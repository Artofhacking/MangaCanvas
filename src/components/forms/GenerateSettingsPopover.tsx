import { useEffect, type ReactNode } from "react"
import { ChevronDown } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useFeedback } from "@/components/feedback/FeedbackProvider"
import { aspectRatioIconSize } from "@/features/infinite-canvas/utils/aspectRatio"
import {
  applyAspectRatio,
  applyClarityTier,
  applyQualityTier,
  applyQuantity,
  clampGenerateSettings,
  CLARITY_TIERS,
  type ClarityTier,
  formatSettingsCapsule,
  GENERATE_ASPECT_RATIOS,
  availableRatios,
  type GenerateSettings,
  isClaritySupported,
  isQualitySupported,
  isRatioSupported,
  QUALITY_TIERS,
  type QualityTier,
  QUANTITY_OPTIONS,
} from "@/lib/generateSettings"
import { listQuantityOptions } from "@/features/infinite-canvas/utils/generateParams"
import { cn } from "@/lib/utils"

interface GenerateSettingsPopoverProps {
  model: string
  value: GenerateSettings
  onChange: (next: GenerateSettings) => void
  quantityOptions?: number[]
  showQuantity?: boolean
  disabled?: boolean
  align?: "start" | "center" | "end"
}

function SectionLabel({ children }: { children: string }) {
  return (
    <p className="mb-2 text-[11px] font-semibold tracking-wide text-[hsl(var(--on-surface-variant))]">
      {children}
    </p>
  )
}

function ChoiceButton({
  active,
  disabled,
  onClick,
  className,
  children,
}: {
  active: boolean
  disabled?: boolean
  onClick: () => void
  className?: string
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-2 text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[hsl(var(--primary))]",
        active
          ? "signature-gradient border-transparent text-white shadow-sm"
          : "border-[hsl(var(--outline-variant))]/45 bg-[hsl(var(--surface-container-low))] text-[hsl(var(--on-surface))] hover:border-[hsl(var(--primary))]/40",
        disabled && !active && "cursor-not-allowed opacity-40 hover:border-[hsl(var(--outline-variant))]/45",
        className
      )}
    >
      {children}
    </button>
  )
}

export function GenerateSettingsPopover({
  model,
  value,
  onChange,
  quantityOptions,
  showQuantity = true,
  disabled = false,
  align = "end",
}: GenerateSettingsPopoverProps) {
  const { notify } = useFeedback()
  const resolvedQuantity = quantityOptions ?? (model ? listQuantityOptions(model) : [...QUANTITY_OPTIONS])
  const ratioOptions = model ? availableRatios(model, value.quality) : [...GENERATE_ASPECT_RATIOS]

  useEffect(() => {
    if (!model) return
    const clamped = clampGenerateSettings(model, value)
    if (!clamped.changed) return
    onChange(clamped.settings)
    if (clamped.message) notify.info(clamped.message)
    // Clamp only when the model or current combo is incompatible.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model, value.quality, value.aspectRatio, value.clarity])

  const commit = (result: { settings: GenerateSettings; ok: boolean; message?: string }) => {
    if (!result.ok) {
      if (result.message) notify.warning(result.message)
      return
    }
    onChange(result.settings)
    if (result.message) notify.info(result.message)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          aria-label="生成参数"
          title={formatSettingsCapsule(value)}
          className={cn(
            "inline-flex max-w-full items-center gap-1.5 rounded-full border border-[hsl(var(--outline-variant))]/40 bg-[hsl(var(--surface-container-lowest))] px-3 py-1.5 text-left text-xs font-semibold text-[hsl(var(--on-surface))] shadow-sm transition-colors hover:border-[hsl(var(--primary))]/35 hover:bg-[hsl(var(--surface-container-low))] disabled:opacity-50",
          )}
        >
          <span className="truncate">{formatSettingsCapsule(value)}</span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[hsl(var(--secondary))]" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={align}
        side="top"
        sideOffset={10}
        className="z-[80] w-[min(22.5rem,calc(100vw-2rem))] rounded-2xl border-[hsl(var(--outline-variant))]/30 bg-[hsl(var(--surface-container-lowest))] p-4 shadow-2xl"
        onCloseAutoFocus={(event) => event.preventDefault()}
      >
        <div
          className="space-y-4"
          onPointerDown={(event) => event.preventDefault()}
        >
          <section>
            <SectionLabel>画质</SectionLabel>
            <div className="grid grid-cols-3 gap-1.5">
              {QUALITY_TIERS.map((tier) => {
                const supported = !model || isQualitySupported(model, tier.id)
                return (
                  <ChoiceButton
                    key={tier.id}
                    active={value.quality === tier.id}
                    disabled={!supported}
                    onClick={() => commit(applyQualityTier(model, value, tier.id as QualityTier))}
                  >
                    {tier.label}
                  </ChoiceButton>
                )
              })}
            </div>
          </section>

          <section>
            <SectionLabel>清晰度</SectionLabel>
            <div className="grid grid-cols-3 gap-1.5">
              {CLARITY_TIERS.map((tier) => {
                const supported = !model || isClaritySupported(model, value.quality, value.aspectRatio, tier.id)
                return (
                  <ChoiceButton
                    key={tier.id}
                    active={value.clarity === tier.id}
                    disabled={!supported}
                    onClick={() => commit(applyClarityTier(model, value, tier.id as ClarityTier))}
                  >
                    {tier.label}
                  </ChoiceButton>
                )
              })}
            </div>
          </section>

          <section>
            <SectionLabel>比例</SectionLabel>
            <div className="grid grid-cols-5 gap-1.5">
              {ratioOptions.map((ratio) => {
                const active = value.aspectRatio === ratio
                const supported = !model || isRatioSupported(model, value.quality, ratio)
                const icon = aspectRatioIconSize(ratio)
                return (
                  <button
                    key={ratio}
                    type="button"
                    title={supported ? ratio : `${ratio}（当前模型不支持）`}
                    onClick={() => commit(applyAspectRatio(model, value, ratio))}
                    className={cn(
                      "flex flex-col items-center gap-1 rounded-xl border px-1 py-2 transition-colors",
                      active
                        ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/10"
                        : "border-[hsl(var(--outline-variant))]/40 bg-[hsl(var(--surface-container-low))] hover:border-[hsl(var(--primary))]/35",
                      !supported && !active && "cursor-not-allowed opacity-40 hover:border-[hsl(var(--outline-variant))]/40"
                    )}
                  >
                    <span
                      className="rounded-[2px] border-2"
                      style={{
                        width: icon.w,
                        height: icon.h,
                        borderColor: active ? "hsl(var(--primary))" : "hsl(var(--on-surface-variant))",
                      }}
                    />
                    <span
                      className="text-[10px] font-semibold"
                      style={{ color: active ? "hsl(var(--primary))" : "hsl(var(--on-surface-variant))" }}
                    >
                      {ratio}
                    </span>
                  </button>
                )
              })}
            </div>
          </section>

          {showQuantity ? (
            <section>
              <SectionLabel>生成数量</SectionLabel>
              <div className="grid grid-cols-3 gap-1.5">
                {resolvedQuantity.map((qty) => (
                  <ChoiceButton
                    key={qty}
                    active={value.quantity === qty}
                    onClick={() => commit(applyQuantity(value, qty, model))}
                  >
                    {qty}张
                  </ChoiceButton>
                ))}
              </div>
              <p className="mt-2 text-[10px] text-[hsl(var(--secondary))]">每次生成会按张数消耗积分</p>
            </section>
          ) : null}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
