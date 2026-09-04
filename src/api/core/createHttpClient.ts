import axios, {
  AxiosError,
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from 'axios'
import type { HttpError } from './error'
import { normalizeHttpError } from './error'

export interface CreateHttpClientOptions {
  baseURL: string
  timeout?: number
  headers?: Record<string, string>
  showErrorMessage?: boolean
  resolveBaseURL?: () => string | undefined
  resolveHeaders?: (config: InternalAxiosRequestConfig) => Record<string, string | undefined>
  mapErrorMessage?: (rawMessage: string, error: AxiosError | Error) => string
  onError?: (error: HttpError) => void
}

export function createHttpClient(options: CreateHttpClientOptions): AxiosInstance {
  const client = axios.create({
    baseURL: options.baseURL,
    timeout: options.timeout ?? 15000,
    headers: options.headers,
  })

  client.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
      const runtimeBaseURL = options.resolveBaseURL?.()
      if (runtimeBaseURL) {
        config.baseURL = runtimeBaseURL
      }

      const runtimeHeaders = options.resolveHeaders?.(config)
      if (runtimeHeaders) {
        Object.entries(runtimeHeaders).forEach(([key, value]) => {
          if (value !== undefined) {
            config.headers.set(key, value)
          }
        })
      }

      return config
    },
    (error: AxiosError) => {
      return Promise.reject(
        normalizeHttpError(error, '请求发送失败', (context) =>
          options.mapErrorMessage?.(context.rawMessage, context.error) || context.rawMessage
        )
      )
    }
  )

  client.interceptors.response.use(
    (response) => {
      return response
    },
    (error: AxiosError) => {
      const normalizedError = normalizeHttpError(error, '请求失败', (context) =>
        options.mapErrorMessage?.(context.rawMessage, context.error) || context.rawMessage
      )

      if (options.showErrorMessage !== false) {
        options.onError?.(normalizedError)
      }

      return Promise.reject(normalizedError)
    }
  )

  return client
}

export function createRequest<TResponse = unknown, TData = unknown>(
  client: AxiosInstance,
  config: AxiosRequestConfig<TData>
): Promise<TResponse> {
  return client
    .request<TResponse, AxiosResponse<TResponse>, TData>(config)
    .then((response) => response.data)
}
