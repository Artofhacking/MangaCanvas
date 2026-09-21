import axios, { AxiosError } from 'axios'

export class HttpError extends Error {
  status?: number
  code?: number | string
  rawMessage?: string
  url?: string

  constructor(
    message: string,
    options: { status?: number; code?: number | string; rawMessage?: string; url?: string } = {}
  ) {
    super(message)
    this.name = 'HttpError'
    this.status = options.status
    this.code = options.code
    this.rawMessage = options.rawMessage
    this.url = options.url
  }
}

export interface ErrorMessageContext {
  error: AxiosError | Error
  rawMessage: string
  fallbackMessage: string
}

export function extractErrorMessage(error: unknown, fallbackMessage = '请求失败'): string {
  if (axios.isAxiosError(error)) {
    return (
      error.response?.data?.message ||
      error.response?.data?.error?.message ||
      error.message ||
      fallbackMessage
    )
  }

  if (error instanceof Error) {
    return error.message || fallbackMessage
  }

  return fallbackMessage
}

export function isCanceledError(error: unknown): boolean {
  if (!error) return false
  if (axios.isCancel(error)) return true

  if (typeof error === 'object' && error !== null) {
    const code = 'code' in error ? String((error as { code?: unknown }).code || '') : ''
    const name = 'name' in error ? String((error as { name?: unknown }).name || '') : ''
    if (code === 'ERR_CANCELED' || name === 'CanceledError' || name === 'AbortError') {
      return true
    }
  }

  if (error instanceof Error) {
    return error.message === 'canceled' || error.message === '已取消'
  }

  return false
}

export function normalizeHttpError(
  error: unknown,
  fallbackMessage = '请求失败',
  getMessage?: (context: ErrorMessageContext) => string
): HttpError {
  if (error instanceof HttpError) {
    return error
  }

  if (axios.isAxiosError(error)) {
    const rawMessage = extractErrorMessage(error, fallbackMessage)
    const message = getMessage?.({ error, rawMessage, fallbackMessage }) || rawMessage

    const envelopeCode = error.response?.data?.code
    return new HttpError(message, {
      status: error.response?.status,
      code: envelopeCode ?? error.code,
      rawMessage,
      url: error.config?.url,
    })
  }

  if (error instanceof Error) {
    const rawMessage = error.message || fallbackMessage
    const message = getMessage?.({ error, rawMessage, fallbackMessage }) || rawMessage
    return new HttpError(message, { rawMessage })
  }

  return new HttpError(fallbackMessage, { rawMessage: fallbackMessage })
}
