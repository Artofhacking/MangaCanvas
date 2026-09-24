import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const css = readFileSync(new URL("../index.css", import.meta.url), "utf8")

describe("dialog scroll lock keeps the right edge", () => {
  it("pins the locked body and leaves the root scrollbar in place", () => {
    expect(css).toMatch(/html\s*\{[^}]*overflow-y:\s*scroll/)
    expect(css).toMatch(/html:has\(body\.workspace-body-lock\)\s*\{[^}]*overflow-y:\s*hidden/)
    expect(css).toMatch(
      /html body\[data-scroll-locked\]\s*\{[^}]*position:\s*fixed\s*!important/
    )
    expect(css).toMatch(
      /html body\[data-scroll-locked\]\s*\{[^}]*--removed-body-scroll-bar-size:\s*0px\s*!important/
    )
    expect(css).toMatch(
      /html body\[data-scroll-locked\]\s*\{[^}]*margin-right:\s*0px\s*!important/
    )
    expect(css).not.toMatch(/overflow-y:\s*scroll;\s*\n\s*overflow-x:\s*hidden/)
  })
})
