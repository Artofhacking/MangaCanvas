import { afterEach, describe, expect, it, vi } from 'vitest'

import { uploadApi } from '@/api/uploadApi'
import { uploadCanvasBlob, uploadCanvasMediaUrl } from './uploadCanvasMedia'

const PNG = 'data:image/png;base64,iVBORw0KGgo='
const STORED = '/static/uploads/generated/shot.png'
const UPLOAD_URL = '/api/v1/upload/raw/abc?token=t'

describe('uploadCanvasMediaUrl', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  function mockUploadApi() {
    vi.spyOn(uploadApi, 'getPresignedUrl').mockResolvedValue({
      uploadUrl: UPLOAD_URL,
      accessUrl: STORED,
      expiresIn: 1800,
    })
    vi.spyOn(uploadApi, 'uploadToOSS').mockResolvedValue(true)
    vi.spyOn(uploadApi, 'confirmUpload').mockResolvedValue({ accessUrl: STORED, confirmed: true })
  }

  it('decodes a data URL and stores raw bytes via presign, PUT, and confirm', async () => {
    mockUploadApi()

    await expect(uploadCanvasMediaUrl(PNG)).resolves.toBe(STORED)

    expect(uploadApi.getPresignedUrl).toHaveBeenCalledWith({
      filename: 'canvas.png',
      contentType: 'image/png',
      directory: 'generated',
    })
    expect(uploadApi.uploadToOSS).toHaveBeenCalledTimes(1)
    const [uploadUrl, file, contentType] = vi.mocked(uploadApi.uploadToOSS).mock.calls[0]
    expect(uploadUrl).toBe(UPLOAD_URL)
    expect(contentType).toBe('image/png')
    expect(new Uint8Array(await file.arrayBuffer())).toEqual(
      Uint8Array.from(atob('iVBORw0KGgo='), (char) => char.charCodeAt(0)),
    )
    expect(new TextDecoder().decode(await file.arrayBuffer())).not.toContain('data:image')
    expect(uploadApi.confirmUpload).toHaveBeenCalledWith({
      accessUrl: STORED,
      directory: 'generated',
      relatedId: undefined,
    })
  })

  it('puts an uploaded file\'s raw bytes without re-encoding them as a data URL', async () => {
    mockUploadApi()
    const raw = new Uint8Array([1, 2, 3, 4])
    const file = new File([raw], 'shot.png', { type: 'image/png' })

    await expect(uploadCanvasBlob(file)).resolves.toBe(STORED)

    const sent = vi.mocked(uploadApi.uploadToOSS).mock.calls[0][1]
    expect(new Uint8Array(await sent.arrayBuffer())).toEqual(raw)
    expect(uploadApi.getPresignedUrl).toHaveBeenCalledWith({
      filename: 'shot.png',
      contentType: 'image/png',
      directory: 'generated',
    })
  })

  it('leaves an existing file path untouched', async () => {
    const presign = vi.spyOn(uploadApi, 'getPresignedUrl')
    await expect(uploadCanvasMediaUrl(STORED)).resolves.toBe(STORED)
    expect(presign).not.toHaveBeenCalled()
  })

  it('refuses to keep a data URL when confirm does not return a path', async () => {
    vi.spyOn(uploadApi, 'getPresignedUrl').mockResolvedValue({
      uploadUrl: UPLOAD_URL,
      accessUrl: PNG,
      expiresIn: 1800,
    })
    vi.spyOn(uploadApi, 'uploadToOSS').mockResolvedValue(true)
    vi.spyOn(uploadApi, 'confirmUpload').mockResolvedValue({ accessUrl: PNG, confirmed: true })

    await expect(uploadCanvasMediaUrl(PNG)).rejects.toThrow('图片未能保存为文件地址')
  })
})
