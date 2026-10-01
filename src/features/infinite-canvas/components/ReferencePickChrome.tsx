import { useMemo } from 'react'
import { useNodeId } from 'reactflow'
import { useModelsStore } from '@/store/modelsStore'
import { cn } from '@/lib/utils'
import { useCanvasStore } from '../stores/canvasStore'
import { assessReferencePick } from '../utils/referencePick'

/**
 * On-canvas pick state for the node that renders this.
 * Pickable and connected stay readable; blocked sources show why they cannot be added.
 */
export function ReferencePickChrome({ roundedClass = 'rounded-[20px]' }: { roundedClass?: string }) {
  const nodeId = useNodeId()
  const targetId = useCanvasStore((state) => state.referencePickTargetId)
  if (!nodeId || !targetId) return null
  return <ReferencePickChromeLive nodeId={nodeId} targetId={targetId} roundedClass={roundedClass} />
}

function ReferencePickChromeLive({
  nodeId,
  targetId,
  roundedClass,
}: {
  nodeId: string
  targetId: string
  roundedClass: string
}) {
  const nodes = useCanvasStore((state) => state.nodes)
  const edges = useCanvasStore((state) => state.edges)
  const imageModels = useModelsStore((state) => state.image.models)
  const liveImageModelIds = useMemo(
    () => imageModels.filter((model) => model.isEnabled !== false).map((model) => model.id),
    [imageModels]
  )
  const assessment = useMemo(() => {
    const source = nodes.find((node) => node.id === nodeId)
    const target = nodes.find((node) => node.id === targetId)
    if (!source || !target) return null
    return assessReferencePick({
      source,
      target,
      nodes,
      edges,
      liveImageModelIds,
    })
  }, [edges, liveImageModelIds, nodeId, nodes, targetId])

  if (!assessment) return null
  const dim = assessment.visual === 'blocked' && assessment.block !== 'self'

  return (
    <div
      className={cn(
        'pointer-events-none absolute inset-0 z-20',
        roundedClass,
        assessment.visual === 'pickable' && 'border-2 border-dashed border-[hsl(var(--primary))]',
        assessment.visual === 'connected' && 'border-2 border-[hsl(var(--primary))]',
        dim && 'bg-[hsl(var(--surface-container-lowest))]/50'
      )}
      data-reference-pick-visual={assessment.visual}
      data-reference-pick-block={assessment.block || ''}
    >
      <span
        className={cn(
          'absolute left-2 right-2 truncate rounded-full bg-[hsl(var(--surface-container-lowest))]/95 px-2 py-1 text-center text-[11px] font-semibold text-[hsl(var(--on-surface))] shadow-sm',
          assessment.block === 'self' ? 'top-2' : 'bottom-2'
        )}
      >
        {assessment.chip}
      </span>
    </div>
  )
}

export default ReferencePickChrome
