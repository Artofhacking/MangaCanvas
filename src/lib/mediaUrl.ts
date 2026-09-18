function currentOrigin(): string {
  if (typeof window === "undefined" || !window.location?.origin) return ""
  return window.location.origin.replace(/\/$/, "")
}

function mediaPath(url: string): string | null {
  if (!url || url.startsWith("data:") || url.startsWith("blob:")) return null
  try {
    const parsed = new URL(url, currentOrigin() || "http://local")
    const path = `${parsed.pathname}${parsed.search}`
    if (path.startsWith("/static/") || path.startsWith("/api/")) return path
  } catch {
    if (url.startsWith("/static/") || url.startsWith("/api/")) return url
  }
  return null
}

export function mediaUrl(url?: string | null): string {
  if (!url) return ""
  const path = mediaPath(url)
  if (!path) return url
  const origin = currentOrigin()
  return origin ? `${origin}${path}` : path
}

export function rewriteCanvasMedia<T extends { nodes?: Array<{ data?: Record<string, unknown> }> }>(canvas: T): T {
  const nodes = (canvas.nodes || []).map((node) => {
    const data = node.data
    if (!data) return node
    const next = { ...data }
    for (const key of ["url", "thumbnail", "cover", "poster"]) {
      if (typeof next[key] === "string") {
        next[key] = mediaUrl(next[key] as string)
      }
    }
    return { ...node, data: next }
  })
  return { ...canvas, nodes }
}
