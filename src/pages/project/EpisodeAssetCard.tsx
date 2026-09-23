import { episodeAssetImageSrc, episodeAssetInitial, shouldRenderAssetImage, type EpisodeAssetKind } from "@/pages/project/episodeOverview"
import { Image as ImageIcon, Package } from "lucide-react"
import { useEffect, useState, type ReactNode } from "react"

function AssetMark({ name, kind }: { name: string; kind: EpisodeAssetKind }) {
  if (kind === "character") {
    return <span className="text-base font-semibold text-[hsl(var(--on-surface))]">{episodeAssetInitial(name)}</span>
  }
  const Icon = kind === "scene" ? ImageIcon : Package
  return <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
}

export function EpisodeAssetThumb({
  name,
  image,
  kind,
}: {
  name: string
  image?: string | null
  kind: EpisodeAssetKind
}) {
  const src = episodeAssetImageSrc(image)
  const [failed, setFailed] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    setFailed(false)
    setLoaded(false)
  }, [src])

  const showImage = shouldRenderAssetImage(src, failed)

  return (
    <span
      aria-hidden="true"
      className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[hsl(var(--surface-container-lowest))] text-[hsl(var(--secondary))]"
    >
      {loaded && showImage ? null : <AssetMark name={name} kind={kind} />}
      {showImage ? (
        <img
          src={src || undefined}
          alt=""
          className={`absolute inset-0 h-full w-full object-cover transition-opacity ${loaded ? "opacity-100" : "opacity-0"}`}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
        />
      ) : null}
    </span>
  )
}

export function EpisodeAssetCard({
  name,
  image,
  kind,
  statusLine,
  onClick,
}: {
  name: string
  image?: string | null
  kind: EpisodeAssetKind
  statusLine: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-2xl bg-[hsl(var(--surface-container-high))] p-3 text-left transition-colors hover:bg-[hsl(var(--surface-container-highest))]"
    >
      <EpisodeAssetThumb name={name} image={image} kind={kind} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold text-[hsl(var(--on-surface))]">{name}</span>
        <span className="mt-0.5 block truncate text-xs text-[hsl(var(--secondary))]">{statusLine}</span>
      </span>
    </button>
  )
}

export function EpisodeAssetColumn({
  icon,
  title,
  empty,
  items,
  footer,
}: {
  icon: ReactNode
  title: string
  empty: string
  items: Array<{
    id: number
    name: string
    image?: string | null
    kind: EpisodeAssetKind
    statusLine: string
    onClick: () => void
  }>
  footer?: ReactNode
}) {
  return (
    <div className="flex h-full flex-col rounded-[24px] border border-[hsl(var(--outline-variant))]/20 bg-[hsl(var(--surface-container-low))] p-6">
      <div className="flex items-center gap-2 text-[hsl(var(--secondary))]">
        {icon}
        <span className="text-[13px] font-semibold">{title}</span>
      </div>
      <div className="mt-5 flex flex-col gap-3">
        {items.length === 0 ? (
          <p className="text-sm text-[hsl(var(--secondary))]">{empty}</p>
        ) : (
          items.map((item) => (
            <EpisodeAssetCard
              key={item.id}
              name={item.name}
              image={item.image}
              kind={item.kind}
              statusLine={item.statusLine}
              onClick={item.onClick}
            />
          ))
        )}
      </div>
      {footer ? <div className="mt-5 lg:mt-auto lg:pt-5">{footer}</div> : null}
    </div>
  )
}
