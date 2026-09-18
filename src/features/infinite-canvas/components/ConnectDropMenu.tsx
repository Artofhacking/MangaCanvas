import React, { useEffect, useState } from 'react'
import { ImageIcon, Video } from 'lucide-react'
import type { GenerateNodeType } from '../utils/generateSlots'

export interface ConnectDropMenuState {
  sourceId: string
  screen: { x: number; y: number }
  flow: { x: number; y: number }
}

export const CONNECT_DROP_MENU_WIDTH = 220
export const CONNECT_DROP_MENU_HEIGHT = 140

export function getConnectDropMenuPosition(screen: { x: number; y: number }) {
  const maxX = typeof window !== 'undefined' ? window.innerWidth - CONNECT_DROP_MENU_WIDTH - 12 : screen.x
  const maxY = typeof window !== 'undefined' ? window.innerHeight - CONNECT_DROP_MENU_HEIGHT - 12 : screen.y
  return {
    left: Math.max(12, Math.min(screen.x + 8, maxX)),
    top: Math.max(12, Math.min(screen.y + 8, maxY)),
  }
}

export function getConnectDropMenuLineTarget(screen: { x: number; y: number }) {
  const position = getConnectDropMenuPosition(screen)
  return { x: position.left, y: position.top + CONNECT_DROP_MENU_HEIGHT / 2 }
}

const ConnectDropMenu: React.FC<{
  state: ConnectDropMenuState
  onSelect: (type: GenerateNodeType) => void
  onClose: () => void
}> = ({ state, onSelect, onClose }) => {
  const position = getConnectDropMenuPosition(state.screen)
  const [armed, setArmed] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(() => setArmed(true), 80)
    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="pointer-events-none fixed inset-0 z-[40]">
      <button
        type="button"
        className="pointer-events-auto absolute inset-0 cursor-default bg-transparent"
        aria-label="关闭引用菜单"
        onClick={armed ? onClose : undefined}
      />
      <div
        className="pointer-events-auto absolute w-[220px] rounded-2xl border border-[hsl(var(--outline-variant))]/40 bg-[hsl(var(--surface-container-lowest))] p-2 shadow-[0_18px_50px_rgba(42,28,24,0.16)]"
        style={{ left: position.left, top: position.top }}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
      >
        <p className="px-2.5 pb-1.5 pt-1 text-[11px] font-semibold tracking-wide text-[hsl(var(--secondary))]">
          引用该节点生成
        </p>
        <button
          type="button"
          onClick={() => onSelect('imageConfig')}
          className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm text-[hsl(var(--on-surface))] transition-colors hover:bg-[hsl(var(--surface-container-low))]"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[hsl(var(--surface-container-low))] text-[hsl(var(--primary))]">
            <ImageIcon className="h-4 w-4" />
          </span>
          <span>
            <span className="block font-semibold">画面</span>
            <span className="block text-[11px] text-[hsl(var(--secondary))]">打开底部生成栏生图</span>
          </span>
        </button>
        <button
          type="button"
          onClick={() => onSelect('videoConfig')}
          className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm text-[hsl(var(--on-surface))] transition-colors hover:bg-[hsl(var(--surface-container-low))]"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[hsl(var(--surface-container-low))] text-[hsl(var(--primary))]">
            <Video className="h-4 w-4" />
          </span>
          <span>
            <span className="block font-semibold">视频</span>
            <span className="block text-[11px] text-[hsl(var(--secondary))]">打开底部生成栏生视频</span>
          </span>
        </button>
      </div>
    </div>
  )
}

export default ConnectDropMenu
