import { useEffect } from "react"
import { useNavigate } from "react-router-dom"

/**
 * Keep bookmarked HashRouter URLs working after the switch to history mode.
 * `#/project/6/scenes` (and `#/project/6/assets/scenes`) rewrite to the same path.
 */
export default function LegacyHashRedirect() {
  const navigate = useNavigate()

  useEffect(() => {
    const { hash, search } = window.location
    if (!hash.startsWith("#/")) {
      return
    }

    const hashed = hash.slice(1)
    const queryIndex = hashed.indexOf("?")
    const pathname = queryIndex === -1 ? hashed : hashed.slice(0, queryIndex)
    const hashSearch = queryIndex === -1 ? "" : hashed.slice(queryIndex)
    navigate(`${pathname}${hashSearch || search}`, { replace: true })
  }, [navigate])

  return null
}
