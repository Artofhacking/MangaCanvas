import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { SHAPING_LABEL, normalizeShapingStatus } from '@/features/project/shaping'
import type { ShapingStatus } from '@/types'
import { Lock, LockOpen } from 'lucide-react'

const BADGE_CLASS: Record<ShapingStatus, string> = {
  unset: 'bg-[hsl(var(--surface-container-highest))] text-[hsl(var(--on-surface-variant))]',
  semi: 'bg-[hsl(var(--primary))]/12 text-[hsl(var(--primary))]',
  final: 'bg-[hsl(var(--primary))] text-white',
}

export function ShapingBadge({ status }: { status?: ShapingStatus | null }) {
  const normalized = normalizeShapingStatus(status)
  return (
    <Badge className={`border-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${BADGE_CLASS[normalized]}`}>
      {SHAPING_LABEL[normalized]}
    </Badge>
  )
}

interface ShapingPanelProps {
  status?: ShapingStatus | null
  prompt?: string
  busy?: boolean
  onLock?: () => void
  onUnlock?: () => void
}

export default function ShapingPanel({ status, prompt, busy = false, onLock, onUnlock }: ShapingPanelProps) {
  const normalized = normalizeShapingStatus(status)
  const promptEmpty = !prompt?.trim()

  return (
    <div className="rounded-xl bg-[hsl(var(--surface-container-low))] p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs text-[hsl(var(--secondary))]">定型</p>
          <p className="mt-1 text-sm font-bold text-[hsl(var(--on-surface))]">{SHAPING_LABEL[normalized]}</p>
        </div>
        <ShapingBadge status={normalized} />
      </div>
      <p className="mt-2 text-xs leading-5 text-[hsl(var(--secondary))]">
        {normalized === 'unset'
          ? '锁定提示词后才能出分镜。再补一张定妆封面，就会变成已定妆。'
          : normalized === 'semi'
            ? '尚未定妆，仅按提示词约束。在编辑里生成并设为封面即可定妆。'
            : '改提示词或换定妆前需要先解锁。解锁后回到还没定，封面仍会留着。'}
      </p>
      <div className="mt-3">
        {normalized === 'unset' ? (
          <Button
            type="button"
            disabled={busy || promptEmpty || !onLock}
            title={promptEmpty ? '请先填写提示词' : undefined}
            onClick={onLock}
            className="h-9 rounded-xl signature-gradient border-0 px-4 text-xs font-bold text-white disabled:opacity-60"
          >
            <Lock className="mr-1 h-3.5 w-3.5" />
            锁定提示词
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            disabled={busy || !onUnlock}
            onClick={onUnlock}
            className="h-9 rounded-xl border-[hsl(var(--outline-variant))]/40 px-4 text-xs font-bold"
          >
            <LockOpen className="mr-1 h-3.5 w-3.5" />
            解锁
          </Button>
        )}
        {normalized === 'unset' && promptEmpty ? (
          <p className="mt-2 text-xs text-[hsl(var(--secondary))]">请先填写提示词</p>
        ) : null}
      </div>
    </div>
  )
}
