export type PlotAsset = {
  id: number
  name: string
  category: 'character' | 'scene' | 'object'
  image?: string
}

export type PlotToken =
  | { type: 'text'; value: string }
  | { type: 'mention'; value: string; asset: PlotAsset }

export function seedNodeId(asset: PlotAsset) {
  return `seed_${asset.category}_${asset.id}`
}

export function buildAliasList(assets: PlotAsset[]) {
  const aliases: Array<{ token: string; asset: PlotAsset }> = []
  const taken = new Set<string>()
  const add = (token: string, asset: PlotAsset) => {
    const key = (token || '').trim()
    if (!key || taken.has(key)) return
    taken.add(key)
    aliases.push({ token: key, asset })
  }
  ;[...assets]
    .filter((item) => item.name)
    .sort((a, b) => b.name.length - a.name.length)
    .forEach((asset) => add(asset.name, asset))
  assets
    .filter((item) => item.category === 'object' && item.name)
    .forEach((asset) => {
      const name = asset.name
      for (let index = 1; index <= name.length - 2; index += 1) {
        add(name.slice(index), asset)
      }
      if (name.length >= 4) {
        for (let index = 1; index < name.length - 1; index += 1) {
          add(name.slice(0, index) + name.slice(index + 1), asset)
        }
      }
    })
  return aliases.sort((a, b) => b.token.length - a.token.length)
}

function matchAlias(slice: string, aliases: Array<{ token: string; asset: PlotAsset }>) {
  return aliases.find((item) => slice.startsWith(item.token))
}

export function mentionizePlot(text: string, assets: PlotAsset[]) {
  const aliases = buildAliasList(assets)
  if (!text || !aliases.length) return text || ''
  let out = ''
  let index = 0
  while (index < text.length) {
    if (text[index] === '@') {
      const hit = matchAlias(text.slice(index + 1), aliases)
      if (hit) {
        out += `@${hit.asset.name}`
        index += 1 + (text.slice(index + 1).startsWith(hit.asset.name) ? hit.asset.name.length : hit.token.length)
        continue
      }
    }
    const hit = text[index] === '@' ? undefined : matchAlias(text.slice(index), aliases)
    if (hit) {
      out += `@${hit.asset.name}`
      index += hit.token.length
      if (text[index] === '子' && !hit.asset.name.endsWith('子')) {
        index += 1
      }
      continue
    }
    out += text[index]
    index += 1
  }
  return out
}

export function tokenizePlot(text: string, assets: PlotAsset[]): PlotToken[] {
  const aliases = buildAliasList(assets)
  if (!text) return []
  if (!aliases.length) return [{ type: 'text', value: text }]
  const tokens: PlotToken[] = []
  let index = 0
  while (index < text.length) {
    if (text[index] === '@') {
      const hit = matchAlias(text.slice(index + 1), aliases)
      if (hit) {
        const consumed = text.slice(index + 1).startsWith(hit.asset.name) ? hit.asset.name.length : hit.token.length
        tokens.push({ type: 'mention', value: `@${hit.asset.name}`, asset: hit.asset })
        index += 1 + consumed
        continue
      }
    }
    const nextAt = text.indexOf('@', index + 1)
    const end = nextAt === -1 ? text.length : nextAt
    if (end > index) {
      tokens.push({ type: 'text', value: text.slice(index, end) })
      index = end
    } else {
      tokens.push({ type: 'text', value: text[index] })
      index += 1
    }
  }
  return tokens
}

export function mentionedAssets(text: string, assets: PlotAsset[]) {
  const found: PlotAsset[] = []
  const seen = new Set<string>()
  tokenizePlot(mentionizePlot(text, assets), assets).forEach((token) => {
    if (token.type !== 'mention') return
    const key = `${token.asset.category}:${token.asset.id}`
    if (seen.has(key)) return
    seen.add(key)
    found.push(token.asset)
  })
  return found
}

export function plotNeedsMentions(text: string, assets: PlotAsset[]) {
  const source = text || ''
  if (!source.trim() || !assets.length) return false
  return mentionizePlot(source, assets) !== source
}
