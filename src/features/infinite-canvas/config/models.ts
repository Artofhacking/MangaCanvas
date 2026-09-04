import type { ModelConfig, SizeOption } from '../types';

export const IMAGE_MODELS: ModelConfig[] = [
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
    getSizesByQuality: (): SizeOption[] => {
      return [
        { label: '1:1 (1280*1280)', key: '1280*1280' },
        { label: '3:4 (1104*1472)', key: '1104*1472' },
        { label: '4:3 (1472*1104)', key: '1472*1104' },
        { label: '9:16 (960*1696)', key: '960*1696' },
        { label: '16:9 (1696*960)', key: '1696*960' },
        { label: '1:1 (1440*1440)', key: '1440*1440' },
      ];
    },
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
    getSizesByQuality: (): SizeOption[] => {
      return [
        { label: '1:1 (1280*1280)', key: '1280*1280' },
        { label: '1:1 (1024*1024)', key: '1024*1024' },
        { label: '2:3 (800*1200)', key: '800*1200' },
        { label: '3:2 (1200*800)', key: '1200*800' },
        { label: '3:4 (960*1280)', key: '960*1280' },
        { label: '4:3 (1280*960)', key: '1280*960' },
        { label: '9:16 (720*1280)', key: '720*1280' },
        { label: '16:9 (1280*720)', key: '1280*720' },
        { label: '21:9 (1344*576)', key: '1344*576' },
      ];
    },
  },
];

export const VIDEO_MODELS: ModelConfig[] = [
  {
    key: 'wan2.6-t2v',
    label: '万相 2.6 文生视频',
    type: 'video',
    async: true,
    sizes: [
      // 720P
      { label: '720P 16:9 (1280*720)', key: '1280*720' },
      { label: '720P 9:16 (720*1280)', key: '720*1280' },
      { label: '720P 1:1 (960*960)', key: '960*960' },
      { label: '720P 4:3 (1088*832)', key: '1088*832' },
      { label: '720P 3:4 (832*1088)', key: '832*1088' },
      // 1080P
      { label: '1080P 16:9 (1920*1080)', key: '1920*1080' },
      { label: '1080P 9:16 (1080*1920)', key: '1080*1920' },
      { label: '1080P 1:1 (1440*1440)', key: '1440*1440' },
      { label: '1080P 4:3 (1632*1248)', key: '1632*1248' },
      { label: '1080P 3:4 (1248*1632)', key: '1248*1632' },
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
    key: 'wan2.6-i2v-flash',
    label: '万相 2.6 图生视频',
    type: 'video',
    async: true,
    resolutions: [
      { label: '720P', key: '720P' },
      { label: '1080P', key: '1080P' },
    ],
    durs: [
      { label: '2秒', key: 2 },
      { label: '5秒', key: 5 },
      { label: '10秒', key: 10 },
      { label: '15秒', key: 15 },
    ],
    defaultParams: {
      resolution: '720P',
      duration: 5,
    },
  },
  {
    key: 'wan2.2-kf2v-flash',
    label: '万相 2.2 关键帧生视频',
    type: 'video',
    async: true,
    resolutions: [
      { label: '720P', key: '720P' },
      { label: '1080P', key: '1080P' },
    ],
    durs: [
      { label: '5秒', key: 5 },
    ],
    defaultParams: {
      resolution: '720P',
      duration: 5,
    },
  },
];

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
