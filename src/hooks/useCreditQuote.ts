import { useEffect, useMemo, useState } from "react"
import { creditsApi, type CreditQuote, type QuoteRequest } from "@/api/creditsApi"

export function useCreditQuote(request: QuoteRequest | null) {
  const [quote, setQuote] = useState<CreditQuote | null>(null)
  const key = useMemo(() => (request ? JSON.stringify(request) : ""), [request])

  useEffect(() => {
    if (!request?.model) {
      setQuote(null)
      return
    }
    const timer = window.setTimeout(() => {
      creditsApi
        .quote(request)
        .then(setQuote)
        .catch(() => setQuote(null))
    }, 280)
    return () => window.clearTimeout(timer)
  }, [key, request])

  const blocked = !quote
    ? ""
    : !quote.sufficient
      ? "积分不足"
      : !quote.quotaOk
        ? quote.message || "额度不足"
        : ""
  const costLabel = quote ? `${quote.credits} 积分` : null
  return { quote, blocked, costLabel }
}
