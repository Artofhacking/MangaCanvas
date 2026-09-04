import type { AxiosRequestConfig } from 'axios'
import { appClient, requestData } from '@/api'

export interface ApiResponse<T> {
  success: boolean
  data: T
  message?: string
}

export const successResponse = <T>(data: T): ApiResponse<T> => ({
  success: true,
  data,
})

export const errorResponse = <T>(message: string, fallbackData: T): ApiResponse<T> => ({
  success: false,
  data: fallbackData,
  message,
})

export async function toApiResponse<TResponse, TBody = unknown>(
  config: AxiosRequestConfig<TBody>,
  fallbackData: TResponse,
  message: string,
  transform?: (data: TResponse) => TResponse
): Promise<ApiResponse<TResponse>> {
  try {
    const data = await requestData<TResponse, TBody>(appClient, config)
    return successResponse(transform ? transform(data) : data)
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message || message : message, fallbackData)
  }
}
