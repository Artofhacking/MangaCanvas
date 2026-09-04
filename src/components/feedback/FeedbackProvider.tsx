import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { CheckCircle2, AlertTriangle, Info, XCircle, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

type FeedbackVariant = "info" | "success" | "warning" | "error"

interface NotifyOptions {
  title?: string
  description: string
  variant?: FeedbackVariant
  duration?: number
}

interface ConfirmOptions {
  title: string
  description?: string
  confirmText?: string
  cancelText?: string
  tone?: "default" | "danger"
}

interface ToastItem extends NotifyOptions {
  id: number
}

interface ConfirmState extends ConfirmOptions {
  open: boolean
}

interface FeedbackContextValue {
  notify: {
    show: (options: NotifyOptions) => void
    info: (description: string, title?: string) => void
    success: (description: string, title?: string) => void
    warning: (description: string, title?: string) => void
    error: (description: string, title?: string) => void
  }
  confirm: (options: ConfirmOptions) => Promise<boolean>
}

const FeedbackContext = createContext<FeedbackContextValue | null>(null)

const variantStyles: Record<FeedbackVariant, { icon: typeof Info; iconClass: string; ringClass: string }> = {
  info: {
    icon: Info,
    iconClass: "text-[hsl(var(--primary))]",
    ringClass: "ring-[hsl(var(--primary))]/10",
  },
  success: {
    icon: CheckCircle2,
    iconClass: "text-emerald-600",
    ringClass: "ring-emerald-500/10",
  },
  warning: {
    icon: AlertTriangle,
    iconClass: "text-amber-600",
    ringClass: "ring-amber-500/10",
  },
  error: {
    icon: XCircle,
    iconClass: "text-red-600",
    ringClass: "ring-red-500/10",
  },
}

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null)
  const confirmResolverRef = useRef<((value: boolean) => void) | null>(null)
  const idRef = useRef(0)

  const dismissToast = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const show = useCallback(
    ({ duration = 2400, variant = "info", ...options }: NotifyOptions) => {
      const id = ++idRef.current
      setToasts((current) => [...current, { id, duration, variant, ...options }])

      window.setTimeout(() => {
        dismissToast(id)
      }, duration)
    },
    [dismissToast]
  )

  const confirm = useCallback((options: ConfirmOptions) => {
    setConfirmState({
      open: true,
      confirmText: "确定",
      cancelText: "取消",
      tone: "default",
      ...options,
    })

    return new Promise<boolean>((resolve) => {
      confirmResolverRef.current = resolve
    })
  }, [])

  const resolveConfirm = useCallback((value: boolean) => {
    confirmResolverRef.current?.(value)
    confirmResolverRef.current = null
    setConfirmState((current) => (current ? { ...current, open: false } : null))
  }, [])

  const value = useMemo<FeedbackContextValue>(
    () => ({
      notify: {
        show,
        info: (description, title = "提示") => show({ title, description, variant: "info" }),
        success: (description, title = "已完成") => show({ title, description, variant: "success" }),
        warning: (description, title = "请留意") => show({ title, description, variant: "warning" }),
        error: (description, title = "操作失败") => show({ title, description, variant: "error" }),
      },
      confirm,
    }),
    [confirm, show]
  )

  return (
    <FeedbackContext.Provider value={value}>
      {children}

      <div className="pointer-events-none fixed right-6 top-6 z-[100] flex w-full max-w-sm flex-col gap-3">
        {toasts.map((toast) => {
          const config = variantStyles[toast.variant ?? "info"]
          const Icon = config.icon

          return (
            <div
              key={toast.id}
              className={`pointer-events-auto rounded-2xl border border-[hsl(var(--outline-variant))]/30 bg-[hsl(var(--surface-container-lowest))]/95 p-4 shadow-xl shadow-black/5 ring-1 backdrop-blur-md ${config.ringClass}`}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 rounded-full bg-[hsl(var(--surface-container-low))] p-2">
                  <Icon className={`h-4 w-4 ${config.iconClass}`} />
                </div>
                <div className="min-w-0 flex-1">
                  {toast.title ? (
                    <p className="text-sm font-semibold text-[hsl(var(--on-surface))]">{toast.title}</p>
                  ) : null}
                  <p className="mt-1 text-sm leading-6 text-[hsl(var(--on-surface-variant))]">{toast.description}</p>
                </div>
                <button
                  type="button"
                  onClick={() => dismissToast(toast.id)}
                  className="rounded-lg p-1 text-[hsl(var(--secondary))] transition-colors hover:bg-[hsl(var(--surface-container-low))] hover:text-[hsl(var(--on-surface))]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          )
        })}
      </div>

      <Dialog
        open={confirmState?.open ?? false}
        onOpenChange={(open) => {
          if (!open) resolveConfirm(false)
        }}
      >
        <DialogContent className="max-w-[480px] border-0 rounded-2xl bg-[hsl(var(--surface))] p-0 overflow-hidden">
          <div className="px-6 py-6">
            <DialogHeader className="space-y-3 text-left">
              <DialogTitle className="text-xl font-bold text-[hsl(var(--on-surface))]">
                {confirmState?.title}
              </DialogTitle>
              {confirmState?.description ? (
                <DialogDescription className="text-sm leading-6 text-[hsl(var(--secondary))]">
                  {confirmState.description}
                </DialogDescription>
              ) : null}
            </DialogHeader>
          </div>
          <DialogFooter className="border-t border-[hsl(var(--outline-variant))]/20 bg-[hsl(var(--surface-container-low))] px-6 py-4 sm:justify-end">
            <Button
              type="button"
              variant="ghost"
              onClick={() => resolveConfirm(false)}
              className="rounded-xl text-[hsl(var(--secondary))] hover:bg-[hsl(var(--surface-container-high))]"
            >
              {confirmState?.cancelText ?? "取消"}
            </Button>
            <Button
              type="button"
              onClick={() => resolveConfirm(true)}
              className={
                confirmState?.tone === "danger"
                  ? "rounded-xl bg-red-600 text-white hover:bg-red-600/90"
                  : "signature-gradient rounded-xl text-white border-0 hover:opacity-90"
              }
            >
              {confirmState?.confirmText ?? "确定"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </FeedbackContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useFeedback() {
  const context = useContext(FeedbackContext)

  if (!context) {
    throw new Error("useFeedback must be used within FeedbackProvider")
  }

  return context
}
