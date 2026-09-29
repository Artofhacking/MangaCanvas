import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/api/aigc/imageService', () => ({
  persistMedia: vi.fn(),
}))

import { persistMedia } from '@/api/aigc/imageService'
import { uploadCanvasMediaUrl } from './uploadCanvasMedia'

const PNG = 'data:image/png;base64,iVBORw0KGgo='
const STORED = '/static/uploads/generated/shot.png'

describe('uploadCanvasMediaUrl', () => {
  beforeEach(() => {
    vi.mocked(persistMedia).mockReset()
    vi.mocked(persistMedia).mockResolvedValue(STORED)
  })

  it('uploads a data URL and returns the file path', async () => {
    await expect(uploadCanvasMediaUrl(PNG)).resolves.toBe(STORED)
    expect(persistMedia).toHaveBeenCalledWith(PNG)
  })

  it('leaves an existing file path untouched', async () => {
    await expect(uploadCanvasMediaUrl(STORED)).resolves.toBe(STORED)
    expect(persistMedia).not.toHaveBeenCalled()
  })

  it('refuses to keep a data URL when upload does not return a path', async () => {
    vi.mocked(persistMedia).mockResolvedValue(PNG)
    await expect(uploadCanvasMediaUrl(PNG)).rejects.toThrow('图片未能保存为文件地址')
  })
})
