import type { ReferenceSlot } from './generateSlots'

export interface SlotRef {
  index: number
  sourceId: string
}

const MENTION_TOKEN = /@(\d+|？|\?)/g

export function getAtQuery(text: string, caret: number): { start: number; query: string } | null {
  const before = text.slice(0, Math.max(0, caret))
  const at = before.lastIndexOf('@')
  if (at < 0) return null
  if (at > 0) {
    const prev = before[at - 1]
    if (prev && !/[\s([{（【,，、;；:：]/u.test(prev)) return null
  }
  const query = before.slice(at + 1)
  if (query.length > 0 && /\s/.test(query)) return null
  return { start: at, query }
}

export function filterMentionSlots(slots: ReferenceSlot[], query: string): ReferenceSlot[] {
  const alive = slots.filter((slot) => !slot.dead)
  const needle = query.trim().toLowerCase()
  if (!needle) return alive
  return alive.filter((slot) => {
    return (
      String(slot.index).includes(needle) ||
      slot.label.toLowerCase().includes(needle) ||
      (slot.snippet || '').toLowerCase().includes(needle)
    )
  })
}

export function insertMentionToken(
  text: string,
  caret: number,
  slot: ReferenceSlot
): { text: string; caret: number } {
  const query = getAtQuery(text, caret)
  const token = `@${slot.index} `
  if (query) {
    const next = `${text.slice(0, query.start)}${token}${text.slice(caret)}`
    return { text: next, caret: query.start + token.length }
  }
  const prefix = text.length > 0 && caret > 0 && !/\s$/.test(text.slice(0, caret)) ? ' ' : ''
  const insertion = `${prefix}${token}`
  const next = `${text.slice(0, caret)}${insertion}${text.slice(caret)}`
  return { text: next, caret: caret + insertion.length }
}

export function reconcilePromptMentions(
  prompt: string,
  previousSlots: SlotRef[],
  nextSlots: ReferenceSlot[]
): string {
  if (!prompt || previousSlots.length === 0) return prompt
  return prompt.replace(MENTION_TOKEN, (_match, raw: string) => {
    if (raw === '?' || raw === '？') return '@?'
    const prev = previousSlots.find((slot) => slot.index === Number(raw))
    if (!prev) return '@?'
    const next = nextSlots.find((slot) => slot.sourceId === prev.sourceId && !slot.dead)
    if (!next) return '@?'
    return `@${next.index}`
  })
}

export function parseMentionIndexes(prompt: string): number[] {
  const indexes: number[] = []
  for (const match of prompt.matchAll(/@(\d+)/g)) {
    const index = Number(match[1])
    if (!indexes.includes(index)) indexes.push(index)
  }
  return indexes
}

export function isMentionBroken(token: string, slots: ReferenceSlot[]): boolean {
  const match = token.match(/^@(\d+|？|\?)$/)
  if (!match) return false
  if (match[1] === '?' || match[1] === '？') return true
  return !slots.some((slot) => slot.index === Number(match[1]) && !slot.dead)
}

export function resolveMentionsForSend(prompt: string, slots: ReferenceSlot[]): string {
  const resolved = prompt.replace(MENTION_TOKEN, (_match, raw: string) => {
    if (raw === '?' || raw === '？') return ''
    const slot = slots.find((item) => item.index === Number(raw) && !item.dead)
    if (!slot) return ''
    if (slot.kind === 'text' && slot.snippet) {
      return `「${slot.snippet}」`
    }
    return `@${slot.index}`
  })
  return resolved
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}
