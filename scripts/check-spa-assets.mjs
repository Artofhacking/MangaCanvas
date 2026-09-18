import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"

const htmlPath = resolve("dist/index.html")

if (!existsSync(htmlPath)) {
  console.error("dist/index.html missing. Run `npm run build` first.")
  process.exit(1)
}

const html = readFileSync(htmlPath, "utf8")
const relative = [...html.matchAll(/\b(?:src|href)="(\.\/(?:assets|src)\/[^"]+)"/g)].map((match) => match[1])
const absoluteAssets = [...html.matchAll(/\b(?:src|href)="(\/assets\/[^"]+)"/g)].map((match) => match[1])

if (relative.length > 0) {
  console.error("Relative asset URLs found (history deep links will white-screen):")
  for (const url of relative) {
    console.error(`  ${url}`)
  }
  process.exit(1)
}

if (absoluteAssets.length === 0) {
  console.error("dist/index.html has no absolute /assets/* URLs.")
  process.exit(1)
}

console.log("SPA asset URLs OK:")
for (const url of absoluteAssets) {
  console.log(`  ${url}`)
}
