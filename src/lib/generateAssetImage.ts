import { imageService, isI2IModel } from '@/api/aigc'

export const aspectToSize = {
  '1:1': '1024x1024',
  '16:9': '1536x1024',
  '9:16': '1024x1536',
  '4:3': '1536x1024',
} as const

export async function generateAssetImage(params: {
  model: string
  prompt: string
  aspectRatio?: keyof typeof aspectToSize
  referenceImages?: string[]
  n?: number
}) {
  const size = aspectToSize[params.aspectRatio || '1:1']
  const urls = await imageService.generate({
    model: params.model,
    prompt: params.prompt,
    size,
    quality: 'medium',
    n: params.n ?? 1,
    images: isI2IModel(params.model) ? params.referenceImages : undefined,
  })
  const url = urls?.[0]
  if (!url) throw new Error('未返回生成结果')
  return url
}
