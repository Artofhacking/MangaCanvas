export type GenerateBarModelNotice = 'load-error' | 'empty' | null

/**
 * Decide whether the generate bar should toast about the live model list.
 *
 * `useModels` reports `loading` only while status is `loading`. The store
 * starts at `idle` with `models: []`, so treating "not loading + empty" as a
 * finished empty catalog fires a false warning before autoFetch settles.
 * Wait until the modality request has reached success or error.
 */
export function resolveGenerateBarModelNotice(input: {
  loading: boolean
  isLoaded: boolean
  error: string | null
  modelCount: number
}): GenerateBarModelNotice {
  if (input.loading || !input.isLoaded) return null
  if (input.error) return 'load-error'
  if (input.modelCount === 0) return 'empty'
  return null
}
