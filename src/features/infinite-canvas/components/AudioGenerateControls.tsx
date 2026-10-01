import { useEffect, useMemo, useRef } from 'react'
import { Check, ChevronDown, Loader2 } from 'lucide-react'
import { message } from 'antd'
import type { CustomNode } from '../types'
import { useAudioModels } from '../hooks/useModels'
import { liveModelsToPicker } from '../config/modelCapabilities'
import { audioModelTip } from '../config/audioModelTip'
import { displayModelName } from '@/lib/displayModelName'
import { resolveGenerateBarModelNotice } from '../utils/generateBarModelNotice'
import {
  audioGenerateBlockedMessage,
  audioModePatch,
  audioModelsForMode,
  readAudioMode,
  type AudioNodeMode,
} from '../utils/audioMode'
import { AudioModeSwitch } from './AudioModeSwitch'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

const DOCK_MENU =
  'z-[80] min-w-[10.5rem] overflow-y-auto rounded-xl border-[hsl(var(--outline-variant))]/30 bg-[hsl(var(--surface-container-lowest))] p-1.5 shadow-xl'

export interface AudioGenerateAvailability {
  blocked: boolean
  hint: string
}

export function AudioGenerateControls({
  node,
  onChange,
  onAvailability,
}: {
  node: CustomNode
  onChange: (data: Partial<CustomNode['data']>) => void
  onAvailability: (state: AudioGenerateAvailability) => void
}) {
  const { models, loading, error, isLoaded } = useAudioModels()
  const mode = readAudioMode(node.data.audioMode)
  const pickerModels = useMemo(
    () => liveModelsToPicker(models, 'audio', loading),
    [loading, models]
  )
  const available = useMemo(() => audioModelsForMode(pickerModels, mode), [mode, pickerModels])
  const currentId = typeof node.data.model === 'string' ? node.data.model : ''
  const selected = available.find((item) => item.key === currentId) || available[0]
  const voices = mode === 'tts' ? selected?.voices || [] : []
  const currentVoice = typeof node.data.voiceId === 'string' ? node.data.voiceId : ''
  const selectedVoice = voices.find((item) => item.key === currentVoice) || voices[0]
  const toastedRef = useRef<string | null>(null)

  useEffect(() => {
    const notice = resolveGenerateBarModelNotice({
      loading,
      isLoaded,
      error,
      modelCount: models.length,
    })
    const toastKey = `${error || 'empty'}:${notice || 'ok'}`
    if (!notice || toastedRef.current === toastKey) return
    toastedRef.current = toastKey
    if (notice === 'load-error') message.error('音频模型列表加载失败')
  }, [error, isLoaded, loading, models.length])

  useEffect(() => {
    if (loading || !isLoaded) return
    const nextModel = available.some((item) => item.key === currentId) ? currentId : available[0]?.key || ''
    const model = available.find((item) => item.key === nextModel)
    const nextVoices = mode === 'tts' ? model?.voices || [] : []
    const nextVoice = nextVoices.some((item) => item.key === currentVoice)
      ? currentVoice
      : model?.defaultParams?.voiceId || nextVoices[0]?.key || ''
    const patch: Partial<CustomNode['data']> = {}
    if (nextModel !== currentId) patch.model = nextModel
    if (mode === 'tts' && nextVoice !== currentVoice) patch.voiceId = nextVoice
    if (Object.keys(patch).length) onChange(patch)
  }, [available, currentId, currentVoice, isLoaded, loading, mode, onChange])

  useEffect(() => {
    if (loading || !isLoaded) {
      onAvailability({ blocked: true, hint: '正在加载音频模型…' })
      return
    }
    if (error) {
      onAvailability({ blocked: true, hint: '音频模型列表加载失败' })
      return
    }
    if (!available.length) {
      onAvailability({
        blocked: true,
        hint: audioGenerateBlockedMessage(mode, models.length),
      })
      return
    }
    onAvailability({ blocked: false, hint: '' })
  }, [available.length, error, isLoaded, loading, mode, models.length, onAvailability])

  const handleMode = (next: AudioNodeMode) => {
    onChange(audioModePatch(next))
  }

  return (
    <div className="flex min-w-0 flex-1 items-center gap-1.5">
      <AudioModeSwitch value={mode} onChange={handleMode} disabled={Boolean(node.data.loading)} />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            disabled={loading || available.length === 0}
            title={selected ? audioModelTip(selected.key, selected.label) || displayModelName(selected.label) || selected.key : '音频模型'}
            className="inline-flex h-8 w-[10.5rem] shrink-0 items-center gap-1 overflow-hidden rounded-full px-2 text-[11px] font-medium text-[hsl(var(--on-surface))] hover:bg-[hsl(var(--surface-container-low))] disabled:opacity-50"
          >
            <span className="min-w-0 flex-1 truncate text-left">
              {loading ? '加载模型…' : selected ? displayModelName(selected.label) || selected.key : '暂无模型'}
            </span>
            {loading ? (
              <Loader2 className="h-3 w-3 shrink-0 animate-spin text-[hsl(var(--secondary))]" />
            ) : (
              <ChevronDown className="h-3 w-3 shrink-0 text-[hsl(var(--secondary))]" />
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" sideOffset={8} className={DOCK_MENU}>
          {available.map((item) => (
            <DropdownMenuItem
              key={item.key}
              onClick={() => onChange({
                model: item.key,
                modelLabel: item.label,
                voiceId: item.defaultParams?.voiceId || item.voices?.[0]?.key || '',
              })}
              className={cn(
                'rounded-lg px-2.5 py-2 text-sm',
                item.key === selected?.key
                  ? 'bg-[hsl(var(--primary))] text-white focus:bg-[hsl(var(--primary))] focus:text-white'
                  : 'text-[hsl(var(--on-surface))]'
              )}
            >
              <Check className={cn('mr-2 h-3.5 w-3.5', item.key === selected?.key ? 'opacity-100' : 'opacity-0')} />
              <span className="min-w-0">
                <span className="block">{displayModelName(item.label) || item.key}</span>
                {audioModelTip(item.key, item.label) ? (
                  <span className={cn('block text-[11px]', item.key === selected?.key ? 'text-white/80' : 'text-[hsl(var(--secondary))]')}>
                    {audioModelTip(item.key, item.label)}
                  </span>
                ) : null}
              </span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      {voices.length > 0 ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              title={selectedVoice?.label || '音色'}
              className="inline-flex h-8 w-[7.5rem] shrink-0 items-center gap-1 overflow-hidden rounded-full px-2 text-[11px] font-medium text-[hsl(var(--on-surface))] hover:bg-[hsl(var(--surface-container-low))]"
            >
              <span className="min-w-0 flex-1 truncate text-left">{selectedVoice?.label || '音色'}</span>
              <ChevronDown className="h-3 w-3 shrink-0 text-[hsl(var(--secondary))]" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" sideOffset={8} className={cn(DOCK_MENU, 'max-h-64')}>
            {voices.map((item) => (
              <DropdownMenuItem
                key={item.key}
                onClick={() => onChange({ voiceId: item.key })}
                className={cn(
                  'rounded-lg px-2.5 py-2 text-sm',
                  item.key === selectedVoice?.key
                    ? 'bg-[hsl(var(--primary))] text-white focus:bg-[hsl(var(--primary))] focus:text-white'
                    : 'text-[hsl(var(--on-surface))]'
                )}
              >
                <Check className={cn('mr-2 h-3.5 w-3.5', item.key === selectedVoice?.key ? 'opacity-100' : 'opacity-0')} />
                {item.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  )
}
