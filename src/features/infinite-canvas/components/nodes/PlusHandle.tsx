import type { ComponentProps } from 'react'
import { Handle } from 'reactflow'
import { cn } from '@/lib/utils'

/** Circular “+” port used by image/video preview cards. */
export function PlusHandle({ className, children, style, ...props }: ComponentProps<typeof Handle>) {
  return (
    <Handle
      {...props}
      className={cn('media-plus-handle', className)}
      style={{
        width: 22,
        height: 22,
        background: 'hsl(var(--surface-container-lowest))',
        border: '1.5px solid color-mix(in srgb, hsl(var(--on-surface)) 22%, transparent)',
        borderRadius: 999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 1px 8px rgba(26, 26, 26, 0.16)',
        ...style,
      }}
    >
      {children ?? (
        <span className="media-plus-handle__mark" aria-hidden>
          <svg viewBox="0 0 12 12" width="12" height="12">
            <path d="M6 2v8M2 6h8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          </svg>
        </span>
      )}
    </Handle>
  )
}

export default PlusHandle
