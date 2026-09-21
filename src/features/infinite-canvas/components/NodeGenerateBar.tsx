import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowUp,
  Check,
  ChevronDown,
  Clapperboard,
  Clock,
  Copy,
  FileText,
  ImagePlus,
  Loader2,
  Monitor,
  Music2,
  Sparkles,
  Tag,
  Users,
  Video,
} from 'lucide-react'
import { message } from 'antd'
import { useCanvasStore } from '../stores/canvasStore'
import { liveModelsToPicker, remapModelId } from '../config/modelCapabilities'
import { useImageModels, useVideoModels } from '../hooks/useModels'
import { useExactlySelectedNodeId } from '../hooks/useNodeDock'
import { useNodeGenerateAction } from '../hooks/useNodeGenerateAction'
import {
  getIncomingReferenceSlots,
  isGenerateNodeType,
  type ReferenceSlot,
} from '../utils/generateSlots'
import { NodeDockOverlay } from './NodeDockOverlay'
import {
  applyImageRatio,
  applyModelDefaults,
  applyVideoRatio,
  applyVideoResolution,
  coerceGenerateParams,
  getSizeRatio,
  listImageAspectRatios,
  listQuantityOptions,
  listVideoAspectRatios,
  listVideoResolutions,
  parseVideoSize,
} from '../utils/generateParams'
import { aspectRatioIconSize } from '../utils/aspectRatio'
import { reconcilePromptMentions, type SlotRef } from '../utils/promptMentions'
import type { CustomNode, ModelConfig } from '../types'
import MentionPromptInput, { type MentionPromptInputHandle } from './MentionPromptInput'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { displayModelName } from '@/lib/displayModelName'
import { cn } from '@/lib/utils'

const BAR_MIN_WIDTH = 560
const BAR_MAX_WIDTH = 860
const BAR_ESTIMATED_HEIGHT = 168
const DOCK_MENU =
  'z-[80] min-w-[10.5rem] overflow-y-auto rounded-xl border-[hsl(var(--outline-variant))]/30 bg-[hsl(var(--surface-container-lowest))] p-1.5 shadow-xl'
const CAPABILITY_CHIPS = [
  { id: 'mark', label: '标记', icon: Tag },
  { id: 'fx', label: '特效', icon: Sparkles },
  { id: 'cast', label: '角色库', icon: Users },
  { id: 'camera', label: '运镜', icon: Clapperboard },
] as const

function DockDivider() {
  return <span aria-hidden className="mx-0.5 h-4 w-px shrink-0 bg-[hsl(var(--outline-variant))]/50" />
}

function RatioGlyph({ ratio }: { ratio: string }) {
  const icon = aspectRatioIconSize(ratio, 12)
  return (
    <span
      aria-hidden
      className="shrink-0 rounded-[1px] border-[1.5px] border-[hsl(var(--on-surface-variant))]"
      style={{ width: icon.w, height: icon.h }}
    />
  )
}

const DockSelectTrigger = React.forwardRef<
  HTMLButtonElement,
  {
    icon?: React.ReactNode
    label: string
    loading?: boolean
    disabled?: boolean
    wide?: boolean
  } & React.ComponentPropsWithoutRef<'button'>
>(({ icon, label, loading, disabled, wide, className, ...props }, ref) => (
  <Button
    ref={ref}
    type="button"
    variant="ghost"
    disabled={disabled}
    title={label}
    {...props}
    className={cn(
      'h-8 min-w-0 shrink-0 gap-1 overflow-hidden rounded-full px-2 py-0 text-[11px] font-medium text-[hsl(var(--on-surface))] hover:bg-[hsl(var(--surface-container-low))] [&_svg]:size-3',
      wide ? 'max-w-[9.5rem]' : 'max-w-[5.75rem]',
      className
    )}
  >
    {icon ? <span className="shrink-0 text-[hsl(var(--secondary))]">{icon}</span> : null}
    <span className="min-w-0 truncate whitespace-nowrap">{loading ? '加载模型…' : label}</span>
    {loading ? (
      <Loader2 className="h-3 w-3 shrink-0 animate-spin text-[hsl(var(--secondary))]" />
    ) : (
      <ChevronDown className="h-3 w-3 shrink-0 text-[hsl(var(--secondary))]" />
    )}
  </Button>
))
DockSelectTrigger.displayName = 'DockSelectTrigger'

function menuItemClass(active: boolean) {
  return cn(
    'rounded-lg px-2.5 py-2 text-sm',
    active
      ? 'bg-[hsl(var(--primary))] text-white focus:bg-[hsl(var(--primary))] focus:text-white'
      : 'text-[hsl(var(--on-surface))]'
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
  const { models: liveImageModels, loading: imageLoading, error: imageError } = useImageModels()
  const { models: liveVideoModels, loading: videoLoading, error: videoError } = useVideoModels()
  const liveModels = isVideo ? liveVideoModels : liveImageModels
  const liveIds = liveModels.map((item) => item.id)
  const loading = isVideo ? videoLoading : imageLoading
  const error = isVideo ? videoError : imageError
  const pickerModels = useMemo(
    () => liveModelsToPicker(liveModels, isVideo ? 'video' : 'image', loading),
    [isVideo, liveModels, loading]
  )
  const toastKey = `${isVideo ? 'video' : 'image'}:${error || 'empty'}`
  const toastedRef = useRef<string | null>(null)

  useEffect(() => {
    if (loading) return
    if (error) {
      if (toastedRef.current !== toastKey) {
        toastedRef.current = toastKey
        message.error(isVideo ? '视频模型列表加载失败' : '图片模型列表加载失败')
      }
      return
    }
    if (liveModels.length === 0 && toastedRef.current !== toastKey) {
      toastedRef.current = toastKey
      message.warning(isVideo ? '当前没有可用的视频模型' : '当前没有可用的图片模型')
    }
  }, [error, isVideo, liveModels.length, loading, toastKey])

  const currentKey = remapModelId(
    typeof node.data.model === 'string' ? node.data.model : undefined,
    liveIds,
    isVideo ? 'video' : 'image'
  )
  const selected = pickerModels.find((item) => item.key === currentKey)
  const currentModel = selected
  const imageRatios = useMemo(
    () =>
      isVideo
        ? []
        : listImageAspectRatios(
            currentKey,
            typeof node.data.quality === 'string' ? node.data.quality : undefined,
            currentModel
          ),
    [currentKey, currentModel, isVideo, node.data.quality]
  )
  const imageRatio = typeof node.data.size === 'string' ? getSizeRatio(node.data.size) : (node.data.ratio || '1:1')
  const videoParsed = parseVideoSize(typeof node.data.size === 'string' ? node.data.size : undefined)
  const videoResolution =
    (typeof node.data.resolution === 'string' && node.data.resolution) || videoParsed.resolution
  const videoRatio = (typeof node.data.ratio === 'string' && node.data.ratio) || videoParsed.ratio
  const availableResolutions = listVideoResolutions(currentKey, currentModel)
  const videoRatios = listVideoAspectRatios(currentKey, currentModel)
  const showVideoAspect = Boolean(currentModel?.supportsAspect) && videoRatios.length > 0
  const qualities = currentModel?.qualities || []
  const showQuality = !isVideo && qualities.length > 1
  const currentQuality = typeof node.data.quality === 'string' ? node.data.quality : qualities[0]?.key
  const qualityLabel = qualities.find((item) => item.key === currentQuality)?.label || currentQuality || '画质'
  const quantityOptions = listQuantityOptions(currentKey, currentModel)
  const quantity = typeof node.data.n === 'number' && node.data.n > 0 ? node.data.n : 1
  const durations = currentModel?.durs || []
  const durationLabel =
    durations.find((item) => item.key === node.data.duration)?.label ||
    (typeof node.data.duration === 'number' ? `${node.data.duration}秒` : '时长')

  useEffect(() => {
    if (loading || pickerModels.length === 0) return
    if (!pickerModels.some((item) => item.key === currentKey)) {
      onChange(applyModelDefaults(node.type, pickerModels[0].key, node, liveIds, pickerModels[0]))
      return
    }
    const coerced = coerceGenerateParams(node, liveIds, currentModel)
    if (coerced) onChange(coerced)
  }, [
    currentKey,
    currentModel,
    liveIds,
    loading,
    node,
    node.data.duration,
    node.data.model,
    node.data.n,
    node.data.quality,
    node.data.ratio,
    node.data.resolution,
    node.data.size,
    node.type,
    onChange,
    pickerModels,
  ])

  const handleSelect = (model: ModelConfig) => {
    onChange(applyModelDefaults(node.type, model.key, node, liveIds, model))
  }

  return (
    <div className="flex min-w-0 shrink-0 items-center gap-0.5">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <DockSelectTrigger
            wide
            loading={loading && pickerModels.length === 0}
            disabled={loading && pickerModels.length === 0}
            label={
              loading && !selected
                ? '加载模型…'
                : selected
                  ? displayModelName(selected.label)
                  : pickerModels.length === 0
                    ? '暂无可用模型'
                    : displayModelName(currentKey) || '选择模型'
            }
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={8} className={cn(DOCK_MENU, 'max-h-[420px] w-72')}>
          <p className="px-2 pb-1.5 pt-1 text-[10px] font-semibold tracking-wide text-[hsl(var(--secondary))]">
            模型
          </p>
          {pickerModels.length === 0 ? (
            <p className="px-2.5 py-2 text-xs text-[hsl(var(--secondary))]">
              {loading ? '正在拉取可用模型…' : error ? '模型列表加载失败' : '接口未返回可用模型'}
            </p>
          ) : (
            pickerModels.map((model) => (
              <DropdownMenuItem
                key={model.key}
                onClick={() => handleSelect(model)}
                className={menuItemClass(currentKey === model.key)}
              >
                <Check className={cn('mr-2 h-3.5 w-3.5', currentKey === model.key ? 'opacity-100' : 'opacity-0')} />
                <span className="truncate">{displayModelName(model.label)}</span>
              </DropdownMenuItem>
            ))
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {isVideo ? (
        <>
          {showVideoAspect ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <DockSelectTrigger icon={<RatioGlyph ratio={videoRatio} />} label={videoRatio} />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" sideOffset={8} className={DOCK_MENU}>
                {videoRatios.map((ratio) => (
                  <DropdownMenuItem
                    key={ratio}
                    onClick={() => onChange(applyVideoRatio(videoResolution, ratio))}
                    className={menuItemClass(videoRatio === ratio)}
                  >
                    <Check className={cn('mr-2 h-3.5 w-3.5', videoRatio === ratio ? 'opacity-100' : 'opacity-0')} />
                    <RatioGlyph ratio={ratio} />
                    <span className="ml-2">{ratio}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <DockSelectTrigger icon={<Monitor className="h-3 w-3" />} label={videoResolution} />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={8} className={DOCK_MENU}>
              {availableResolutions.map((res) => (
                <DropdownMenuItem
                  key={res}
                  onClick={() =>
                    onChange(
                      applyVideoResolution(
                        currentKey,
                        res,
                        typeof node.data.size === 'string' ? node.data.size : undefined
                      )
                    )
                  }
                  className={menuItemClass(videoResolution === res)}
                >
                  <Check className={cn('mr-2 h-3.5 w-3.5', videoResolution === res ? 'opacity-100' : 'opacity-0')} />
                  {res}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <DockSelectTrigger icon={<Clock className="h-3 w-3" />} label={durationLabel} />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={8} className={DOCK_MENU}>
              {durations.map((item) => (
                <DropdownMenuItem
                  key={item.key}
                  onClick={() => onChange({ duration: item.key })}
                  className={menuItemClass(node.data.duration === item.key)}
                >
                  <Check className={cn('mr-2 h-3.5 w-3.5', node.data.duration === item.key ? 'opacity-100' : 'opacity-0')} />
                  {item.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      ) : (
        <>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <DockSelectTrigger icon={<RatioGlyph ratio={imageRatio} />} label={imageRatio} />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={8} className={DOCK_MENU}>
              {imageRatios.map((ratio) => (
                <DropdownMenuItem
                  key={ratio}
                  onClick={() => {
                    const next = applyImageRatio(
                      currentKey,
                      typeof node.data.quality === 'string' ? node.data.quality : undefined,
                      ratio,
                      currentModel
                    )
                    if (next) onChange(next)
                  }}
                  className={menuItemClass(imageRatio === ratio)}
                >
                  <Check className={cn('mr-2 h-3.5 w-3.5', imageRatio === ratio ? 'opacity-100' : 'opacity-0')} />
                  <RatioGlyph ratio={ratio} />
                  <span className="ml-2">{ratio}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          {showQuality ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <DockSelectTrigger label={qualityLabel} />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" sideOffset={8} className={DOCK_MENU}>
                {qualities.map((item) => (
                  <DropdownMenuItem
                    key={item.key}
                    onClick={() => onChange({ quality: item.key })}
                    className={menuItemClass(currentQuality === item.key)}
                  >
                    <Check className={cn('mr-2 h-3.5 w-3.5', currentQuality === item.key ? 'opacity-100' : 'opacity-0')} />
                    {item.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
          {quantityOptions.length > 1 ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <DockSelectTrigger icon={<Copy className="h-3 w-3" />} label={`${quantity}张`} />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" sideOffset={8} className={DOCK_MENU}>
                {quantityOptions.map((qty) => (
                  <DropdownMenuItem
                    key={qty}
                    onClick={() => onChange({ n: qty })}
                    className={menuItemClass(quantity === qty)}
                  >
                    <Check className={cn('mr-2 h-3.5 w-3.5', quantity === qty ? 'opacity-100' : 'opacity-0')} />
                    {qty}张
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </>
      )}
    </div>
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
  const selectedId = useExactlySelectedNodeId(isGenerateNodeType)
  const node = useCanvasStore((state) => state.nodes.find((item) => item.id === selectedId) ?? null)
  const edges = useCanvasStore((state) => state.edges)
  const nodes = useCanvasStore((state) => state.nodes)
  const updateNode = useCanvasStore((state) => state.updateNode)
  const { send, sending } = useNodeGenerateAction(selectedId)
  const [draftPrompt, setDraftPrompt] = useState('')
  const mentionRef = useRef<MentionPromptInputHandle>(null)
  const prevSlotsRef = useRef<{ nodeId: string | null; slots: SlotRef[] }>({ nodeId: null, slots: [] })

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

  const handleModelChange = useCallback((data: Partial<CustomNode['data']>) => {
    if (!selectedId) return
    updateNode(selectedId, data)
  }, [selectedId, updateNode])

  const handlePromptChange = (value: string) => {
    if (!selectedId) return
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
    <NodeDockOverlay
      nodeId={selectedId && node ? selectedId : null}
      barWidth={BAR_MIN_WIDTH}
      maxWidth={BAR_MAX_WIDTH}
      fitContent
      estimatedHeight={BAR_ESTIMATED_HEIGHT}
      dockKey="generate"
    >
      {({ placeAbove }) => {
        if (!node) return null
        return (
        <>
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
            {slots.length > 0 ? (
              <span className="shrink-0 rounded-full bg-[hsl(var(--surface-container-high))] px-2.5 py-1 text-[10px] font-semibold tracking-wide text-[hsl(var(--secondary))]">
                {`${slots.length} 个参考`}
              </span>
            ) : null}
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

          <div className="mt-2 flex items-center gap-1.5 overflow-x-auto whitespace-nowrap">
            <div className="flex shrink-0 items-center gap-1.5">
              {CAPABILITY_CHIPS.map((chip) => {
                const Icon = chip.icon
                return (
                  <button
                    key={chip.id}
                    type="button"
                    onClick={handleChipClick}
                    className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-[hsl(var(--surface-container-high))] px-2.5 py-1 text-[11px] font-medium text-[hsl(var(--on-surface-variant))] transition-colors hover:bg-[hsl(var(--surface-container-highest))]"
                  >
                    <Icon className="h-3 w-3" />
                    {chip.label}
                  </button>
                )
              })}
            </div>
            <DockDivider />
            <GenerateBarModelPicker node={node} onChange={handleModelChange} />
            <DockDivider />
            <button
              type="button"
              onClick={handleSend}
              disabled={sending}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full signature-gradient text-white shadow-md transition-opacity hover:opacity-90 disabled:opacity-50"
              title="发送生成"
            >
              <ArrowUp className={cn('h-4 w-4', sending && 'animate-pulse')} />
            </button>
          </div>
        </div>
        </>
        )
      }}
    </NodeDockOverlay>
  )
}

export default NodeGenerateBar
