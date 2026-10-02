import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  ALSO_ADD_TO_FAVORITES_LABEL,
  initialAlsoFavorite,
  saveMaterialsEmptyWarning,
  saveMaterialsModalTitle,
  saveMaterialsResultMessage,
  saveMaterialsSubmitLabel,
} from './saveToMaterialsCopy'

const here = dirname(fileURLToPath(import.meta.url))

const nodeMenuFiles = [
  'nodes/ImageNode.tsx',
  'nodes/ImageConfigNode.tsx',
  'nodes/VideoNode.tsx',
  'nodes/VideoConfigNode.tsx',
]

describe('save to materials favorite checkbox', () => {
  it('defaults the checkbox off and only starts checked for the preview shortcut', () => {
    expect(initialAlsoFavorite()).toBe(false)
    expect(initialAlsoFavorite(false)).toBe(false)
    expect(initialAlsoFavorite(true)).toBe(true)
    expect(ALSO_ADD_TO_FAVORITES_LABEL).toBe('同时加入「我的收藏」')
  })

  it('keeps the modal titled as a material save', () => {
    expect(saveMaterialsModalTitle('create')).toBe('保存为新素材')
    expect(saveMaterialsModalTitle('existing')).toBe('添加到已有素材')
  })

  it('uses a save label until the checkbox is on', () => {
    expect(saveMaterialsSubmitLabel('create', false)).toBe('保存')
    expect(saveMaterialsSubmitLabel('create', false, '收藏到资产库')).toBe('保存')
    expect(saveMaterialsSubmitLabel('create', true)).toBe('保存并收藏')
    expect(saveMaterialsSubmitLabel('create', true, '收藏到资产库')).toBe('收藏到资产库')
    expect(saveMaterialsSubmitLabel('existing', false)).toBe('更新')
    expect(saveMaterialsSubmitLabel('existing', true)).toBe('更新并收藏')
  })

  it('does not mention 收藏 when the checkbox is off', () => {
    for (const category of ['character', 'scene', 'object', 'video']) {
      for (const mode of ['create', 'existing'] as const) {
        const result = saveMaterialsResultMessage({ alsoFavorite: false, mode, category })
        expect(result.level).toBe('success')
        expect(result.text.includes('收藏')).toBe(false)
      }
    }
    expect(saveMaterialsResultMessage({ alsoFavorite: false, mode: 'create', category: 'scene' }).text).toBe(
      '已保存到素材库',
    )
    expect(saveMaterialsResultMessage({ alsoFavorite: false, mode: 'existing', category: 'video' }).text).toBe(
      '已更新已有视频',
    )
    expect(saveMaterialsResultMessage({ alsoFavorite: false, mode: 'existing', category: 'character' }).text).toBe(
      '已更新已有素材',
    )
    expect(saveMaterialsEmptyWarning('video').includes('收藏')).toBe(false)
    expect(saveMaterialsEmptyWarning('image').includes('收藏')).toBe(false)
  })

  it('says the asset was saved and favorited when the checkbox is on', () => {
    expect(saveMaterialsResultMessage({ alsoFavorite: true, mode: 'create', category: 'scene' })).toEqual({
      level: 'success',
      text: '已保存并加入收藏',
    })
    expect(saveMaterialsResultMessage({ alsoFavorite: true, mode: 'existing', category: 'video' }).text).toBe(
      '已保存并加入收藏',
    )
    expect(
      saveMaterialsResultMessage({
        alsoFavorite: true,
        mode: 'create',
        category: 'character',
        catalogFailed: true,
      }),
    ).toEqual({
      level: 'warning',
      text: '素材库写入失败，已加入我的收藏',
    })
  })

  it('removes 收藏 from image and video node menus and keeps 保存到素材库', () => {
    for (const file of nodeMenuFiles) {
      const source = readFileSync(resolve(here, file), 'utf8')
      expect(source).toContain('保存到素材库')
      expect(source.includes("label: '收藏'")).toBe(false)
      expect(source.includes('<span>收藏</span>')).toBe(false)
      expect(source.includes('handleFavorite')).toBe(false)
      expect(source.includes('saveAsFavorite')).toBe(false)
    }
  })

  it('keeps the preview star as a favorite shortcut', () => {
    const source = readFileSync(resolve(here, 'PreviewModal.tsx'), 'utf8')
    expect(source).toContain('asFavorite')
    expect(source).toContain("aria-label={favorite ? '取消收藏' : '收藏'}")
  })
})