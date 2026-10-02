import type { StoryboardShot } from '@/types'

/** Why a shot stays out of the delivery package. */
export type DeliveryGapReason = 'no-frame' | 'unfinalized' | 'missing-file'

export const DELIVERY_GAP_LABEL: Record<DeliveryGapReason, string> = {
  'no-frame': '尚无首帧',
  unfinalized: '未定稿',
  'missing-file': '定稿缺少文件',
}

export type DeliveryItem = {
  shotId: string
  shotNumber: number
  prompt: string
  fileUrl: string
  filename: string
  finalizedAt?: string
}

export type DeliveryGap = {
  shotId: string
  shotNumber: number
  prompt: string
  reason: DeliveryGapReason
}

export type EpisodeDelivery = {
  version: 1
  episodeId: number
  episodeName: string
  episodeCode: string
  items: DeliveryItem[]
  gaps: DeliveryGap[]
  exportedAt?: string
  export: {
    format: 'manifest'
    zip: false
    note: string
  }
}

export const DELIVERY_EXPORT_NOTE = '按镜号排列的定稿文件地址。zip 打包留待后续。'

const FILE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif', 'mp4', 'webm'])

export function deliveryFileCode(code: string): string {
  const cleaned = code
    .trim()
    .replace(/[^A-Za-z0-9\u4e00-\u9fff._-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^[._]+|[._]+$/g, '')
  return cleaned || 'episode'
}

export function deliveryFilename(code: string, shotNumber: number, url: string): string {
  const path = url.split('?')[0].split('#')[0]
  const match = path.match(/\.([A-Za-z0-9]{2,5})$/)
  const ext = match?.[1]?.toLowerCase()
  const safeExt = ext && FILE_EXTENSIONS.has(ext) ? ext : 'png'
  return `${deliveryFileCode(code)}_镜${String(shotNumber).padStart(2, '0')}.${safeExt}`
}

function gapReason(shot: StoryboardShot): DeliveryGapReason {
  if (shot.finalized) return 'missing-file'
  if (shot.imageUrl) return 'unfinalized'
  return 'no-frame'
}

/**
 * Delivery order is the storyboard 镜号.
 * Only a shot marked 定稿, with a frozen file, enters the package.
 * Everything else is a gap and stays out of the manifest items.
 */
export function buildEpisodeDelivery(input: {
  id: number
  name: string
  code: string
  storyboard?: StoryboardShot[] | null
}): EpisodeDelivery {
  const shots = [...(input.storyboard || [])].sort((a, b) => a.index - b.index)
  const items: DeliveryItem[] = []
  const gaps: DeliveryGap[] = []

  for (const shot of shots) {
    const fileUrl = shot.finalized ? shot.finalizedImageUrl || shot.imageUrl || '' : ''
    if (shot.finalized && fileUrl) {
      items.push({
        shotId: shot.id,
        shotNumber: shot.index,
        prompt: shot.prompt,
        fileUrl,
        filename: deliveryFilename(input.code, shot.index, fileUrl),
        ...(shot.finalizedAt ? { finalizedAt: shot.finalizedAt } : {}),
      })
      continue
    }
    gaps.push({
      shotId: shot.id,
      shotNumber: shot.index,
      prompt: shot.prompt,
      reason: gapReason(shot),
    })
  }

  return {
    version: 1,
    episodeId: input.id,
    episodeName: input.name,
    episodeCode: input.code,
    items,
    gaps,
    export: {
      format: 'manifest',
      zip: false,
      note: DELIVERY_EXPORT_NOTE,
    },
  }
}

export function deliveryManifestFilename(delivery: Pick<EpisodeDelivery, 'episodeCode' | 'episodeId'>): string {
  return `${deliveryFileCode(delivery.episodeCode || `episode-${delivery.episodeId}`)}-交付清单.json`
}

export function downloadDeliveryManifest(delivery: EpisodeDelivery) {
  const payload: EpisodeDelivery = {
    ...delivery,
    exportedAt: delivery.exportedAt || new Date().toISOString(),
  }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = deliveryManifestFilename(delivery)
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
