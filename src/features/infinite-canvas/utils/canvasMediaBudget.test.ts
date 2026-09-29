import { afterEach, describe, expect, it } from 'vitest'
import {
  CANVAS_FULL_RES_MIN_ZOOM,
  CANVAS_MAX_DISPLAY_BITMAPS,
  CANVAS_MAX_FULL_RES_IMAGES,
  CANVAS_MAX_PREVIEW_IMAGES,
  CANVAS_ONLY_RENDER_VISIBLE_ELEMENTS,
  activeCanvasVideoProps,
  canDownscaleCanvasImageUrl,
  claimCanvasDisplayBitmap,
  claimCanvasFullResImage,
  claimCanvasPreviewImage,
  allowsCanvasFullResolution,
  armCanvasOverviewCapture,
  captureCanvasOverviewZoom,
  deferCanvasFitView,
  flowNodeIntersectsViewport,
  getCanvasOverviewZoom,
  flowNodeVisibleRatio,
  getActiveCanvasVideoId,
  isCanvasFitViewSettled,
  releaseCanvasDisplayBitmap,
  releaseCanvasFullResImage,
  releaseCanvasPreviewImage,
  resetCanvasMediaBudgetForTests,
  resolveActiveVideoId,
  resolveCanvasImageDisplay,
  resolveCanvasImageDisplaySrc,
  setCanvasVideoIntent,
  type CanvasImageSourceInput,
  type VideoPlaybackIntent,
} from './canvasMediaBudget'

afterEach(() => {
  resetCanvasMediaBudgetForTests()
})

function video(partial: Partial<VideoPlaybackIntent> & Pick<VideoPlaybackIntent, 'id'>): VideoPlaybackIntent {
  return {
    inViewport: true,
    selected: false,
    hovered: false,
    playRequested: false,
    explicitSeq: 0,
    ...partial,
  }
}

describe('resolveCanvasImageDisplay', () => {
  const settled: CanvasImageSourceInput = {
    inViewport: true,
    measured: true,
    viewportSettled: true,
    allowFullResolution: true,
    fullResGranted: true,
    previewGranted: true,
    displayGranted: true,
  }

  it('prefers a distinct thumbnail and does not need a full-resolution slot', () => {
    expect(resolveCanvasImageDisplay({
      ...settled,
      url: 'https://cdn.example/full.png',
      thumbnail: 'https://cdn.example/thumb.jpg',
      allowFullResolution: false,
      fullResGranted: false,
      displayGranted: false,
    })).toEqual({
      mode: 'preview',
      src: 'https://cdn.example/thumb.jpg',
      downscaleUrl: '',
    })
  })

  it('keeps a remote original off the card while zoomed out or over the decode cap', () => {
    expect(resolveCanvasImageDisplay({
      ...settled,
      url: 'https://cdn.example/full.png',
      thumbnail: 'https://cdn.example/full.png',
      allowFullResolution: false,
    })).toEqual({ mode: 'empty', src: '', downscaleUrl: '' })
    expect(resolveCanvasImageDisplay({
      ...settled,
      url: 'https://cdn.example/full.png',
      thumbnail: '',
      fullResGranted: false,
    })).toEqual({ mode: 'empty', src: '', downscaleUrl: '' })
  })

  it('does not decode an image that is outside the pane', () => {
    expect(resolveCanvasImageDisplay({
      ...settled,
      url: 'https://cdn.example/full.png',
      thumbnail: 'https://cdn.example/thumb.jpg',
      inViewport: false,
    })).toEqual({ mode: 'empty', src: '', downscaleUrl: '' })
  })

  it('keeps a distinct thumbnail after LOD would allow the original', () => {
    expect(resolveCanvasImageDisplay({
      ...settled,
      url: 'https://cdn.example/full.png',
      thumbnail: 'https://cdn.example/thumb.jpg',
    })).toMatchObject({ mode: 'preview', src: 'https://cdn.example/thumb.jpg' })
  })

  it('uses the original url once zoom and a decode slot allow it', () => {
    expect(resolveCanvasImageDisplay({
      ...settled,
      url: 'https://cdn.example/full.png',
      thumbnail: '',
    })).toEqual({
      mode: 'full',
      src: 'https://cdn.example/full.png',
      downscaleUrl: '',
    })
    expect(resolveCanvasImageDisplaySrc({
      ...settled,
      url: 'https://cdn.example/full.png',
      thumbnail: '',
    })).toBe('https://cdn.example/full.png')
  })

  it('does not decode on the pre-fit frame even when zoom would allow full resolution', () => {
    const plans = Array.from({ length: 40 }, (_, index) => resolveCanvasImageDisplay({
      ...settled,
      measured: index % 2 === 0,
      viewportSettled: false,
      url: `https://cdn.example/full-${index}.png`,
      thumbnail: index % 3 === 0 ? `https://cdn.example/full-${index}.png` : '',
    }))
    expect(plans.every((plan) => plan.mode === 'empty' && plan.src === '' && plan.downscaleUrl === '')).toBe(true)
  })

  it('does not treat an unmeasured node as ready to decode', () => {
    expect(resolveCanvasImageDisplay({
      ...settled,
      measured: false,
      url: '/static/full.png',
      thumbnail: 'https://cdn.example/thumb.jpg',
    })).toEqual({ mode: 'empty', src: '', downscaleUrl: '' })
  })

  it('downscales a same-origin asset whose thumbnail is missing or identical', () => {
    expect(resolveCanvasImageDisplay({
      ...settled,
      allowFullResolution: false,
      fullResGranted: false,
      url: '/static/generated/full.png',
      thumbnail: '/static/generated/full.png',
    })).toEqual({
      mode: 'downscale',
      src: '',
      downscaleUrl: '/static/generated/full.png',
    })
    expect(resolveCanvasImageDisplaySrc({
      ...settled,
      allowFullResolution: false,
      url: '/static/generated/full.png',
      thumbnail: '',
    })).toBe('')
  })

  it('holds a distinct thumbnail when the preview cap is full', () => {
    expect(resolveCanvasImageDisplay({
      ...settled,
      url: 'https://cdn.example/full.png',
      thumbnail: 'https://cdn.example/thumb.jpg',
      previewGranted: false,
    })).toEqual({ mode: 'empty', src: '', downscaleUrl: '' })
  })
})

describe('first-open image budget', () => {
  it('does not decode originals on the opening fitView, only after zooming into a region', () => {
    expect(allowsCanvasFullResolution(1.2, null)).toBe(false)
    expect(allowsCanvasFullResolution(1.2, 1.2)).toBe(false)
    expect(allowsCanvasFullResolution(0.5, 0.2)).toBe(false)
    expect(allowsCanvasFullResolution(1, 0.4)).toBe(true)

    expect(getCanvasOverviewZoom()).toBeNull()
    captureCanvasOverviewZoom(1.1)
    expect(allowsCanvasFullResolution(1.1, getCanvasOverviewZoom())).toBe(false)
    expect(allowsCanvasFullResolution(1.2, getCanvasOverviewZoom())).toBe(true)
    captureCanvasOverviewZoom(0.2)
    expect(getCanvasOverviewZoom()).toBe(1.1)

    armCanvasOverviewCapture()
    expect(getCanvasOverviewZoom()).toBeNull()
    const state = { fitViewOnInitDone: true }
    deferCanvasFitView({
      setState: (partial) => {
        state.fitViewOnInitDone = partial.fitViewOnInitDone
      },
    })
    expect(state.fitViewOnInitDone).toBe(false)
    captureCanvasOverviewZoom(0.35)
    expect(allowsCanvasFullResolution(0.5, getCanvasOverviewZoom())).toBe(false)
    expect(allowsCanvasFullResolution(0.95, getCanvasOverviewZoom())).toBe(true)
  })

  it('keeps overview zoom and the full-resolution cap below the previous limits', () => {
    expect(CANVAS_FULL_RES_MIN_ZOOM).toBe(0.85)
    expect(CANVAS_MAX_FULL_RES_IMAGES).toBe(4)
    expect(CANVAS_MAX_PREVIEW_IMAGES).toBe(8)
    expect(CANVAS_MAX_DISPLAY_BITMAPS).toBe(12)
  })

  it('downscales local and data urls, not remote originals', () => {
    expect(canDownscaleCanvasImageUrl('/static/a.png')).toBe(true)
    expect(canDownscaleCanvasImageUrl('/api/media/a.png')).toBe(true)
    expect(canDownscaleCanvasImageUrl('https://files.example/static/a.png?x=1')).toBe(true)
    expect(canDownscaleCanvasImageUrl('data:image/png;base64,aaaa')).toBe(true)
    expect(canDownscaleCanvasImageUrl('blob:http://local/1')).toBe(true)
    expect(canDownscaleCanvasImageUrl('https://cdn.example/full.png')).toBe(false)
    expect(canDownscaleCanvasImageUrl('')).toBe(false)
  })

  it('keeps every remote card on a placeholder when the fitted zoom is an overview', () => {
    const plans = Array.from({ length: 40 }, (_, index) => resolveCanvasImageDisplay({
      inViewport: true,
      measured: true,
      viewportSettled: true,
      allowFullResolution: false,
      fullResGranted: index < CANVAS_MAX_FULL_RES_IMAGES,
      previewGranted: true,
      displayGranted: true,
      url: `https://cdn.example/shot-${index}.png`,
      thumbnail: index % 2 === 0 ? `https://cdn.example/shot-${index}.png` : '',
    }))
    expect(plans.every((plan) => plan.mode === 'empty' && plan.src === '')).toBe(true)
  })

  it('waits for fitView before card images mount', () => {
    expect(isCanvasFitViewSettled(undefined)).toBe(false)
    expect(isCanvasFitViewSettled({ fitViewOnInitDone: false })).toBe(false)
    expect(isCanvasFitViewSettled({ fitViewOnInitDone: true })).toBe(true)
    const state = { fitViewOnInitDone: true }
    deferCanvasFitView({
      setState: (partial) => {
        state.fitViewOnInitDone = partial.fitViewOnInitDone
      },
    })
    expect(isCanvasFitViewSettled(state)).toBe(false)
  })
})

describe('flowNodeIntersectsViewport', () => {
  const pane = { translateX: 0, translateY: 0, zoom: 1, paneWidth: 1000, paneHeight: 800 }

  it('treats a node fully inside the pane as visible', () => {
    expect(flowNodeVisibleRatio({
      ...pane,
      nodeX: 100,
      nodeY: 100,
      nodeWidth: 200,
      nodeHeight: 100,
    })).toBe(1)
    expect(flowNodeIntersectsViewport({
      ...pane,
      nodeX: 100,
      nodeY: 100,
      nodeWidth: 200,
      nodeHeight: 100,
      minVisibleRatio: 0.35,
    })).toBe(true)
  })

  it('rejects a node that sits fully to the right of the pane', () => {
    expect(flowNodeIntersectsViewport({
      ...pane,
      nodeX: 2000,
      nodeY: 100,
      nodeWidth: 200,
      nodeHeight: 100,
    })).toBe(false)
  })

  it('honors the minimum visible fraction for a node cut by the pane edge', () => {
    const clipped = {
      ...pane,
      nodeX: 900,
      nodeY: 100,
      nodeWidth: 200,
      nodeHeight: 100,
    }
    expect(flowNodeVisibleRatio(clipped)).toBeCloseTo(0.5)
    expect(flowNodeIntersectsViewport({ ...clipped, minVisibleRatio: 0.35 })).toBe(true)
    expect(flowNodeIntersectsViewport({ ...clipped, minVisibleRatio: 0.6 })).toBe(false)
  })
})

describe('resolveActiveVideoId', () => {
  it('does not play a mounted video that nobody is watching', () => {
    expect(resolveActiveVideoId(null, [video({ id: 'a' }), video({ id: 'b' })])).toBeNull()
  })

  it('plays the only selected video inside the viewport', () => {
    expect(resolveActiveVideoId(null, [
      video({ id: 'a', selected: true }),
      video({ id: 'b' }),
    ])).toBe('a')
  })

  it('does not play a selected video outside the viewport', () => {
    expect(resolveActiveVideoId(null, [
      video({ id: 'a', selected: true, inViewport: false }),
    ])).toBeNull()
  })

  it('does not attach a source for every selected video', () => {
    expect(resolveActiveVideoId(null, [
      video({ id: 'a', selected: true }),
      video({ id: 'b', selected: true }),
      video({ id: 'c', selected: true }),
    ])).toBeNull()
  })

  it('keeps a single already-playing selection when more videos are selected', () => {
    expect(resolveActiveVideoId('b', [
      video({ id: 'a', selected: true }),
      video({ id: 'b', selected: true }),
    ])).toBe('b')
  })

  it('lets the latest hover or play click take the only decoder', () => {
    expect(resolveActiveVideoId('a', [
      video({ id: 'a', selected: true, explicitSeq: 1 }),
      video({ id: 'b', hovered: true, explicitSeq: 2 }),
    ])).toBe('b')
    expect(resolveActiveVideoId('b', [
      video({ id: 'b', hovered: true, explicitSeq: 2 }),
      video({ id: 'c', playRequested: true, explicitSeq: 3 }),
    ])).toBe('c')
  })

  it('ignores an explicit play request for a video that is off screen', () => {
    expect(resolveActiveVideoId(null, [
      video({ id: 'a', playRequested: true, explicitSeq: 4, inViewport: false }),
    ])).toBeNull()
  })

  it('resumes the only selected video after hover ends', () => {
    expect(resolveActiveVideoId('b', [
      video({ id: 'a', selected: true }),
      video({ id: 'b' }),
    ])).toBe('a')
  })
})

describe('canvas video playback store', () => {
  it('keeps a single active video as intents change', () => {
    setCanvasVideoIntent('a', {
      inViewport: true,
      selected: true,
      hovered: false,
      playRequested: false,
      explicitSeq: 0,
    })
    setCanvasVideoIntent('b', {
      inViewport: true,
      selected: false,
      hovered: false,
      playRequested: false,
      explicitSeq: 0,
    })
    expect(getActiveCanvasVideoId()).toBe('a')

    setCanvasVideoIntent('b', {
      inViewport: true,
      selected: true,
      hovered: false,
      playRequested: false,
      explicitSeq: 0,
    })
    expect(getActiveCanvasVideoId()).toBe('a')

    setCanvasVideoIntent('b', {
      inViewport: true,
      selected: true,
      hovered: true,
      playRequested: false,
      explicitSeq: 2,
    })
    expect(getActiveCanvasVideoId()).toBe('b')

    setCanvasVideoIntent('b', null)
    expect(getActiveCanvasVideoId()).toBe('a')
  })
})

describe('canvas full-resolution budget', () => {
  it('caps how many full-resolution images can decode at once', () => {
    for (let index = 0; index < CANVAS_MAX_FULL_RES_IMAGES; index += 1) {
      expect(claimCanvasFullResImage(`img-${index}`)).toBe(true)
    }
    expect(claimCanvasFullResImage('overflow')).toBe(false)
    releaseCanvasFullResImage('img-0')
    expect(claimCanvasFullResImage('overflow')).toBe(true)
    expect(claimCanvasFullResImage('overflow')).toBe(true)
  })

  it('caps thumbnail imgs and downscaled previews separately', () => {
    for (let index = 0; index < CANVAS_MAX_PREVIEW_IMAGES; index += 1) {
      expect(claimCanvasPreviewImage(`thumb-${index}`)).toBe(true)
    }
    expect(claimCanvasPreviewImage('thumb-overflow')).toBe(false)
    releaseCanvasPreviewImage('thumb-0')
    expect(claimCanvasPreviewImage('thumb-overflow')).toBe(true)

    for (let index = 0; index < CANVAS_MAX_DISPLAY_BITMAPS; index += 1) {
      expect(claimCanvasDisplayBitmap(`display-${index}`)).toBe(true)
    }
    expect(claimCanvasDisplayBitmap('display-overflow')).toBe(false)
    releaseCanvasDisplayBitmap('display-0')
    expect(claimCanvasDisplayBitmap('display-overflow')).toBe(true)
    expect(claimCanvasFullResImage('still-open')).toBe(true)
  })
})

describe('active canvas video element', () => {
  it('autoplays only when playback is intended, muted and inline', () => {
    expect(activeCanvasVideoProps(true)).toEqual({
      autoPlay: true,
      loop: true,
      muted: true,
      playsInline: true,
    })
    expect(activeCanvasVideoProps(false).muted).toBe(false)
  })
})

describe('viewport culling', () => {
  it('asks React Flow to skip nodes outside the pane', () => {
    expect(CANVAS_ONLY_RENDER_VISIBLE_ELEMENTS).toBe(true)
  })
})
