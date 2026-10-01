import { describe, expect, it } from 'vitest'
import { FIRST_FRAME_RATIO_HINT, formatAiError } from './formatAiError'

const FIRST_FRAME_PAYLOAD = [
  '视频任务提交失败: {"error":{"code":"InvalidParameter.TaskTypeConstraint","message":"The parameter ratio specified in the request is not valid. For first-frame or first-last-frame generation, the output ratio follows the first-frame image.","param":"","type":"BadRequest"},',
  '"id":"02179087016233446c140470d092c1c2bed457a462426b2f73c29","request_id":"02179087016233446c140470d092c1c2bed457a462426b2f73c29",',
  '"submitted_request":"02179087016233446c140470d092c1c2bed457a462426b2f73c29","content":[{"text":"输入图片说明：@1 是雾峡巨石阵战斗场景全能参考"}]}',
].join('')

describe('formatAiError', () => {
  it('maps Seedance first-frame ratio constraints to a short Chinese hint', () => {
    const text = formatAiError(FIRST_FRAME_PAYLOAD, '视频生成失败')
    expect(text.startsWith('视频任务提交失败')).toBe(true)
    expect(text).toContain(FIRST_FRAME_RATIO_HINT)
    expect(text).not.toContain('{')
    expect(text).not.toContain('InvalidParameter')
    expect(text).not.toContain('request_id')
    expect(text).not.toContain('雾峡')
    expect(text).not.toContain('first-frame')
  })

  it('maps the same constraint from a plain upstream sentence', () => {
    const text = formatAiError(
      '视频生成失败: The parameter ratio specified in the request is not valid. For first-frame or first-last-frame generation, the output ratio follows the first-frame image.'
    )
    expect(text).toContain(FIRST_FRAME_RATIO_HINT)
    expect(text.startsWith('视频生成失败')).toBe(true)
    expect(text).not.toContain('ratio')
  })

  it('still maps the constraint when the JSON body is truncated', () => {
    const truncated = `${FIRST_FRAME_PAYLOAD.slice(0, 280)}…`
    const text = formatAiError(truncated)
    expect(text).toContain(FIRST_FRAME_RATIO_HINT)
    expect(text).not.toContain('{')
  })

  it('maps a general invalid ratio without dumping JSON', () => {
    const text = formatAiError(
      '视频生成失败: {"error":{"code":"InvalidParameter","message":"aspect ratio is not valid","type":"BadRequest"}}'
    )
    expect(text).toBe('视频生成失败。输出比例无效，请换成该模型支持的比例后重试。')
  })

  it('paraphrases readable InvalidParameter constraints', () => {
    expect(
      formatAiError('生成任务提交失败: {"code":"InvalidParameter","message":"The size is not supported","type":"BadRequest"}')
    ).toBe('生成任务提交失败。分辨率或尺寸不被该模型支持，请调整后重试。')
    expect(
      formatAiError('视频生成失败: {"error":{"code":"InvalidParameter","message":"duration must be between 4 and 15"}}')
    ).toBe('视频生成失败。时长不在该模型支持范围内，请调整后重试。')
    expect(
      formatAiError('{"code":"DataInspectionFailed","message":"Input data may contain inappropriate content."}')
    ).toBe('内容未通过审核，请修改提示词或参考图后重试。')
  })

  it('keeps the submit prefix and a short Chinese sentence for unknown JSON', () => {
    const text = formatAiError(
      '视频任务提交失败: {"error":{"code":"MysteryFailure","message":"upstream exploded","request_id":"abc"},"content":[{"text":"用户提示词原文"}]}'
    )
    expect(text).toBe('视频任务提交失败。请检查参数后重试。')
    expect(text).not.toContain('{')
    expect(text).not.toContain('用户提示词')
    expect(text).not.toContain('upstream')
  })

  it('uses a generic Chinese sentence when the body has no error code', () => {
    const text = formatAiError('音频任务提交失败: {"foo":1,"request_id":"abc"}', '音频生成失败')
    expect(text).toBe('音频任务提交失败。请检查参数后重试。')
    expect(text).not.toContain('{')
  })

  it('leaves short Chinese messages and rate-limit markers unchanged', () => {
    expect(formatAiError('上游拒绝')).toBe('上游拒绝')
    expect(formatAiError('已取消')).toBe('已取消')
    expect(formatAiError('API_RATE_LIMIT')).toBe('API_RATE_LIMIT')
    expect(formatAiError(formatAiError(FIRST_FRAME_PAYLOAD))).toBe(formatAiError(FIRST_FRAME_PAYLOAD))
  })

  it('reads an Error instance', () => {
    const text = formatAiError(new Error(FIRST_FRAME_PAYLOAD))
    expect(text).toContain(FIRST_FRAME_RATIO_HINT)
  })
})
