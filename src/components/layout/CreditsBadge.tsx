import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { creditsApi } from "@/api/creditsApi"
import { applySessionCredits, CREDITS_CHANGE_EVENT, getCurrentUser } from "@/lib/session"

export default function CreditsBadge({ className = "" }: { className?: string }) {
  const [balance, setBalance] = useState<number | null>(getCurrentUser()?.credits ?? null)

  useEffect(() => {
    const sync = () => setBalance(getCurrentUser()?.credits ?? null)
    const load = () => {
      creditsApi
        .balance()
        .then((data) => {
          setBalance(data.balance)
          applySessionCredits(data.balance)
        })
        .catch(() => sync())
    }
    load()
    window.addEventListener(CREDITS_CHANGE_EVENT, sync)
    return () => window.removeEventListener(CREDITS_CHANGE_EVENT, sync)
  }, [])

  return (
    <Link
      to="/billing"
      className={`inline-flex h-9 items-center rounded-full bg-[hsl(var(--surface-container-low))] px-3 text-xs font-semibold text-[hsl(var(--on-surface))] hover:bg-[hsl(var(--surface-container-high))] ${className}`}
      title="积分与账单"
    >
      {balance == null ? "—" : balance.toLocaleString()} 积分
    </Link>
  )
}
