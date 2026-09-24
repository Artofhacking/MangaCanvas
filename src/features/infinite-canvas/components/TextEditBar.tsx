import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useCanvasStore } from '../stores/canvasStore'
import { mentionizePlot, type PlotAsset } from '@/lib/plotMentions'
import {
  MENTION_PROMPT_FIELD_CLASS,
  MENTION_PROMPT_TEXTAREA_SCROLL_CLASS,
} from '../utils/mentionPromptLayout'
import { isTextNoteType } from '../utils/nodeDock'
import {
  clearTextEditFocus,
  consumePendingTextEditFocus,
  getTextEditNodeId,
  resolveTextEditTarget,
  subscribeTextEditFocus,
} from '../utils/textEditFocus'
import { useExactlySelectedNodeId } from '../hooks/useNodeDock'
import { NodeDockOverlay } from './NodeDockOverlay'
import { cn } from '@/lib/utils'

const BAR_WIDTH = 480
const BAR_ESTIMATED_HEIGHT = 176
const PLACEHOLDER = '输入旁白、对白或便签…'

const TextEditBar: React.FC = () => {
  const selectedId = useExactlySelectedNodeId(isTextNoteType)
  const [editingId, setEditingId] = useState<string | null>(getTextEditNodeId)
  const activeId = resolveTextEditTarget(selectedId, editingId)
  const { node, nodes, updateNode } = useCanvasStore(
    useShallow((state) => ({
      node: state.nodes.find((item) => item.id === activeId) ?? null,
      nodes: state.nodes,
      updateNode: state.updateNode,
    }))
  )
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const plotAssets = useMemo<PlotAsset[]>(
    () =>
      nodes.flatMap((item) => {
        const assetId = Number(item.data.sourceAssetId)
        const name = String(item.data.label || '')
        const category = item.data.sourceType
        if (!assetId || !name) return []
        if (category !== 'character' && category !== 'scene' && category !== 'object') return []
        return [{ id: assetId, name, category, image: String(item.data.url || '') }]
      }),
    [nodes]
  )

  const focusInput = useCallback(() => {
    window.setTimeout(() => inputRef.current?.focus(), 40)
  }, [])

  useEffect(() => {
    setEditingId(getTextEditNodeId())
    return subscribeTextEditFocus(setEditingId)
  }, [])

  useEffect(() => {
    if (editingId && editingId !== selectedId) clearTextEditFocus(editingId)
  }, [editingId, selectedId])

  useEffect(() => {
    setDraft(typeof node?.data.content === 'string' ? node.data.content : '')
  }, [node?.data.content, activeId])

  useEffect(() => {
    if (!activeId) return
    consumePendingTextEditFocus(activeId)
    focusInput()
  }, [activeId, focusInput])

  const handleChange = (value: string) => {
    if (!activeId) return
    setDraft(value)
    updateNode(activeId, { content: value })
  }

  const handleBlur = () => {
    if (!activeId || !activeId.startsWith('act_')) return
    const next = mentionizePlot(draft, plotAssets)
    if (next !== draft) {
      setDraft(next)
      updateNode(activeId, { content: next })
    }
  }

  return (
    <NodeDockOverlay
      nodeId={activeId && node ? activeId : null}
      barWidth={BAR_WIDTH}
      estimatedHeight={BAR_ESTIMATED_HEIGHT}
      dockKey="text-edit"
    >
      {({ placeAbove }) => (
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
            <textarea
              ref={inputRef}
              value={draft}
              onChange={(event) => handleChange(event.target.value)}
              onBlur={handleBlur}
              placeholder={PLACEHOLDER}
              spellCheck={false}
              className={cn(
                'min-h-[120px] max-h-[min(45vh,320px)] w-full resize-none rounded-2xl border-0 bg-[hsl(var(--surface-container-low))] text-[hsl(var(--on-surface))] placeholder:text-[hsl(var(--secondary))] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[hsl(var(--primary))]',
                MENTION_PROMPT_FIELD_CLASS,
                MENTION_PROMPT_TEXTAREA_SCROLL_CLASS
              )}
            />
            <div className="mt-2 px-0.5 text-[11px] tabular-nums text-[hsl(var(--secondary))]">
              {draft.length} 字
            </div>
          </div>
        </>
      )}
    </NodeDockOverlay>
  )
}

export default TextEditBar
