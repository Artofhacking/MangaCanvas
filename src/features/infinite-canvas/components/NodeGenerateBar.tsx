import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowUp,
  Check,
  ChevronDown,
  Clock,
  Copy,
  FileText,
  ImagePlus,
  Loader2,
  Monitor,
  Music2,
  Sparkles,
  Users,
  Video,
} from 'lucide-react'
import { message, Tooltip } from 'antd'
import { useCanvasStore } from '../stores/canvasStore'
import { findVideoPickerModel, liveModelsToPicker, remapModelId } from '../config/modelCapabilities'
import { useImageModels, useVideoModels } from '../hooks/useModels'
import { AudioGenerateControls, type AudioGenerateAvailability } from './AudioGenerateControls'
import { audioPromptPlaceholder, buildCanvasAudioRequest, readAudioMode } from '../utils/audioMode'
import { useExactlySelectedNodeId } from '../hooks/useNodeDock'
import { useNodeGenerateAction } from '../hooks/useNodeGenerateAction'
import {
  collectGenerateInputs,
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
  normalizeVideoQuantity,
  VIDEO_QUANTITY_OPTIONS,
  listVideoRequestImages,
  listVideoResolutions,
  parseVideoSize,
  resolveImageRequestModel,
  resolveListedVideoModel,
  routedVideoModelKey,
  videoAspectSuppressedByReferences,
} from '../utils/generateParams'
import { aspectRatioIconSize } from '../utils/aspectRatio'
import { resolveGenerateBarModelNotice } from '../utils/generateBarModelNotice'
import { reconcilePromptMentions, type SlotRef } from '../utils/promptMentions'
import { creditsApi, type CreditQuote } from '@/api/creditsApi'
import { HttpError } from '@/api/core/error'
import { resolveProjectId } from '@/lib/session'
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
import { imageModelTip } from '../config/imageModelTip'
import { videoModelTip } from '../config/videoModelTip'
import { cn } from '@/lib/utils'
import {
  REFERENCE_EMPTY_HINT,
  REFERENCE_PICK_BUTTON_LABEL,
  REFERENCE_PICK_EXIT_TOOLTIP,
  REFERENCE_PICK_SEND_BLOCKED,
  REFERENCE_PICK_TOOLTIP,
} from '../utils/referencePick'

/**
 * Reserved dock width. Triggers are fixed-width pills and the frame is this
 * wide, so model / ratio / quality / count (and the video equivalents) cannot
 * grow or shrink the panel.
 *
 * Video is the wide row: 角色库 + model + ratio + resolution + duration + count.
 * 688px hid the count pill under the row's horizontal overflow (only the copy
 * icon stayed in view). 760px keeps 「1张 / 2张 / 4张」 fully visible.
 * Model and 比例 stay outside that scroller so a hidden scrollbar cannot
 * push the ratio pill out of sight.
 */
const BAR_WIDTH = 760
const BAR_ESTIMATED_HEIGHT = 208
/** HappyHorse i2v has no ratio; output follows the first frame. */
const VIDEO_REFERENCE_ASPECT_HINT = '输出跟首帧'
const DOCK_MENU =
  'z-[80] min-w-[10.5rem] overflow-y-auto rounded-xl border-[hsl(var(--outline-variant))]/30 bg-[hsl(var(--surface-container-lowest))] p-1.5 shadow-xl'

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
    /** Short fixed label (1张 / 2张 / 4张) that must stay fully readable. */
    fitLabel?: boolean
  } & React.ComponentPropsWithoutRef<'button'>
>(({ icon, label, loading, disabled, wide, fitLabel, className, ...props }, ref) => (
  <Button
    ref={ref}
    type="button"
    variant="ghost"
    disabled={disabled}
    title={label}
    {...props}
    className={cn(
      'h-8 shrink-0 justify-start gap-1 overflow-hidden rounded-full px-2 py-0 text-[11px] font-medium text-[hsl(var(--on-surface))] hover:bg-[hsl(var(--surface-container-low))] [&_svg]:size-3',
      fitLabel ? 'w-[4.75rem]' : wide ? 'w-[10.5rem]' : 'w-[5rem]',
      className
    )}
  >
    {icon ? <span className="shrink-0 text-[hsl(var(--secondary))]">{icon}</span> : null}
    <span
      className={cn(
        'whitespace-nowrap text-left',
        fitLabel ? 'shrink-0' : 'min-w-0 flex-1 truncate'
      )}
    >
      {loading ? '加载模型…' : label}
    </span>
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
  suppressVideoAspect = false,
  videoReferenceCount = 0,
  imageReferenceCount = 0,
}: {
  node: CustomNode
  onChange: (data: Partial<CustomNode['data']>) => void
  /** Exactly one HappyHorse image URL: hide ratio, output follows the first frame. */
  suppressVideoAspect?: boolean
  videoReferenceCount?: number
  imageReferenceCount?: number
}) {
  const isVideo = node.type === 'videoConfig'
  const {
    models: liveImageModels,
    loading: imageLoading,
    error: imageError,
    isLoaded: imageLoaded,
  } = useImageModels()
  const {
    models: liveVideoModels,
    loading: videoLoading,
    error: videoError,
    isLoaded: videoLoaded,
  } = useVideoModels()
  const liveModels = isVideo ? liveVideoModels : liveImageModels
  const liveIds = liveModels.map((item) => item.id)
  const loading = isVideo ? videoLoading : imageLoading
  const error = isVideo ? videoError : imageError
  const loaded = isVideo ? videoLoaded : imageLoaded
  const pickerModels = useMemo(
    () => liveModelsToPicker(liveModels, isVideo ? 'video' : 'image', loading),
    [isVideo, liveModels, loading]
  )
  const toastKey = `${isVideo ? 'video' : 'image'}:${error || 'empty'}`
  const toastedRef = useRef<string | null>(null)

  useEffect(() => {
    const notice = resolveGenerateBarModelNotice({
      loading,
      isLoaded: loaded,
      error,
      modelCount: liveModels.length,
    })
    if (!notice || toastedRef.current === toastKey) return
    toastedRef.current = toastKey
    if (notice === 'load-error') {
      message.error(isVideo ? '视频模型列表加载失败' : '图片模型列表加载失败')
      return
    }
    message.warning(isVideo ? '当前没有可用的视频模型' : '当前没有可用的图片模型')
  }, [error, isVideo, liveModels.length, loaded, loading, toastKey])

  const currentKey = remapModelId(
    typeof node.data.model === 'string' ? node.data.model : undefined,
    liveIds,
    isVideo ? 'video' : 'image'
  )
  const selected = isVideo
    ? findVideoPickerModel(pickerModels, currentKey)
    : pickerModels.find((item) => item.key === currentKey)
  const currentModel = selected
  const imageRequestKey = isVideo
    ? currentKey
    : resolveImageRequestModel(currentKey, imageReferenceCount, liveIds)
  const imageRequestModel =
    pickerModels.find((item) => item.key === imageRequestKey) ||
    (imageRequestKey === currentModel?.key ? currentModel : undefined)
  const imageRatios = useMemo(
    () =>
      isVideo
        ? []
        : listImageAspectRatios(
            imageRequestKey,
            typeof node.data.quality === 'string' ? node.data.quality : undefined,
            imageRequestModel
          ),
    [imageRequestKey, imageRequestModel, isVideo, node.data.quality]
  )
  const imageRatio = typeof node.data.size === 'string' ? getSizeRatio(node.data.size) : (node.data.ratio || '1:1')
  const videoParsed = parseVideoSize(typeof node.data.size === 'string' ? node.data.size : undefined)
  const videoResolution =
    (typeof node.data.resolution === 'string' && node.data.resolution) || videoParsed.resolution
  const videoRatio = (typeof node.data.ratio === 'string' && node.data.ratio) || videoParsed.ratio
  const aspectKey = isVideo ? routedVideoModelKey(currentKey, videoReferenceCount) : currentKey
  const aspectModel = isVideo ? resolveListedVideoModel(aspectKey, currentModel) : undefined
  const availableResolutions = listVideoResolutions(aspectKey, aspectModel)
  const videoRatios = listVideoAspectRatios(aspectKey, aspectModel)
  const showVideoAspect = !suppressVideoAspect && videoRatios.length > 0
  const qualities = currentModel?.qualities || []
  const showQuality = !isVideo && qualities.length > 1
  const currentQuality = typeof node.data.quality === 'string' ? node.data.quality : qualities[0]?.key
  const qualityLabel = qualities.find((item) => item.key === currentQuality)?.label || currentQuality || '画质'
  const quantityOptions = isVideo ? [...VIDEO_QUANTITY_OPTIONS] : listQuantityOptions(currentKey, currentModel)
  const quantity = isVideo
    ? normalizeVideoQuantity(node.data.n)
    : (typeof node.data.n === 'number' && node.data.n > 0 ? node.data.n : 1)
  const durations = currentModel?.durs || []
  const durationLabel =
    durations.find((item) => item.key === node.data.duration)?.label ||
    (typeof node.data.duration === 'number' ? `${node.data.duration}秒` : '时长')

  useEffect(() => {
    if (loading || pickerModels.length === 0) return
    if (!selected) {
      onChange(applyModelDefaults(node.type, pickerModels[0].key, node, liveIds, pickerModels[0]))
      return
    }
    const requestNode =
      !isVideo && imageRequestKey !== currentKey
        ? { ...node, data: { ...node.data, model: imageRequestKey } }
        : node
    const coerced = coerceGenerateParams(requestNode, liveIds, isVideo ? currentModel : imageRequestModel)
    if (coerced) onChange(coerced)
  }, [
    currentKey,
    currentModel,
    imageRequestKey,
    imageRequestModel,
    imageReferenceCount,
    isVideo,
    selected,
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

  const triggerName =
    loading && !selected
      ? '加载模型…'
      : selected
        ? displayModelName(selected.label)
        : pickerModels.length === 0
          ? '暂无可用模型'
          : displayModelName(currentKey) || '选择模型'
  const resolveTip = (key?: string | null, label?: string | null) =>
    isVideo ? videoModelTip(key, label) : imageModelTip(key, label)
  const selectedTip = selected ? resolveTip(selected.key, selected.label) : ''
  const triggerTitle = selectedTip
    ? `${displayModelName(selected?.label) || triggerName} — ${selectedTip}`
    : selected?.label || currentKey || '选择模型'
  const ratioTriggerProps = {
    'data-generate-ratio': 'true',
    'aria-label': '比例',
  } as const

  return (
    <div className="flex min-w-0 flex-1 items-center gap-0.5">
      <div className="flex shrink-0 items-center gap-0.5">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <DockSelectTrigger
            wide
            loading={loading && pickerModels.length === 0}
            disabled={loading && pickerModels.length === 0}
            title={triggerTitle}
            label={triggerName}
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          sideOffset={8}
          className={cn(DOCK_MENU, 'w-[22rem]', isVideo ? 'max-h-[520px]' : 'max-h-[420px]')}
        >
          <p className="px-2 pb-1.5 pt-1 text-[10px] font-semibold tracking-wide text-[hsl(var(--secondary))]">
            模型
          </p>
          {pickerModels.length === 0 ? (
            <p className="px-2.5 py-2 text-xs text-[hsl(var(--secondary))]">
              {loading ? '正在拉取可用模型…' : error ? '模型列表加载失败' : '接口未返回可用模型'}
            </p>
          ) : (
            pickerModels.map((model) => {
              const active = selected?.key === model.key
              const tip = resolveTip(model.key, model.label)
              return (
                <DropdownMenuItem
                  key={model.key}
                  onClick={() => handleSelect(model)}
                  className={cn(menuItemClass(active), tip && 'items-start')}
                >
                  <Check
                    className={cn(
                      'mr-2 h-3.5 w-3.5 shrink-0',
                      tip && 'mt-0.5',
                      active ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  <span className="min-w-0 flex-1 text-left">
                    <span className="block truncate">{displayModelName(model.label)}</span>
                    {tip ? (
                      <span
                        className={cn(
                          'mt-0.5 block whitespace-normal break-words text-[11px] font-normal leading-4',
                          active ? 'text-white/80' : 'text-[hsl(var(--secondary))]'
                        )}
                      >
                        {tip}
                      </span>
                    ) : null}
                  </span>
                </DropdownMenuItem>
              )
            })
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <DockDivider />

      {isVideo ? (
        showVideoAspect ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <DockSelectTrigger
                {...ratioTriggerProps}
                aria-label={`比例 ${videoRatio}`}
                icon={<RatioGlyph ratio={videoRatio} />}
                label={videoRatio}
              />
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
        ) : null
      ) : (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <DockSelectTrigger
              {...ratioTriggerProps}
              aria-label={`比例 ${imageRatio}`}
              icon={<RatioGlyph ratio={imageRatio} />}
              label={imageRatio}
            />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={8} className={DOCK_MENU}>
            {imageRatios.map((ratio) => (
              <DropdownMenuItem
                key={ratio}
                onClick={() => {
                  const next = applyImageRatio(
                    imageRequestKey,
                    typeof node.data.quality === 'string' ? node.data.quality : undefined,
                    ratio,
                    imageRequestModel
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
      )}
      </div>
      <div className="flex min-w-0 items-center gap-0.5 overflow-x-auto whitespace-nowrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {isVideo ? (
        <>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <DockSelectTrigger className="w-[5.5rem]" icon={<Monitor className="h-3 w-3" />} label={videoResolution} />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={8} className={DOCK_MENU}>
              {availableResolutions.map((res) => (
                <DropdownMenuItem
                  key={res}
                  onClick={() =>
                    onChange(
                      applyVideoResolution(
                        aspectKey,
                        res,
                        typeof node.data.size === 'string' ? node.data.size : undefined,
                        videoRatio
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
          {durations.length > 0 ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <DockSelectTrigger className="w-[5rem]" icon={<Clock className="h-3 w-3" />} label={durationLabel} />
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
          ) : null}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <DockSelectTrigger fitLabel icon={<Copy className="h-3 w-3" />} label={`${quantity}张`} />
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
        </>
      ) : (
        <>
          {showQuality ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <DockSelectTrigger className="w-[2.75rem]" label={qualityLabel} />
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
                <DockSelectTrigger fitLabel icon={<Copy className="h-3 w-3" />} label={`${quantity}张`} />
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
  const referencePickTargetId = useCanvasStore((state) => state.referencePickTargetId)
  const setReferencePickTarget = useCanvasStore((state) => state.setReferencePickTarget)
  const picking = Boolean(selectedId && referencePickTargetId === selectedId)
  const { send, sending } = useNodeGenerateAction(selectedId)
  const [draftPrompt, setDraftPrompt] = useState('')
  const [quote, setQuote] = useState<CreditQuote | null>(null)
  const [quoteError, setQuoteError] = useState('')
  const [audioGate, setAudioGate] = useState<AudioGenerateAvailability>({ blocked: false, hint: '' })
  const mentionRef = useRef<MentionPromptInputHandle>(null)
  const prevSlotsRef = useRef<{ nodeId: string | null; slots: SlotRef[] }>({ nodeId: null, slots: [] })

  const slots = useMemo(
    () => (selectedId ? getIncomingReferenceSlots(selectedId, nodes, edges) : []),
    [edges, nodes, selectedId]
  )
  const connectedInputs = useMemo(
    () => (selectedId ? collectGenerateInputs(selectedId, nodes, edges) : null),
    [edges, nodes, selectedId]
  )
  const videoReferenceCount =
    node?.type === 'videoConfig' && connectedInputs
      ? listVideoRequestImages(connectedInputs.firstFrameImage, connectedInputs.refImages).length
      : 0
  const imageReferenceCount =
    node?.type === 'imageConfig' && connectedInputs ? connectedInputs.refImages.length : 0
  const suppressVideoAspect = useMemo(() => {
    if (!selectedId || node?.type !== 'videoConfig' || !connectedInputs) return false
    const modelKey = typeof node.data.model === 'string' ? node.data.model : ''
    return videoAspectSuppressedByReferences(modelKey, connectedInputs)
  }, [connectedInputs, node?.data.model, node?.type, selectedId])

  useEffect(() => {
    setDraftPrompt(typeof node?.data.prompt === 'string' ? node.data.prompt : '')
  }, [node?.data.prompt, selectedId])

  useEffect(() => {
    if (!selectedId) return
    const timer = window.setTimeout(() => mentionRef.current?.focus(), 40)
    return () => window.clearTimeout(timer)
  }, [selectedId])

  useEffect(() => {
    if (!picking) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      setReferencePickTarget(null)
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [picking, setReferencePickTarget])

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

  const handleAudioAvailability = useCallback((state: AudioGenerateAvailability) => {
    setAudioGate((prev) => (prev.blocked === state.blocked && prev.hint === state.hint ? prev : state))
  }, [])

  useEffect(() => {
    if (node?.type === 'audio') return
    setAudioGate((prev) => (prev.blocked || prev.hint ? { blocked: false, hint: '' } : prev))
  }, [node?.type])

  useEffect(() => {
    if (!node) {
      setQuote(null)
      setQuoteError('')
      return
    }
    if (node.type === 'audio') {
      const mode = readAudioMode(node.data.audioMode)
      const model = typeof node.data.model === 'string' ? node.data.model : ''
      if (mode === 'sfx' || !model) {
        setQuote(null)
        setQuoteError('')
        return
      }
      const projectId = resolveProjectId()
      const timer = window.setTimeout(() => {
        creditsApi
          .quote({
            model,
            modality: 'audio',
            n: 1,
            projectId,
          })
          .then((result) => {
            setQuote(result)
            setQuoteError('')
          })
          .catch((error: unknown) => {
            setQuote(null)
            setQuoteError(error instanceof Error ? error.message : '估价失败')
          })
      }, 280)
      return () => window.clearTimeout(timer)
    }
    const projectId = resolveProjectId()
    const timer = window.setTimeout(() => {
      const payload =
        node.type === 'videoConfig'
          ? {
              model: String(node.data.model || 'happyhorse-1.1-t2v'),
              modality: 'video' as const,
              size: node.data.size,
              resolution: node.data.resolution,
              duration: Number(node.data.duration || 5),
              imageCount: videoReferenceCount,
              n: normalizeVideoQuantity(node.data.n),
              projectId,
            }
          : {
              model: String(node.data.model || 'gpt-image-2'),
              modality: 'image' as const,
              quality: node.data.quality,
              size: node.data.size,
              n: 1,
              projectId,
            }
      creditsApi
        .quote(payload)
        .then((result) => {
          setQuote(result)
          setQuoteError('')
        })
        .catch((error: unknown) => {
          setQuote(null)
          setQuoteError(error instanceof Error ? error.message : '估价失败')
        })
    }, 280)
    return () => window.clearTimeout(timer)
  }, [
    node,
    node?.data.model,
    node?.data.quality,
    node?.data.size,
    node?.data.resolution,
    node?.data.duration,
    node?.data.n,
    node?.data.audioMode,
    node?.type,
    slots,
    videoReferenceCount,
  ])

  const handlePromptChange = (value: string) => {
    if (!selectedId) return
    setDraftPrompt(value)
    updateNode(selectedId, { prompt: value })
  }

  const handleInsertMention = (slot: ReferenceSlot) => {
    mentionRef.current?.insertSlot(slot)
  }

  const handleCastClick = () => {
    message.info('角色库将在后续版本接入')
  }

  const insufficient = Boolean(quote && (!quote.sufficient || !quote.quotaOk))
  const blockedReason = quote && !quote.sufficient ? '积分不足' : quote && !quote.quotaOk ? (quote.message || '额度不足') : quoteError
  const audioCopy = node?.type === 'audio' && readAudioMode(node.data.audioMode) !== 'sfx'
    ? buildCanvasAudioRequest({
        mode: readAudioMode(node.data.audioMode),
        model: typeof node.data.model === 'string' && node.data.model ? node.data.model : 'pending',
        prompt: draftPrompt,
        lyrics: connectedInputs?.textSnippets.join('\n\n') || '',
        voiceId: typeof node.data.voiceId === 'string' ? node.data.voiceId : undefined,
      })
    : null
  const audioCopyMessage = audioCopy && !audioCopy.ok && audioCopy.message !== '当前没有可用的音频模型'
    ? audioCopy.message
    : ''
  const audioBlocked = node?.type === 'audio' && (audioGate.blocked || Boolean(audioCopyMessage))
  const audioReason = audioGate.blocked ? audioGate.hint : audioCopyMessage

  const handleToggleReferencePick = (event: React.MouseEvent) => {
    event.stopPropagation()
    if (!selectedId) return
    setReferencePickTarget(picking ? null : selectedId)
  }

  const handleSend = (event: React.MouseEvent) => {
    event.stopPropagation()
    if (picking) {
      message.info(REFERENCE_PICK_SEND_BLOCKED)
      return
    }
    if (audioBlocked) {
      if (audioReason) message.info(audioReason)
      return
    }
    if (insufficient) {
      message.warning(blockedReason || '积分不足')
      return
    }
    void send(draftPrompt).catch((error: unknown) => {
      const code = error instanceof HttpError ? Number(error.code) : NaN
      if (code === 2003) message.warning('积分不足')
      else if (code === 2004) message.warning('额度不足')
    })
  }

  return (
    <NodeDockOverlay
      nodeId={selectedId && node ? selectedId : null}
      barWidth={BAR_WIDTH}
      maxWidth={BAR_WIDTH}
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
            'w-full min-w-0 border border-[hsl(var(--outline-variant))]/40 bg-[hsl(var(--surface-container-lowest))]/96 p-3 backdrop-blur-md',
            placeAbove
              ? 'rounded-[24px] shadow-[0_18px_50px_rgba(42,28,24,0.12)]'
              : 'rounded-[22px] shadow-[0_10px_28px_rgba(42,28,24,0.10)]'
          )}
        >
          <div className="mb-2 flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <Tooltip title={picking ? REFERENCE_PICK_EXIT_TOOLTIP : REFERENCE_PICK_TOOLTIP} placement="top">
                <button
                  type="button"
                  onClick={handleToggleReferencePick}
                  aria-pressed={picking}
                  data-reference-pick-toggle={picking ? 'on' : 'off'}
                  className={cn(
                    'inline-flex h-8 shrink-0 items-center gap-1 rounded-full px-3 text-[12px] font-semibold transition-colors',
                    picking
                      ? 'signature-gradient text-white shadow-sm'
                      : 'bg-[hsl(var(--surface-container-high))] text-[hsl(var(--on-surface))] hover:bg-[hsl(var(--surface-container-highest))]'
                  )}
                >
                  {REFERENCE_PICK_BUTTON_LABEL}
                </button>
              </Tooltip>
              {slots.length > 0 ? (
                <span className="shrink-0 rounded-full bg-[hsl(var(--surface-container-high))] px-2.5 py-1 text-[10px] font-semibold tracking-wide text-[hsl(var(--secondary))]">
                  {`${slots.length} 个参考`}
                </span>
              ) : null}
            </div>
            <div className="flex min-w-0 items-center gap-2 overflow-x-auto pb-0.5">
              {slots.length === 0 ? (
                <div className="flex h-14 items-center gap-3 rounded-2xl border-2 border-dashed border-[hsl(var(--outline-variant))]/45 bg-[hsl(var(--surface-container-low))] px-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[hsl(var(--surface-container-lowest))] text-[hsl(var(--secondary))]">
                    <ImagePlus className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-[hsl(var(--on-surface))]">参考资源</p>
                    <p className="text-[11px] text-[hsl(var(--secondary))]">{REFERENCE_EMPTY_HINT}</p>
                  </div>
                </div>
              ) : (
                slots.map((slot) => (
                  <SlotThumb key={slot.edgeId} slot={slot} onInsert={handleInsertMention} />
                ))
              )}
            </div>
          </div>

          <MentionPromptInput
            ref={mentionRef}
            value={draftPrompt}
            slots={slots}
            onChange={handlePromptChange}
            placeholder={
              node.type === 'audio'
                ? audioPromptPlaceholder(readAudioMode(node.data.audioMode))
                : node.type === 'videoConfig'
                  ? '描述视频，输入 @ 引用已连入的参考…'
                  : '描述画面，输入 @ 引用已连入的参考…'
            }
          />

          {node.type === 'audio' && audioGate.hint ? (
            <p className="mt-2 text-[11px] leading-4 text-[hsl(var(--secondary))]">{audioGate.hint}</p>
          ) : null}

          {suppressVideoAspect ? (
            <p className="mt-2 text-[11px] leading-4 text-[hsl(var(--secondary))]">
              {VIDEO_REFERENCE_ASPECT_HINT}
            </p>
          ) : null}

          <div className="mt-2 flex min-w-0 items-center gap-1.5">
            <div className="flex min-w-0 flex-1 items-center gap-1.5">
              {node.type === 'audio' ? (
                <AudioGenerateControls
                  node={node}
                  onChange={handleModelChange}
                  onAvailability={handleAudioAvailability}
                />
              ) : (
                <>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handleCastClick}
                      className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-[hsl(var(--surface-container-high))] px-2.5 py-1 text-[11px] font-medium text-[hsl(var(--on-surface-variant))] transition-colors hover:bg-[hsl(var(--surface-container-highest))]"
                    >
                      <Users className="h-3 w-3" />
                      角色库
                    </button>
                  </div>
                  <DockDivider />
                  <GenerateBarModelPicker
                    node={node}
                    onChange={handleModelChange}
                    suppressVideoAspect={suppressVideoAspect}
                    videoReferenceCount={videoReferenceCount}
                    imageReferenceCount={imageReferenceCount}
                  />
                </>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <span
                className={cn(
                  'inline-flex min-w-[4.5rem] shrink-0 items-center justify-end whitespace-nowrap text-[11px] font-semibold tabular-nums',
                  insufficient ? 'text-red-600' : 'text-[hsl(var(--secondary))]'
                )}
              >
                {quote ? `${quote.credits} 积分` : ''}
              </span>
              <DockDivider />
              <button
                type="button"
                onClick={handleSend}
                disabled={sending || insufficient || picking || audioBlocked}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full signature-gradient text-white shadow-md transition-opacity hover:opacity-90 disabled:opacity-50"
                title={
                  picking
                    ? REFERENCE_PICK_SEND_BLOCKED
                    : audioBlocked
                      ? audioReason || '暂不能生成'
                      : insufficient
                        ? blockedReason || '积分不足'
                        : '发送生成'
                }
              >
                <ArrowUp className={cn('h-4 w-4', sending && 'animate-pulse')} />
              </button>
            </div>
          </div>
        </div>
        </>
        )
      }}
    </NodeDockOverlay>
  )
}

export default NodeGenerateBar
