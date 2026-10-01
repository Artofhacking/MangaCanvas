/**
 * User-facing copy for upstream image / video / audio failures.
 * The API message may embed a raw JSON body; the toast and node overlay must not.
 */

export const FIRST_FRAME_RATIO_HINT =
  '图生视频时输出比例需与首帧图一致，请改成与参考图相同的比例，或不选手动比例后重试。'

const GENERIC_HINT = '请检查参数后重试。'

const ERROR_PREFIXES = [
  '视频任务提交失败',
  '查询视频任务失败',
  '音频任务提交失败',
  '生成任务提交失败',
  '查询生成任务失败',
  '视频生成失败',
  '音频生成失败',
  '图片生成失败',
  '生成任务失败',
  '剧本解析失败',
  '生成失败',
]

interface UpstreamErrorFields {
  code: string
  type: string
  message: string
  param: string
}

const EMPTY_FIELDS: UpstreamErrorFields = { code: '', type: '', message: '', param: '' }

function rawText(error: unknown): string {
  if (typeof error === 'string') return error.trim()
  if (error instanceof Error) return error.message.trim()
  return ''
}

function cjkCount(text: string): number {
  return (text.match(/[\u3400-\u9fff]/g) || []).length
}

function isMostlyChinese(text: string): boolean {
  const cjk = cjkCount(text)
  if (cjk < 2) return false
  const latin = (text.match(/[A-Za-z]/g) || []).length
  return cjk >= latin
}

function isFriendly(text: string): boolean {
  if (!text || text.length > 180) return false
  if (/[{}[\]]/.test(text)) return false
  if (/request_id|submitted_request|InvalidParameter|BadRequest|TaskTypeConstraint/i.test(text)) return false
  return isMostlyChinese(text)
}

function splitPrefix(raw: string): { prefix: string; rest: string } {
  for (const prefix of ERROR_PREFIXES) {
    if (!raw.startsWith(prefix)) continue
    return { prefix, rest: raw.slice(prefix.length).replace(/^[:：\s]+/, '') }
  }
  return { prefix: '', rest: raw }
}

function unescapeJsonString(value: string): string {
  return value.replace(/\\"/g, '"').replace(/\\n/g, ' ').replace(/\\\\/g, '\\')
}

function matchJsonString(text: string, key: string): string {
  const matched = text.match(new RegExp(`"${key}"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"`))
  if (matched) return unescapeJsonString(matched[1]).trim()
  const quoted = text.match(new RegExp(`'${key}'\\s*:\\s*'((?:\\\\'|[^'])*)'`))
  return quoted ? quoted[1].replace(/\\'/g, "'").trim() : ''
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function textField(record: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return ''
}

function readErrorFields(value: unknown, depth = 0): UpstreamErrorFields {
  if (depth > 4 || value == null) return { ...EMPTY_FIELDS }
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        return readErrorFields(JSON.parse(trimmed), depth + 1)
      } catch {
        return { ...EMPTY_FIELDS, message: trimmed }
      }
    }
    return { ...EMPTY_FIELDS, message: trimmed }
  }
  const record = asRecord(value)
  if (!record) return { ...EMPTY_FIELDS }
  const nested = readErrorFields(record.error ?? record.data, depth + 1)
  const code = textField(record, ['code', 'err_code', 'error_code']) || nested.code
  const type = textField(record, ['type']) || nested.type
  const param = textField(record, ['param']) || nested.param
  let message = textField(record, ['message', 'msg', 'fail_reason'])
  if (!message || message.startsWith('{') || message.startsWith('[')) {
    message = nested.message || (message.startsWith('{') || message.startsWith('[') ? '' : message)
  }
  return { code, type, param, message }
}

function extractFields(text: string): UpstreamErrorFields {
  const jsonStart = text.search(/[{[]/)
  if (jsonStart < 0) return { ...EMPTY_FIELDS, message: text.trim() }
  const source = text.slice(jsonStart)
  try {
    const parsed = readErrorFields(JSON.parse(source))
    if (parsed.code || parsed.message || parsed.type) return parsed
  } catch {
    // Truncated upstream bodies still carry code and message near the front.
  }
  return {
    code: matchJsonString(source, 'code'),
    type: matchJsonString(source, 'type'),
    param: matchJsonString(source, 'param'),
    message: matchJsonString(source, 'message'),
  }
}

function mentionsRatio(fields: UpstreamErrorFields): boolean {
  const blob = `${fields.param} ${fields.message}`
  return /\bratio\b|aspect/i.test(blob) || /比例|宽高比/.test(blob)
}

function mentionsFirstFrame(fields: UpstreamErrorFields): boolean {
  return /first[\s_-]*last[\s_-]*frame|first[\s_-]*frame/i.test(fields.message) || /首帧|首尾帧/.test(fields.message)
}

function isTaskTypeConstraint(fields: UpstreamErrorFields): boolean {
  return /TaskTypeConstraint/i.test(fields.code)
}

function looksInvalid(fields: UpstreamErrorFields): boolean {
  const blob = `${fields.code} ${fields.type} ${fields.message}`
  return /invalid|not valid|not support|unsupported|bad\s*request|非法|无效|不支持/i.test(blob)
}

function isInvalidParameter(fields: UpstreamErrorFields): boolean {
  return /InvalidParameter/i.test(fields.code) || /BadRequest/i.test(fields.type) || /BadRequest/i.test(fields.code)
}

function paraphrase(fields: UpstreamErrorFields): string | null {
  const blob = `${fields.code} ${fields.type} ${fields.param} ${fields.message}`
  if (/inappropriate|data[\s_-]*inspection|moderation|safety|nsfw|违规|审核/i.test(blob)) {
    return '内容未通过审核，请修改提示词或参考图后重试。'
  }
  if (/quota|insufficient|balance|arrearage|余额|额度/i.test(blob)) {
    return '账户额度不足，请检查余额后重试。'
  }
  if (/rate limit|too many requests|throttl|过于频繁/i.test(blob)) {
    return '请求过于频繁，请稍后重试。'
  }
  if (/duration|seconds/i.test(blob) && /invalid|must|between|range|support|不支持|超出/i.test(blob)) {
    return '时长不在该模型支持范围内，请调整后重试。'
  }
  if (/resolution|\bsize\b|width|height|尺寸|分辨率/i.test(blob) && looksInvalid(fields)) {
    return '分辨率或尺寸不被该模型支持，请调整后重试。'
  }
  if (/prompt/i.test(blob) && /required|empty|missing|缺少|为空/i.test(blob)) {
    return '请补充提示词后再试。'
  }
  if (/image|first[\s_-]*frame|参考图|首帧/i.test(blob) && /required|missing|empty|缺少|为空/i.test(blob)) {
    return '请提供可用的参考图后再试。'
  }
  if (/model/i.test(blob) && /not found|invalid|unsupported|does not exist|未知|不可用/i.test(blob)) {
    return '当前模型不可用，请更换模型后重试。'
  }
  if (/timed?\s*out|timeout/i.test(blob)) {
    return '生成超时，请稍后重试。'
  }
  return null
}

function clipChinese(text: string): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (clean.length <= 80) return /[。！？…]$/.test(clean) ? clean : `${clean}。`
  const cut = clean.slice(0, 80)
  const stop = Math.max(cut.lastIndexOf('。'), cut.lastIndexOf('，'))
  const base = (stop > 20 ? cut.slice(0, stop) : cut).replace(/[，,]$/, '')
  return `${base}…`
}

function guidanceFor(fields: UpstreamErrorFields): { text: string; specific: boolean } | null {
  if ((isTaskTypeConstraint(fields) || mentionsFirstFrame(fields)) && mentionsRatio(fields) && mentionsFirstFrame(fields)) {
    return { text: FIRST_FRAME_RATIO_HINT, specific: true }
  }
  if (mentionsRatio(fields) && looksInvalid(fields) && !mentionsFirstFrame(fields)) {
    return { text: '输出比例无效，请换成该模型支持的比例后重试。', specific: true }
  }
  const paraphrased = paraphrase(fields)
  if (paraphrased) return { text: paraphrased, specific: true }
  if (isInvalidParameter(fields)) {
    if (fields.message && isMostlyChinese(fields.message) && !/[{}[\]]/.test(fields.message)) {
      return { text: clipChinese(fields.message), specific: true }
    }
    return { text: '参数不符合要求，请调整后重试。', specific: true }
  }
  if (fields.message && isMostlyChinese(fields.message) && !/[{}[\]]/.test(fields.message)) {
    return { text: clipChinese(fields.message), specific: true }
  }
  return null
}

function withPrefix(prefix: string, summary: string): string {
  const body = /[。！？…]$/.test(summary) ? summary : `${summary}。`
  if (!prefix) return body
  if (body.startsWith(prefix)) return body
  return `${prefix}。${body}`
}

function formatRaw(raw: string, fallback: string): string {
  const text = raw.trim()
  if (!text) return fallback
  if (text === 'API_RATE_LIMIT') return text
  if (isFriendly(text)) return text

  const { prefix, rest } = splitPrefix(text)
  const fields = extractFields(rest)
  const guidance = guidanceFor(fields)
  const summary = guidance?.text || GENERIC_HINT
  if (prefix) return withPrefix(prefix, summary)
  if (guidance?.specific) return withPrefix('', summary)
  if (fallback && fallback !== '生成失败' && isFriendly(fallback)) return withPrefix(fallback.replace(/[。！？…]+$/g, ''), summary)
  return withPrefix('', summary)
}

export function formatAiError(error: unknown, fallback = '生成失败'): string {
  return formatRaw(rawText(error), fallback)
}
