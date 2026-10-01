import { describe, expect, it } from 'vitest'
import {
  CANVAS_DELETE_KEYS,
  CANVAS_MULTI_SELECTION_KEYS,
  CANVAS_PAN_ACTIVATION_KEY,
  CANVAS_PAN_BUTTONS,
  getCanvasPanOnDrag,
  isMediaPreviewDoubleClick,
  isPlainCanvasDeleteKey,
  isSurprisingCanvasOverlayOpen,
  pointerTravelExceeds,
  shouldRemoveSelectedNodesOnKey,
  type CanvasDeleteKeyState,
} from './canvasInteraction'

describe('getCanvasPanOnDrag', () => {
  it('lets left-drag pan when the canvas is locked (marquee is off)', () => {
    expect(getCanvasPanOnDrag(true)).toBe(true)
  })

  it('keeps left-drag for node move and marquee, and pans with middle/right when unlocked', () => {
    expect(getCanvasPanOnDrag(false)).toEqual([1, 2])
    expect(getCanvasPanOnDrag(false)).not.toContain(0)
    expect(CANVAS_PAN_BUTTONS).toEqual([1, 2])
  })
})

describe('media preview gesture', () => {
  it('does not open the lightbox on a single click', () => {
    expect(isMediaPreviewDoubleClick(1_000, 0)).toBe(false)
    expect(isMediaPreviewDoubleClick(1_500, 1_000)).toBe(false)
  })

  it('opens the lightbox on the second click of a double-click', () => {
    expect(isMediaPreviewDoubleClick(1_200, 1_000)).toBe(true)
  })
})

describe('pointerTravelExceeds', () => {
  it('treats a stationary click as a click', () => {
    expect(pointerTravelExceeds({ x: 10, y: 10 }, { clientX: 12, clientY: 11 })).toBe(false)
  })

  it('treats a real drag as not a click', () => {
    expect(pointerTravelExceeds({ x: 10, y: 10 }, { clientX: 28, clientY: 10 })).toBe(true)
    expect(pointerTravelExceeds(null, { clientX: 28, clientY: 10 })).toBe(false)
  })
})

function deleteKey(overrides: Partial<CanvasDeleteKeyState> = {}): CanvasDeleteKeyState {
  return {
    key: 'Delete',
    target: { tagName: 'DIV' },
    locked: false,
    referencePicking: false,
    connectMenuOpen: false,
    overlayOpen: false,
    ...overrides,
  }
}

describe('canvas selection and pan keys', () => {
  it('supports Shift click in addition to Cmd/Ctrl', () => {
    expect(CANVAS_MULTI_SELECTION_KEYS).toEqual(['Shift', 'Meta', 'Control'])
  })

  it('keeps Space as an extra pan modifier, not the only way to pan', () => {
    expect(CANVAS_PAN_ACTIVATION_KEY).toBe('Space')
  })
})

describe('keyboard delete guard', () => {
  it('accepts Delete and Backspace when the canvas itself is focused', () => {
    expect(CANVAS_DELETE_KEYS).toEqual(['Delete', 'Backspace'])
    expect(shouldRemoveSelectedNodesOnKey(deleteKey())).toBe(true)
    expect(shouldRemoveSelectedNodesOnKey(deleteKey({ key: 'Backspace' }))).toBe(true)
  })

  it('ignores typing in inputs, textareas, selects, and contenteditable', () => {
    expect(shouldRemoveSelectedNodesOnKey(deleteKey({ target: { tagName: 'INPUT' } }))).toBe(false)
    expect(shouldRemoveSelectedNodesOnKey(deleteKey({ target: { tagName: 'TEXTAREA' } }))).toBe(false)
    expect(shouldRemoveSelectedNodesOnKey(deleteKey({ target: { tagName: 'SELECT' } }))).toBe(false)
    expect(shouldRemoveSelectedNodesOnKey(deleteKey({ target: { tagName: 'DIV', isContentEditable: true } }))).toBe(false)
    expect(shouldRemoveSelectedNodesOnKey(deleteKey({
      target: {
        tagName: 'SPAN',
        closest: (selector: string) => (selector.includes('textarea') ? {} : null),
      },
    }))).toBe(false)
  })

  it('ignores modifier chords, composition, locked canvas, reference pick, connect menu, and overlays', () => {
    expect(shouldRemoveSelectedNodesOnKey(deleteKey({ metaKey: true }))).toBe(false)
    expect(shouldRemoveSelectedNodesOnKey(deleteKey({ ctrlKey: true }))).toBe(false)
    expect(shouldRemoveSelectedNodesOnKey(deleteKey({ altKey: true }))).toBe(false)
    expect(shouldRemoveSelectedNodesOnKey(deleteKey({ isComposing: true }))).toBe(false)
    expect(shouldRemoveSelectedNodesOnKey(deleteKey({ key: 'a' }))).toBe(false)
    expect(shouldRemoveSelectedNodesOnKey(deleteKey({ locked: true }))).toBe(false)
    expect(isPlainCanvasDeleteKey(deleteKey({ locked: true }))).toBe(true)
    expect(shouldRemoveSelectedNodesOnKey(deleteKey({ referencePicking: true }))).toBe(false)
    expect(shouldRemoveSelectedNodesOnKey(deleteKey({ connectMenuOpen: true }))).toBe(false)
    expect(shouldRemoveSelectedNodesOnKey(deleteKey({ overlayOpen: true }))).toBe(false)
    expect(shouldRemoveSelectedNodesOnKey(deleteKey({
      target: {
        tagName: 'BUTTON',
        closest: (selector: string) => (selector.includes('[role="dialog"]') ? {} : null),
      },
    }))).toBe(false)
  })

  it('treats a visible modal as open and a hidden one as closed', () => {
    const openModal = {
      querySelectorAll: (selector: string) => (
        selector.includes('ant-modal-wrap') ? [{ style: { display: '' }, getAttribute: () => null }] : []
      ),
      querySelector: () => null,
    } as unknown as ParentNode
    const hiddenModal = {
      querySelectorAll: () => [{ style: { display: 'none' }, getAttribute: () => 'true' }],
      querySelector: () => null,
    } as unknown as ParentNode
    const openMenu = {
      querySelectorAll: () => [],
      querySelector: (selector: string) => (selector.includes('[role="menu"]') ? {} : null),
    } as unknown as ParentNode

    expect(isSurprisingCanvasOverlayOpen(openModal)).toBe(true)
    expect(isSurprisingCanvasOverlayOpen(hiddenModal)).toBe(false)
    expect(isSurprisingCanvasOverlayOpen(openMenu)).toBe(true)
    expect(isSurprisingCanvasOverlayOpen(null)).toBe(false)
  })
})
