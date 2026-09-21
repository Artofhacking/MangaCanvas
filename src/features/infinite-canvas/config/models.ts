import type { ModelConfig, SizeOption } from '../types';
import { labeledSizes } from '../utils/aspectRatio';

/**
 * Capability map keyed by GET /ai/models ids.
 * Not a picker source — empty/error live lists must not dump this catalog.
 * Live `parameters.sizes` always wins; this list is last-resort only.
 */

/** Mirrors backend `GPT_IMAGE_2_SIZES` — one pixel size per common ratio. */
export const GPT_IMAGE_PRESET_SIZES = [
  '1024x1024', // 1:1
  '1536x864', // 16:9
  '864x1536', // 9:16
  '1536x1152', // 4:3
  '1152x1536', // 3:4
  '1536x1024', // 3:2
  '1024x1536', // 2:3
  '1792x768', // 21:9
] as const

const gptImagePresetSizeOptions = (): SizeOption[] => labeledSizes([...GPT_IMAGE_PRESET_SIZES])

export const IMAGE_MODELS: ModelConfig[] = [
  {
    key: 'gpt-image-2',
    label: 'GPT Image 2 文生图',
    type: 'image',
    async: true,
    qualities: [
      { label: '低', key: 'low' },
      { label: '中', key: 'medium' },
      { label: '高', key: 'high' },
    ],
    defaultParams: {
      size: '1024x1024',
      quality: 'medium',
    },
    getSizesByQuality: gptImagePresetSizeOptions,
  },
  {
    key: 'gpt-image-2.5-flare',
    label: 'GPT Image 2.5 Flare 文生图',
    type: 'image',
    async: true,
    qualities: [
      { label: '低', key: 'low' },
      { label: '中', key: 'medium' },
      { label: '高', key: 'high' },
    ],
    defaultParams: {
      size: '1024x1024',
      quality: 'medium',
    },
    getSizesByQuality: gptImagePresetSizeOptions,
  },
  {
    key: 'gpt-image-2.5-sunburst',
    label: 'GPT Image 2.5 Sunburst 文生图',
    type: 'image',
    async: true,
    qualities: [
      { label: '低', key: 'low' },
      { label: '中', key: 'medium' },
      { label: '高', key: 'high' },
    ],
    defaultParams: {
      size: '1024x1024',
      quality: 'medium',
    },
    getSizesByQuality: gptImagePresetSizeOptions,
  },
  {
    key: 'wan2.7-image',
    label: '万相 2.7 文生图',
    type: 'image',
    async: true,
    qualities: [
      { label: '标准', key: 'standard' },
    ],
    defaultParams: {
      size: '1280*1280',
      quality: 'standard',
    },
    getSizesByQuality: (): SizeOption[] =>
      labeledSizes(['1280*1280', '1104*1472', '1472*1104', '960*1696', '1696*960']),
  },
  {
    key: 'wan2.7-image-pro',
    label: '万相 2.7 文生图 Pro',
    type: 'image',
    async: true,
    qualities: [
      { label: '标准', key: 'standard' },
    ],
    defaultParams: {
      size: '1280*1280',
      quality: 'standard',
    },
    getSizesByQuality: (): SizeOption[] =>
      labeledSizes(['1280*1280', '1104*1472', '1472*1104', '960*1696', '1696*960']),
  },
  {
    key: 'qwen-image-2.0',
    label: '通义千问生图',
    type: 'image',
    async: true,
    qualities: [
      { label: '标准', key: 'standard' },
    ],
    defaultParams: {
      size: '1024x1024',
      quality: 'standard',
    },
    getSizesByQuality: (): SizeOption[] => labeledSizes(['1024x1024', '1024x1536', '1536x1024']),
  },
  {
    key: 'qwen-image-2.0-pro',
    label: '通义千问生图 Pro',
    type: 'image',
    async: true,
    qualities: [
      { label: '标准', key: 'standard' },
    ],
    defaultParams: {
      size: '1024x1024',
      quality: 'standard',
    },
    getSizesByQuality: (): SizeOption[] => labeledSizes(['1024x1024', '1024x1536', '1536x1024']),
  },
  {
    key: 'wan2.6-t2i',
    label: '万相 2.6 文生图',
    type: 'image',
    async: true,
    qualities: [
      { label: '标准', key: 'standard' },
    ],
    defaultParams: {
      size: '1280*1280',
      quality: 'standard',
    },
    getSizesByQuality: (): SizeOption[] =>
      labeledSizes(['1280*1280', '1104*1472', '1472*1104', '960*1696', '1696*960', '1440*1440']),
  },
  {
    key: 'wan2.6-image',
    label: '万相 2.6 图生图',
    type: 'image',
    async: true,
    qualities: [
      { label: '标准', key: 'standard' },
    ],
    defaultParams: {
      size: '1280*1280',
      quality: 'standard',
    },
    getSizesByQuality: (): SizeOption[] =>
      labeledSizes([
        '1280*1280',
        '1024*1024',
        '800*1200',
        '1200*800',
        '960*1280',
        '1280*960',
        '720*1280',
        '1280*720',
        '1344*576',
      ]),
  },
];

export const VIDEO_MODELS: ModelConfig[] = [
  {
    key: 'happyhorse-1.1-t2v',
    label: 'HappyHorse 文生视频',
    type: 'video',
    async: true,
    sizes: [
      { label: '720P 16:9 (1280*720)', key: '1280*720' },
      { label: '720P 9:16 (720*1280)', key: '720*1280' },
      { label: '1080P 16:9 (1920*1080)', key: '1920*1080' },
      { label: '1080P 9:16 (1080*1920)', key: '1080*1920' },
    ],
    durs: [
      { label: '5秒', key: 5 },
      { label: '10秒', key: 10 },
    ],
    defaultParams: {
      size: '1280*720',
      duration: 5,
    },
  },
  {
    key: 'happyhorse-1.1-i2v',
    label: 'HappyHorse 图生视频',
    type: 'video',
    async: true,
    resolutions: [
      { label: '720P', key: '720P' },
      { label: '1080P', key: '1080P' },
    ],
    durs: [
      { label: '5秒', key: 5 },
      { label: '10秒', key: 10 },
    ],
    defaultParams: {
      resolution: '720P',
      duration: 5,
    },
  },
  {
    key: 'happyhorse-1.1-r2v',
    label: 'HappyHorse 参考图生视频',
    type: 'video',
    async: true,
    resolutions: [
      { label: '720P', key: '720P' },
      { label: '1080P', key: '1080P' },
    ],
    durs: [
      { label: '5秒', key: 5 },
      { label: '10秒', key: 10 },
    ],
    defaultParams: {
      resolution: '720P',
      duration: 5,
    },
  },
  {
    key: 'doubao-seedance-2-0-260128',
    label: 'Seedance 2.0',
    type: 'video',
    enabled: false,
    async: true,
    sizes: [
      { label: '720P 16:9 (1280*720)', key: '1280*720' },
      { label: '720P 9:16 (720*1280)', key: '720*1280' },
      { label: '1080P 16:9 (1920*1080)', key: '1920*1080' },
      { label: '1080P 9:16 (1080*1920)', key: '1080*1920' },
    ],
    durs: [
      { label: '5秒', key: 5 },
      { label: '10秒', key: 10 },
    ],
    defaultParams: {
      size: '1280*720',
      duration: 5,
    },
  },
  {
    key: 'doubao-seedance-2-0-fast-260128',
    label: 'Seedance 2.0 Fast',
    type: 'video',
    enabled: false,
    async: true,
    sizes: [
      { label: '720P 16:9 (1280*720)', key: '1280*720' },
      { label: '720P 9:16 (720*1280)', key: '720*1280' },
    ],
    durs: [
      { label: '5秒', key: 5 },
      { label: '10秒', key: 10 },
    ],
    defaultParams: {
      size: '1280*720',
      duration: 5,
    },
  },
  {
    key: 'doubao-seedance-2-0-mini-260615',
    label: 'Seedance 2.0 Mini',
    type: 'video',
    enabled: false,
    async: true,
    sizes: [
      { label: '720P 16:9 (1280*720)', key: '1280*720' },
      { label: '720P 9:16 (720*1280)', key: '720*1280' },
    ],
    durs: [
      { label: '5秒', key: 5 },
      { label: '10秒', key: 10 },
    ],
    defaultParams: {
      size: '1280*720',
      duration: 5,
    },
  },
  {
    key: 'doubao-seedance-2-5-260628',
    label: 'Seedance 2.5',
    type: 'video',
    enabled: false,
    async: true,
    sizes: [
      { label: '720P 16:9 (1280*720)', key: '1280*720' },
      { label: '720P 9:16 (720*1280)', key: '720*1280' },
      { label: '1080P 16:9 (1920*1080)', key: '1920*1080' },
      { label: '1080P 9:16 (1080*1920)', key: '1080*1920' },
    ],
    durs: [
      { label: '5秒', key: 5 },
      { label: '10秒', key: 10 },
      { label: '15秒', key: 15 },
    ],
    defaultParams: {
      size: '1280*720',
      duration: 5,
    },
  },
  {
    key: 'MiniMax-H3',
    label: '海螺 MiniMax H3',
    type: 'video',
    enabled: false,
    async: true,
    sizes: [
      { label: '768P 16:9 (1280*720)', key: '1280*720' },
      { label: '768P 9:16 (720*1280)', key: '720*1280' },
      { label: '2K 16:9 (1920*1080)', key: '1920*1080' },
      { label: '2K 9:16 (1080*1920)', key: '1080*1920' },
    ],
    durs: [
      { label: '5秒', key: 5 },
      { label: '10秒', key: 10 },
      { label: '15秒', key: 15 },
    ],
    defaultParams: {
      size: '1280*720',
      duration: 5,
    },
  },
  {
    key: 'MiniMax-H3-Max',
    label: '海螺 MiniMax H3 Max',
    type: 'video',
    enabled: false,
    async: true,
    sizes: [
      { label: '768P 16:9 (1280*720)', key: '1280*720' },
      { label: '768P 9:16 (720*1280)', key: '720*1280' },
    ],
    durs: [
      { label: '5秒', key: 5 },
      { label: '10秒', key: 10 },
      { label: '15秒', key: 15 },
    ],
    defaultParams: {
      size: '1280*720',
      duration: 5,
    },
  },
  {
    key: 'viduq3-pro',
    label: 'Vidu Q3 Pro',
    type: 'video',
    enabled: false,
    async: true,
    sizes: [
      { label: '720P 16:9 (1280*720)', key: '1280*720' },
      { label: '720P 9:16 (720*1280)', key: '720*1280' },
      { label: '1080P 16:9 (1920*1080)', key: '1920*1080' },
      { label: '1080P 9:16 (1080*1920)', key: '1080*1920' },
    ],
    durs: [
      { label: '5秒', key: 5 },
      { label: '10秒', key: 10 },
      { label: '15秒', key: 15 },
    ],
    defaultParams: {
      size: '1280*720',
      duration: 5,
    },
  },
  {
    key: 'viduq3-turbo',
    label: 'Vidu Q3 Turbo',
    type: 'video',
    enabled: false,
    async: true,
    sizes: [
      { label: '720P 16:9 (1280*720)', key: '1280*720' },
      { label: '720P 9:16 (720*1280)', key: '720*1280' },
      { label: '1080P 16:9 (1920*1080)', key: '1920*1080' },
      { label: '1080P 9:16 (1080*1920)', key: '1080*1920' },
    ],
    durs: [
      { label: '5秒', key: 5 },
      { label: '10秒', key: 10 },
      { label: '15秒', key: 15 },
    ],
    defaultParams: {
      size: '1280*720',
      duration: 5,
    },
  },
];

export function enabledModels<T extends { enabled?: boolean }>(all: T[]): T[] {
  return all.filter((item) => item.enabled !== false)
}

export function filterLiveModels<T extends { key: string; enabled?: boolean }>(
  all: T[],
  liveIds: readonly string[]
): T[] {
  const set = new Set(liveIds)
  return enabledModels(all).filter((item) => set.has(item.key))
}

/** Live API ids only. Empty/error live lists never dump the static catalog. */
export function resolvePickerModels<T extends { key: string; enabled?: boolean }>(
  all: T[],
  liveIds: readonly string[],
  loading: boolean
): T[] {
  if (loading || liveIds.length === 0) return []
  return filterLiveModels(all, liveIds)
}

export function remapVideoModel(key: string | undefined, liveIds: readonly string[] = []): string {
  const name = (key || '').trim()
  if (liveIds.length) {
    if (name && liveIds.includes(name)) return name
    if (name.includes('i2v') || name.includes('kf2v') || name.includes('r2v')) {
      return liveIds.find((id) => id.includes('r2v') && name.includes('r2v'))
        || liveIds.find((id) => id.includes('i2v'))
        || liveIds[0]
    }
    return liveIds.find((id) => id.includes('t2v')) || liveIds[0]
  }
  if (!name) return 'happyhorse-1.1-t2v'
  if (VIDEO_MODELS.some((item) => item.key === name)) return name
  if (name.includes('r2v')) return 'happyhorse-1.1-r2v'
  if (name.includes('i2v') || name.includes('kf2v')) return 'happyhorse-1.1-i2v'
  return 'happyhorse-1.1-t2v'
}

export const CHAT_MODELS: ModelConfig[] = [];

// Helper functions
export function getModelByKey(key: string): ModelConfig | undefined {
  return [...IMAGE_MODELS, ...VIDEO_MODELS, ...CHAT_MODELS].find((m) => m.key === key);
}

export function getImageModel(key: string): ModelConfig | undefined {
  return IMAGE_MODELS.find((m) => m.key === key);
}

export function getVideoModel(key: string): ModelConfig | undefined {
  return VIDEO_MODELS.find((m) => m.key === key);
}

export function getChatModel(key: string): ModelConfig | undefined {
  return CHAT_MODELS.find((m) => m.key === key);
}
