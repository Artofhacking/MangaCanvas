import { useEffect, useState } from 'react'
import {
  claimCanvasDisplayBitmap,
  claimCanvasFullResImage,
  claimCanvasPreviewImage,
  releaseCanvasDisplayBitmap,
  releaseCanvasFullResImage,
  releaseCanvasPreviewImage,
  subscribeCanvasDisplayBitmaps,
  subscribeCanvasFullResImages,
  subscribeCanvasPreviewImages,
} from '../utils/canvasMediaBudget'

function useCanvasMediaSlot(
  id: string,
  wants: boolean,
  claim: (slotId: string) => boolean,
  release: (slotId: string) => void,
  subscribe: (listener: () => void) => () => void,
): boolean {
  const [granted, setGranted] = useState(false)

  useEffect(() => {
    if (!wants) {
      release(id)
      setGranted(false)
      return
    }

    let stopped = false
    const sync = () => {
      if (stopped) return
      const next = claim(id)
      setGranted((current) => (current === next ? current : next))
    }
    const unsubscribe = subscribe(sync)
    sync()
    return () => {
      stopped = true
      unsubscribe()
      release(id)
    }
  }, [claim, id, release, subscribe, wants])

  return granted
}

/** Holds one of the canvas-wide full-resolution decode slots while `wants` is true. */
export function useCanvasFullResSlot(id: string, wants: boolean): boolean {
  return useCanvasMediaSlot(
    id,
    wants,
    claimCanvasFullResImage,
    releaseCanvasFullResImage,
    subscribeCanvasFullResImages,
  )
}

/** Holds one distinct-thumbnail `<img>` slot. */
export function useCanvasPreviewSlot(id: string, wants: boolean): boolean {
  return useCanvasMediaSlot(
    id,
    wants,
    claimCanvasPreviewImage,
    releaseCanvasPreviewImage,
    subscribeCanvasPreviewImages,
  )
}

/** Holds one downscaled object-URL slot. */
export function useCanvasDisplaySlot(id: string, wants: boolean): boolean {
  return useCanvasMediaSlot(
    id,
    wants,
    claimCanvasDisplayBitmap,
    releaseCanvasDisplayBitmap,
    subscribeCanvasDisplayBitmaps,
  )
}
