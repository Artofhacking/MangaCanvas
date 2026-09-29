import { persistMedia } from '@/api/aigc/imageService'
import { isInlineCanvasMedia } from '@/lib/canvasPayload'

function readBlobAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('读取本地图片失败'))
    reader.readAsDataURL(blob)
  })
}

/** Turn a data: or blob: URL into a /static/... path. Ordinary paths are returned unchanged. */
export async function uploadCanvasMediaUrl(value: string): Promise<string> {
  let source = value
  if (value.startsWith('blob:')) {
    const response = await fetch(value)
    if (!response.ok) throw new Error('读取本地图片失败')
    source = await readBlobAsDataUrl(await response.blob())
  }
  if (!isInlineCanvasMedia(source)) return source
  if (!source.startsWith('data:')) throw new Error('图片未能保存为文件地址')
  const stored = await persistMedia(source)
  if (!stored || isInlineCanvasMedia(stored)) {
    throw new Error('图片未能保存为文件地址')
  }
  return stored
}

export async function uploadCanvasBlob(blob: Blob): Promise<string> {
  return uploadCanvasMediaUrl(await readBlobAsDataUrl(blob))
}
