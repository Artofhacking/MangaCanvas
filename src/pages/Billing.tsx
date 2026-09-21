import { useCallback, useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { AlertCircle, Coins, Receipt, RefreshCw, TrendingDown, TrendingUp, Wallet } from "lucide-react"
import WorkspaceHeader from "@/components/layout/WorkspaceHeader"
import WorkspaceLayout from "@/components/layout/WorkspaceLayout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Pagination } from "@/components/ui/pagination"
import { QuerySpinner } from "@/components/feedback/ListQueryState"
import { useFeedback } from "@/components/feedback/FeedbackProvider"
import { creditsApi, type CreditHistoryItem, type CreditsBalance, type PriceRule } from "@/api/creditsApi"
import { applySessionCredits, getUserRoleId, isSuperAdmin } from "@/lib/session"

const HISTORY_PAGE_SIZE = 20

const ENTRY_TYPE_LABELS: Record<string, string> = {
  consume: "消费",
  earn: "收入",
  allocate: "发放",
  adjust: "调整",
  refund: "退回",
  release: "释放",
}

function formatEntryType(entryType: string) {
  return ENTRY_TYPE_LABELS[entryType] || entryType || "—"
}

function formatAmount(amount: number) {
  if (amount > 0) return `+${amount.toLocaleString()}`
  return amount.toLocaleString()
}

function formatTime(value?: string) {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

export default function Billing() {
  const { notify } = useFeedback()
  const superAdmin = isSuperAdmin(getUserRoleId() ?? undefined)
  const [wallet, setWallet] = useState<CreditsBalance | null>(null)
  const [items, setItems] = useState<CreditHistoryItem[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [error, setError] = useState("")
  const [email, setEmail] = useState("")
  const [amount, setAmount] = useState("100")
  const [description, setDescription] = useState("管理员发放")
  const [lookup, setLookup] = useState<{ id: number; username: string; email: string } | null>(null)
  const [granting, setGranting] = useState(false)
  const [prices, setPrices] = useState<PriceRule[]>([])
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editingValue, setEditingValue] = useState("")

  const loadPage = useCallback(async (nextPage: number, mode: "full" | "history" = "full") => {
    if (mode === "full") {
      setLoading(true)
    } else {
      setHistoryLoading(true)
    }
    setError("")
    try {
      const [nextWallet, history] = await Promise.all([
        mode === "full" ? creditsApi.balance() : Promise.resolve(null),
        creditsApi.history(nextPage, HISTORY_PAGE_SIZE),
      ])
      if (nextWallet) {
        setWallet(nextWallet)
        applySessionCredits(nextWallet.balance)
      }
      setItems((history.list || []).filter((row) => row.amount !== 0))
      setPage(history.pagination?.page || nextPage)
      setTotal(history.pagination?.total || 0)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "加载失败")
    } finally {
      setLoading(false)
      setHistoryLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    void loadPage(1)
    if (superAdmin) {
      creditsApi
        .prices()
        .then((data) => {
          if (!cancelled) setPrices(data.list || [])
        })
        .catch(() => {})
    }
    return () => {
      cancelled = true
    }
  }, [loadPage, superAdmin])

  const handleLookup = async () => {
    try {
      const user = await creditsApi.lookupUser(email.trim())
      setLookup(user)
      notify.success(`找到 ${user.username}`)
    } catch (err: unknown) {
      setLookup(null)
      notify.error(err instanceof Error ? err.message : "未找到用户")
    }
  }

  const handleGrant = async () => {
    if (!lookup) {
      notify.warning("请先用邮箱查找用户")
      return
    }
    const value = Number(amount)
    if (!Number.isFinite(value) || value <= 0) {
      notify.warning("发放数量必须大于 0")
      return
    }
    setGranting(true)
    try {
      const result = await creditsApi.grant({
        userId: lookup.id,
        amount: Math.floor(value),
        description: description.trim() || "管理员发放",
      })
      notify.success(`已发放 ${result.amount} 积分，对方余额 ${result.balance}`)
      await loadPage(1)
    } catch (err: unknown) {
      notify.error(err instanceof Error ? err.message : "发放失败")
    } finally {
      setGranting(false)
    }
  }

  const handleSavePrice = async (id: number) => {
    const value = Number(editingValue)
    if (!Number.isFinite(value) || value < 1) {
      notify.warning("单价必须大于 0")
      return
    }
    try {
      const updated = await creditsApi.updatePrice(id, { creditsPerUnit: Math.floor(value) })
      setPrices((current) =>
        current.map((row) => (row.id === id ? { ...row, creditsPerUnit: updated.creditsPerUnit } : row))
      )
      setEditingId(null)
      notify.success("价目已更新")
    } catch (err: unknown) {
      notify.error(err instanceof Error ? err.message : "改价失败")
    }
  }

  const stats = [
    {
      label: "可用积分",
      value: wallet?.balance,
      icon: Wallet,
      emphasize: true,
    },
    {
      label: "预扣中",
      value: wallet?.frozenCredits ?? 0,
      icon: Coins,
    },
    {
      label: "累计获得",
      value: wallet?.totalEarned ?? 0,
      icon: TrendingUp,
    },
    {
      label: "累计消耗",
      value: wallet?.totalUsed ?? 0,
      icon: TrendingDown,
    },
  ]

  return (
    <WorkspaceLayout
      header={
        <WorkspaceHeader
          title="积分与账单"
          subtitle="成功消费才会扣分，预扣失败会退回"
          actions={
            <Link to="/pricing">
              <Button
                variant="secondary"
                className="rounded-xl bg-[hsl(var(--surface-container-high))] text-[hsl(var(--on-surface))]"
              >
                查看计价
              </Button>
            </Link>
          }
        />
      }
    >
      {loading ? (
        <QuerySpinner label="正在加载账单..." />
      ) : error && !wallet ? (
        <div className="flex min-h-[360px] flex-col items-center justify-center rounded-2xl bg-[hsl(var(--surface-container-lowest))] px-6 text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[hsl(var(--surface-container-high))]">
            <AlertCircle className="h-6 w-6 text-[hsl(var(--primary))]" />
          </div>
          <h2 className="text-lg font-bold text-[hsl(var(--on-surface))]">账单暂时无法加载</h2>
          <p className="mt-2 max-w-md text-sm text-[hsl(var(--secondary))]">{error}</p>
          <Button
            type="button"
            onClick={() => void loadPage(1)}
            className="mt-6 signature-gradient rounded-xl border-0 px-6 text-white"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            重试
          </Button>
        </div>
      ) : (
        <div className="mx-auto max-w-5xl space-y-8">
          <section className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            {stats.map((stat) => {
              const Icon = stat.icon
              return (
                <div
                  key={stat.label}
                  className="rounded-2xl bg-[hsl(var(--surface-container-lowest))] p-5"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-[hsl(var(--secondary))]">{stat.label}</p>
                    <Icon className="h-4 w-4 text-[hsl(var(--primary))]" />
                  </div>
                  <p
                    className={`mt-2 font-black text-[hsl(var(--on-surface))] ${
                      stat.emphasize ? "text-3xl" : "text-2xl"
                    }`}
                  >
                    {stat.value == null ? "—" : Number(stat.value).toLocaleString()}
                  </p>
                </div>
              )
            })}
          </section>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          {superAdmin ? (
            <section className="rounded-2xl bg-[hsl(var(--surface-container-lowest))] p-5">
              <h2 className="mb-4 text-base font-bold text-[hsl(var(--on-surface))]">发放积分</h2>
              <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                <Input
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="用户邮箱"
                  className="h-11 rounded-xl border-none bg-[hsl(var(--surface-container-low))] text-sm placeholder:text-[hsl(var(--secondary))] focus-visible:ring-1 focus-visible:ring-[hsl(var(--primary))]"
                />
                <Button type="button" variant="secondary" onClick={() => void handleLookup()}>
                  查找
                </Button>
              </div>
              {lookup ? (
                <p className="mt-2 text-xs text-[hsl(var(--secondary))]">
                  {lookup.username} · {lookup.email} · id {lookup.id}
                </p>
              ) : null}
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <Input
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  placeholder="数量"
                  className="h-11 rounded-xl border-none bg-[hsl(var(--surface-container-low))] text-sm placeholder:text-[hsl(var(--secondary))] focus-visible:ring-1 focus-visible:ring-[hsl(var(--primary))]"
                />
                <Input
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="说明"
                  className="h-11 rounded-xl border-none bg-[hsl(var(--surface-container-low))] text-sm placeholder:text-[hsl(var(--secondary))] focus-visible:ring-1 focus-visible:ring-[hsl(var(--primary))]"
                />
                <Button
                  type="button"
                  disabled={granting}
                  onClick={() => void handleGrant()}
                  className="signature-gradient rounded-xl border-0 text-white"
                >
                  {granting ? "发放中..." : "发放"}
                </Button>
              </div>
            </section>
          ) : (
            <p className="text-sm text-[hsl(var(--secondary))]">积分由管理员发放，本页不支持在线支付。</p>
          )}

          {superAdmin && prices.length > 0 ? (
            <section className="overflow-hidden rounded-2xl bg-[hsl(var(--surface-container-lowest))]">
              <div className="bg-[hsl(var(--surface-container-low))] px-4 py-3 text-sm font-bold text-[hsl(var(--on-surface))]">
                价目（1 积分 = ¥0.01）
              </div>
              <table className="w-full text-sm">
                <thead className="text-left text-[hsl(var(--secondary))]">
                  <tr>
                    <th className="px-4 py-2 font-medium">模型</th>
                    <th className="px-4 py-2 font-medium">单位</th>
                    <th className="px-4 py-2 font-medium">规格</th>
                    <th className="px-4 py-2 font-medium text-right">单价</th>
                  </tr>
                </thead>
                <tbody>
                  {prices.map((row) => (
                    <tr key={row.id} className="border-t border-[hsl(var(--outline-variant))]/15">
                      <td className="px-4 py-2 text-[hsl(var(--on-surface))]">{row.modelId}</td>
                      <td className="px-4 py-2 text-[hsl(var(--on-surface))]">{row.unit}</td>
                      <td className="px-4 py-2 text-[hsl(var(--secondary))]">
                        {[row.quality, row.resolution].filter(Boolean).join(" / ") || "—"}
                      </td>
                      <td className="px-4 py-2 text-right">
                        {editingId === row.id ? (
                          <span className="inline-flex items-center gap-2">
                            <Input
                              className="h-8 w-20 rounded-xl border-none bg-[hsl(var(--surface-container-low))]"
                              value={editingValue}
                              onChange={(event) => setEditingValue(event.target.value)}
                            />
                            <button
                              className="text-[hsl(var(--primary))]"
                              onClick={() => void handleSavePrice(row.id)}
                            >
                              保存
                            </button>
                          </span>
                        ) : (
                          <button
                            className="font-semibold text-[hsl(var(--on-surface))]"
                            onClick={() => {
                              setEditingId(row.id)
                              setEditingValue(String(row.creditsPerUnit))
                            }}
                          >
                            {row.creditsPerUnit}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ) : null}

          <section className="overflow-hidden rounded-2xl bg-[hsl(var(--surface-container-lowest))]">
            <div className="flex items-center justify-between bg-[hsl(var(--surface-container-low))] px-4 py-3">
              <div className="flex items-center gap-2 text-sm font-bold text-[hsl(var(--on-surface))]">
                <Receipt className="h-4 w-4 text-[hsl(var(--primary))]" />
                消费流水
              </div>
              <span className="text-xs text-[hsl(var(--secondary))]">{total} 条记录</span>
            </div>
            {historyLoading ? (
              <QuerySpinner label="正在加载流水..." />
            ) : (
              <>
                <table className="w-full text-sm">
                  <thead className="text-left text-[hsl(var(--secondary))]">
                    <tr>
                      <th className="px-4 py-3 font-medium">时间</th>
                      <th className="px-4 py-3 font-medium">类型</th>
                      <th className="px-4 py-3 font-medium">说明</th>
                      <th className="px-4 py-3 font-medium text-right">积分</th>
                      <th className="px-4 py-3 font-medium text-right">余额</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.length === 0 ? (
                      <tr>
                        <td className="px-4 py-16 text-center" colSpan={5}>
                          <p className="text-sm font-medium text-[hsl(var(--on-surface))]">暂无流水</p>
                          <p className="mt-1 text-xs text-[hsl(var(--secondary))]">
                            生成成功后的扣费、管理员发放都会出现在这里
                          </p>
                        </td>
                      </tr>
                    ) : (
                      items.map((row) => (
                        <tr key={row.id} className="border-t border-[hsl(var(--outline-variant))]/15">
                          <td className="px-4 py-3 text-[hsl(var(--secondary))]">{formatTime(row.createdAt)}</td>
                          <td className="px-4 py-3 text-[hsl(var(--on-surface))]">{formatEntryType(row.entryType)}</td>
                          <td className="px-4 py-3 text-[hsl(var(--on-surface))]">{row.description || "—"}</td>
                          <td
                            className={`px-4 py-3 text-right font-semibold ${
                              row.amount < 0 ? "text-red-600" : "text-emerald-600"
                            }`}
                          >
                            {formatAmount(row.amount)}
                          </td>
                          <td className="px-4 py-3 text-right text-[hsl(var(--secondary))]">
                            {row.balanceAfter == null ? "—" : row.balanceAfter.toLocaleString()}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
                <div className="px-4">
                  <Pagination
                    page={page}
                    size={HISTORY_PAGE_SIZE}
                    total={total}
                    onPageChange={(nextPage) => void loadPage(nextPage, "history")}
                  />
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </WorkspaceLayout>
  )
}
