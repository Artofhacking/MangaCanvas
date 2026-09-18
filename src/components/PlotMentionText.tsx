import type { PlotAsset } from '@/lib/plotMentions'
import { mentionizePlot, tokenizePlot } from '@/lib/plotMentions'

type PlotMentionTextProps = {
  text: string
  assets: PlotAsset[]
  onMentionClick?: (asset: PlotAsset) => void
  className?: string
}

export default function PlotMentionText({ text, assets, onMentionClick, className }: PlotMentionTextProps) {
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
            className="nodrag nopan mx-0.5 inline rounded-md px-1 font-semibold text-[hsl(var(--primary))] hover:underline"
            title={`${token.asset.category === 'character' ? '角色' : token.asset.category === 'scene' ? '场景' : '物品'}：${token.asset.name}`}
            onClick={(event) => {
              event.stopPropagation()
              event.preventDefault()
              onMentionClick?.(token.asset)
            }}
          >
            @{token.asset.name}
          </button>
        )
      })}
    </span>
  )
}
