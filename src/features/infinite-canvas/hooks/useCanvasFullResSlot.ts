import { useEffect, useState } from 'react'
import {
  claimCanvasFullResImage,
  releaseCanvasFullResImage,
  subscribeCanvasFullResImages,
} from '../utils/canvasMediaBudget'

/** Holds one of the canvas-wide full-resolution decode slots while `wants` is true. */
export function useCanvasFullResSlot(id: string, wants: boolean): boolean {
  const [granted, setGranted] = useState(false)

  useEffect(() => {
    if (!wants) {
      releaseCanvasFullResImage(id)
      setGranted(false)
      return
    }

    let stopped = false
    const sync = () => {
      if (stopped) return
      const next = claimCanvasFullResImage(id)
      setGranted((current) => (current === next ? current : next))
    }
    const unsubscribe = subscribeCanvasFullResImages(sync)
    sync()
    return () => {
      stopped = true
      unsubscribe()
      releaseCanvasFullResImage(id)
    }
  }, [id, wants])

  return granted
}
