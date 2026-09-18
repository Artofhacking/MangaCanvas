import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"

function legacyHashToHistoryPath(location) {
  const { hash, search } = location
  if (!hash.startsWith("#/")) {
    return null
  }

  const hashed = hash.slice(1)
  const queryIndex = hashed.indexOf("?")
  const pathname = queryIndex === -1 ? hashed : hashed.slice(0, queryIndex)
  const hashSearch = queryIndex === -1 ? "" : hashed.slice(queryIndex)

  if (!pathname.startsWith("/") || pathname.startsWith("//")) {
    return null
  }

  return `${pathname}${hashSearch || search}`
}

const cases = [
  [{ hash: "#/project/6/script", search: "" }, "/project/6/script"],
  [{ hash: "#/project/6/scenes", search: "" }, "/project/6/scenes"],
  [{ hash: "#/dashboard", search: "" }, "/dashboard"],
  [{ hash: "#/projects", search: "" }, "/projects"],
  [{ hash: "#/workflow", search: "" }, "/workflow"],
  [{ hash: "#/project/6/script?tab=raw", search: "" }, "/project/6/script?tab=raw"],
  [{ hash: "#/projects", search: "?from=home" }, "/projects?from=home"],
  [{ hash: "#section", search: "" }, null],
  [{ hash: "", search: "" }, null],
  [{ hash: "#//evil.example", search: "" }, null],
]

let failed = 0
for (const [input, expected] of cases) {
  const actual = legacyHashToHistoryPath(input)
  if (actual !== expected) {
    console.error(`legacy hash mapping failed for ${JSON.stringify(input)}`)
    console.error(`  expected ${expected}`)
    console.error(`  actual   ${actual}`)
    failed += 1
  }
}

const html = readFileSync(resolve("index.html"), "utf8")
const requiredSnippets = [
  'hash.indexOf("#/")',
  "location.replace(pathname + (hashSearch || location.search))",
  'pathname.indexOf("//") === 0',
]

for (const snippet of requiredSnippets) {
  if (!html.includes(snippet)) {
    console.error(`index.html is missing the early hash redirect snippet: ${snippet}`)
    failed += 1
  }
}

const helper = readFileSync(resolve("src/lib/legacyHash.ts"), "utf8")
if (!helper.includes("location.replace(next)")) {
  console.error("src/lib/legacyHash.ts must call location.replace")
  failed += 1
}

const boot = readFileSync(resolve("src/main.tsx"), "utf8")
if (!boot.includes("redirectLegacyHashLocation")) {
  console.error("src/main.tsx must consume leftover hash routes before createRoot")
  failed += 1
}

const distHtmlPath = resolve("dist/index.html")
if (existsSync(distHtmlPath)) {
  const distHtml = readFileSync(distHtmlPath, "utf8")
  for (const snippet of requiredSnippets) {
    if (!distHtml.includes(snippet)) {
      console.error(`dist/index.html lost the early hash redirect snippet: ${snippet}`)
      failed += 1
    }
  }
}

if (failed > 0) {
  process.exit(1)
}

console.log("Legacy hash redirect checks OK")
for (const [input, expected] of cases) {
  if (expected) {
    console.log(`  ${input.hash}${input.search} -> ${expected}`)
  }
}
