import React, { useEffect, useState } from 'react'
import { ImageIcon, Video } from 'lucide-react'
import type { GenerateNodeType } from '../utils/generateSlots'
import { buildScreenBezier, getSourceHandleScreenPoint } from '../utils/connectPreview'

export interface ConnectDropMenuState {
  sourceId: string
  screen: { x: number; y: number }
  flow: { x: number; y: number }
  fromScreen?: { x: number; y: number }
}

const MENU_WIDTH = 220
const MENU_HEIGHT = 140

function clampMenuPosition(x: number, y: number, width = MENU_WIDTH, height = MENU_HEIGHT) {
  const maxX = typeof window !== 'undefined' ? window.innerWidth - width - 12 : x
  const maxY = typeof window !== 'undefined' ? window.innerHeight - height - 12 : y
  return {
    left: Math.max(12, Math.min(x, maxX)),
    top: Math.max(12, Math.min(y, maxY)),
  }
}

const ConnectDropMenu: React.FC<{
  state: ConnectDropMenuState
  onSelect: (type: GenerateNodeType) => void
  onClose: () => void
}> = ({ state, onSelect, onClose }) => {
  const position = clampMenuPosition(state.screen.x + 8, state.screen.y + 8)
  const fromScreen = state.fromScreen || getSourceHandleScreenPoint(state.sourceId)
  const toScreen = { x: position.left, y: position.top + MENU_HEIGHT / 2 }
  const previewPath = fromScreen ? buildScreenBezier(fromScreen, toScreen) : null
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
      {previewPath && fromScreen ? (
        <svg className="absolute inset-0 h-full w-full overflow-visible" aria-hidden>
          <path
            d={previewPath}
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            className="react-flow__connection-path"
          />
          <circle
            cx={toScreen.x}
            cy={toScreen.y}
            r={4}
            fill="hsl(var(--primary))"
          />
        </svg>
      ) : null}
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
