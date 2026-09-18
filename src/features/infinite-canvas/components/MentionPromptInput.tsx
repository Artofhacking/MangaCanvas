import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import type { ReferenceSlot } from '../utils/generateSlots'
import {
  filterMentionSlots,
  getAtQuery,
  insertMentionToken,
  isMentionBroken,
} from '../utils/promptMentions'
import { cn } from '@/lib/utils'

export interface MentionPromptInputHandle {
  insertSlot: (slot: ReferenceSlot) => void
  focus: () => void
}

interface MentionPromptInputProps {
  value: string
  slots: ReferenceSlot[]
  placeholder?: string
  onChange: (value: string) => void
}

function HighlightedPrompt({ value, slots }: { value: string; slots: ReferenceSlot[] }) {
  const parts = value.split(/(@(?:\d+|？|\?))/g)
  return (
    <>
      {parts.map((part, index) => {
        if (!/^@(?:\d+|？|\?)$/.test(part)) {
          return <span key={`${index}-${part}`}>{part}</span>
        }
        const broken = isMentionBroken(part, slots)
        return (
          <span
            key={`${index}-${part}`}
            className={cn(
              'rounded-md px-0.5 font-semibold',
              broken
                ? 'bg-red-500/15 text-red-600'
                : 'bg-[hsl(var(--primary))]/12 text-[hsl(var(--primary))]'
            )}
          >
            {part}
          </span>
        )
      })}
      {value.endsWith('\n') ? '\n' : null}
    </>
  )
}

const MentionPromptInput = forwardRef<MentionPromptInputHandle, MentionPromptInputProps>(
  ({ value, slots, placeholder, onChange }, ref) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const [caret, setCaret] = useState(0)
    const [activeIndex, setActiveIndex] = useState(0)

    const atQuery = useMemo(() => getAtQuery(value, caret), [caret, value])
    const filtered = useMemo(
      () => (atQuery ? filterMentionSlots(slots, atQuery.query) : []),
      [atQuery, slots]
    )
    const pickerOpen = Boolean(atQuery)

    useEffect(() => {
      setActiveIndex(0)
    }, [atQuery?.query, pickerOpen])

    const applyInsert = (slot: ReferenceSlot, fromCaret = caret) => {
      const next = insertMentionToken(value, fromCaret, slot)
      onChange(next.text)
      requestAnimationFrame(() => {
        const el = textareaRef.current
        if (!el) return
        el.focus()
        el.setSelectionRange(next.caret, next.caret)
        setCaret(next.caret)
      })
    }

    useImperativeHandle(ref, () => ({
      insertSlot: (slot) => {
        const el = textareaRef.current
        const from = el ? el.selectionStart : value.length
        applyInsert(slot, from)
      },
      focus: () => textareaRef.current?.focus(),
    }))

    const syncCaret = (el: HTMLTextAreaElement | null) => {
      if (!el) return
      setCaret(el.selectionStart)
    }

    const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (!pickerOpen) return
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setActiveIndex((index) => (filtered.length === 0 ? 0 : (index + 1) % filtered.length))
        return
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault()
        setActiveIndex((index) =>
          filtered.length === 0 ? 0 : (index - 1 + filtered.length) % filtered.length
        )
        return
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        const slot = filtered[activeIndex]
        if (slot) {
          event.preventDefault()
          applyInsert(slot)
        }
        return
      }
      if (event.key === 'Escape') {
        event.preventDefault()
        setCaret(value.length)
      }
    }

    return (
      <div className="relative">
        {pickerOpen ? (
          <div className="absolute bottom-full left-0 right-0 z-[80] mb-1 max-h-56 overflow-y-auto rounded-2xl border border-[hsl(var(--outline-variant))]/40 bg-[hsl(var(--surface-container-lowest))] p-1.5 shadow-xl">
            {filtered.length === 0 ? (
              <div className="px-3 py-2 text-xs text-[hsl(var(--secondary))]">
                {slots.filter((slot) => !slot.dead).length === 0
                  ? '先把资源连入当前节点'
                  : '没有匹配的参考'}
              </div>
            ) : (
              filtered.map((slot, index) => (
                <button
                  key={slot.edgeId}
                  type="button"
                  onMouseDown={(event) => {
                    event.preventDefault()
                    applyInsert(slot)
                  }}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left',
                    index === activeIndex
                      ? 'bg-[hsl(var(--primary))]/10'
                      : 'hover:bg-[hsl(var(--surface-container-low))]'
                  )}
                >
                  <div className="h-8 w-8 shrink-0 overflow-hidden rounded-lg bg-[hsl(var(--surface-container-low))]">
                    {slot.thumbUrl ? (
                      <img src={slot.thumbUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-[10px] font-bold text-[hsl(var(--primary))]">
                        @{slot.index}
                      </span>
                    )}
                  </div>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-semibold text-[hsl(var(--on-surface))]">
                      @{slot.index} {slot.label}
                    </span>
                    {slot.snippet ? (
                      <span className="block truncate text-[10px] text-[hsl(var(--secondary))]">
                        {slot.snippet}
                      </span>
                    ) : null}
                  </span>
                </button>
              ))
            )}
          </div>
        ) : null}

        <div className="relative">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 overflow-hidden whitespace-pre-wrap break-words px-3 py-2.5 text-sm leading-5 text-[hsl(var(--on-surface))]"
          >
            {value ? (
              <HighlightedPrompt value={value} slots={slots} />
            ) : (
              <span className="text-[hsl(var(--secondary))]">{placeholder}</span>
            )}
          </div>
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(event) => {
              onChange(event.target.value)
              setCaret(event.target.selectionStart)
            }}
            onKeyDown={handleKeyDown}
            onClick={(event) => syncCaret(event.currentTarget)}
            onKeyUp={(event) => syncCaret(event.currentTarget)}
            onSelect={(event) => syncCaret(event.currentTarget)}
            spellCheck={false}
            className="min-h-[88px] w-full resize-none rounded-2xl bg-[hsl(var(--surface-container-low))] px-3 py-2.5 text-sm leading-5 text-transparent caret-[hsl(var(--on-surface))] placeholder:text-transparent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[hsl(var(--primary))]"
          />
        </div>
      </div>
    )
  }
)

MentionPromptInput.displayName = 'MentionPromptInput'

export default MentionPromptInput
