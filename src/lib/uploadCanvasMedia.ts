import { uploadApi } from '@/api/uploadApi'
import { isInlineCanvasMedia } from '@/lib/canvasPayload'

const CANVAS_UPLOAD_DIRECTORY = 'generated' as const

function extensionFor(mime: string): string {
  const known: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/bmp': 'bmp',
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'audio/mpeg': 'mp3',
    'audio/wav': 'wav',
  }
  if (known[mime]) return known[mime]
  const subtype = (mime.split('/')[1] || 'bin').split('+')[0]
  return subtype.replace(/[^a-z0-9]/gi, '') || 'bin'
}

function dataUrlToFile(dataUrl: string): File {
  const comma = dataUrl.indexOf(',')
  if (comma < 0) throw new Error('图片未能保存为文件地址')
  const meta = dataUrl.slice('data:'.length, comma)
  const payload = dataUrl.slice(comma + 1)
  const mime = meta.split(';')[0] || 'application/octet-stream'
  let binary: string
  try {
    binary = /;base64/i.test(meta) ? atob(payload.replace(/\s/g, '')) : decodeURIComponent(payload)
  } catch {
    throw new Error('图片未能保存为文件地址')
  }
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return new File([bytes], `canvas.${extensionFor(mime)}`, { type: mime })
}

async function storeFile(file: File): Promise<string> {
  const accessUrl = await uploadApi.uploadSingleFile(file, CANVAS_UPLOAD_DIRECTORY)
  if (!accessUrl || isInlineCanvasMedia(accessUrl)) {
    throw new Error('图片未能保存为文件地址')
  }
  return accessUrl
}

/**
 * Decode a data URL and store the raw bytes with the upload API:
 * POST /upload/presigned → PUT uploadUrl → POST /upload/confirm, directory "generated".
 * File paths and remote URLs are returned unchanged.
 */
export async function uploadCanvasMediaUrl(value: string): Promise<string> {
  if (value.startsWith('blob:')) {
    const response = await fetch(value)
    if (!response.ok) throw new Error('读取本地图片失败')
    return uploadCanvasBlob(await response.blob())
  }
  if (!isInlineCanvasMedia(value)) return value
  if (!value.startsWith('data:')) throw new Error('图片未能保存为文件地址')
  return storeFile(dataUrlToFile(value))
}

export async function uploadCanvasBlob(blob: Blob): Promise<string> {
  const contentType = blob.type || 'application/octet-stream'
  const file = blob instanceof File && blob.name
    ? blob
    : new File([blob], `canvas.${extensionFor(contentType)}`, { type: contentType })
  return storeFile(file)
}
