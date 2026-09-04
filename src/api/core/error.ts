import axios, { AxiosError } from 'axios'

export class HttpError extends Error {
  status?: number
  code?: string
  rawMessage?: string

  constructor(message: string, options: { status?: number; code?: string; rawMessage?: string } = {}) {
    super(message)
    this.name = 'HttpError'
    this.status = options.status
    this.code = options.code
    this.rawMessage = options.rawMessage
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

    return new HttpError(message, {
      status: error.response?.status,
      code: error.code,
      rawMessage,
    })
  }

  if (error instanceof Error) {
    const rawMessage = error.message || fallbackMessage
    const message = getMessage?.({ error, rawMessage, fallbackMessage }) || rawMessage
    return new HttpError(message, { rawMessage })
  }

  return new HttpError(fallbackMessage, { rawMessage: fallbackMessage })
}
