/**
 * How an asset becomes canvas nodes.
 *
 * Prompt-only assets become a text node. A real still becomes an image node.
 * A real video becomes a video node. Blank, broken, and the card-cover
 * stand-in are not images. An asset with neither media nor a prompt adds nothing.
 */

export const TEXT_SEED_LABEL = '提示词'
export const IMAGE_SEED_LABEL = '参考图'
export const VIDEO_SEED_LABEL = '视频节点'

/** Stand-in cover used when a character, scene, or object has no saved image. */
export const PLACEHOLDER_COVER_URL =
  'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600&h=400&fit=crop'

const UNUSABLE_MEDIA = /^(?:null|undefined|none|n\/a|na|placeholder|broken|error|about:blank)$/i
const VIDEO_EXT = /\.(mp4|webm|mov|m4v|mkv|avi)(?:$|[?#])/i

export type AssetMediaKind = 'text' | 'image' | 'video' | 'none'

export type AssetMediaInput = {
  name?: string | null
  prompt?: string | null
  description?: string | null
  image?: string | null
  video?: string | null
  videoUrl?: string | null
  mediaType?: string | null
  hasImage?: boolean
  hasVideo?: boolean
  hasCover?: boolean
}

export type ResolvedAssetMedia = {
  kind: AssetMediaKind
  prompt: string
  imageUrl?: string
  videoUrl?: string
  label: string
}

export type SeedNode = {
  id: string
  type: 'text' | 'image' | 'video'
  position: { x: number; y: number }
  data: Record<string, unknown>
}

export function isPlaceholderCover(url?: string | null): boolean {
  return (url || '').trim() === PLACEHOLDER_COVER_URL
}

export function isMissingMediaUrl(url?: string | null): boolean {
  const value = (url || '').trim()
  if (!value) return true
  return UNUSABLE_MEDIA.test(value)
}

export function looksLikeVideoUrl(url?: string | null): boolean {
  const value = (url || '').trim()
  return Boolean(value) && VIDEO_EXT.test(value)
}

function cleanUrl(url?: string | null): string | undefined {
  const value = (url || '').trim()
  if (isMissingMediaUrl(value)) return undefined
  return value
}

function coverUrl(input: AssetMediaInput): string | undefined {
  if (input.hasImage === false || input.hasCover === false) return undefined
  const image = cleanUrl(input.image)
  if (!image) return undefined
  if (isPlaceholderCover(image) && input.hasImage !== true && input.hasCover !== true) {
    return undefined
  }
  return image
}

function labelFor(name: string, kind: Exclude<AssetMediaKind, 'none'>): string {
  if (name) return name
  if (kind === 'text') return TEXT_SEED_LABEL
  if (kind === 'video') return VIDEO_SEED_LABEL
  return IMAGE_SEED_LABEL
}

export function resolveAssetMedia(input: AssetMediaInput): ResolvedAssetMedia {
  const prompt = (input.prompt ?? input.description ?? '').trim()
  const name = (input.name || '').trim()
  const declared = (input.mediaType || '').trim().toLowerCase()
  const explicitVideo = input.hasVideo === false ? undefined : cleanUrl(input.video || input.videoUrl)
  const cover = coverUrl(input)
  const coverIsVideo = Boolean(cover && looksLikeVideoUrl(cover))

  let videoUrl = explicitVideo || (coverIsVideo ? cover : undefined)
  let imageUrl = cover && !coverIsVideo ? cover : undefined

  if (declared === 'video') {
    videoUrl = explicitVideo || (coverIsVideo ? cover : undefined)
    imageUrl = videoUrl ? undefined : imageUrl
  } else if (declared === 'image') {
    videoUrl = explicitVideo
    imageUrl = cover && !coverIsVideo ? cover : undefined
    if (!imageUrl && !videoUrl && coverIsVideo) videoUrl = cover
  }

  if (videoUrl) {
    return { kind: 'video', prompt, videoUrl, label: labelFor(name, 'video') }
  }
  if (imageUrl) {
    return { kind: 'image', prompt, imageUrl, label: labelFor(name, 'image') }
  }
  if (prompt) {
    return { kind: 'text', prompt, label: labelFor(name, 'text') }
  }
  return { kind: 'none', prompt: '', label: name }
}

function withExtra(data: Record<string, unknown>, extra?: Record<string, unknown>) {
  if (!extra) return data
  const next = { ...data }
  for (const [key, value] of Object.entries(extra)) {
    if (value !== undefined) next[key] = value
  }
  return next
}

/** One node for the asset's real media. Prompt-only becomes text. Nothing usable returns null. */
export function dominantAssetNode(
  input: AssetMediaInput,
  position: { x: number; y: number },
  id: string,
  extra?: Record<string, unknown>,
): SeedNode | null {
  const resolved = resolveAssetMedia(input)
  if (resolved.kind === 'none') return null
  if (resolved.kind === 'text') {
    return {
      id,
      type: 'text',
      position,
      data: withExtra({ label: resolved.label, content: resolved.prompt }, extra),
    }
  }
  return {
    id,
    type: resolved.kind,
    position,
    data: withExtra(
      {
        label: resolved.label,
        url: resolved.kind === 'video' ? resolved.videoUrl : resolved.imageUrl,
        ...(resolved.prompt ? { prompt: resolved.prompt } : {}),
      },
      extra,
    ),
  }
}

/**
 * Nodes created when opening a canvas from one asset.
 * Prompt plus a real image or video keeps the existing pair: a 提示词 text node
 * wired into the media node. Prompt alone is a single text node titled with the asset name.
 */
export function openAssetSeedNodes(
  input: AssetMediaInput,
  extra?: Record<string, unknown>,
): { nodes: SeedNode[]; edges: Array<{ id: string; source: string; target: string }> } {
  const resolved = resolveAssetMedia(input)
  if (resolved.kind === 'none') return { nodes: [], edges: [] }

  if (resolved.kind === 'text') {
    return {
      nodes: [
        {
          id: 'seed_prompt',
          type: 'text',
          position: { x: 80, y: 80 },
          data: withExtra({ label: resolved.label, content: resolved.prompt }, extra),
        },
      ],
      edges: [],
    }
  }

  const mediaId = resolved.kind === 'video' ? 'seed_video' : 'seed_image'
  const mediaNode: SeedNode = {
    id: mediaId,
    type: resolved.kind,
    position: { x: resolved.prompt ? 440 : 80, y: 40 },
    data: withExtra(
      {
        label: resolved.label,
        url: resolved.kind === 'video' ? resolved.videoUrl : resolved.imageUrl,
      },
      extra,
    ),
  }
  if (!resolved.prompt) return { nodes: [mediaNode], edges: [] }

  return {
    nodes: [
      {
        id: 'seed_prompt',
        type: 'text',
        position: { x: 80, y: 80 },
        data: withExtra({ label: TEXT_SEED_LABEL, content: resolved.prompt }, extra),
      },
      mediaNode,
    ],
    edges: [{ id: 'seed_edge', source: 'seed_prompt', target: mediaId }],
  }
}
