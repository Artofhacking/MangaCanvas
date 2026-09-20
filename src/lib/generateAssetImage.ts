import { imageService } from '@/api/aigc'
import {
  buildImageGenerateOptions,
  DEFAULT_GENERATE_SETTINGS,
  type GenerateSettings,
} from '@/lib/generateSettings'

export { aspectToSize } from '@/lib/generateSettings'

export async function generateAssetImage(params: {
  model: string
  prompt: string
  aspectRatio?: string
  quality?: GenerateSettings['quality']
  clarity?: GenerateSettings['clarity']
  referenceImages?: string[]
  n?: number
}): Promise<string[]> {
  const options = buildImageGenerateOptions({
    model: params.model,
    prompt: params.prompt,
    settings: {
      ...DEFAULT_GENERATE_SETTINGS,
      aspectRatio: params.aspectRatio || DEFAULT_GENERATE_SETTINGS.aspectRatio,
      quality: params.quality || DEFAULT_GENERATE_SETTINGS.quality,
      clarity: params.clarity || DEFAULT_GENERATE_SETTINGS.clarity,
      quantity: params.n ?? 1,
    },
    referenceImages: params.referenceImages,
  })
  if ('error' in options) throw new Error(options.error)

  const urls = await imageService.generate(options)
  if (!urls?.length) throw new Error('未返回生成结果')
  return urls
}
