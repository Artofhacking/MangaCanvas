import { useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useFeedback } from "@/components/feedback/FeedbackProvider"
import { 
  ArrowLeft, 
  Plus, 
  MoreHorizontal, 
  Shield, 
  User, 
  Eye, 
  Trash2,
  Crown,
  Mail
} from "lucide-react"
import { projectMembersApi, projectsApi } from "@/api"
import { mapMember } from "@/lib/projectMappers"

interface Member {
  id: number
  name: string
  email: string
  avatar: string
  role: "owner" | "editor" | "viewer"
  joinedAt: string
  status: "active" | "pending"
}

const roleLabels: Record<string, { label: string; description: string; icon: typeof Crown }> = {
  owner: { label: "所有者", description: "拥有项目的全部权限", icon: Crown },
  editor: { label: "编辑者", description: "可以创建和编辑内容", icon: User },
  viewer: { label: "查看者", description: "仅可查看项目内容", icon: Eye },
}

export default function ProjectPermissions() {
  const navigate = useNavigate()
  const { projectId } = useParams()
  const { notify, confirm } = useFeedback()
  const numericProjectId = projectId ? Number(projectId) : null
  const [members, setMembers] = useState<Member[]>([])
  const [projectName, setProjectName] = useState("当前项目")
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState<"editor" | "viewer">("editor")
  const [isInviting, setIsInviting] = useState(false)

  const loadMembers = async (targetProjectId: number) => {
    const response = await projectMembersApi.list(targetProjectId)
    setMembers(response.list.map((member) => mapMember(member)))
  }

  useEffect(() => {
    if (!numericProjectId) return
    void loadMembers(numericProjectId).catch((error) => notify.error(error instanceof Error ? error.message : "加载权限成员失败"))
    void projectsApi.getById(numericProjectId).then((project) => setProjectName(project.name)).catch(() => undefined)
  }, [notify, numericProjectId])

  const handleRoleChange = (memberId: number, newRole: string) => {
    if (!numericProjectId) return
    void projectMembersApi
      .updateRole(numericProjectId, memberId, newRole as Member["role"])
      .then(() => loadMembers(numericProjectId))
      .then(() => notify.success("角色已更新"))
      .catch((error) => notify.error(error instanceof Error ? error.message : "角色更新失败"))
  }

  const handleRemoveMember = async (member: Member) => {
    const confirmed = await confirm({
      title: "移除成员",
      description: `确定要将「${member.name}」从项目中移除吗？`,
      confirmText: "移除",
      tone: "danger",
    })

    if (confirmed) {
      if (!numericProjectId) return
      try {
        await projectMembersApi.remove(numericProjectId, member.id)
        await loadMembers(numericProjectId)
        notify.success("成员已移除")
      } catch (error) {
        notify.error(error instanceof Error ? error.message : "移除成员失败")
      }
    }
  }

  const handleInvite = async () => {
    if (!inviteEmail.trim()) {
      notify.warning("请输入用户 ID")
      return
    }
    if (!numericProjectId) return

    setIsInviting(true)
    try {
      const userId = Number(inviteEmail)
      if (!Number.isFinite(userId)) {
        notify.warning("当前接口需要用户 ID")
        return
      }

      await projectMembersApi.add(numericProjectId, { userId, role: inviteRole })
      await loadMembers(numericProjectId)
      setInviteEmail("")
      notify.success("成员已添加")
    } catch (error) {
      notify.error(error instanceof Error ? error.message : "邀请成员失败")
    } finally {
      setIsInviting(false)
    }
  }

  const activeMembers = members.filter((m) => m.status === "active")
  const pendingMembers = members.filter((m) => m.status === "pending")

  return (
    <div className="min-h-screen bg-[hsl(var(--surface))]">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-40 bg-[hsl(var(--surface-container-lowest))]/85 backdrop-blur-md border-b border-[hsl(var(--outline-variant))]/15">
        <div className="flex items-center justify-between h-16 px-8">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/projects")}
              className="text-[hsl(var(--secondary))] hover:text-[hsl(var(--on-surface))]"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-lg font-black text-[hsl(var(--on-surface))]">权限控制</h1>
              <p className="text-xs text-[hsl(var(--secondary))]">管理项目成员和访问权限</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-24 pb-12 px-8 max-w-5xl mx-auto">
        {/* Project Info */}
        <div className="mb-8 p-6 rounded-2xl bg-[hsl(var(--surface-container-low))]">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-xl bg-[hsl(var(--primary))]/10 flex items-center justify-center">
              <Shield className="w-8 h-8 text-[hsl(var(--primary))]" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-[hsl(var(--on-surface))]">{projectName}</h2>
              <p className="text-sm text-[hsl(var(--secondary))]">项目 ID: {projectId}</p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Badge variant="secondary" className="bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))] border-0">
                {activeMembers.length} 位成员
              </Badge>
              {pendingMembers.length > 0 && (
                <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 border-0">
                  {pendingMembers.length} 个待处理邀请
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Invite Section */}
        <div className="mb-8 p-6 rounded-2xl bg-[hsl(var(--surface-container-lowest))] border border-[hsl(var(--outline-variant))]/20">
          <h3 className="text-lg font-bold text-[hsl(var(--on-surface))] mb-4">邀请成员</h3>
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(var(--secondary))]" />
              <Input
                type="email"
                placeholder="输入用户 ID"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="pl-10 bg-[hsl(var(--surface-container-low))] border-none focus-visible:ring-1 focus-visible:ring-[hsl(var(--primary))]"
              />
            </div>
            <Select value={inviteRole} onValueChange={(value) => setInviteRole(value as "editor" | "viewer")}>
              <SelectTrigger className="w-40 bg-[hsl(var(--surface-container-low))] border-none">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="editor">编辑者</SelectItem>
                <SelectItem value="viewer">查看者</SelectItem>
              </SelectContent>
            </Select>
            <Button
              onClick={handleInvite}
              disabled={isInviting}
              className="signature-gradient text-white border-0 hover:opacity-90"
            >
              {isInviting ? (
                <span className="w-4 h-4 mr-2 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              ) : (
                <Plus className="w-4 h-4 mr-2" />
              )}
              邀请
            </Button>
          </div>
          <p className="mt-3 text-xs text-[hsl(var(--secondary))]">
            被邀请者将收到邮件通知，点击链接即可加入项目
          </p>
        </div>

        {/* Members List */}
        <div className="space-y-6">
          {/* Active Members */}
          <div>
            <h3 className="text-sm font-bold text-[hsl(var(--secondary))] uppercase tracking-wider mb-4">
              成员 ({activeMembers.length})
            </h3>
            <div className="space-y-3">
              {activeMembers.map((member) => {
                const roleConfig = roleLabels[member.role]
                const RoleIcon = roleConfig.icon
                return (
                  <div
                    key={member.id}
                    className="flex items-center gap-4 p-4 rounded-xl bg-[hsl(var(--surface-container-lowest))] border border-[hsl(var(--outline-variant))]/20 hover:border-[hsl(var(--outline-variant))]/40 transition-colors"
                  >
                    <Avatar className="w-12 h-12">
                      <AvatarImage src={member.avatar} alt={member.name} />
                      <AvatarFallback className="bg-[hsl(var(--surface-container-high))] text-sm font-bold">
                        {member.name.slice(0, 1)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[hsl(var(--on-surface))]">{member.name}</span>
                        {member.role === "owner" && (
                          <Badge className="signature-gradient text-white text-[10px] border-0">所有者</Badge>
                        )}
                      </div>
                      <p className="text-sm text-[hsl(var(--secondary))]">{member.email}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[hsl(var(--surface-container-low))]">
                        <RoleIcon className="w-4 h-4 text-[hsl(var(--secondary))]" />
                        <span className="text-sm text-[hsl(var(--on-surface))]">{roleConfig.label}</span>
                      </div>
                      {member.role !== "owner" && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <Select
                              value={member.role}
                              onValueChange={(value: string) => handleRoleChange(member.id, value)}
                            >
                              <SelectTrigger className="w-full border-none">
                                <SelectValue placeholder="更改角色" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="admin">管理员</SelectItem>
                                <SelectItem value="editor">编辑者</SelectItem>
                                <SelectItem value="viewer">查看者</SelectItem>
                              </SelectContent>
                            </Select>
                            <DropdownMenuItem
                              onClick={() => handleRemoveMember(member)}
                              className="text-red-600 focus:text-red-600 focus:bg-red-50"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              移除成员
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Pending Invitations */}
          {pendingMembers.length > 0 && (
            <div>
              <h3 className="text-sm font-bold text-[hsl(var(--secondary))] uppercase tracking-wider mb-4">
                待处理邀请 ({pendingMembers.length})
              </h3>
              <div className="space-y-3">
                {pendingMembers.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center gap-4 p-4 rounded-xl bg-[hsl(var(--surface-container-lowest))] border border-dashed border-[hsl(var(--outline-variant))]/40"
                  >
                    <div className="w-12 h-12 rounded-full bg-[hsl(var(--surface-container-high))] flex items-center justify-center">
                      <Mail className="w-5 h-5 text-[hsl(var(--secondary))]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="font-bold text-[hsl(var(--on-surface))]">{member.email}</span>
                      <p className="text-sm text-amber-600">等待接受邀请</p>
                    </div>
                    <Badge variant="secondary" className="bg-[hsl(var(--surface-container-low))] text-[hsl(var(--secondary))] border-0">
                      {roleLabels[member.role].label}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveMember(member)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      取消邀请
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Role Descriptions */}
        <div className="mt-12 p-6 rounded-2xl bg-[hsl(var(--surface-container-low))]">
          <h3 className="text-lg font-bold text-[hsl(var(--on-surface))] mb-4">权限说明</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(roleLabels).map(([role, config]) => {
              const RoleIcon = config.icon
              return (
                <div key={role} className="flex items-start gap-3 p-3 rounded-lg bg-[hsl(var(--surface-container-lowest))]">
                  <RoleIcon className="w-5 h-5 text-[hsl(var(--primary))] mt-0.5" />
                  <div>
                    <span className="font-bold text-[hsl(var(--on-surface))]">{config.label}</span>
                    <p className="text-sm text-[hsl(var(--secondary))]">{config.description}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </main>
    </div>
  )
}
