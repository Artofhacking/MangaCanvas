import { Loader2 } from "lucide-react"

export function QuerySpinner({ label = "加载中..." }: { label?: string }) {
  return (
    <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 text-[hsl(var(--secondary))]">
      <Loader2 className="h-7 w-7 animate-spin text-[hsl(var(--primary))]" />
      <p className="text-sm">{label}</p>
    </div>
  )
}

export function CardGridSkeleton({
  count = 8,
  aspect = "aspect-[4/3]",
}: {
  count?: number
  aspect?: string
}) {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-6">
      {Array.from({ length: count }, (_, index) => (
        <div
          key={index}
          className={`${aspect} animate-pulse rounded-xl bg-[hsl(var(--surface-container-high))]`}
        />
      ))}
    </div>
  )
}
