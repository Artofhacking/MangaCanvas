import type { ComponentProps } from 'react'
import { Handle } from 'reactflow'
import { cn } from '@/lib/utils'

/** Circular “+” port used by image/video preview cards. */
export function PlusHandle({ className, ...props }: ComponentProps<typeof Handle>) {
  return <Handle {...props} className={cn('media-plus-handle', className)} />
}

export default PlusHandle
