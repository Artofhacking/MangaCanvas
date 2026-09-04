import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Plus, Mail, UserX, MoreHorizontal, Search, Trash2, Loader2, UserPlus, Building2 } from "lucide-react"
import Sidebar from "@/components/layout/Sidebar"
import { useEffect, useState, useMemo, useRef } from "react"
import { useFeedback } from "@/components/feedback/FeedbackProvider"
import { organizationApi } from "@/api"
import { getUserOrganizationIds } from "@/lib/session"

interface Member {
  id: number
  name: string
  email: string
  role: string
  avatar: string
  status: "active" | "pending"
  joinedAt: string
  assignedBy?: number
}

const roleLabels: Record<string, string> = {
  super_admin: "超级管理员",
  admin: "管理员",
  employee: "员工",
}

export default function Members() {
  const { notify } = useFeedback()
  const [members, setMembers] = useState<Member[]>([])
  const [organizationId, setOrganizationId] = useState<number | null>(null)
  const [organizationName, setOrganizationName] = useState("我的组织")
  const [searchQuery, setSearchQuery] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  
  // 邀请成员对话框状态
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteUsername, setInviteUsername] = useState("")
  const [isInviting, setIsInviting] = useState(false)
  
  // 删除确认对话框状态
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingMember, setDeletingMember] = useState<Member | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // 过滤成员列表
  const filteredMembers = useMemo(() => {
    if (!searchQuery.trim()) return members
    const query = searchQuery.toLowerCase()
    return members.filter(
      (m) =>
        m.name.toLowerCase().includes(query) ||
        m.email.toLowerCase().includes(query)
    )
  }, [members, searchQuery])

  // 加载组织成员
  const loadMembers = async (orgId: number) => {
    setIsLoading(true)
    try {
      const response = await organizationApi.listMembers(orgId)
      const mappedMembers = response.list.map((member) => ({
        id: member.userId,
        name: member.user.username,
        email: member.user.email,
        role: "employee", // 组织成员默认角色，后续可从 user.role 获取
        avatar: member.user.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(member.user.username)}`,
        status: "active" as const,
        joinedAt: member.joinedAt,
        assignedBy: member.assignedBy,
      }))
      setMembers(mappedMembers)
    } catch (error) {
      notify.error(error instanceof Error ? error.message : "加载成员失败")
    } finally {
      setIsLoading(false)
    }
  }

  // 加载组织信息
  const loadOrganization = async (orgId: number) => {
    try {
      const org = await organizationApi.getById(orgId)
      setOrganizationName(org.name)
    } catch {
      // 使用默认名称
    }
  }

  // 初始化 - 获取当前用户的组织
  const notifiedRef = useRef(false)
  useEffect(() => {
    const orgIds = getUserOrganizationIds()
    if (orgIds.length === 0) {
      if (!notifiedRef.current) {
        notify.error("您不属于任何组织")
        notifiedRef.current = true
      }
      return
    }

    // TOB 产品：一套服务对应一个公司/组织，默认使用第一个组织
    const currentOrgId = orgIds[0]
    setOrganizationId(currentOrgId)
    loadOrganization(currentOrgId)
    loadMembers(currentOrgId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 处理邀请成员
  const handleInvite = async () => {
    if (!inviteEmail.trim() || !inviteUsername.trim()) {
      notify.error("请输入用户名和邮箱")
      return
    }

    if (!organizationId) {
      notify.error("未找到所属组织")
      return
    }

    setIsInviting(true)

    try {
      // TODO: 后端需要提供一个通过用户名/邮箱邀请用户的接口
      // 目前先模拟成功，实际应该调用注册+添加成员的流程
      notify.success(`已发送邀请邮件至 ${inviteEmail}`)
      setInviteDialogOpen(false)
      setInviteEmail("")
      setInviteUsername("")
      // 重新加载成员列表
      await loadMembers(organizationId)
    } catch (error) {
      notify.error(error instanceof Error ? error.message : "邀请成员失败")
    } finally {
      setIsInviting(false)
    }
  }

  // 处理打开删除对话框
  const handleOpenDelete = (member: Member) => {
    setDeletingMember(member)
    setDeleteDialogOpen(true)
  }

  // 处理删除成员
  const handleDelete = async () => {
    if (!deletingMember) return
    if (!organizationId) return

    setIsDeleting(true)

    try {
      await organizationApi.removeMember(organizationId, deletingMember.id)
      await loadMembers(organizationId)
      setDeleteDialogOpen(false)
      setDeletingMember(null)
      notify.success(`已将 ${deletingMember.name} 从组织中移除`)
    } catch (error) {
      notify.error(error instanceof Error ? error.message : "移除成员失败")
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="workspace-shell h-screen overflow-hidden bg-[hsl(var(--surface))]">
      <Sidebar />

      <main className="relative ml-64 flex h-screen flex-col overflow-hidden">
        {/* Header */}
        <header className="flex h-16 items-center justify-between border-b border-[hsl(var(--outline-variant))]/15 px-8">
          <div className="flex items-center gap-3">
            <Building2 className="h-5 w-5 text-[hsl(var(--secondary))]" />
            <div>
              <h1 className="text-lg font-black text-[hsl(var(--on-surface))]">成员管理</h1>
              <p className="text-xs text-[hsl(var(--secondary))]">{organizationName}</p>
            </div>
          </div>
          <Button 
            className="bg-[hsl(var(--primary))] text-white hover:opacity-90"
            onClick={() => setInviteDialogOpen(true)}
          >
            <Plus className="mr-2 h-4 w-4" />
            邀请成员
          </Button>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8">
          {/* Stats */}
          <div className="mb-8 grid grid-cols-4 gap-4">
            <Card className="p-4">
              <div className="text-2xl font-black text-[hsl(var(--on-surface))]">{members.length}</div>
              <div className="text-xs text-[hsl(var(--secondary))]">总成员</div>
            </Card>
            <Card className="p-4">
              <div className="text-2xl font-black text-[hsl(var(--primary))]">
                {members.filter((m) => m.status === "active").length}
              </div>
              <div className="text-xs text-[hsl(var(--secondary))]">活跃成员</div>
            </Card>
            <Card className="p-4">
              <div className="text-2xl font-black text-amber-500">
                {members.filter((m) => m.status === "pending").length}
              </div>
              <div className="text-xs text-[hsl(var(--secondary))]">待确认</div>
            </Card>
            <Card className="p-4">
              <div className="text-2xl font-black text-emerald-500">
                {members.filter((m) => m.role === "admin").length}
              </div>
              <div className="text-xs text-[hsl(var(--secondary))]">管理员</div>
            </Card>
          </div>

          {/* Search */}
          <div className="mb-6 flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--secondary))]" />
              <input
                type="text"
                placeholder="搜索成员..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-[hsl(var(--outline-variant))]/30 bg-[hsl(var(--surface-container))] py-2 pl-10 pr-4 text-sm focus:border-[hsl(var(--primary))] focus:outline-none"
              />
            </div>
          </div>

          {/* Loading State */}
          {isLoading && (
            <div className="flex h-64 flex-col items-center justify-center text-[hsl(var(--secondary))]">
              <Loader2 className="h-8 w-8 animate-spin mb-4" />
              <p>加载成员中...</p>
            </div>
          )}

          {/* Members List */}
          {!isLoading && (
            <div className="space-y-3">
              {filteredMembers.map((member) => (
                <Card
                  key={member.id}
                  className="flex items-center justify-between p-4 transition-all hover:shadow-md"
                >
                  <div className="flex items-center gap-4">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={member.avatar} alt={member.name} />
                      <AvatarFallback>{member.name[0]}</AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[hsl(var(--on-surface))]">
                          {member.name}
                        </span>
                        {member.status === "pending" && (
                          <Badge variant="secondary" className="text-[10px]">
                            待确认
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-[hsl(var(--secondary))]">
                        <Mail className="h-3 w-3" />
                        {member.email}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <Badge variant="outline" className="text-xs">
                      {roleLabels[member.role] || member.role}
                    </Badge>
                    <span className="text-xs text-[hsl(var(--secondary))]">
                      {member.joinedAt}
                    </span>
                    <div className="flex gap-1">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8"
                        onClick={() => handleOpenDelete(member)}
                        title="移除成员"
                      >
                        <UserX className="h-4 w-4 text-[hsl(var(--secondary))]" />
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4 text-[hsl(var(--secondary))]" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>成员操作</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            onClick={() => handleOpenDelete(member)}
                            className="text-red-600"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            从组织移除
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {!isLoading && filteredMembers.length === 0 && (
            <div className="flex h-64 flex-col items-center justify-center text-[hsl(var(--secondary))]">
              <div className="mb-4 text-4xl">👥</div>
              <p>{searchQuery ? "未找到匹配的成员" : "暂无成员，点击右上角邀请成员"}</p>
            </div>
          )}
        </div>
      </main>

      {/* 邀请成员对话框 */}
      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>邀请成员</DialogTitle>
            <DialogDescription>
              邀请新成员加入 {organizationName}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="username">用户名</Label>
              <Input
                id="username"
                placeholder="请输入用户名"
                value={inviteUsername}
                onChange={(e) => setInviteUsername(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">邮箱地址</Label>
              <Input
                id="email"
                type="email"
                placeholder="member@company.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>
              取消
            </Button>
            <Button 
              onClick={handleInvite} 
              disabled={isInviting || !inviteEmail.trim() || !inviteUsername.trim()}
              className="bg-[hsl(var(--primary))] text-white"
            >
              {isInviting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  发送中...
                </>
              ) : (
                <>
                  <UserPlus className="mr-2 h-4 w-4" />
                  发送邀请
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认对话框 */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>移除成员</DialogTitle>
            <DialogDescription>
              确定要将 <strong>{deletingMember?.name}</strong> 从组织中移除吗？此操作无法撤销。
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="flex items-center gap-3 rounded-lg bg-red-50 p-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={deletingMember?.avatar} />
                <AvatarFallback>{deletingMember?.name[0]}</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium">{deletingMember?.name}</p>
                <p className="text-sm text-[hsl(var(--secondary))]">{deletingMember?.email}</p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              取消
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  移除中...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  确认移除
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
