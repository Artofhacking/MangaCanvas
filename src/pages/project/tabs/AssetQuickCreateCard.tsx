import { Wand2, Workflow } from "lucide-react"
import { cn } from "@/lib/utils"

export type AssetQuickCreateVariant = "character" | "scene" | "object"

interface AssetQuickCreateCardProps {
  variant: AssetQuickCreateVariant
  title: string
  description: string
  quickHint: string
  onQuickCreate: () => void
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
    actions: string
    button: string
    iconWrap: string
    icon: string
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
    actions: "space-y-2",
    button: "gap-2 rounded-xl px-2.5 py-2.5",
    iconWrap: "h-8 w-8 rounded-xl",
    icon: "h-4 w-4",
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
    actions: "space-y-2.5",
    button: "gap-2 rounded-xl px-2.5 py-2.5",
    iconWrap: "h-8 w-8 rounded-xl",
    icon: "h-4 w-4",
    footer: "p-3",
    footerTitle: "cn-keep text-sm font-extrabold text-[hsl(var(--on-surface))] mb-1",
    footerMeta: "",
  },
  object: {
    shell: "rounded-xl",
    aspect: "aspect-square",
    thumbPad: "p-3",
    heading: "text-sm font-bold text-[hsl(var(--on-surface))]",
    description: "mt-1 text-[10px] text-[hsl(var(--secondary))]",
    actions: "space-y-2",
    button: "gap-2 rounded-xl px-2 py-2",
    iconWrap: "h-7 w-7 rounded-lg",
    icon: "h-3.5 w-3.5",
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
  onOpenCanvas,
}: AssetQuickCreateCardProps) {
  const styles = variantStyles[variant]

  return (
    <div
      className={cn(
        "overflow-hidden bg-[hsl(var(--surface-container-lowest))]",
        styles.shell,
      )}
    >
      <div
        className={cn(
          "relative flex w-full flex-col overflow-hidden border-2 border-dashed border-[hsl(var(--outline-variant))] bg-[linear-gradient(180deg,hsl(var(--surface-container))_0%,hsl(var(--surface-container-low))_100%)] transition-all hover:border-[hsl(var(--primary))]/35 hover:shadow-lg hover:shadow-[hsl(var(--primary))]/5",
          styles.aspect,
          styles.thumbPad,
        )}
      >
        <div className={variant === "character" ? "mb-5 pt-2" : variant === "scene" ? "mb-4 pt-1" : "mb-3"}>
          <h3 className={styles.heading}>{title}</h3>
          <p className={styles.description}>{description}</p>
        </div>

        <div className={cn("mt-auto", styles.actions)}>
          <button
            type="button"
            onClick={onQuickCreate}
            className={cn(
              "flex w-full items-center text-left transition-all bg-[hsl(var(--surface-container-high))] hover:bg-[hsl(var(--surface-container-highest))]",
              styles.button,
            )}
          >
            <div
              className={cn(
                "flex shrink-0 items-center justify-center bg-[hsl(var(--primary))]/12 text-[hsl(var(--primary))]",
                styles.iconWrap,
              )}
            >
              <Wand2 className={styles.icon} />
            </div>
            <div className="min-w-0">
              <div className="cn-nowrap text-xs font-bold text-[hsl(var(--on-surface))]">快捷创作</div>
              <div className="cn-nowrap text-[13px] text-[hsl(var(--secondary))]">{quickHint}</div>
            </div>
          </button>

          <button
            type="button"
            onClick={onOpenCanvas}
            className={cn(
              "flex w-full items-center text-left transition-all border border-[hsl(var(--outline-variant))]/60 bg-[hsl(var(--surface))]/75 hover:border-[hsl(var(--primary))]/30 hover:bg-[hsl(var(--surface-container-lowest))]",
              styles.button,
            )}
          >
            <div
              className={cn(
                "flex shrink-0 items-center justify-center bg-[hsl(var(--secondary-container))] text-[hsl(var(--on-secondary-container))]",
                styles.iconWrap,
              )}
            >
              <Workflow className={styles.icon} />
            </div>
            <div className="min-w-0">
              <div className="cn-nowrap text-xs font-bold text-[hsl(var(--on-surface))]">无限画布</div>
              <div className="cn-nowrap text-[13px] text-[hsl(var(--secondary))]">自由编排</div>
            </div>
          </button>
        </div>
      </div>

      <div className={styles.footer}>
        <h3 className={styles.footerTitle}>快捷创作</h3>
        <div className={cn("flex items-center justify-between", styles.footerMeta)}>
          <span
            className={cn(
              "truncate max-w-[60%] text-[13px] text-[hsl(var(--secondary))]",
              variant === "scene" && "font-medium",
            )}
          >
            {quickHint}
          </span>
          <span className="cn-nowrap text-[13px] text-[hsl(var(--secondary))]">无限画布</span>
        </div>
      </div>
    </div>
  )
}
