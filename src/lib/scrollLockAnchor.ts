const INSTALLED = "__mangacanvasScrollLockAnchor"

/**
 * Remember the document scroll offset before Radix locks the body.
 * The lock rule pins body with top: var(--scroll-lock-top), so a page that
 * was scrolled stays visually put, and the offset is restored on close.
 */
export function installScrollLockAnchor() {
  if (typeof window === "undefined" || typeof document === "undefined") return
  const host = window as Window & { [INSTALLED]?: boolean }
  if (host[INSTALLED]) return
  host[INSTALLED] = true

  let savedY = window.scrollY || document.documentElement.scrollTop || 0
  let locked = document.body.hasAttribute("data-scroll-locked")

  const writeTop = (y: number) => {
    document.documentElement.style.setProperty("--scroll-lock-top", `${-y}px`)
  }

  const remember = () => {
    if (locked) return
    savedY = window.scrollY || document.documentElement.scrollTop || 0
    writeTop(savedY)
  }

  remember()
  window.addEventListener("scroll", remember, { passive: true })

  const observer = new MutationObserver(() => {
    const next = document.body.hasAttribute("data-scroll-locked")
    if (next && !locked) {
      remember()
      locked = true
      return
    }
    if (!next && locked) {
      locked = false
      const y = savedY
      window.scrollTo(0, y)
    }
  })
  observer.observe(document.body, { attributes: true, attributeFilter: ["data-scroll-locked"] })
}
