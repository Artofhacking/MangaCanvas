import React, { useState } from 'react'
import { Input } from 'antd'
import { MoreHorizontal } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

export const IMAGE_PREVIEW_WIDTH = 360
export const VIDEO_PREVIEW_WIDTH = 420

export function cssAspectRatio(ratio?: string, fallback = '1 / 1') {
  if (!ratio) return fallback
  const parts = ratio.split(/[:/x×*]/i).map((part) => Number(part.trim()))
  if (parts.length < 2 || !parts[0] || !parts[1]) return fallback
  return `${parts[0]} / ${parts[1]}`
}

export interface MediaCardAction {
  key: string
  label: string
  icon?: React.ReactNode
  onClick: (event: React.MouseEvent) => void
  danger?: boolean
  hidden?: boolean
  disabled?: boolean
}

interface MediaPreviewCardProps {
  selected?: boolean
  dropActive?: boolean
  label: string
  icon: React.ReactNode
  width?: number
  aspectRatio?: string
  handles?: React.ReactNode
  actions?: MediaCardAction[]
  isEditingLabel?: boolean
  editLabel?: string
  onLabelDoubleClick?: (event: React.MouseEvent) => void
  onLabelChange?: (event: React.ChangeEvent<HTMLInputElement>) => void
  onLabelBlur?: () => void
  onLabelKeyDown?: (event: React.KeyboardEvent<HTMLInputElement>) => void
  className?: string
  children: React.ReactNode
}

export function MediaEmptyGlyph({ kind }: { kind: 'image' | 'video' }) {
  if (kind === 'video') {
    return (
      <div className="flex h-full w-full items-center justify-center" aria-hidden>
        <svg
          viewBox="0 0 24 24"
          className="h-14 w-14 text-[hsl(var(--media-stage-muted))]"
          fill="currentColor"
        >
          <path d="M4 7.2A2.2 2.2 0 0 1 6.2 5h7.6A2.2 2.2 0 0 1 16 7.2v9.6A2.2 2.2 0 0 1 13.8 19H6.2A2.2 2.2 0 0 1 4 16.8V7.2Zm13.15 1.16 4.12-2.47A1 1 0 0 1 22.8 6.76v10.48a1 1 0 0 1-1.53.87l-4.12-2.47V8.36Z" />
        </svg>
      </div>
    )
  }

  return (
    <div className="flex h-full w-full items-center justify-center" aria-hidden>
      <svg
        viewBox="0 0 24 24"
        className="h-16 w-16 text-[hsl(var(--media-stage-muted))]"
        fill="currentColor"
      >
        <path d="M19 4H5a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h14a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3ZM8.2 8.1a1.6 1.6 0 1 1 0 3.2 1.6 1.6 0 0 1 0-3.2ZM5.1 17.2l3.4-4.7a1 1 0 0 1 1.58-.06L12.7 15l1.72-2.2a1 1 0 0 1 1.58 0L19 17.2H5.1Z" />
      </svg>
    </div>
  )
}

export function MediaStageLoading({ kind }: { kind: 'image' | 'video' }) {
  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden">
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      <MediaEmptyGlyph kind={kind} />
    </div>
  )
}

export const MediaPreviewCard: React.FC<MediaPreviewCardProps> = ({
  selected,
  dropActive,
  label,
  icon,
  width = IMAGE_PREVIEW_WIDTH,
  aspectRatio = '1 / 1',
  handles,
  actions,
  isEditingLabel,
  editLabel,
  onLabelDoubleClick,
  onLabelChange,
  onLabelBlur,
  onLabelKeyDown,
  className,
  children,
}) => {
  const [menuOpen, setMenuOpen] = useState(false)
  const visibleActions = (actions || []).filter((action) => !action.hidden)

  return (
    <div className={cn('media-preview-card group/media-card relative', className)} style={{ width }}>
      {handles}
      <div
        className={cn(
          'relative overflow-hidden rounded-[22px] border transition-[border-color,box-shadow] duration-200',
          dropActive
            ? 'border-[hsl(var(--primary))] shadow-[0_0_0_3px_hsl(var(--primary)/0.18)]'
            : selected
              ? 'border-[hsl(var(--primary))] shadow-[0_0_0_1px_hsl(var(--primary)/0.28)]'
              : 'border-[hsl(var(--media-stage-fg)/0.14)]'
        )}
        style={{
          aspectRatio,
          backgroundColor: 'hsl(var(--media-stage))',
        }}
      >
        <div className="absolute inset-0">{children}</div>

        <div className="absolute left-3 top-3 z-10 flex max-w-[72%] items-center gap-1.5">
          <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center text-[hsl(var(--media-stage-fg))]/72 [&>svg]:h-3.5 [&>svg]:w-3.5">
            {icon}
          </span>
          {isEditingLabel ? (
            <Input
              value={editLabel}
              onChange={onLabelChange}
              onBlur={onLabelBlur}
              onKeyDown={onLabelKeyDown}
              autoFocus
              size="small"
              className="nodrag nopan nowheel pointer-events-auto h-6 w-36 text-xs"
              onClick={(event) => event.stopPropagation()}
              onPointerDown={(event) => event.stopPropagation()}
            />
          ) : (
            <span
              className="cursor-text truncate text-[12px] font-medium tracking-wide text-[hsl(var(--media-stage-fg))]/88"
              onDoubleClick={onLabelDoubleClick}
              title="双击编辑"
            >
              {label}
            </span>
          )}
        </div>

        {visibleActions.length > 0 ? (
          <div
            className={cn(
              'absolute right-2 top-2 z-20 transition-opacity duration-150',
              selected || menuOpen || dropActive
                ? 'opacity-100'
                : 'opacity-0 group-hover/media-card:opacity-100'
            )}
          >
            <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="nodrag nopan nowheel flex h-7 w-7 items-center justify-center rounded-full border border-[hsl(var(--media-stage-fg)/0.12)] bg-[hsl(var(--media-stage))]/70 text-[hsl(var(--media-stage-fg))]/88 backdrop-blur-sm transition-colors hover:bg-[hsl(var(--media-stage-fg)/0.12)]"
                  title="更多"
                  onClick={(event) => event.stopPropagation()}
                  onPointerDown={(event) => event.stopPropagation()}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                sideOffset={6}
                className="nodrag nopan nowheel z-[80] min-w-[148px] rounded-xl border-[hsl(var(--outline-variant))]/30 bg-[hsl(var(--surface-container-lowest))] p-1 shadow-xl"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => event.stopPropagation()}
              >
                {visibleActions.map((action) => (
                  <DropdownMenuItem
                    key={action.key}
                    disabled={action.disabled}
                    onClick={action.onClick}
                    className={cn(
                      'rounded-lg px-2.5 py-2 text-sm',
                      action.danger
                        ? 'text-[#b42318] focus:bg-[#b42318]/8 focus:text-[#b42318]'
                        : 'text-[hsl(var(--on-surface))]'
                    )}
                  >
                    {action.icon ? <span className="mr-2 flex h-4 w-4 items-center justify-center">{action.icon}</span> : null}
                    {action.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default MediaPreviewCard
