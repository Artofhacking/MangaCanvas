import { AUDIO_MODE_OPTIONS, type AudioNodeMode } from '../utils/audioMode'
import { cn } from '@/lib/utils'

export function AudioModeSwitch({
  value,
  onChange,
  disabled,
}: {
  value: AudioNodeMode
  onChange: (mode: AudioNodeMode) => void
  disabled?: boolean
}) {
  return (
    <div
      className="nodrag nopan nowheel inline-flex rounded-full bg-[hsl(var(--surface-container-high))] p-0.5"
      role="group"
      aria-label="音频模式"
    >
      {AUDIO_MODE_OPTIONS.map((option) => {
        const active = option.key === value
        return (
          <button
            key={option.key}
            type="button"
            disabled={disabled}
            aria-pressed={active}
            onClick={(event) => {
              event.stopPropagation()
              if (!active) onChange(option.key)
            }}
            onPointerDown={(event) => event.stopPropagation()}
            className={cn(
              'h-7 rounded-full px-2.5 text-[11px] font-semibold transition-colors disabled:opacity-50',
              active
                ? 'signature-gradient text-white shadow-sm'
                : 'text-[hsl(var(--on-surface-variant))] hover:text-[hsl(var(--on-surface))]'
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
