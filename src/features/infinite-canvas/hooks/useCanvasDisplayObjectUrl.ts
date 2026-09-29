import { useEffect, useState } from 'react'
import { loadCanvasDisplayObjectUrl, revokeCanvasObjectUrl } from '../utils/canvasDisplayBitmap'

/** Object URL for a card-sized preview. Empty while decoding, after failure, or when `sourceUrl` is blank. */
export function useCanvasDisplayObjectUrl(sourceUrl: string): string {
  const [objectUrl, setObjectUrl] = useState('')

  useEffect(() => {
    if (!sourceUrl) {
      setObjectUrl('')
      return
    }

    const controller = new AbortController()
    let created = ''
    let stopped = false
    setObjectUrl('')
    void loadCanvasDisplayObjectUrl(sourceUrl, controller.signal)
      .then((url) => {
        if (stopped || controller.signal.aborted) {
          revokeCanvasObjectUrl(url)
          return
        }
        created = url
        setObjectUrl(url)
      })
      .catch(() => {
        if (!stopped) setObjectUrl('')
      })

    return () => {
      stopped = true
      controller.abort()
      if (created) {
        revokeCanvasObjectUrl(created)
        created = ''
      }
    }
  }, [sourceUrl])

  return sourceUrl ? objectUrl : ''
}
