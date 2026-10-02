export function EpisodeAssociationRow({
  name,
  image,
  checked,
  onToggle,
  onPreview,
}: {
  name: string
  image?: string | null
  checked: boolean
  onToggle: () => void
  onPreview: () => void
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-[hsl(var(--surface-container-low))] p-3 transition-colors hover:bg-[hsl(var(--surface-container-high))]">
      <input
        type="checkbox"
        checked={checked}
        aria-label={`关联 ${name}`}
        onClick={(event) => event.stopPropagation()}
        onChange={() => onToggle()}
        className="h-4 w-4 shrink-0 cursor-pointer"
      />
      <button
        type="button"
        onClick={onPreview}
        aria-label={`查看 ${name}`}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
      >
        {image ? (
          <img src={image} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" />
        ) : (
          <span className="h-10 w-10 shrink-0 rounded-lg bg-[hsl(var(--surface-container-highest))]" />
        )}
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-[hsl(var(--on-surface))]">{name}</span>
      </button>
    </div>
  )
}
