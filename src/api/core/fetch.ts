import { HttpError } from './error'

export async function readResponseText(response: Response): Promise<string> {
  try {
    return await response.text()
  } catch {
    return ''
  }
}

export async function ensureResponseOk(
  response: Response,
  fallbackMessage = '请求失败'
): Promise<Response> {
  if (response.ok) {
    return response
  }

  const rawMessage = await readResponseText(response)
  const message = rawMessage || `${fallbackMessage}: ${response.status}`

  throw new HttpError(message, {
    status: response.status,
    rawMessage: rawMessage || fallbackMessage,
  })
}

export async function parseJsonResponse<T>(
  response: Response,
  fallbackMessage = '请求失败'
): Promise<T> {
  await ensureResponseOk(response, fallbackMessage)
  return (await response.json()) as T
}

export async function getResponseReader(
  response: Response,
  fallbackMessage = '请求失败'
): Promise<ReadableStreamDefaultReader<Uint8Array>> {
  await ensureResponseOk(response, fallbackMessage)

  const reader = response.body?.getReader()
  if (!reader) {
    throw new HttpError('Response body is not readable', {
      status: response.status,
      rawMessage: fallbackMessage,
    })
  }

  return reader
}
