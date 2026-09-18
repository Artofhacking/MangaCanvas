import React from 'react'

type Option = {
  label: string
  value: string | number
}

type GroupedOption = {
  label: string
  options: Option[]
}

type NodeSelectProps = {
  value?: string | number
  onChange: (value: string | number) => void
  options: Array<Option | GroupedOption>
  placeholder?: string
  loading?: boolean
  disabled?: boolean
}

function isGroup(item: Option | GroupedOption): item is GroupedOption {
  return Array.isArray((item as GroupedOption).options)
}

function flattenOptions(options: Array<Option | GroupedOption>): Option[] {
  return options.flatMap((item) => (isGroup(item) ? item.options : [item]))
}

const NodeSelect: React.FC<NodeSelectProps> = ({
  value,
  onChange,
  options,
  placeholder,
  loading = false,
  disabled = false,
}) => {
  const flat = flattenOptions(options)
  const hasValue = flat.some((item) => String(item.value) === String(value))
  const displayValue = hasValue ? String(value) : ''

  return (
    <select
      className="nodrag nowheel h-8 w-full rounded-md border px-2 text-sm outline-none"
      style={{
        backgroundColor: 'var(--bg-secondary, var(--ic-surface-container-low, #f4efe9))',
        borderColor: 'var(--border-color, var(--ic-outline-variant, rgba(26,26,26,0.18)))',
        color: 'var(--text-primary, var(--ic-on-surface, #1f1f1f))',
      }}
      value={displayValue}
      disabled={disabled || loading || flat.length === 0}
      onChange={(event) => {
        const raw = event.target.value
        const matched = flat.find((item) => String(item.value) === raw)
        if (!matched) return
        onChange(typeof value === 'number' || typeof matched.value === 'number' ? Number(matched.value) : matched.value)
      }}
    >
      {!hasValue && (
        <option value="" disabled>
          {loading ? '检测可用模型...' : placeholder || '请选择'}
        </option>
      )}
      {options.map((item) => {
        if (isGroup(item)) {
          return (
            <optgroup key={item.label} label={item.label}>
              {item.options.map((option) => (
                <option key={String(option.value)} value={String(option.value)}>
                  {option.label}
                </option>
              ))}
            </optgroup>
          )
        }
        return (
          <option key={String(item.value)} value={String(item.value)}>
            {item.label}
          </option>
        )
      })}
    </select>
  )
}

export default NodeSelect
