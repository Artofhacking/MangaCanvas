/** Mouse buttons accepted by React Flow `panOnDrag`. 0 = left, 1 = middle, 2 = right. */
export const CANVAS_PAN_BUTTONS = [1, 2] as const

/** Add to the current selection instead of replacing it. */
export const CANVAS_MULTI_SELECTION_KEYS = ['Shift', 'Meta', 'Control'] as const

export const CANVAS_PAN_ACTIVATION_KEY = 'Space'

export const CANVAS_INTERACTION_HINT =
  '左键拖空白框选，Shift/⌘/Ctrl+点击加选，拖任一已选节点整组移动。Delete 或 Backspace 删除选中节点。滚轮/触控板滑动或中键/右键拖动画布；Space+拖拽也可平移。⌘/Ctrl+滚轮或捏合缩放。'

/** Plain Delete / Backspace. Modifier chords stay with the browser and text fields. */
export const CANVAS_DELETE_KEYS = ['Delete', 'Backspace'] as const

const EDITABLE_FIELD_SELECTOR = 'input, textarea, select, [contenteditable="true"], [contenteditable=""]'
const BLOCKING_SURFACE_SELECTOR = '[role="dialog"], [role="menu"], [role="listbox"], .ant-modal, .ant-drawer'

type KeyboardTarget = {
  tagName?: string
  isContentEditable?: boolean
  closest?: (selector: string) => unknown
}

export function isEditableKeyboardTarget(target: EventTarget | null): boolean {
  if (!target || typeof target !== 'object') return false
  const element = target as KeyboardTarget
  const tag = element.tagName?.toUpperCase()
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (element.isContentEditable) return true
  return Boolean(element.closest?.(EDITABLE_FIELD_SELECTOR))
}

/** Focus inside a modal, drawer, or open menu should not delete canvas nodes. */
export function isBlockingOverlayTarget(target: EventTarget | null): boolean {
  if (!target || typeof target !== 'object') return false
  const element = target as KeyboardTarget
  return Boolean(element.closest?.(BLOCKING_SURFACE_SELECTOR))
}

type OverlayElement = {
  style?: { display?: string }
  getAttribute?: (name: string) => string | null
  classList?: { contains: (token: string) => boolean }
}

function isHiddenOverlay(node: OverlayElement): boolean {
  if (node.style?.display === 'none') return true
  if (node.getAttribute?.('aria-hidden') === 'true') return true
  if (node.classList?.contains('ant-select-dropdown-hidden')) return true
  return false
}

/**
 * Open Ant Design modals/drawers and Radix menus, even when focus stayed on the canvas.
 * Closed wrappers that remain in the DOM with display:none do not count.
 */
export function isSurprisingCanvasOverlayOpen(root: ParentNode | null | undefined): boolean {
  if (!root) return false
  for (const wrap of root.querySelectorAll('.ant-modal-wrap, .ant-drawer.ant-drawer-open, .ant-select-dropdown')) {
    if (!isHiddenOverlay(wrap)) return true
  }
  return Boolean(
    root.querySelector(
      '[role="dialog"][data-state="open"], [role="menu"][data-state="open"], [role="listbox"][data-state="open"]',
    ),
  )
}

export interface CanvasDeleteKeyState {
  key: string
  metaKey?: boolean
  ctrlKey?: boolean
  altKey?: boolean
  isComposing?: boolean
  target: EventTarget | null
  locked: boolean
  referencePicking: boolean
  connectMenuOpen: boolean
  overlayOpen: boolean
}

/**
 * Delete/Backspace that belongs to the canvas, including when deletion itself is paused.
 * Callers should preventDefault so Backspace does not navigate the browser.
 */
export function isPlainCanvasDeleteKey(
  state: Omit<CanvasDeleteKeyState, 'locked' | 'referencePicking' | 'connectMenuOpen'>,
): boolean {
  if (state.overlayOpen || state.isComposing || state.metaKey || state.ctrlKey || state.altKey) return false
  if (state.key !== 'Delete' && state.key !== 'Backspace') return false
  if (isEditableKeyboardTarget(state.target) || isBlockingOverlayTarget(state.target)) return false
  return true
}

/** True when this keydown should remove the current canvas selection. */
export function shouldRemoveSelectedNodesOnKey(state: CanvasDeleteKeyState): boolean {
  if (state.locked || state.referencePicking || state.connectMenuOpen) return false
  return isPlainCanvasDeleteKey(state)
}

export const CANVAS_INTERACTION_HINT_SHORT = '框选多选，滚轮/中键平移'

/**
 * Screen pixels of pointer travel that still count as a click.
 * Larger moves are node drags; snap-to-grid can hide a short drag, so the
 * click handler must ignore them instead of opening editors or previews.
 */
export const NODE_DRAG_CLICK_THRESHOLD_PX = 4

/**
 * Locked canvas turns off marquee and node drag, so left-drag can pan.
 * Unlocked canvas must NOT include the left button here. React Flow 11 then
 * keeps left-drag for node moves (and marquee when the event target is the
 * pane itself). `panOnDrag={true}` or `[0, …]` lets d3-zoom take that button,
 * and nodes stop moving even though `nodesDraggable` is on.
 */
export function getCanvasPanOnDrag(isLocked: boolean): true | number[] {
  return isLocked ? true : [...CANVAS_PAN_BUTTONS]
}

/**
 * Browsers often never emit `dblclick` on a React Flow node: d3-drag calls
 * `preventDefault()` on mousedown, which suppresses the synthesized event.
 * Treat a second click inside this window as the preview gesture instead.
 */
export const MEDIA_PREVIEW_DOUBLE_CLICK_MS = 400

/** True only for the second click of a double-click. A single click stays a selection. */
export function isMediaPreviewDoubleClick(
  now: number,
  previousClickAt: number,
  windowMs = MEDIA_PREVIEW_DOUBLE_CLICK_MS,
): boolean {
  return previousClickAt > 0 && now - previousClickAt <= windowMs
}

export function pointerTravelExceeds(
  origin: { x: number; y: number } | null,
  point: { clientX: number; clientY: number },
  threshold = NODE_DRAG_CLICK_THRESHOLD_PX,
): boolean {
  if (!origin) return false
  const dx = point.clientX - origin.x
  const dy = point.clientY - origin.y
  return dx * dx + dy * dy > threshold * threshold
}
