import { useLayoutEffect } from "react"

import { redirectLegacyHashLocation } from "@/lib/legacyHash"

/**
 * Safety net for leftover HashRouter URLs after the app has already mounted.
 * The real handoff happens in `index.html` / `main.tsx` before the router
 * matches the marketing homepage.
 */
export default function LegacyHashRedirect() {
  useLayoutEffect(() => {
    redirectLegacyHashLocation()
    const onHashChange = () => {
      redirectLegacyHashLocation()
    }
    window.addEventListener("hashchange", onHashChange)
    return () => window.removeEventListener("hashchange", onHashChange)
  }, [])

  return null
}
