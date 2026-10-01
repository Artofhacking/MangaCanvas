import { isI2IModel, UNSUPPORTED_REFERENCE_IMAGE_MESSAGE } from '@/api/aigc'
import { useModelsStore } from '@/store/modelsStore'
import type { CustomEdge, CustomNode } from '../types'
import { useCanvasStore } from '../stores/canvasStore'
import {
  collectGenerateInputs,
  isGenerateNodeType,
  readNodeMediaUrl,
} from './generateSlots'
import {
  listVideoRequestImages,
  resolveImageRequestModel,
  VIDEO_REFERENCE_LIMIT,
} from './generateParams'
import { MEDIA_PREVIEW_DOUBLE_CLICK_MS } from './canvasInteraction'

export const REFERENCE_PICK_BUTTON_LABEL = '+ 参考'
export const REFERENCE_PICK_TOOLTIP = '从当前画布中添加参考'
export const REFERENCE_PICK_EXIT_TOOLTIP = '再次点击或按 Esc 退出'
export const REFERENCE_EMPTY_HINT = '点选或连线后编号，输入 @ 可引用'
export const REFERENCE_PICK_SEND_BLOCKED = '请先退出参考点选'

export const REFERENCE_PICK_VIDEO_MESSAGE = '视频暂不支持作为参考'
export const REFERENCE_PICK_EMPTY_MESSAGE = '该节点还没有画面'
export const REFERENCE_PICK_SELF_MESSAGE = '不能引用当前节点'
export const REFERENCE_PICK_TYPE_MESSAGE = '该类型暂不支持作为参考'
export const REFERENCE_PICK_VIDEO_LIMIT_MESSAGE = `视频参考最多 ${VIDEO_REFERENCE_LIMIT} 张`

export type ReferencePickVisual = 'pickable' | 'connected' | 'blocked'
export type ReferencePickBlock = 'self' | 'limit' | 'type' | 'no-media' | 'video'

export interface ReferencePickAssessment {
  visual: ReferencePickVisual
  block?: ReferencePickBlock
  /** Toast and on-canvas reason. Empty when the click can add a reference. */
  message?: string
  chip: string
}

export type ReferencePickClickResult =
  | { action: 'added' }
  | { action: 'removed' }
  | { action: 'blocked'; message: string }
  | { action: 'ignored' }

const IMAGE_SOURCE_TYPES = new Set(['image', 'imageConfig'])
const VIDEO_SOURCE_TYPES = new Set(['video', 'videoConfig'])

function isImageSource(node: CustomNode): boolean {
  return IMAGE_SOURCE_TYPES.has(node.type)
}

function isVideoSource(node: CustomNode): boolean {
  return VIDEO_SOURCE_TYPES.has(node.type)
}

function incomingEdge(sourceId: string, targetId: string, edges: CustomEdge[]): CustomEdge | undefined {
  return edges.find((edge) => edge.source === sourceId && edge.target === targetId)
}

/**
 * How many image URLs this generate node can accept.
 * Video stays at `VIDEO_REFERENCE_LIMIT`. i2i models keep every connected URL.
 * Models that reject reference images have a capacity of 0, so the pick stops here.
 */
export function referencePickCapacity(
  target: CustomNode,
  attachedImageCount: number,
  liveImageModelIds: readonly string[] = []
): number {
  if (target.type === 'videoConfig') return VIDEO_REFERENCE_LIMIT
  if (target.type !== 'imageConfig') return 0
  const modelKey = typeof target.data.model === 'string' && target.data.model
    ? target.data.model
    : 'gpt-image-2'
  const routed = resolveImageRequestModel(modelKey, attachedImageCount + 1, liveImageModelIds)
  return isI2IModel(routed) ? Number.POSITIVE_INFINITY : 0
}

function videoPickWouldDrop(targetId: string, nodes: CustomNode[], edges: CustomEdge[], sourceUrl: string): boolean {
  const inputs = collectGenerateInputs(targetId, nodes, edges)
  const current = listVideoRequestImages(inputs.firstFrameImage, inputs.refImages)
  if (!sourceUrl || current.includes(sourceUrl)) return false
  if (current.length >= VIDEO_REFERENCE_LIMIT) return true
  const next = listVideoRequestImages(inputs.firstFrameImage, [...inputs.refImages, sourceUrl])
  return !next.includes(sourceUrl)
}

export function assessReferencePick(input: {
  source: CustomNode
  target: CustomNode
  nodes: CustomNode[]
  edges: CustomEdge[]
  liveImageModelIds?: readonly string[]
}): ReferencePickAssessment {
  const { source, target, nodes, edges } = input
  const liveImageModelIds = input.liveImageModelIds || []

  if (source.id === target.id) {
    return {
      visual: 'blocked',
      block: 'self',
      message: REFERENCE_PICK_SELF_MESSAGE,
      chip: '当前节点',
    }
  }

  if (incomingEdge(source.id, target.id, edges)) {
    return {
      visual: 'connected',
      chip: '已参考 · 点击断开',
    }
  }

  if (isVideoSource(source)) {
    return {
      visual: 'blocked',
      block: 'video',
      message: REFERENCE_PICK_VIDEO_MESSAGE,
      chip: REFERENCE_PICK_VIDEO_MESSAGE,
    }
  }

  if (!isImageSource(source)) {
    return {
      visual: 'blocked',
      block: 'type',
      message: REFERENCE_PICK_TYPE_MESSAGE,
      chip: REFERENCE_PICK_TYPE_MESSAGE,
    }
  }

  const mediaUrl = readNodeMediaUrl(source)
  if (!mediaUrl) {
    return {
      visual: 'blocked',
      block: 'no-media',
      message: REFERENCE_PICK_EMPTY_MESSAGE,
      chip: REFERENCE_PICK_EMPTY_MESSAGE,
    }
  }

  const inputs = collectGenerateInputs(target.id, nodes, edges)
  const capacity = referencePickCapacity(target, inputs.refImages.length, liveImageModelIds)
  if (capacity === 0) {
    return {
      visual: 'blocked',
      block: 'limit',
      message: UNSUPPORTED_REFERENCE_IMAGE_MESSAGE,
      chip: '当前模型不支持参考图',
    }
  }

  if (target.type === 'videoConfig' && videoPickWouldDrop(target.id, nodes, edges, mediaUrl)) {
    return {
      visual: 'blocked',
      block: 'limit',
      message: REFERENCE_PICK_VIDEO_LIMIT_MESSAGE,
      chip: REFERENCE_PICK_VIDEO_LIMIT_MESSAGE,
    }
  }

  return {
    visual: 'pickable',
    chip: '点击添加参考',
  }
}

export function withReferencePickClasses<T extends CustomNode>(
  nodes: T[],
  edges: CustomEdge[],
  targetId: string | null,
  liveImageModelIds: readonly string[] = []
): T[] {
  if (!targetId) return nodes
  const target = nodes.find((node) => node.id === targetId)
  if (!target || !isGenerateNodeType(target.type)) return nodes
  return nodes.map((node) => {
    const assessment = assessReferencePick({
      source: node,
      target,
      nodes,
      edges,
      liveImageModelIds,
    })
    const pickClass = `reference-pick-${assessment.visual}`
    const previous = typeof (node as { className?: string }).className === 'string'
      ? (node as { className?: string }).className
      : ''
    const className = [previous, pickClass].filter(Boolean).join(' ')
    if (className === previous) return node
    return { ...node, className }
  })
}

function readLiveImageModelIds(): string[] {
  return useModelsStore.getState().getModelsByModality('image').map((model) => model.id)
}

/**
 * Same edge as a drag onto the generate node (`onConnect`: slotOrder, imageRole).
 * A second click on an already connected source removes that edge.
 */
export function applyReferencePickClick(sourceId: string): ReferencePickClickResult {
  const state = useCanvasStore.getState()
  const targetId = state.referencePickTargetId
  if (!targetId) return { action: 'ignored' }

  const source = state.nodes.find((node) => node.id === sourceId)
  const target = state.nodes.find((node) => node.id === targetId)
  if (!source || !target || !isGenerateNodeType(target.type)) return { action: 'ignored' }

  const assessment = assessReferencePick({
    source,
    target,
    nodes: state.nodes,
    edges: state.edges,
    liveImageModelIds: readLiveImageModelIds(),
  })

  const keepTargetSelected = () => {
    const latest = useCanvasStore.getState()
    const current = latest.nodes.find((node) => node.id === targetId)
    if (current && !current.selected) latest.selectNode(targetId)
  }

  if (assessment.visual === 'connected') {
    const edge = incomingEdge(sourceId, targetId, state.edges)
    if (!edge) return { action: 'ignored' }
    state.onEdgesChange([{ id: edge.id, type: 'remove' }])
    useCanvasStore.getState().saveHistory()
    keepTargetSelected()
    return { action: 'removed' }
  }

  if (assessment.visual !== 'pickable') {
    keepTargetSelected()
    return { action: 'blocked', message: assessment.message || REFERENCE_PICK_TYPE_MESSAGE }
  }

  state.onConnect({
    source: sourceId,
    target: targetId,
    sourceHandle: null,
    targetHandle: null,
  })
  keepTargetSelected()
  return { action: 'added' }
}

let lastPickClick: { sourceId: string; at: number } | null = null

/** Ignore the rest of a double-click so the second press does not undo the first. */
export function noteReferencePickClick(sourceId: string, now = Date.now()): boolean {
  if (
    lastPickClick &&
    lastPickClick.sourceId === sourceId &&
    now - lastPickClick.at <= MEDIA_PREVIEW_DOUBLE_CLICK_MS
  ) {
    return true
  }
  lastPickClick = { sourceId, at: now }
  return false
}

export function resetReferencePickClickGuard(): void {
  lastPickClick = null
}

export function isReferencePickActive(): boolean {
  return useCanvasStore.getState().referencePickTargetId != null
}
