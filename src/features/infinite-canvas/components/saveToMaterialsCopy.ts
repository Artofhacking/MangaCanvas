export const ALSO_ADD_TO_FAVORITES_LABEL = '同时加入「我的收藏」'

export const SAVED_TO_LIBRARY_TOAST = '已保存到素材库'
export const SAVED_AND_FAVORITED_TOAST = '已保存并加入收藏'

export type SaveMaterialsMode = 'create' | 'existing'

/** Checkbox starts off. Preview star passes asFavorite so the shortcut stays checked. */
export function initialAlsoFavorite(asFavorite?: boolean): boolean {
  return asFavorite === true
}

export function saveMaterialsModalTitle(mode: SaveMaterialsMode): string {
  return mode === 'create' ? '保存为新素材' : '添加到已有素材'
}

export function saveMaterialsSubmitLabel(
  mode: SaveMaterialsMode,
  alsoFavorite: boolean,
  confirmLabel?: string,
): string {
  if (mode === 'existing') return alsoFavorite ? '更新并收藏' : '更新'
  if (alsoFavorite) return confirmLabel || '保存并收藏'
  return '保存'
}

export function saveMaterialsEmptyWarning(mediaType: 'image' | 'video'): string {
  return mediaType === 'video' ? '当前视频没有可保存的内容' : '当前图片节点没有可保存的图片'
}

export function saveMaterialsResultMessage(input: {
  alsoFavorite: boolean
  mode: SaveMaterialsMode
  category: string
  catalogFailed?: boolean
}): { level: 'success' | 'warning'; text: string } {
  if (input.alsoFavorite) {
    if (input.catalogFailed) {
      return { level: 'warning', text: '素材库写入失败，已加入我的收藏' }
    }
    return { level: 'success', text: SAVED_AND_FAVORITED_TOAST }
  }
  if (input.mode === 'existing') {
    return {
      level: 'success',
      text: input.category === 'video' ? '已更新已有视频' : '已更新已有素材',
    }
  }
  return { level: 'success', text: SAVED_TO_LIBRARY_TOAST }
}
