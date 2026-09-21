import { useEffect, useState } from "react"
import WorkspaceHeader from "@/components/layout/WorkspaceHeader"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { creditsApi, type CreditHistoryItem, type PriceRule } from "@/api/creditsApi"
import { applySessionCredits, getUserRoleId, isSuperAdmin } from "@/lib/session"
import { useFeedback } from "@/components/feedback/FeedbackProvider"

export default function Billing() {
  const { notify } = useFeedback()
  const superAdmin = isSuperAdmin(getUserRoleId() ?? undefined)
  const [balance, setBalance] = useState<number | null>(null)
  const [frozen, setFrozen] = useState(0)
  const [items, setItems] = useState<CreditHistoryItem[]>([])
  const [error, setError] = useState("")
  const [email, setEmail] = useState("")
  const [amount, setAmount] = useState("100")
  const [description, setDescription] = useState("管理员发放")
  const [lookup, setLookup] = useState<{ id: number; username: string; email: string } | null>(null)
  const [granting, setGranting] = useState(false)
  const [prices, setPrices] = useState<PriceRule[]>([])
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editingValue, setEditingValue] = useState("")

  const reloadWallet = () =>
    Promise.all([creditsApi.balance(), creditsApi.history(1, 50)]).then(([wallet, history]) => {
      setBalance(wallet.balance)
      setFrozen(wallet.frozenCredits || 0)
      setItems((history.list || []).filter((row) => row.amount !== 0))
      applySessionCredits(wallet.balance)
    })

  useEffect(() => {
    let cancelled = false
    reloadWallet()
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "加载失败")
      })
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
  }, [superAdmin])

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
      await reloadWallet()
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

  return (
    <div className="min-h-screen bg-[hsl(var(--surface))]">
      <WorkspaceHeader title="积分与账单" subtitle="成功消费才会扣分，预扣失败会退回" />
      <main className="mx-auto max-w-4xl px-6 pb-16 pt-20">
        <div className="mb-8 grid grid-cols-2 gap-4">
          <div className="rounded-2xl border border-[hsl(var(--outline-variant))]/20 bg-[hsl(var(--surface-container-lowest))] p-5">
            <p className="text-xs text-[hsl(var(--secondary))]">可用积分</p>
            <p className="mt-2 text-3xl font-black">{balance == null ? "—" : balance.toLocaleString()}</p>
          </div>
          <div className="rounded-2xl border border-[hsl(var(--outline-variant))]/20 bg-[hsl(var(--surface-container-lowest))] p-5">
            <p className="text-xs text-[hsl(var(--secondary))]">预扣中</p>
            <p className="mt-2 text-3xl font-black">{frozen.toLocaleString()}</p>
          </div>
        </div>
        {error ? <p className="mb-6 text-sm text-red-600">{error}</p> : null}

        {superAdmin ? (
          <section className="mb-10 rounded-2xl border border-[hsl(var(--outline-variant))]/20 bg-[hsl(var(--surface-container-lowest))] p-5">
            <h2 className="mb-4 text-base font-bold">发放积分</h2>
            <div className="grid gap-3 md:grid-cols-[1fr_auto]">
              <Input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="用户邮箱" />
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
              <Input value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="数量" />
              <Input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="说明" />
              <Button type="button" disabled={granting} onClick={() => void handleGrant()}>
                {granting ? "发放中..." : "发放"}
              </Button>
            </div>
          </section>
        ) : (
          <p className="mb-8 text-sm text-[hsl(var(--secondary))]">积分由管理员发放，本页不支持在线支付。</p>
        )}

        {superAdmin && prices.length > 0 ? (
          <section className="mb-10 overflow-hidden rounded-2xl border border-[hsl(var(--outline-variant))]/20">
            <div className="bg-[hsl(var(--surface-container-low))] px-4 py-3 text-sm font-bold">价目（1 积分 = ¥0.01）</div>
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
                    <td className="px-4 py-2">{row.modelId}</td>
                    <td className="px-4 py-2">{row.unit}</td>
                    <td className="px-4 py-2 text-[hsl(var(--secondary))]">
                      {[row.quality, row.resolution].filter(Boolean).join(" / ") || "—"}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {editingId === row.id ? (
                        <span className="inline-flex items-center gap-2">
                          <Input
                            className="h-8 w-20"
                            value={editingValue}
                            onChange={(event) => setEditingValue(event.target.value)}
                          />
                          <button className="text-[hsl(var(--primary))]" onClick={() => void handleSavePrice(row.id)}>
                            保存
                          </button>
                        </span>
                      ) : (
                        <button
                          className="font-semibold"
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

        <div className="overflow-hidden rounded-2xl border border-[hsl(var(--outline-variant))]/20">
          <table className="w-full text-sm">
            <thead className="bg-[hsl(var(--surface-container-low))] text-left text-[hsl(var(--secondary))]">
              <tr>
                <th className="px-4 py-3 font-medium">时间</th>
                <th className="px-4 py-3 font-medium">类型</th>
                <th className="px-4 py-3 font-medium">说明</th>
                <th className="px-4 py-3 font-medium text-right">积分</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-center text-[hsl(var(--secondary))]" colSpan={4}>
                    暂无流水
                  </td>
                </tr>
              ) : (
                items.map((row) => (
                  <tr key={row.id} className="border-t border-[hsl(var(--outline-variant))]/15">
                    <td className="px-4 py-3 text-[hsl(var(--secondary))]">
                      {row.createdAt ? new Date(row.createdAt).toLocaleString() : "—"}
                    </td>
                    <td className="px-4 py-3">{row.entryType}</td>
                    <td className="px-4 py-3">{row.description || "—"}</td>
                    <td className={`px-4 py-3 text-right font-semibold ${row.amount < 0 ? "text-red-600" : "text-emerald-600"}`}>
                      {row.amount > 0 ? `+${row.amount}` : row.amount}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  )
}
