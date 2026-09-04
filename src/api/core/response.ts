import type { AxiosInstance, AxiosRequestConfig } from 'axios'
import { createRequest } from './createHttpClient'

export interface BackendResponse<T> {
  code: number
  data: T
  message?: string
}

/**
 * 适配后端响应格式
 * 支持两种格式：
 * 1. 标准后端格式: { code: 0, data: T, message?: string }
 * 2. 直接数据格式（mock）: T
 */
function adaptBackendResponse<T>(response: unknown): T {
  // 检查是否是标准后端格式 (有 code 字段)
  if (
    response !== null &&
    typeof response === 'object' &&
    'code' in response &&
    typeof (response as { code: unknown }).code === 'number'
  ) {
    const backendResp = response as BackendResponse<T>
    if (backendResp.code !== 0) {
      throw new Error(backendResp.message || `请求失败: code=${backendResp.code}`)
    }
    return backendResp.data
  }
  // 直接返回数据（mock 模式）
  return response as T
}

export async function requestData<TResponse, TBody = unknown>(
  client: AxiosInstance,
  config: AxiosRequestConfig<TBody>
): Promise<TResponse> {
  const response = await createRequest<unknown, TBody>(client, config)
  return adaptBackendResponse<TResponse>(response)
}
