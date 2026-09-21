/** Mouse buttons accepted by React Flow `panOnDrag`. 0 = left, 1 = middle, 2 = right. */
export const CANVAS_PAN_BUTTONS = [1, 2] as const

/** Add to the current selection instead of replacing it. */
export const CANVAS_MULTI_SELECTION_KEYS = ['Shift', 'Meta', 'Control'] as const

export const CANVAS_PAN_ACTIVATION_KEY = 'Space'

export const CANVAS_INTERACTION_HINT =
  '左键拖空白框选，Shift/⌘/Ctrl+点击加选，拖任一已选节点整组移动。滚轮/触控板滑动或中键/右键拖动画布；Space+拖拽也可平移。⌘/Ctrl+滚轮或捏合缩放。'

export const CANVAS_INTERACTION_HINT_SHORT = '框选多选，滚轮/中键平移'

/**
 * Locked canvas turns off marquee, so left-drag can pan.
 * Unlocked canvas keeps left-drag for marquee and pans with the secondary buttons.
 */
export function getCanvasPanOnDrag(isLocked: boolean): true | number[] {
  return isLocked ? true : [...CANVAS_PAN_BUTTONS]
}
