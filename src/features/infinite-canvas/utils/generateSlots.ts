import type { CustomEdge, CustomNode } from '../types'

export const GENERATE_NODE_TYPES = ['imageConfig', 'videoConfig'] as const
export type GenerateNodeType = (typeof GENERATE_NODE_TYPES)[number]

export type ReferenceSlotKind = 'image' | 'video' | 'text' | 'audio' | 'effect' | 'unknown'

export interface ReferenceSlot {
  index: number
  edgeId: string
  sourceId: string
  kind: ReferenceSlotKind
  label: string
  thumbUrl?: string
  snippet?: string
  dead: boolean
  role?: string
}

export interface GenerateConnectedInputs {
  prompt: string
  textSnippets: string[]
  refImages: string[]
  firstFrameImage: string
  lastFrameImage: string
  slots: ReferenceSlot[]
}

export function isGenerateNodeType(type?: string | null): type is GenerateNodeType {
  return type === 'imageConfig' || type === 'videoConfig'
}

export function getEdgeSlotOrder(edge: CustomEdge, fallback = 0): number {
  const slotOrder = edge.data?.slotOrder
  if (typeof slotOrder === 'number' && Number.isFinite(slotOrder)) {
    return slotOrder
  }
  const promptOrder = edge.data?.promptOrder
  if (typeof promptOrder === 'number' && Number.isFinite(promptOrder)) {
    return promptOrder
  }
  return fallback
}

export function nextSlotOrder(targetId: string, edges: CustomEdge[]): number {
  const incoming = edges.filter((edge) => edge.target === targetId)
  const maxOrder = incoming.reduce((max, edge, index) => {
    return Math.max(max, getEdgeSlotOrder(edge, index + 1))
  }, 0)
  return maxOrder + 1
}

function asText(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function nodeMediaUrl(node: CustomNode): string {
  return asText(node.data.url) || asText(node.data.base64) || asText(node.data.thumbnail)
}

function classifySource(node?: CustomNode): ReferenceSlotKind {
  if (!node) return 'unknown'
  if (node.type === 'image' || node.type === 'imageConfig') return 'image'
  if (node.type === 'video' || node.type === 'videoConfig') return 'video'
  if (node.type === 'text') return 'text'
  if (node.type === 'audio' || node.type === 'sound') return 'audio'
  if (node.type === 'effectConfig' || node.type === 'templateEffect') return 'effect'
  return 'unknown'
}

function sourceLabel(node: CustomNode | undefined, kind: ReferenceSlotKind): string {
  if (!node) return '已断开'
  const label = asText(node.data.label)
  if (label) return label
  switch (kind) {
    case 'image':
      return '图片'
    case 'video':
      return '视频'
    case 'text':
      return '文本'
    case 'audio':
      return '音频'
    case 'effect':
      return '效果'
    default:
      return '参考'
  }
}

function sourceSnippet(node: CustomNode | undefined, kind: ReferenceSlotKind): string | undefined {
  if (!node) return undefined
  if (kind === 'text') {
    const content = asText(node.data.content) || asText(node.data.value)
    return content.trim() || undefined
  }
  if (kind === 'effect') {
    return [node.data.style, node.data.lighting, node.data.camera, node.data.effect]
      .map((item) => asText(item))
      .filter(Boolean)
      .join('，') || undefined
  }
  return undefined
}

function sourceThumb(node: CustomNode | undefined, kind: ReferenceSlotKind): string | undefined {
  if (!node) return undefined
  if (kind === 'image' || kind === 'video') {
    return nodeMediaUrl(node) || undefined
  }
  return undefined
}

export function getIncomingEdgesInOrder(nodeId: string, edges: CustomEdge[]): CustomEdge[] {
  return edges
    .filter((edge) => edge.target === nodeId)
    .map((edge, index) => ({ edge, index }))
    .sort((left, right) => {
      const orderDiff = getEdgeSlotOrder(left.edge, left.index + 1) - getEdgeSlotOrder(right.edge, right.index + 1)
      return orderDiff !== 0 ? orderDiff : left.index - right.index
    })
    .map(({ edge }) => edge)
}

export function getIncomingReferenceSlots(
  nodeId: string,
  nodes: CustomNode[],
  edges: CustomEdge[]
): ReferenceSlot[] {
  return getIncomingEdgesInOrder(nodeId, edges).map((edge, index) => {
    const sourceNode = nodes.find((node) => node.id === edge.source)
    const kind = classifySource(sourceNode)
    return {
      index: index + 1,
      edgeId: edge.id,
      sourceId: edge.source,
      kind,
      label: sourceLabel(sourceNode, kind),
      thumbUrl: sourceThumb(sourceNode, kind),
      snippet: sourceSnippet(sourceNode, kind),
      dead: !sourceNode,
      role: asText(edge.data?.imageRole) || edge.targetHandle || undefined,
    }
  })
}

function effectSuffixFromParams(params: Record<string, string | undefined>, includeCamera: boolean): string {
  return [
    params.style,
    params.lighting,
    includeCamera ? params.camera : undefined,
    params.effect,
  ]
    .filter(Boolean)
    .join('，')
}

export function collectGenerateInputs(
  nodeId: string,
  nodes: CustomNode[],
  edges: CustomEdge[],
  options: { includeCamera?: boolean; localPrompt?: string; promptSource?: 'bar' | 'merge' } = {}
): GenerateConnectedInputs {
  const slots = getIncomingReferenceSlots(nodeId, nodes, edges)
  const textSnippets: string[] = []
  const refImages: string[] = []
  let firstFrameImage = ''
  let lastFrameImage = ''
  const effectParams: { style?: string; lighting?: string; camera?: string; effect?: string } = {}

  slots.forEach((slot) => {
    if (slot.dead) return
    const sourceNode = nodes.find((node) => node.id === slot.sourceId)
    if (!sourceNode) return

    if (slot.kind === 'text' && slot.snippet) {
      textSnippets.push(slot.snippet)
      return
    }

    if (slot.kind === 'image' || slot.kind === 'video') {
      const mediaUrl = sourceThumb(sourceNode, slot.kind)
      if (!mediaUrl) return

      if (sourceNode.type === 'image') {
        if (slot.role === 'first_frame_image' || slot.role === 'first-frame') {
          firstFrameImage = firstFrameImage || mediaUrl
        } else if (slot.role === 'last_frame_image' || slot.role === 'last-frame') {
          lastFrameImage = lastFrameImage || mediaUrl
        } else if (!firstFrameImage) {
          firstFrameImage = mediaUrl
        }
        if (slot.kind === 'image') {
          refImages.push(mediaUrl)
        }
      } else if (slot.kind === 'image') {
        refImages.push(mediaUrl)
      }
      return
    }

    if (slot.kind === 'effect') {
      if (sourceNode.data.style) effectParams.style = asText(sourceNode.data.style)
      if (sourceNode.data.lighting) effectParams.lighting = asText(sourceNode.data.lighting)
      if (sourceNode.data.camera) effectParams.camera = asText(sourceNode.data.camera)
      if (sourceNode.data.effect) effectParams.effect = asText(sourceNode.data.effect)
    }
  })

  const effectSuffix = effectSuffixFromParams(effectParams, options.includeCamera === true)
  const connectedPrompt = textSnippets.join('\n\n')
  const localPrompt = (options.localPrompt || '').trim()
  // bar：只使用底部输入（含已解析的 @ 提及），不再把连入文本静默拼进 prompt
  const mergedBase =
    options.promptSource === 'bar'
      ? localPrompt
      : [localPrompt, connectedPrompt].filter(Boolean).join('\n\n')
  const prompt = effectSuffix
    ? mergedBase
      ? `${mergedBase}，${effectSuffix}`
      : effectSuffix
    : mergedBase

  return {
    prompt,
    textSnippets,
    refImages,
    firstFrameImage,
    lastFrameImage,
    slots,
  }
}
