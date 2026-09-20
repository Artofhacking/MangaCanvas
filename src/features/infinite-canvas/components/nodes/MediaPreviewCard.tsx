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

export const IMAGE_PREVIEW_WIDTH = 448
export const VIDEO_PREVIEW_WIDTH = 448
export const IMAGE_EMPTY_ASPECT = '16 / 10'

function parseAspectParts(ratio?: string, fallback = '1 / 1') {
  const source = ratio || fallback
  const parts = source.split(/[:/x×*]/i).map((part) => Number(part.trim()))
  const w = parts[0] && parts[0] > 0 ? parts[0] : 1
  const h = parts[1] && parts[1] > 0 ? parts[1] : 1
  return { w, h, css: `${w} / ${h}` }
}

export function cssAspectRatio(ratio?: string, fallback = '1 / 1') {
  return parseAspectParts(ratio, fallback).css
}

export function previewCardHeight(width: number, ratio?: string, fallback = '1 / 1') {
  const { w, h } = parseAspectParts(ratio, fallback)
  return Math.round((width * h) / w)
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
  /** True when the card shows generated/uploaded media (keeps a dark well behind it). */
  filled?: boolean
  children: React.ReactNode
}

export function MediaEmptyGlyph({ kind }: { kind: 'image' | 'video' }) {
  if (kind === 'video') {
    return (
      <div className="flex h-full w-full items-center justify-center" aria-hidden>
        <svg
          viewBox="0 0 24 24"
          className="h-12 w-12 text-[hsl(var(--media-stage-muted))]"
          fill="currentColor"
        >
          <path d="M15 8.6v6.8l4.7 2.82A.8.8 0 0 0 21 17.54V6.46a.8.8 0 0 0-1.3-.68L15 8.6ZM4.8 6.5h9.1c.94 0 1.7.76 1.7 1.7v7.6c0 .94-.76 1.7-1.7 1.7H4.8c-.94 0-1.7-.76-1.7-1.7V8.2c0-.94.76-1.7 1.7-1.7Z" />
        </svg>
      </div>
    )
  }

  return (
    <div className="flex h-full w-full items-center justify-center" aria-hidden>
      <svg
        viewBox="0 0 64 48"
        className="h-14 w-[4.5rem] text-[hsl(var(--media-stage-muted))]"
        fill="currentColor"
      >
        <path d="M8 40 27.5 13.5 39 28.5 45 20 58 40H8Z" />
        <circle cx="43.5" cy="13.5" r="3.6" />
      </svg>
    </div>
  )
}

export function MediaStageLoading({ kind }: { kind: 'image' | 'video' }) {
  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden">
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-[hsl(var(--primary)/0.08)] to-transparent" />
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
  filled,
  children,
}) => {
  const [menuOpen, setMenuOpen] = useState(false)
  const visibleActions = (actions || []).filter((action) => !action.hidden)
  const height = previewCardHeight(width, aspectRatio)

  return (
    <div className={cn('media-preview-card group/media-card relative', className)} style={{ width }}>
      <div className="mb-1.5 flex h-6 items-center justify-between gap-2 px-0.5">
        <div className="flex min-w-0 items-center gap-1.5 text-[hsl(var(--on-surface-variant))]">
          <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center [&>svg]:h-3.5 [&>svg]:w-3.5">
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
              className="nodrag nopan nowheel h-6 w-36 text-xs"
              onClick={(event) => event.stopPropagation()}
              onPointerDown={(event) => event.stopPropagation()}
            />
          ) : (
            <span
              className="cursor-text truncate text-[12px] font-medium tracking-wide"
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
              'shrink-0 transition-opacity duration-150',
              selected || menuOpen || dropActive
                ? 'opacity-100'
                : 'opacity-0 group-hover/media-card:opacity-100'
            )}
          >
            <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="nodrag nopan nowheel flex h-6 w-6 items-center justify-center rounded-full text-[hsl(var(--on-surface-variant))] transition-colors hover:bg-[hsl(var(--surface-container-high))] hover:text-[hsl(var(--on-surface))]"
                  title="更多"
                  onClick={(event) => event.stopPropagation()}
                  onPointerDown={(event) => event.stopPropagation()}
                >
                  <MoreHorizontal className="h-3.5 w-3.5" />
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

      <div className="relative" style={{ height }}>
        {handles}
        <div
          className={cn(
            'relative h-full w-full overflow-hidden rounded-[20px] border transition-[border-color,box-shadow] duration-200',
            filled && 'media-preview-card__stage--filled',
            dropActive
              ? 'border-[hsl(var(--primary))] shadow-[0_0_0_3px_hsl(var(--primary)/0.18)]'
              : selected
                ? 'border-[hsl(var(--primary))] shadow-[0_0_0_2px_hsl(var(--primary)/0.28)]'
                : 'border-[hsl(var(--outline-variant)/0.7)]'
          )}
          style={{ backgroundColor: 'hsl(var(--media-stage))' }}
        >
          <div className="absolute inset-0">{children}</div>
        </div>
      </div>
    </div>
  )
}

export default MediaPreviewCard
