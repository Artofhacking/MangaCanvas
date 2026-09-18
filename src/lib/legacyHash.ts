/**
 * Convert leftover HashRouter bookmarks (`#/project/6/script`) into a
 * same-origin history path. Returns null when the URL is not a legacy hash route.
 */
export function legacyHashToHistoryPath(
  location: Pick<Location, "hash" | "search">,
): string | null {
  const { hash, search } = location
  if (!hash.startsWith("#/")) {
    return null
  }

  const hashed = hash.slice(1)
  const queryIndex = hashed.indexOf("?")
  const pathname = queryIndex === -1 ? hashed : hashed.slice(0, queryIndex)
  const hashSearch = queryIndex === -1 ? "" : hashed.slice(queryIndex)

  // Only accept same-origin paths. `#//evil.example` would otherwise become
  // a protocol-relative redirect.
  if (!pathname.startsWith("/") || pathname.startsWith("//")) {
    return null
  }

  return `${pathname}${hashSearch || search}`
}

export function redirectLegacyHashLocation(
  location: Pick<Location, "hash" | "search" | "replace"> = window.location,
): boolean {
  const next = legacyHashToHistoryPath(location)
  if (!next) {
    return false
  }

  location.replace(next)
  return true
}
