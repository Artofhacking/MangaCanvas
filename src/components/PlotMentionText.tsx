import { useRef } from 'react'
import type { PlotAsset } from '@/lib/plotMentions'
import { mentionizePlot, tokenizePlot } from '@/lib/plotMentions'

type PlotMentionTextProps = {
  text: string
  assets: PlotAsset[]
  onMentionClick?: (asset: PlotAsset) => void
  className?: string
  /**
   * Inside a canvas node, @mentions must not wear `nodrag` or the card cannot
   * be grabbed. A click that does not travel still focuses the asset.
   */
  allowNodeDrag?: boolean
}

const DRAG_CLICK_THRESHOLD_PX = 4

function pointerMoved(
  origin: { x: number; y: number } | null,
  point: { clientX: number; clientY: number },
) {
  if (!origin) return false
  const dx = point.clientX - origin.x
  const dy = point.clientY - origin.y
  return dx * dx + dy * dy > DRAG_CLICK_THRESHOLD_PX * DRAG_CLICK_THRESHOLD_PX
}

export default function PlotMentionText({
  text,
  assets,
  onMentionClick,
  className,
  allowNodeDrag = false,
}: PlotMentionTextProps) {
  const pointerOrigin = useRef<{ x: number; y: number } | null>(null)
  const tokens = tokenizePlot(mentionizePlot(text || '', assets), assets)
  return (
    <span className={className}>
      {tokens.map((token, index) => {
        if (token.type !== 'mention') {
          return <span key={`${index}-${token.value}`}>{token.value}</span>
        }
        return (
          <button
            key={`${index}-${token.asset.id}`}
            type="button"
            className={
              allowNodeDrag
                ? 'mx-0.5 inline rounded-md px-1 font-semibold text-[hsl(var(--primary))] hover:underline'
                : 'nodrag nopan mx-0.5 inline rounded-md px-1 font-semibold text-[hsl(var(--primary))] hover:underline'
            }
            title={`${token.asset.category === 'character' ? '角色' : token.asset.category === 'scene' ? '场景' : '物品'}：${token.asset.name}`}
            onPointerDown={
              allowNodeDrag
                ? (event) => {
                    pointerOrigin.current = { x: event.clientX, y: event.clientY }
                  }
                : undefined
            }
            onClick={(event) => {
              if (allowNodeDrag && pointerMoved(pointerOrigin.current, event)) return
              event.stopPropagation()
              event.preventDefault()
              onMentionClick?.(token.asset)
            }}
            onDoubleClick={
              allowNodeDrag
                ? (event) => {
                    event.stopPropagation()
                    event.preventDefault()
                  }
                : undefined
            }
          >
            @{token.asset.name}
          </button>
        )
      })}
    </span>
  )
}
