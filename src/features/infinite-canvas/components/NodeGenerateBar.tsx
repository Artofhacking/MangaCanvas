import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useStore, type Node as RFNode } from 'reactflow'
import {
  ArrowUp,
  Check,
  ChevronDown,
  Clapperboard,
  FileText,
  ImagePlus,
  Loader2,
  Music2,
  Sparkles,
  Tag,
  Users,
  Video,
} from 'lucide-react'
import { message } from 'antd'
import { useCanvasStore } from '../stores/canvasStore'
import { IMAGE_MODELS, VIDEO_MODELS, filterLiveModels, remapVideoModel } from '../config/models'
import { useImageModels, useVideoModels } from '../hooks/useModels'
import { useNodeGenerateAction } from '../hooks/useNodeGenerateAction'
import {
  getIncomingReferenceSlots,
  isGenerateNodeType,
  type ReferenceSlot,
} from '../utils/generateSlots'
import {
  ASPECT_RATIOS,
  applyImageRatio,
  applyModelDefaults,
  applyVideoRatio,
  applyVideoResolution,
  coerceGenerateParams,
  formatParamStub,
  getSizeRatio,
  listImageSizes,
  listVideoResolutions,
  parseVideoSize,
} from '../utils/generateParams'
import { reconcilePromptMentions, type SlotRef } from '../utils/promptMentions'
import { isT2VModel } from '@/api/aigc'
import type { CustomNode, ModelConfig } from '../types'
import MentionPromptInput, { type MentionPromptInputHandle } from './MentionPromptInput'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

const BAR_WIDTH = 560
const BAR_GAP = 6
const BAR_ESTIMATED_HEIGHT = 176
const CAPABILITY_CHIPS = [
  { id: 'mark', label: '标记', icon: Tag },
  { id: 'fx', label: '特效', icon: Sparkles },
  { id: 'cast', label: '角色库', icon: Users },
  { id: 'camera', label: '运镜', icon: Clapperboard },
] as const

interface GenerateBarAnchor {
  id: string
  left: number
  top: number
  width: number
  height: number
}

function useSelectedGenerateNodeId(): string | null {
  return useCanvasStore((state) => {
    const selected = state.nodes.filter(
      (node) => isGenerateNodeType(node.type) && Boolean((node as unknown as RFNode).selected)
    )
    return selected.length === 1 ? selected[0].id : null
  })
}

function useGenerateBarAnchor(nodeId: string | null): GenerateBarAnchor | null {
  return useStore((state) => {
    if (!nodeId) return null
    const node = state.nodeInternals.get(nodeId) as
      | (RFNode & { measured?: { width?: number; height?: number } })
      | undefined
    if (!node) return null
    const [translateX, translateY, zoom] = state.transform
    const abs = node.positionAbsolute ?? node.position
    const width = node.width ?? node.measured?.width ?? 320
    const height = node.height ?? node.measured?.height ?? 220
    return {
      id: nodeId,
      left: abs.x * zoom + translateX,
      top: abs.y * zoom + translateY,
      width: width * zoom,
      height: height * zoom,
    }
  })
}

function AspectRatioPills({
  selected,
  supported,
  onChange,
}: {
  selected: string
  supported?: (ratio: string) => boolean
  onChange: (ratio: string) => void
}) {
  return (
    <div className="flex gap-1">
      {ASPECT_RATIOS.map((ratio) => {
        const enabled = supported ? supported(ratio) : true
        const active = selected === ratio
        const icon =
          ratio === '16:9' ? { w: 16, h: 9 }
            : ratio === '9:16' ? { w: 9, h: 16 }
              : ratio === '4:3' ? { w: 14, h: 10 }
                : ratio === '3:4' ? { w: 10, h: 14 }
                  : { w: 12, h: 12 }
        return (
          <button
            key={ratio}
            type="button"
            disabled={!enabled}
            onClick={() => enabled && onChange(ratio)}
            className={cn(
              'flex flex-1 flex-col items-center gap-1 rounded-lg border px-1 py-1.5 transition-colors',
              active
                ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/10'
                : enabled
                  ? 'border-[hsl(var(--outline-variant))]/35 bg-[hsl(var(--surface-container-low))] hover:border-[hsl(var(--primary))]/40'
                  : 'cursor-not-allowed border-[hsl(var(--outline-variant))]/20 opacity-30'
            )}
          >
            <span
              className="rounded-[2px] border-2"
              style={{
                width: icon.w,
                height: icon.h,
                borderColor: active ? 'hsl(var(--primary))' : 'hsl(var(--on-surface-variant))',
              }}
            />
            <span
              className="text-[10px]"
              style={{ color: active ? 'hsl(var(--primary))' : 'hsl(var(--on-surface-variant))' }}
            >
              {ratio}
            </span>
          </button>
        )
      })}
    </div>
  )
}

function GenerateBarModelPicker({
  node,
  onChange,
}: {
  node: CustomNode
  onChange: (data: Partial<CustomNode['data']>) => void
}) {
  const isVideo = node.type === 'videoConfig'
  const { models: liveImageModels, loading: imageLoading } = useImageModels()
  const { models: liveVideoModels, loading: videoLoading } = useVideoModels()
  const catalog = isVideo ? VIDEO_MODELS : IMAGE_MODELS
  const liveIds = (isVideo ? liveVideoModels : liveImageModels).map((item) => item.id)
  const loading = isVideo ? videoLoading : imageLoading
  const pickerModels = useMemo(() => {
    const live = filterLiveModels(catalog, liveIds)
    return live.length > 0 ? live : catalog
  }, [catalog, liveIds])

  const currentKey = isVideo
    ? remapVideoModel(typeof node.data.model === 'string' ? node.data.model : undefined)
    : typeof node.data.model === 'string'
      ? node.data.model
      : pickerModels[0]?.key || ''
  const selected = pickerModels.find((item) => item.key === currentKey) || catalog.find((item) => item.key === currentKey)
  const paramStub = formatParamStub(node)
  const currentModel = isVideo
    ? VIDEO_MODELS.find((item) => item.key === currentKey)
    : IMAGE_MODELS.find((item) => item.key === currentKey)
  const imageSizes = useMemo(
    () => (isVideo ? [] : listImageSizes(currentKey, typeof node.data.quality === 'string' ? node.data.quality : undefined)),
    [currentKey, isVideo, node.data.quality]
  )
  const imageRatio = typeof node.data.size === 'string' ? getSizeRatio(node.data.size) : (node.data.ratio || '1:1')
  const videoParsed = parseVideoSize(typeof node.data.size === 'string' ? node.data.size : undefined)
  const videoResolution =
    (typeof node.data.resolution === 'string' && node.data.resolution) || videoParsed.resolution
  const videoRatio = (typeof node.data.ratio === 'string' && node.data.ratio) || videoParsed.ratio
  const availableResolutions = listVideoResolutions(currentKey)
  const showVideoAspect = isT2VModel(currentKey)

  useEffect(() => {
    if (loading || pickerModels.length === 0) return
    if (!pickerModels.some((item) => item.key === currentKey)) {
      onChange(applyModelDefaults(node.type, pickerModels[0].key, node))
      return
    }
    const coerced = coerceGenerateParams(node)
    if (coerced) onChange(coerced)
  }, [
    currentKey,
    loading,
    node,
    node.data.duration,
    node.data.model,
    node.data.quality,
    node.data.ratio,
    node.data.resolution,
    node.data.size,
    node.type,
    onChange,
    pickerModels,
  ])

  const handleSelect = (model: ModelConfig) => {
    onChange(applyModelDefaults(node.type, model.key, node))
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          disabled={loading && pickerModels.length === 0}
          className="h-auto max-w-[168px] shrink-0 justify-end rounded-xl bg-[hsl(var(--surface-container-low))] px-2.5 py-1.5 text-right hover:bg-[hsl(var(--surface-container-high))]"
        >
          <span className="min-w-0">
            <span className="block truncate text-[11px] font-semibold text-[hsl(var(--on-surface))]">
              {loading && !selected ? '加载模型…' : selected?.label || currentKey || '选择模型'}
            </span>
            {paramStub ? (
              <span className="block truncate text-[10px] text-[hsl(var(--secondary))]">{paramStub}</span>
            ) : null}
          </span>
          {loading ? (
            <Loader2 className="ml-1 h-3.5 w-3.5 shrink-0 animate-spin text-[hsl(var(--secondary))]" />
          ) : (
            <ChevronDown className="ml-1 h-3.5 w-3.5 shrink-0 text-[hsl(var(--secondary))]" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="z-[80] max-h-[420px] w-80 overflow-y-auto rounded-xl border-[hsl(var(--outline-variant))]/30 bg-[hsl(var(--surface-container-lowest))] p-2 shadow-xl"
      >
        <p className="px-1.5 pb-1.5 text-[10px] font-semibold tracking-wide text-[hsl(var(--secondary))]">模型</p>
        {pickerModels.map((model) => (
          <DropdownMenuItem
            key={model.key}
            onClick={() => handleSelect(model)}
            className={cn(
              'rounded-lg px-2.5 py-2 text-sm',
              currentKey === model.key
                ? 'bg-[hsl(var(--primary))] text-white focus:bg-[hsl(var(--primary))] focus:text-white'
                : 'text-[hsl(var(--on-surface))]'
            )}
          >
            <Check className={cn('mr-2 h-3.5 w-3.5', currentKey === model.key ? 'opacity-100' : 'opacity-0')} />
            <span className="truncate">{model.label}</span>
          </DropdownMenuItem>
        ))}

        <div
          className="mt-2 space-y-2.5 border-t border-[hsl(var(--outline-variant))]/25 px-1 pb-1 pt-2.5"
          onPointerDown={(event) => event.preventDefault()}
        >
          {isVideo ? (
            <>
              <div>
                <p className="mb-1.5 text-[10px] font-semibold tracking-wide text-[hsl(var(--secondary))]">分辨率</p>
                <div className="flex gap-1.5">
                  {availableResolutions.map((res) => (
                    <button
                      key={res}
                      type="button"
                      onClick={() => onChange(applyVideoResolution(currentKey, res, typeof node.data.size === 'string' ? node.data.size : undefined))}
                      className={cn(
                        'flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors',
                        videoResolution === res
                          ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))] text-white'
                          : 'border-[hsl(var(--outline-variant))]/35 bg-[hsl(var(--surface-container-low))] text-[hsl(var(--on-surface-variant))] hover:border-[hsl(var(--primary))]/40'
                      )}
                    >
                      {res}
                    </button>
                  ))}
                </div>
              </div>
              {showVideoAspect ? (
                <div>
                  <p className="mb-1.5 text-[10px] font-semibold tracking-wide text-[hsl(var(--secondary))]">画面比例</p>
                  <AspectRatioPills
                    selected={videoRatio}
                    onChange={(ratio) => onChange(applyVideoRatio(videoResolution, ratio))}
                  />
                </div>
              ) : null}
              <div>
                <p className="mb-1.5 text-[10px] font-semibold tracking-wide text-[hsl(var(--secondary))]">时长</p>
                <div className="flex gap-1.5">
                  {(currentModel?.durs || []).map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => onChange({ duration: item.key })}
                      className={cn(
                        'flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors',
                        node.data.duration === item.key
                          ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))] text-white'
                          : 'border-[hsl(var(--outline-variant))]/35 bg-[hsl(var(--surface-container-low))] text-[hsl(var(--on-surface-variant))] hover:border-[hsl(var(--primary))]/40'
                      )}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div>
              <p className="mb-1.5 text-[10px] font-semibold tracking-wide text-[hsl(var(--secondary))]">画面比例</p>
              <AspectRatioPills
                selected={imageRatio}
                supported={(ratio) => imageSizes.some((item) => getSizeRatio(item.key) === ratio)}
                onChange={(ratio) => {
                  const next = applyImageRatio(
                    currentKey,
                    typeof node.data.quality === 'string' ? node.data.quality : undefined,
                    ratio
                  )
                  if (next) onChange(next)
                }}
              />
            </div>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function SlotThumb({ slot, onInsert }: { slot: ReferenceSlot; onInsert?: (slot: ReferenceSlot) => void }) {
  const removeEdge = useCallback((event: React.MouseEvent) => {
    event.stopPropagation()
    useCanvasStore.getState().onEdgesChange([{ id: slot.edgeId, type: 'remove' }])
  }, [slot.edgeId])

  const body = (() => {
    if (slot.dead) {
      return (
        <div className="flex h-full w-full items-center justify-center bg-[hsl(var(--surface-container))] text-[10px] text-[hsl(var(--secondary))]">
          断开
        </div>
      )
    }
    if (slot.thumbUrl) {
      if (slot.kind === 'video') {
        return (
          <div className="relative h-full w-full">
            <img src={slot.thumbUrl} alt={slot.label} className="h-full w-full object-cover" />
            <Video className="absolute bottom-1 right-1 h-3 w-3 text-white drop-shadow" />
          </div>
        )
      }
      return <img src={slot.thumbUrl} alt={slot.label} className="h-full w-full object-cover" />
    }
    if (slot.kind === 'text') {
      return (
        <div className="flex h-full w-full flex-col justify-between bg-[hsl(var(--surface-container-low))] p-1.5">
          <FileText className="h-3.5 w-3.5 text-[hsl(var(--primary))]" />
          <p className="line-clamp-2 text-[10px] leading-3 text-[hsl(var(--on-surface-variant))]">
            {slot.snippet || '文本'}
          </p>
        </div>
      )
    }
    if (slot.kind === 'audio') {
      return (
        <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-[hsl(var(--surface-container-low))]">
          <Music2 className="h-4 w-4 text-[hsl(var(--primary))]" />
          <span className="text-[10px] text-[hsl(var(--secondary))]">音频</span>
        </div>
      )
    }
    if (slot.kind === 'effect') {
      return (
        <div className="flex h-full w-full flex-col justify-between bg-[hsl(var(--surface-container-low))] p-1.5">
          <Sparkles className="h-3.5 w-3.5 text-[hsl(var(--primary))]" />
          <p className="line-clamp-2 text-[10px] leading-3 text-[hsl(var(--on-surface-variant))]">
            {slot.snippet || '效果'}
          </p>
        </div>
      )
    }
    return (
      <div className="flex h-full w-full items-center justify-center bg-[hsl(var(--surface-container-low))] text-[10px] text-[hsl(var(--secondary))]">
        {slot.label}
      </div>
    )
  })()

  return (
    <div
      role={onInsert && !slot.dead ? 'button' : undefined}
      onClick={() => {
        if (!slot.dead) onInsert?.(slot)
      }}
      className={cn(
        'group relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl border bg-[hsl(var(--surface-container-lowest))]',
        slot.dead
          ? 'border-dashed border-[hsl(var(--outline-variant))]/70 opacity-70'
          : 'cursor-pointer border-[hsl(var(--outline-variant))]/35'
      )}
      title={slot.dead ? slot.label : `插入 @${slot.index}`}
    >
      {body}
      <span className="absolute left-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full signature-gradient px-1 text-[10px] font-bold text-white shadow-sm">
        {slot.index}
      </span>
      <button
        type="button"
        onClick={removeEdge}
        className="absolute right-0.5 top-0.5 hidden h-4 w-4 items-center justify-center rounded-full bg-black/55 text-[10px] text-white group-hover:flex"
        title="断开参考"
      >
        ×
      </button>
    </div>
  )
}

const NodeGenerateBar: React.FC = () => {
  const selectedId = useSelectedGenerateNodeId()
  const anchor = useGenerateBarAnchor(selectedId)
  const node = useCanvasStore((state) => state.nodes.find((item) => item.id === selectedId) ?? null)
  const edges = useCanvasStore((state) => state.edges)
  const nodes = useCanvasStore((state) => state.nodes)
  const updateNode = useCanvasStore((state) => state.updateNode)
  const { send, sending } = useNodeGenerateAction(selectedId)
  const [draftPrompt, setDraftPrompt] = useState('')
  const overlayRef = useRef<HTMLDivElement>(null)
  const barRef = useRef<HTMLDivElement>(null)
  const mentionRef = useRef<MentionPromptInputHandle>(null)
  const prevSlotsRef = useRef<{ nodeId: string | null; slots: SlotRef[] }>({ nodeId: null, slots: [] })
  const [barSize, setBarSize] = useState({ width: BAR_WIDTH, height: BAR_ESTIMATED_HEIGHT })

  const slots = useMemo(
    () => (selectedId ? getIncomingReferenceSlots(selectedId, nodes, edges) : []),
    [edges, nodes, selectedId]
  )

  useEffect(() => {
    setDraftPrompt(typeof node?.data.prompt === 'string' ? node.data.prompt : '')
  }, [node?.data.prompt, selectedId])

  useEffect(() => {
    if (!selectedId) return
    const timer = window.setTimeout(() => mentionRef.current?.focus(), 40)
    return () => window.clearTimeout(timer)
  }, [selectedId])

  useEffect(() => {
    if (!selectedId) {
      prevSlotsRef.current = { nodeId: null, slots: [] }
      return
    }
    const prev = prevSlotsRef.current
    if (prev.nodeId === selectedId && prev.slots.length > 0) {
      const nextPrompt = reconcilePromptMentions(draftPrompt, prev.slots, slots)
      if (nextPrompt !== draftPrompt) {
        setDraftPrompt(nextPrompt)
        updateNode(selectedId, { prompt: nextPrompt })
      }
    }
    prevSlotsRef.current = {
      nodeId: selectedId,
      slots: slots.map((slot) => ({ index: slot.index, sourceId: slot.sourceId })),
    }
  }, [draftPrompt, selectedId, slots, updateNode])

  useEffect(() => {
    const element = barRef.current
    if (!element || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      setBarSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      })
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [selectedId])

  const handleModelChange = useCallback((data: Partial<CustomNode['data']>) => {
    if (!selectedId) return
    updateNode(selectedId, data)
  }, [selectedId, updateNode])

  if (!selectedId || !anchor || !node) {
    return <div ref={overlayRef} className="pointer-events-none absolute inset-0 z-20" />
  }

  const containerWidth = overlayRef.current?.clientWidth ?? (typeof window !== 'undefined' ? window.innerWidth : 1280)
  const containerHeight = overlayRef.current?.clientHeight ?? (typeof window !== 'undefined' ? window.innerHeight : 720)
  const spaceBelow = containerHeight - (anchor.top + anchor.height)
  const spaceAbove = anchor.top
  const overflowBelow = barSize.height + BAR_GAP - spaceBelow
  // Prefer docking under the card. Flip above only when the bar would clip
  // badly below *and* the space above is meaningfully larger.
  const placeAbove = overflowBelow > 48 && spaceAbove > spaceBelow + 24
  const left = Math.min(
    Math.max(anchor.left + anchor.width / 2 - barSize.width / 2, 76),
    Math.max(76, containerWidth - barSize.width - 16)
  )
  const top = placeAbove
    ? Math.max(16, anchor.top - barSize.height - BAR_GAP)
    : Math.min(anchor.top + anchor.height + BAR_GAP, containerHeight - 24)

  const handlePromptChange = (value: string) => {
    setDraftPrompt(value)
    updateNode(selectedId, { prompt: value })
  }

  const handleInsertMention = (slot: ReferenceSlot) => {
    mentionRef.current?.insertSlot(slot)
  }

  const handleChipClick = () => {
    message.info('能力面板将在后续版本接入')
  }

  const handleSend = (event: React.MouseEvent) => {
    event.stopPropagation()
    void send(draftPrompt)
  }

  return (
    <div ref={overlayRef} className="pointer-events-none absolute inset-0 z-20">
      <div
        ref={barRef}
        className="pointer-events-auto absolute nodrag nowheel nopan"
        data-generate-bar="true"
        style={{ left, top, width: BAR_WIDTH }}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
      >
        {placeAbove ? (
          <div className="absolute left-1/2 top-full h-1.5 w-px -translate-x-1/2 bg-[hsl(var(--outline-variant))]/55" />
        ) : null}
        <div
          className={cn(
            'border border-[hsl(var(--outline-variant))]/40 bg-[hsl(var(--surface-container-lowest))]/96 p-3 backdrop-blur-md',
            placeAbove
              ? 'rounded-[24px] shadow-[0_18px_50px_rgba(42,28,24,0.12)]'
              : 'rounded-[22px] shadow-[0_10px_28px_rgba(42,28,24,0.10)]'
          )}
        >
          <div className="mb-2 flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2 overflow-x-auto pb-0.5">
              {slots.length === 0 ? (
                <div className="flex h-14 items-center gap-3 rounded-2xl border-2 border-dashed border-[hsl(var(--outline-variant))]/45 bg-[hsl(var(--surface-container-low))] px-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[hsl(var(--surface-container-lowest))] text-[hsl(var(--secondary))]">
                    <ImagePlus className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-[hsl(var(--on-surface))]">参考资源</p>
                    <p className="text-[11px] text-[hsl(var(--secondary))]">连入后编号，输入 @ 可引用</p>
                  </div>
                </div>
              ) : (
                slots.map((slot) => (
                  <SlotThumb key={slot.edgeId} slot={slot} onInsert={handleInsertMention} />
                ))
              )}
            </div>
            <span className="shrink-0 rounded-full bg-[hsl(var(--surface-container-high))] px-2.5 py-1 text-[10px] font-semibold tracking-wide text-[hsl(var(--secondary))]">
              {slots.length > 0 ? `${slots.length} 个参考` : '待连线'}
            </span>
          </div>

          <MentionPromptInput
            ref={mentionRef}
            value={draftPrompt}
            slots={slots}
            onChange={handlePromptChange}
            placeholder={
              node.type === 'videoConfig'
                ? '描述视频，输入 @ 引用已连入的参考…'
                : '描述画面，输入 @ 引用已连入的参考…'
            }
          />

          <div className="mt-2 flex items-center gap-2">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
              {CAPABILITY_CHIPS.map((chip) => {
                const Icon = chip.icon
                return (
                  <button
                    key={chip.id}
                    type="button"
                    onClick={handleChipClick}
                    className="inline-flex items-center gap-1 rounded-full bg-[hsl(var(--surface-container-high))] px-2.5 py-1 text-[11px] font-medium text-[hsl(var(--on-surface-variant))] transition-colors hover:bg-[hsl(var(--surface-container-highest))]"
                  >
                    <Icon className="h-3 w-3" />
                    {chip.label}
                  </button>
                )
              })}
            </div>
            <GenerateBarModelPicker node={node} onChange={handleModelChange} />
            <button
              type="button"
              onClick={handleSend}
              disabled={sending}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl signature-gradient text-white shadow-md transition-opacity hover:opacity-90 disabled:opacity-50"
              title="发送生成"
            >
              <ArrowUp className={cn('h-4 w-4', sending && 'animate-pulse')} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default NodeGenerateBar
