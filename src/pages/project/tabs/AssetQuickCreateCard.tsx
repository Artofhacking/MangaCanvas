import { Upload, Wand2, Workflow } from "lucide-react"
import { cn } from "@/lib/utils"

export type AssetQuickCreateVariant = "character" | "scene" | "object"

interface AssetQuickCreateCardProps {
  variant: AssetQuickCreateVariant
  title: string
  description: string
  quickHint: string
  onQuickCreate: () => void
  onUpload?: () => void
  onOpenCanvas: () => void
}

const variantStyles: Record<
  AssetQuickCreateVariant,
  {
    shell: string
    aspect: string
    thumbPad: string
    heading: string
    description: string
    footer: string
    footerTitle: string
    footerMeta: string
  }
> = {
  character: {
    shell: "rounded-lg",
    aspect: "aspect-[4/5]",
    thumbPad: "p-3.5",
    heading: "text-sm font-bold text-[hsl(var(--on-surface))]",
    description: "mt-1 text-[11px] leading-5 text-[hsl(var(--secondary))]",
    footer: "p-2.5",
    footerTitle: "cn-keep text-xs font-bold text-[hsl(var(--on-surface))] truncate",
    footerMeta: "mt-1",
  },
  scene: {
    shell: "rounded-xl",
    aspect: "aspect-[4/3]",
    thumbPad: "p-4",
    heading: "text-base font-bold text-[hsl(var(--on-surface))]",
    description: "mt-1 text-xs leading-5 text-[hsl(var(--secondary))]",
    footer: "p-3",
    footerTitle: "cn-keep text-sm font-extrabold text-[hsl(var(--on-surface))] mb-1 truncate",
    footerMeta: "",
  },
  object: {
    shell: "rounded-xl",
    aspect: "aspect-square",
    thumbPad: "p-3",
    heading: "text-sm font-bold text-[hsl(var(--on-surface))]",
    description: "mt-1 text-[10px] text-[hsl(var(--secondary))]",
    footer: "p-3",
    footerTitle: "cn-keep text-sm font-bold text-[hsl(var(--on-surface))] mb-1 truncate",
    footerMeta: "",
  },
}

export default function AssetQuickCreateCard({
  variant,
  title,
  description,
  quickHint,
  onQuickCreate,
  onUpload,
  onOpenCanvas,
}: AssetQuickCreateCardProps) {
  const styles = variantStyles[variant]
  const iconButton =
    variant === "object"
      ? { wrap: "h-9 w-9 rounded-lg", icon: "h-4 w-4" }
      : { wrap: "h-10 w-10 rounded-xl", icon: "h-4 w-4" }

  return (
    <div
      className={cn(
        "overflow-hidden bg-[hsl(var(--surface-container-lowest))]",
        styles.shell,
      )}
    >
      <div
        className={cn(
          "relative flex w-full flex-col items-center justify-center overflow-hidden border-2 border-dashed border-[hsl(var(--outline-variant))] bg-[linear-gradient(180deg,hsl(var(--surface-container))_0%,hsl(var(--surface-container-low))_100%)] text-center transition-all hover:border-[hsl(var(--primary))]/35 hover:shadow-lg hover:shadow-[hsl(var(--primary))]/5",
          styles.aspect,
          styles.thumbPad,
        )}
      >
        <h3 className={styles.heading}>{title}</h3>
        <p className={styles.description}>{description}</p>

        <div className="mt-3 flex w-full items-center justify-center gap-2">
          <button
            type="button"
            onClick={onQuickCreate}
            aria-label={`快捷创作，${quickHint}`}
            className={cn(
              "flex items-center justify-center bg-[hsl(var(--primary))]/12 text-[hsl(var(--primary))] transition-all hover:bg-[hsl(var(--primary))]/18",
              iconButton.wrap,
            )}
          >
            <Wand2 className={iconButton.icon} />
          </button>
          {onUpload ? (
            <button
              type="button"
              onClick={onUpload}
              aria-label="上传到素材库"
              className={cn(
                "flex items-center justify-center border border-[hsl(var(--primary))]/25 bg-[hsl(var(--surface))]/80 text-[hsl(var(--primary))] transition-all hover:border-[hsl(var(--primary))]/45 hover:bg-[hsl(var(--primary))]/10",
                iconButton.wrap,
              )}
            >
              <Upload className={iconButton.icon} />
            </button>
          ) : null}
          <button
            type="button"
            onClick={onOpenCanvas}
            aria-label="无限画布，自由编排"
            className={cn(
              "flex items-center justify-center border border-[hsl(var(--outline-variant))]/60 bg-[hsl(var(--surface))]/75 text-[hsl(var(--on-secondary-container))] transition-all hover:border-[hsl(var(--primary))]/30 hover:bg-[hsl(var(--surface-container-lowest))]",
              iconButton.wrap,
            )}
          >
            <Workflow className={iconButton.icon} />
          </button>
        </div>
      </div>

      <div className={styles.footer}>
        <div className="flex items-start justify-between gap-2">
          <button
            type="button"
            onClick={onQuickCreate}
            className="min-w-0 flex-1 text-left transition-colors hover:text-[hsl(var(--primary))]"
          >
            <span className={cn(styles.footerTitle, "block")}>快捷创作</span>
            <span
              className={cn(
                "block truncate text-[13px] text-[hsl(var(--secondary))]",
                styles.footerMeta,
                variant === "scene" && "font-medium",
              )}
            >
              {quickHint}
            </span>
          </button>
          {onUpload ? (
            <button
              type="button"
              onClick={onUpload}
              className="min-w-0 flex-1 text-center transition-colors hover:text-[hsl(var(--primary))]"
            >
              <span className={cn(styles.footerTitle, "block")}>上传入库</span>
              <span
                className={cn(
                  "cn-nowrap block text-[13px] text-[hsl(var(--secondary))]",
                  styles.footerMeta,
                  variant === "scene" && "font-medium",
                )}
              >
                图片进库
              </span>
            </button>
          ) : null}
          <button
            type="button"
            onClick={onOpenCanvas}
            className="min-w-0 flex-1 text-right transition-colors hover:text-[hsl(var(--primary))]"
          >
            <span className={cn(styles.footerTitle, "block")}>无限画布</span>
            <span
              className={cn(
                "cn-nowrap block text-[13px] text-[hsl(var(--secondary))]",
                styles.footerMeta,
                variant === "scene" && "font-medium",
              )}
            >
              自由编排
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}
