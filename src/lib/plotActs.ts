import { dominantAssetNode, isMissingMediaUrl } from './assetSeed'
import { mentionizePlot, mentionedAssets, plotNeedsMentions, seedNodeId, type PlotAsset } from './plotMentions'
import type { CanvasGraph, OpenWorkflowOptions, WorkflowSeedAsset } from './workflows'

const CN_ACT_INDEX = '一二三四五六七八九十'
export const VIDEO_ACT_SECONDS = 5
const SPEECH_CHARS_PER_SECOND = 4.5
const ACTION_LINE_SECONDS = 1.2
const MAX_SPOKEN_SENTENCE = 22
const MAX_ACTS = 80
const ACT_COLS = 5
const ACT_DX = 400
const ACT_DY = 560

const ACT_HEADING =
  /(?:^|\n)[ \t]*(?:#{1,3}[ \t]*)?(场景[0-9一二三四五六七八九十百]+[^\n]*|第[0-9一二三四五六七八九十百]+[场幕][^\n]*)/g
const DIALOGUE_UNIT = /^([A-Za-z0-9_\u4e00-\u9fff]{1,12}[^\n：:]{0,40}[：:])(.*)$/

export type PlotAct = {
  index: number
  name: string
  heading: string
  summary: string
}

export function stripScriptPreamble(text: string) {
  let next = (text || '').replace(/^剧名[：:].*\n?/gm, '')
  next = next.replace(
    /^人物[：:][\s\S]*?(?=^场景|^第[0-9一二三四五六七八九十]+[场幕集]|^地点|^内景|^外景)/m,
    ''
  )
  if (!/^(?:场景|第[0-9一二三四五六七八九十]+[场幕])/m.test(next)) {
    next = next.replace(/^人物[：:][\s\S]*/m, '')
  }
  return next.trim()
}

function placeFromHeading(heading: string) {
  return heading
    .replace(/^场景[0-9一二三四五六七八九十百]+[：:\s]*/, '')
    .replace(/^第[0-9一二三四五六七八九十百]+[场幕]\s*/, '')
    .replace(/^[：:\s]+/, '')
    .trim()
}

function actLabel(index: number, heading: string) {
  const numeral = CN_ACT_INDEX[index] || String(index + 1)
  const place = placeFromHeading(heading)
  return place ? `第${numeral}幕 · ${place}` : `第${numeral}幕`
}

function spokenLen(text: string) {
  return (text || '').replace(/\s+/g, '').length
}

function isFillerSpeech(text: string) {
  return !(text || '').replace(/[\s。！？!?…·\-—,.，、；;]+/g, '')
}

function splitSpoken(speech: string) {
  const chunks = (speech || '').split(/(?<=[。！？])/).map((part) => part.trim()).filter(Boolean)
  const out: string[] = []
  for (const chunk of chunks) {
    if (spokenLen(chunk) <= MAX_SPOKEN_SENTENCE) {
      if (!isFillerSpeech(chunk)) out.push(chunk)
      continue
    }
    const pieces = chunk.split(/(?<=[，、；,;])/).map((part) => part.trim()).filter(Boolean)
    let buf = ''
    for (const piece of pieces.length ? pieces : [chunk]) {
      if (buf && spokenLen(buf + piece) > MAX_SPOKEN_SENTENCE) {
        if (!isFillerSpeech(buf)) out.push(buf)
        buf = piece
      } else {
        buf += piece
      }
    }
    if (buf && !isFillerSpeech(buf)) out.push(buf)
  }
  return out
}

export function explodeScriptUnits(body: string) {
  const units: string[] = []
  for (const raw of (body || '').split(/\n+/)) {
    const line = raw.trim()
    if (!line) continue
    const match = line.match(DIALOGUE_UNIT)
    if (!match) {
      units.push(line)
      continue
    }
    const spoken = splitSpoken(match[2] || '')
    if (!spoken.length) {
      units.push(line)
      continue
    }
    spoken.forEach((part) => units.push(`${match[1]}${part}`))
  }
  return units
}

export function estimateActSeconds(text: string) {
  const units = explodeScriptUnits(text)
  const list = units.length ? units : (text || '').trim() ? [(text || '').trim()] : []
  let seconds = 0
  for (const unit of list) {
    const match = unit.match(DIALOGUE_UNIT)
    if (!match) {
      seconds += ACTION_LINE_SECONDS
      continue
    }
    seconds += spokenLen(match[2] || '') / SPEECH_CHARS_PER_SECOND
  }
  return seconds
}

export function packVideoBeats(body: string) {
  const units = explodeScriptUnits(body)
  if (!units.length) return (body || '').trim() ? [(body || '').trim()] : []
  const beats: string[] = []
  let current: string[] = []
  let cost = 0
  for (const unit of units) {
    const unitCost = estimateActSeconds(unit)
    if (current.length && cost + unitCost > VIDEO_ACT_SECONDS) {
      beats.push(current.join('\n'))
      current = [unit]
      cost = unitCost
    } else {
      current.push(unit)
      cost += unitCost
    }
  }
  if (current.length) beats.push(current.join('\n'))
  return beats
}

export function splitPlotActs(sourceText: string): PlotAct[] {
  const text = stripScriptPreamble(sourceText)
  if (!text) return []
  const headingRe = new RegExp(ACT_HEADING.source, 'g')
  const matches = [...text.matchAll(headingRe)]
  const scenes: Array<{ heading: string; body: string }> = []
  if (!matches.length) {
    scenes.push({ heading: '', body: text })
  } else {
    matches.forEach((match, index) => {
      const heading = (match[1] || '').trim()
      const start = (match.index || 0) + match[0].length
      const end = index + 1 < matches.length ? matches[index + 1].index || text.length : text.length
      const body = text.slice(start, end).trim()
      if (heading || body) scenes.push({ heading, body })
    })
  }
  const acts: PlotAct[] = []
  scenes.forEach((scene) => {
    const beats = packVideoBeats(scene.body)
    ;(beats.length ? beats : [scene.body]).forEach((beat) => {
      const summary = (beat || '').trim()
      if (!scene.heading && !summary) return
      acts.push({
        index: acts.length + 1,
        name: actLabel(acts.length, scene.heading),
        heading: scene.heading,
        summary,
      })
    })
  })
  return acts.slice(0, MAX_ACTS)
}

export function actSpeakers(actText: string, characterNames: string[]) {
  const found: string[] = []
  const seen = new Set<string>()
  for (const name of characterNames) {
    const key = (name || '').trim()
    if (!key || seen.has(key)) continue
    const pattern = new RegExp(`^\\s*@?${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'm')
    if (pattern.test(actText || '')) {
      seen.add(key)
      found.push(key)
    }
  }
  return found
}

export function actCast(actText: string, characterNames: string[]) {
  const speakers = actSpeakers(actText, characterNames)
  if (speakers.length) return speakers
  return characterNames.filter((name) => name && actText.includes(name))
}

export function isLegacyEpisodeCanvas(canvas?: { nodes?: Array<{ id?: string; type?: string }> } | null) {
  const nodes = canvas?.nodes || []
  if (!nodes.length) return true
  if (nodes.some((node) => String(node.id || '').startsWith('act_'))) return false
  return nodes.every((node) => {
    const id = String(node.id || '')
    return id.startsWith('seed_')
  })
}

export function hasGeneratedCanvasWork(canvas?: { nodes?: Array<{ id?: string; type?: string }> } | null) {
  return (canvas?.nodes || []).some((node) => {
    const type = node.type || ''
    const id = String(node.id || '')
    if (type === 'video' || type === 'videoConfig' || type === 'imageConfig' || type === 'effectConfig' || type === 'templateEffect') {
      return true
    }
    return type === 'image' && !id.startsWith('seed_')
  })
}

export function shouldRebuildEpisodeCanvas(
  canvas?: {
    nodes?: Array<{ id?: string; type?: string; data?: { content?: string; value?: string; label?: string; url?: string; sourceType?: string; sourceAssetId?: string } }>
  } | null
) {
  if (isLegacyEpisodeCanvas(canvas)) return true
  const nodes = canvas?.nodes || []
  const acts = nodes.filter((node) => String(node.id || '').startsWith('act_') && node.type === 'text')
  if (!acts.length) return true
  if (hasGeneratedCanvasWork(canvas)) return false
  if (nodes.some((node) => String(node.id || '').startsWith('seed_') && node.type === 'image' && isMissingMediaUrl(node.data?.url))) {
    return true
  }
  if (acts.some((node) => estimateActSeconds(String(node.data?.content || node.data?.value || '')) > VIDEO_ACT_SECONDS + 0.25)) {
    return true
  }
  const assets: PlotAsset[] = nodes.flatMap((node) => {
    const id = Number(node.data?.sourceAssetId)
    const name = String(node.data?.label || '')
    const category = node.data?.sourceType
    if (!id || !name || (category !== 'character' && category !== 'scene' && category !== 'object')) return []
    return [{ id, name, category }]
  })
  if (!assets.length) return false
  return acts.some((node) => plotNeedsMentions(String(node.data?.content || node.data?.value || ''), assets))
}

export function buildEpisodePlotCanvas(options: OpenWorkflowOptions): CanvasGraph {
  const characters = (options.relatedAssets || []).filter((item) => item.category === 'character')
  const scenes = (options.relatedAssets || []).filter((item) => item.category === 'scene')
  const objects = (options.relatedAssets || []).filter((item) => item.category === 'object')
  const assets: PlotAsset[] = [...characters, ...scenes, ...objects]
  const acts = splitPlotActs(options.seedPrompt || '')
  const nodes: CanvasGraph['nodes'] = []
  const edges: CanvasGraph['edges'] = []

  let characterRow = 0
  characters.forEach((character) => {
    const node = placeAssetNode(nodes, character, { x: 40, y: 48 + characterRow * 320 })
    if (node) characterRow += 1
  })
  let objectRow = 0
  objects.forEach((object) => {
    const node = placeAssetNode(nodes, object, { x: 40, y: 48 + characterRow * 320 + objectRow * 260 })
    if (node) objectRow += 1
  })

  const plotActs = acts.length ? acts : [{ index: 1, name: '第一幕', heading: '', summary: (options.seedPrompt || '').trim() }]
  plotActs.forEach((act, index) => {
    const actId = `act_${act.index}`
    const actX = 380 + (index % ACT_COLS) * ACT_DX
    const actY = 72 + Math.floor(index / ACT_COLS) * ACT_DY
    const summary = mentionizePlot(act.summary, assets)
    const label = mentionizePlot(act.name, assets)
    nodes.push({
      id: actId,
      type: 'text',
      position: { x: actX, y: actY },
      data: { label, content: summary },
    })
    if (index > 0) {
      edges.push({ id: `act_seq_${index}`, source: `act_${plotActs[index - 1].index}`, target: actId })
    }
    mentionedAssets(summary, assets).forEach((asset) => {
      const nodeId = seedNodeId(asset)
      const position = asset.category === 'scene' ? { x: actX, y: actY + 358 } : { x: 40, y: 48 }
      if (!placeAssetNode(nodes, asset, position)) return
      if (asset.category === 'scene') {
        edges.push({ id: `act_${act.index}_${asset.category}_${asset.id}`, source: actId, target: nodeId })
        return
      }
      edges.push({
        id: `${asset.category}_${asset.id}_act_${act.index}`,
        source: nodeId,
        target: actId,
      })
    })
    const scene = matchSceneAsset({ ...act, summary, name: label }, scenes)
    if (scene) {
      const sceneId = seedNodeId(scene)
      if (!placeAssetNode(nodes, scene, { x: actX, y: actY + 358 })) return
      if (!edges.some((edge) => edge.id === `act_${act.index}_scene_${scene.id}`)) {
        edges.push({ id: `act_${act.index}_scene_${scene.id}`, source: actId, target: sceneId })
      }
    }
  })

  return {
    nodes,
    edges,
    viewport: { x: 24, y: 16, zoom: 0.72 },
  }
}

function placeAssetNode(
  nodes: CanvasGraph['nodes'],
  asset: WorkflowSeedAsset | PlotAsset,
  position: { x: number; y: number },
) {
  const id = seedNodeId(asset)
  const existing = nodes.find((node) => node.id === id)
  if (existing) return existing
  const node = dominantAssetNode(
    asset,
    position,
    id,
    {
      sourceType: asset.category,
      sourceAssetId: String(asset.id),
    },
  )
  if (!node) return null
  nodes.push(node)
  return node
}

function matchSceneAsset(act: PlotAct, scenes: WorkflowSeedAsset[]) {
  const haystack = `${act.heading} ${act.name} ${act.summary.slice(0, 80)}`
  return scenes.find((scene) => scene.name && haystack.includes(scene.name))
}
