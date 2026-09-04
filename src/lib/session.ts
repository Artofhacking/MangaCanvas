const SESSION_STORAGE_KEY = 'mangacanvas-session'
const ACTIVE_PROJECT_ID_STORAGE_KEY = 'mangacanvas-active-project-id'
const UNAUTHORIZED_REDIRECT_FLAG = 'mangacanvas-unauthorized-redirecting'

// 角色映射
export const ROLE_MAP: Record<number, { name: string; code: string }> = {
  1: { name: '超级管理员', code: 'superadmin' },
  2: { name: '管理员', code: 'admin' },
  3: { name: '员工', code: 'employee' },
}

export const getRoleName = (roleId: number): string => {
  return ROLE_MAP[roleId]?.name || '未知角色'
}

export const getRoleCode = (roleId: number): string => {
  return ROLE_MAP[roleId]?.code || 'unknown'
}

export const isAdmin = (roleId?: number): boolean => {
  return roleId === 1 || roleId === 2
}

export const isSuperAdmin = (roleId?: number): boolean => {
  return roleId === 1
}

export interface SessionRole {
  id: number
  code: string
  name: string
}

export interface SessionUser {
  id: number
  username: string
  email: string
  avatar: string | null
  roleId: number
  role?: SessionRole
  organizationIds?: number[]
  credits?: number
  createdAt?: string
  updatedAt?: string
}

export interface SessionState {
  token: string
  refreshToken?: string
  user: SessionUser
}

const canUseStorage = () => typeof window !== 'undefined'

export const getSession = (): SessionState | null => {
  if (!canUseStorage()) {
    return null
  }

  const raw = localStorage.getItem(SESSION_STORAGE_KEY)
  if (!raw) {
    return null
  }

  try {
    return JSON.parse(raw) as SessionState
  } catch {
    localStorage.removeItem(SESSION_STORAGE_KEY)
    return null
  }
}

export const saveSession = (session: SessionState) => {
  if (!canUseStorage()) {
    return
  }

  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session))
}

export const updateSessionUser = (user: SessionUser) => {
  const current = getSession()
  if (!current) {
    return
  }

  saveSession({
    ...current,
    user,
  })
}

export const clearSession = () => {
  if (!canUseStorage()) {
    return
  }

  localStorage.removeItem(SESSION_STORAGE_KEY)
}

export const getAuthToken = (): string => {
  return getSession()?.token || ''
}

export const getRefreshToken = (): string => {
  return getSession()?.refreshToken || ''
}

export const getCurrentUser = (): SessionUser | null => {
  return getSession()?.user || null
}

export const getUserRoleId = (): number | null => {
  return getSession()?.user?.roleId ?? null
}

export const getUserOrganizationIds = (): number[] => {
  return getSession()?.user?.organizationIds ?? []
}

export const getActiveProjectId = (): number | null => {
  if (!canUseStorage()) {
    return null
  }

  const raw = localStorage.getItem(ACTIVE_PROJECT_ID_STORAGE_KEY)
  if (!raw) {
    return null
  }

  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : null
}

export const setActiveProjectId = (projectId: number) => {
  if (!canUseStorage()) {
    return
  }

  localStorage.setItem(ACTIVE_PROJECT_ID_STORAGE_KEY, String(projectId))
}

export const redirectToLogin = (reason?: string) => {
  if (!canUseStorage()) {
    return
  }

  if (sessionStorage.getItem(UNAUTHORIZED_REDIRECT_FLAG) === '1') {
    return
  }

  sessionStorage.setItem(UNAUTHORIZED_REDIRECT_FLAG, '1')
  clearSession()

  const target = reason ? `/login?reason=${encodeURIComponent(reason)}` : '/login'
  if (window.location.pathname !== '/login') {
    window.location.assign(target)
    return
  }

  sessionStorage.removeItem(UNAUTHORIZED_REDIRECT_FLAG)
}

export const clearUnauthorizedRedirectFlag = () => {
  if (!canUseStorage()) {
    return
  }

  sessionStorage.removeItem(UNAUTHORIZED_REDIRECT_FLAG)
}

// 清除当前项目 ID（退出登录时调用）
export const clearActiveProjectId = () => {
  if (!canUseStorage()) {
    return
  }
  localStorage.removeItem(ACTIVE_PROJECT_ID_STORAGE_KEY)
}

// ==================== 身份/角色系统 ====================

export const IDENTITY_CHANGE_EVENT = 'mangacanvas-identity-change'

export const identityOptions = [
  { id: 'superadmin', label: '超级管理员', roleId: 1, hasProjects: true },
  { id: 'admin', label: '管理员', roleId: 2, hasProjects: true },
  { id: 'employee', label: '员工', roleId: 3, hasProjects: true },
] as const

export type IdentityOption = (typeof identityOptions)[number]['id']

let identityOverride: IdentityOption | null = null

export const getIdentityByRoleId = (roleId: number): IdentityOption => {
  const option = identityOptions.find((opt) => opt.roleId === roleId)
  return option?.id ?? 'employee'
}

export const getStoredIdentity = (): IdentityOption => {
  if (identityOverride) return identityOverride
  const roleId = getSession()?.user?.roleId
  if (roleId) return getIdentityByRoleId(roleId)
  return 'superadmin'
}

export const setStoredIdentity = (identity: IdentityOption) => {
  identityOverride = identity
  if (canUseStorage()) {
    window.dispatchEvent(new CustomEvent(IDENTITY_CHANGE_EVENT, { detail: identity }))
  }
}

export const getIdentityMeta = (identity: IdentityOption) => {
  return identityOptions.find((option) => option.id === identity) ?? identityOptions[0]
}

export const getIdentityHomePath = (identity: IdentityOption): string => {
  const meta = getIdentityMeta(identity)
  return meta.hasProjects ? '/dashboard' : '/projects'
}

export const canAccessProjectRoutes = (identity: IdentityOption): boolean => {
  return getIdentityMeta(identity).hasProjects
}
