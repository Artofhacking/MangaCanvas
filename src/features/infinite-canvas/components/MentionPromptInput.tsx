import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { ReferenceSlot } from '../utils/generateSlots'
import {
  fitMentionPromptHeight,
  MENTION_PROMPT_FIELD_CLASS,
  MENTION_PROMPT_OVERLAY_SCROLL_CLASS,
  MENTION_PROMPT_TEXTAREA_SCROLL_CLASS,
  MENTION_TOKEN_BROKEN_CLASS,
  MENTION_TOKEN_MARK_CLASS,
  MENTION_TOKEN_OK_CLASS,
  syncOverlayScroll,
} from '../utils/mentionPromptLayout'
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
              MENTION_TOKEN_MARK_CLASS,
              broken ? MENTION_TOKEN_BROKEN_CLASS : MENTION_TOKEN_OK_CLASS
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
    const highlightRef = useRef<HTMLDivElement>(null)
    const [caret, setCaret] = useState(0)
    const [activeIndex, setActiveIndex] = useState(0)

    const syncHighlightScroll = useCallback(() => {
      const el = textareaRef.current
      const overlay = highlightRef.current
      if (!el || !overlay) return
      syncOverlayScroll(el, overlay)
    }, [])

    const syncTextareaLayout = useCallback(() => {
      const el = textareaRef.current
      if (!el) return
      const caretAtEnd = el.selectionStart >= el.value.length
      const prevScroll = el.scrollTop
      fitMentionPromptHeight(el)
      el.scrollTop = caretAtEnd ? el.scrollHeight : prevScroll
      syncHighlightScroll()
    }, [syncHighlightScroll])

    useLayoutEffect(() => {
      syncTextareaLayout()
    }, [syncTextareaLayout, value])

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
        syncTextareaLayout()
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
            ref={highlightRef}
            aria-hidden
            className={cn(
              'pointer-events-none absolute inset-0 rounded-2xl text-[hsl(var(--on-surface))]',
              MENTION_PROMPT_FIELD_CLASS,
              MENTION_PROMPT_OVERLAY_SCROLL_CLASS
            )}
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
            onScroll={syncHighlightScroll}
            onKeyDown={handleKeyDown}
            onClick={(event) => syncCaret(event.currentTarget)}
            onKeyUp={(event) => syncCaret(event.currentTarget)}
            onSelect={(event) => syncCaret(event.currentTarget)}
            spellCheck={false}
            className={cn(
              'min-h-[120px] max-h-[min(45vh,320px)] w-full resize-none rounded-2xl border-0 bg-[hsl(var(--surface-container-low))] text-transparent caret-[hsl(var(--on-surface))] placeholder:text-transparent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[hsl(var(--primary))]',
              MENTION_PROMPT_FIELD_CLASS,
              MENTION_PROMPT_TEXTAREA_SCROLL_CLASS
            )}
          />
        </div>
      </div>
    )
  }
)

MentionPromptInput.displayName = 'MentionPromptInput'

export default MentionPromptInput
