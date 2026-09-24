/** Mouse buttons accepted by React Flow `panOnDrag`. 0 = left, 1 = middle, 2 = right. */
export const CANVAS_PAN_BUTTONS = [1, 2] as const

/** Add to the current selection instead of replacing it. */
export const CANVAS_MULTI_SELECTION_KEYS = ['Shift', 'Meta', 'Control'] as const

export const CANVAS_PAN_ACTIVATION_KEY = 'Space'

export const CANVAS_INTERACTION_HINT =
  '左键拖空白框选，Shift/⌘/Ctrl+点击加选，拖任一已选节点整组移动。滚轮/触控板滑动或中键/右键拖动画布；Space+拖拽也可平移。⌘/Ctrl+滚轮或捏合缩放。'

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
