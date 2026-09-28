import { afterEach, describe, expect, it } from 'vitest'
import {
  CANVAS_MAX_FULL_RES_IMAGES,
  CANVAS_ONLY_RENDER_VISIBLE_ELEMENTS,
  activeCanvasVideoProps,
  claimCanvasFullResImage,
  flowNodeIntersectsViewport,
  flowNodeVisibleRatio,
  getActiveCanvasVideoId,
  releaseCanvasFullResImage,
  resetCanvasMediaBudgetForTests,
  resolveActiveVideoId,
  resolveCanvasImageDisplaySrc,
  setCanvasVideoIntent,
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

describe('resolveCanvasImageDisplaySrc', () => {
  const base = {
    inViewport: true,
    allowFullResolution: true,
    fullResGranted: true,
  }

  it('prefers a distinct thumbnail and does not need a full-resolution slot', () => {
    expect(resolveCanvasImageDisplaySrc({
      ...base,
      url: 'https://cdn.example/full.png',
      thumbnail: 'https://cdn.example/thumb.jpg',
      allowFullResolution: false,
      fullResGranted: false,
    })).toBe('https://cdn.example/thumb.jpg')
  })

  it('keeps the full asset off the card while zoomed out or over the decode cap', () => {
    expect(resolveCanvasImageDisplaySrc({
      ...base,
      url: 'https://cdn.example/full.png',
      thumbnail: 'https://cdn.example/full.png',
      allowFullResolution: false,
    })).toBe('')
    expect(resolveCanvasImageDisplaySrc({
      ...base,
      url: 'https://cdn.example/full.png',
      fullResGranted: false,
    })).toBe('')
  })

  it('does not decode an image that is outside the pane', () => {
    expect(resolveCanvasImageDisplaySrc({
      ...base,
      url: 'https://cdn.example/full.png',
      thumbnail: 'https://cdn.example/thumb.jpg',
      inViewport: false,
    })).toBe('')
  })

  it('uses the full url once zoom and a decode slot allow it', () => {
    expect(resolveCanvasImageDisplaySrc({
      ...base,
      url: 'https://cdn.example/full.png',
      thumbnail: '',
    })).toBe('https://cdn.example/full.png')
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
