/**
 * 文件上传 Hook
 * 封装上传状态管理和上传流程
 */

import { useState, useCallback } from 'react'
import { uploadApi, type UploadDirectory } from '@/api/uploadApi'

export interface UseUploadOptions {
  /** 上传目录 */
  directory: UploadDirectory
  /** 关联资源 ID */
  relatedId?: number | string
  /** 上传成功回调 */
  onSuccess?: (url: string) => void
  /** 上传失败回调 */
  onError?: (error: Error) => void
}

export interface UploadState {
  /** 是否正在上传 */
  uploading: boolean
  /** 上传进度（0-100） */
  progress: number
  /** 上传后的 URL */
  url: string | null
  /** 错误信息 */
  error: Error | null
}

/**
 * 文件上传 Hook
 * @param options 上传配置选项
 * @returns 上传状态和操作方法
 */
export function useUpload(options: UseUploadOptions) {
  const { directory, relatedId, onSuccess, onError } = options

  const [state, setState] = useState<UploadState>({
    uploading: false,
    progress: 0,
    url: null,
    error: null,
  })

  const upload = useCallback(
    async (file: File): Promise<string | null> => {
      setState({ uploading: true, progress: 0, url: null, error: null })

      try {
        // 模拟进度（因为直传 OSS 无法获取真实进度）
        const progressTimer = setInterval(() => {
          setState((prev) => ({
            ...prev,
            progress: Math.min(prev.progress + 10, 90),
          }))
        }, 200)

        // 执行上传
        const url = await uploadApi.uploadSingleFile(file, directory, relatedId)

        clearInterval(progressTimer)
        setState({ uploading: false, progress: 100, url, error: null })

        onSuccess?.(url)

        return url
      } catch (err) {
        const error = err instanceof Error ? err : new Error('上传失败')
        setState({ uploading: false, progress: 0, url: null, error })
        onError?.(error)
        return null
      }
    },
    [directory, relatedId, onSuccess, onError]
  )

  const reset = useCallback(() => {
    setState({ uploading: false, progress: 0, url: null, error: null })
  }, [])

  return {
    ...state,
    upload,
    reset,
  }
}

export function useMultiUpload(options: Omit<UseUploadOptions, 'onSuccess' | 'onError'>) {
  const { directory, relatedId } = options

  const [uploading, setUploading] = useState(false)
  const [results, setResults] = useState<{ file: File; url: string | null; error: Error | null }[]>([])

  const uploadMultiple = useCallback(
    async (files: File[]): Promise<string[]> => {
      setUploading(true)
      setResults([])

      const urls: string[] = []
      const newResults: { file: File; url: string | null; error: Error | null }[] = []

      for (const file of files) {
        try {
          const url = await uploadApi.uploadSingleFile(file, directory, relatedId)
          urls.push(url)
          newResults.push({ file, url, error: null })
        } catch (err) {
          const error = err instanceof Error ? err : new Error('上传失败')
          newResults.push({ file, url: null, error })
        }
      }

      setResults(newResults)
      setUploading(false)

      return urls
    },
    [directory, relatedId]
  )

  const reset = useCallback(() => {
    setUploading(false)
    setResults([])
  }, [])

  return {
    uploading,
    results,
    uploadMultiple,
    reset,
  }
}

export default useUpload
