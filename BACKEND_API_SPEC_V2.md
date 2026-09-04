# MangaCanvas 后端接口规范（v2 · 独立文档）

> **文件**：`BACKEND_API_SPEC_V2.md` — 与仓库内旧版 `BACKEND_API_SPEC.md`（v1.0 接口设计文档）**并存**，不替代其文件名；实现与联调请以本文件与 `schema.sql` 为准。
>
> 本文档与 **`docs/database/schema.sql`**（MySQL 8，`shupivot_admin` 库）一一对应，供后端实现与前后端联调使用。  
> 字段命名：JSON **camelCase**；库表 **snake_case**（见各资源说明）。  
> **AI 模型网关**（Chat / Embeddings / Images / Video / Audio / Rerank / Models / Balance / Bills）见 **§15**。

**版本**：2.0  
**更新日期**：2026-04-07  

---

## 目录

1. [概述与约定](#1-概述与约定)  
2. [资源与表映射](#2-资源与表映射)  
3. [接口模块总览](#3-接口模块总览)  
3.1. [健康检查 Health](#31-健康检查-health)  
4. [认证 Auth](#4-认证-auth)  
5. [组织 Organizations](#5-组织-organizations)  
6. [用户 Users](#6-用户-users)  
7. [项目 Projects](#7-项目-projects)  
8. [项目成员 Project Members](#8-项目成员-project-members)  
9. [角色 Characters](#9-角色-characters)  
10. [场景 Scenes](#10-场景-scenes)  
11. [物品 Objects](#11-物品-objects)  
12. [片段 Episodes](#12-片段-episodes)  
13. [画布工作流 Canvas Workflows](#13-画布工作流-canvas-workflows)  
14. [项目资产 Project Assets](#14-项目资产-project-assets)  
15. [AI 模型网关（OpenAI 兼容）](#15-ai-模型网关openai-兼容)  
16. [文件上传 Upload](#16-文件上传-upload)  
17. [积分与流水 Credits & Ledger](#17-积分与流水-credits--ledger)  
18. [计费额度 Billing](#18-计费额度-billing)  
19. [数据结构 TypeScript](#19-数据结构-typescript)  
20. [错误码](#20-错误码)  
21. [实现说明](#21-实现说明)  

---

## 1. 概述与约定

### 1.1 产品简述

**MangaCanvas**：React + AI 的漫剧（AIGC）创作管理平台（ToB：组织 → 项目 → 资产/画布/片段）。

### 1.2 基础约定

| 项 | 约定 |
|----|------|
| API 前缀 | `/api/v1` |
| 认证 | `Authorization: Bearer {access_token}`（除注册、登录、OAuth 回调等公开接口） |
| 主键 | 业务实体主键均为 **`BIGINT` 自增**，JSON 中用 **number**（与 TS 对齐；超大整数可约定 string，需全链路统一） |
| 画布工作流 ID | **`canvas_workflows.id` 为 VARCHAR**（如 `workflow_*`），接口中为 **string** |
| 时间 | ISO 8601 字符串，毫秒精度与库表 `TIMESTAMP(3)` 一致 |
| 成功响应 | `{ "code": 0, "data": ... }`（`code` 为业务码，0 表示成功） |
| 分页 | `page`（从 1 起）、`size`；响应含 `pagination: { page, size, total }` |

### 1.3 RBAC（系统角色，非漫剧角色）

与表 **`roles`** 一致：`super_admin` | `admin` | `employee`。  
权限位见 `roles` 表：`can_create_organization`、`can_create_project`、`can_manage_project_members`、`list_all_projects`、`list_organization_projects`。

### 1.4 数据层级

```
organizations → organization_members（用户∈组织）
projects（organization_id）→ project_members（用户∈项目，role: owner|editor|viewer）
canvas_workflows（project_id，id 为字符串）→ canvas_workflow_members（可选细粒度）
characters / scenes / project_objects / episodes（均含 organization_id + project_id）
episode_* 关联表：episode_characters、episode_scenes、episode_objects
```

---

## 2. 资源与表映射

| 资源/概念 | 表 |
|-----------|-----|
| 系统角色 | `roles` |
| 组织 | `organizations` |
| 用户 | `users` |
| 用户↔组织 | `organization_members` |
| OAuth | `oauth_identities` |
| 刷新令牌 | `refresh_tokens` |
| 项目 | `projects` |
| 项目成员 | `project_members` |
| 画布工作流 | `canvas_workflows`、`canvas_nodes`、`canvas_edges` |
| 工作流成员 | `canvas_workflow_members` |
| 企业/组织/项目/用户项目额度 | `billing_enterprise_quota`、`billing_organization_quotas`、`billing_project_quotas`、`billing_user_project_quotas` |
| 计费流水 | `billing_ledger` |
| 角色/场景/物品/片段 | `characters`、`scenes`、`project_objects`、`episodes` |
| 片段关联 | `episode_characters`、`episode_scenes`、`episode_objects` |
| 项目资产 | `project_assets` |

**未建表能力**：`generation_tasks` 等生成任务表在 schema 注释中说明**不含**；AI 任务队列可由应用侧 Redis/消息队列实现，落库时可扩展表或与 `billing_ledger.reference_*` 关联。

---

## 3. 接口模块总览

| 模块 | 基础路径 | 说明 |
|------|-----------|------|
| 健康检查 | `/api/v1/health` | 存活探针，不访问数据库、不需 JWT（见 §3.1） |
| 认证 | `/api/v1/auth` | 注册、登录、刷新、me、OAuth |
| 组织 | `/api/v1/organizations` | CRUD、成员 |
| 用户 | `/api/v1/users` | 当前用户组织列表等 |
| 项目 | `/api/v1/projects` | CRUD、复制 |
| 项目成员 | `/api/v1/projects/{projectId}/members` | 增删改查 |
| 角色 | `/api/v1/projects/{projectId}/characters` | CRUD |
| 场景 | `/api/v1/projects/{projectId}/scenes` | CRUD |
| 物品 | `/api/v1/projects/{projectId}/objects` | CRUD |
| 片段 | `/api/v1/projects/{projectId}/episodes` | CRUD、关联 |
| 画布 | `/api/v1/projects/{projectId}/canvas-workflows` | CRUD、图数据、成员 |
| 项目资产 | `/api/v1/projects/{projectId}/assets` | 登记与查询 |
| AI | `/api/v1/ai` | OpenAI 兼容模型网关（§15） |
| 上传 | `/api/v1/upload` | 预签名、确认 |
| 积分 | `/api/v1/credits` | 余额、流水 |
| 计费 | `/api/v1/billing` | 企业/组织/项目/用户项目额度 |

### 3.1 健康检查 Health

用于负载均衡、Docker `HEALTHCHECK`、Kubernetes liveness 等**存活探测**。本接口**不访问数据库**、**不要求** `Authorization`，仅表示 HTTP 服务进程可响应。

```http
GET /api/v1/health
```

#### 响应 `data` 字段

| 字段 | 类型 | 说明 |
|------|------|------|
| status | string | 固定为 `ok`，表示进程可用 |
| timestamp | number | 当前 Unix 时间戳（**毫秒**） |

#### 响应示例

```json
{
  "code": 0,
  "data": {
    "status": "ok",
    "timestamp": 1712486400123
  }
}
```

---

## 4. 认证 Auth

**基础路径**：`/api/v1/auth`

### 4.1 注册

```http
POST /api/v1/auth/register
Content-Type: application/json
```

**Body**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| username | string | 是 | 全局唯一，对应 `users.username` |
| email | string | 是 | 全局唯一 |
| password | string | 是 | 服务端哈希存储 |
| avatar | string | 否 | URL |

#### 请求示例

```bash
curl -X POST https://your-api/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "zhangsan",
    "email": "zhangsan@example.com",
    "password": "P@ssw0rd123",
    "avatar": "https://cdn.example.com/avatar/default.png"
  }'
```

#### 响应参数

| 字段 | 类型 | 说明 |
|------|------|------|
| code | number | 业务码，0 表示成功 |
| data.user | object | 用户对象 |
| data.user.id | number | 用户 ID（BIGINT 自增） |
| data.user.username | string | 用户名 |
| data.user.email | string | 邮箱 |
| data.user.roleId | number | 系统角色 ID（默认 3=employee） |
| data.user.credits | number | 初始积分（默认 0） |
| data.token | string | 访问令牌（JWT） |
| data.refreshToken | string | 刷新令牌 |

#### 响应示例

```json
{
  "code": 0,
  "data": {
    "user": {
      "id": 10001,
      "username": "zhangsan",
      "email": "zhangsan@example.com",
      "avatar": "https://cdn.example.com/avatar/default.png",
      "roleId": 3,
      "credits": 0,
      "createdAt": "2026-04-06T08:00:00.000Z",
      "updatedAt": "2026-04-06T08:00:00.000Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "dGhpcyBpcyBhIHJlZnJlc2ggdG9rZW4..."
  }
}
```

### 4.2 登录

```http
POST /api/v1/auth/login
Content-Type: application/json
```

#### 请求参数

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| email | string | 是 | 注册邮箱 |
| password | string | 是 | 密码 |

#### 请求示例

```bash
curl -X POST https://your-api/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "zhangsan@example.com", "password": "P@ssw0rd123"}'
```

#### 响应示例

```json
{
  "code": 0,
  "data": {
    "user": {
      "id": 10001,
      "username": "zhangsan",
      "email": "zhangsan@example.com",
      "avatar": "https://cdn.example.com/avatar/default.png",
      "roleId": 3,
      "credits": 500,
      "createdAt": "2026-04-06T08:00:00.000Z",
      "updatedAt": "2026-04-06T08:10:00.000Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "dGhpcyBpcyBhIHJlZnJlc2ggdG9rZW4..."
  }
}
```

### 4.3 刷新 Token

与表 `refresh_tokens`（存哈希）一致：客户端提交 **refresh_token**（建议 Body，避免误把 access token 当 Bearer 使用）。

```http
POST /api/v1/auth/refresh
Content-Type: application/json

{
  "refreshToken": "string"
}
```

#### 响应示例

```json
{
  "code": 0,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.new...",
    "refreshToken": "bmV3IHJlZnJlc2ggdG9rZW4..."
  }
}
```

**说明**：轮换策略由服务端定。

### 4.4 当前用户

```http
GET /api/v1/auth/me
Authorization: Bearer {access_token}
```

**Response 200** `data` 字段与 **`users` + `roles`** 一致示例：

| 字段 | 说明 |
|------|------|
| id | users.id |
| roleId | users.role_id |
| role | `{ id, code, name }` |
| organizationIds | 来自 `organization_members` 的组织 id 数组 |
| username, email, avatar, credits | 同表 |
| createdAt, updatedAt | ISO 8601 |

#### 请求示例

```bash
curl -X GET https://your-api/api/v1/auth/me \
  -H "Authorization: Bearer eyJhbGci..."
```

#### 响应示例

```json
{
  "code": 0,
  "data": {
    "id": 10001,
    "username": "zhangsan",
    "email": "zhangsan@example.com",
    "avatar": "https://cdn.example.com/avatar/default.png",
    "roleId": 3,
    "role": { "id": 3, "code": "employee", "name": "员工" },
    "organizationIds": [1, 2],
    "credits": 500,
    "createdAt": "2026-04-06T08:00:00.000Z",
    "updatedAt": "2026-04-06T08:10:00.000Z"
  }
}
```

### 4.5 OAuth

```http
POST /api/v1/auth/oauth/{provider}
```

**provider**：`google` | `github`（与 `oauth_identities.provider` 一致）

#### 请求参数

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| code | string | 是 | OAuth 授权码 |
| redirectUri | string | 是 | 回调地址 |

#### 请求示例

```bash
curl -X POST https://your-api/api/v1/auth/oauth/google \
  -H "Content-Type: application/json" \
  -d '{"code": "4/0AY0e-xxx", "redirectUri": "https://app.example.com/callback"}'
```

#### 响应示例

```json
{
  "code": 0,
  "data": {
    "user": {
      "id": 10002,
      "username": "oauth_user",
      "email": "user@gmail.com",
      "roleId": 3,
      "credits": 0,
      "createdAt": "2026-04-06T09:00:00.000Z",
      "updatedAt": "2026-04-06T09:00:00.000Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "dGhpcyBpcyBhIHJlZnJlc2ggdG9rZW4..."
  }
}
```

**说明**：OAuth 用户 `password_hash` 可为空；绑定写入 `oauth_identities`。

---

## 5. 组织 Organizations

**基础路径**：`/api/v1/organizations`

### 5.1 创建组织

**权限**：`roles.can_create_organization = 1`（超级管理员）。

```http
POST /api/v1/organizations
Authorization: Bearer {token}
Content-Type: application/json

{ "name": "string" }
```

#### 响应示例

```json
{
  "code": 0,
  "data": {
    "id": 1,
    "name": "漫画工作室A",
    "createdBy": 10001,
    "createdAt": "2026-04-06T08:00:00.000Z",
    "updatedAt": "2026-04-06T08:00:00.000Z"
  }
}
```

### 5.2 组织详情

```http
GET /api/v1/organizations/{organizationId}
Authorization: Bearer {token}
```

#### 响应示例

```json
{
  "code": 0,
  "data": {
    "id": 1,
    "name": "漫画工作室A",
    "createdBy": 10001,
    "memberCount": 5,
    "createdAt": "2026-04-06T08:00:00.000Z",
    "updatedAt": "2026-04-06T10:00:00.000Z"
  }
}
```

### 5.3 组织列表（管理端）

```http
GET /api/v1/organizations?page=1&size=20
Authorization: Bearer {token}
```

**权限**：通常仅超级管理员或可按产品收窄。

#### 响应示例

```json
{
  "code": 0,
  "data": {
    "list": [
      { "id": 1, "name": "漫画工作室A", "createdBy": 10001, "createdAt": "2026-04-06T08:00:00.000Z" },
      { "id": 2, "name": "二次元团队B", "createdBy": 10001, "createdAt": "2026-04-06T09:00:00.000Z" }
    ],
    "pagination": { "page": 1, "size": 20, "total": 2 }
  }
}
```

### 5.4 添加组织成员

写入 **`organization_members`**。

```http
POST /api/v1/organizations/{organizationId}/members
Authorization: Bearer {token}
Content-Type: application/json

{ "userId": 10002 }
```

#### 响应示例

```json
{
  "code": 0,
  "data": {
    "organizationId": 1,
    "userId": 10002,
    "assignedBy": 10001,
    "joinedAt": "2026-04-06T09:00:00.000Z"
  }
}
```

### 5.5 移除组织成员

```http
DELETE /api/v1/organizations/{organizationId}/members/{userId}
Authorization: Bearer {token}
```

---

## 6. 用户 Users

### 6.1 当前用户所属组织列表

与 **`GET /api/v1/users/me/organizations`** 一致（文档与实现可二选一暴露，建议保留此路径）。

```http
GET /api/v1/users/me/organizations
Authorization: Bearer {token}
```

#### 响应示例

```json
{
  "code": 0,
  "data": {
    "list": [
      { "id": 1, "name": "漫画工作室A", "joinedAt": "2026-04-06T08:00:00.000Z" },
      { "id": 2, "name": "二次元团队B", "joinedAt": "2026-04-06T09:00:00.000Z" }
    ]
  }
}
```

---

## 7. 项目 Projects

**基础路径**：`/api/v1/projects`

### 7.1 创建

**权限**：`can_create_project = 1`；**员工**不可创建；须指定 **`organizationId`**（`projects.organization_id`）。

```http
POST /api/v1/projects
Authorization: Bearer {token}
Content-Type: application/json

{
  "organizationId": 1,
  "name": "string",
  "description": "string",
  "coverImage": "string",
  "isPublic": false
}
```

**默认**：`owner_id` 为当前用户；`status` 默认 `draft`（`projects.status`：`draft` | `in-progress` | `completed`）。

#### 响应示例

```json
{
  "code": 0,
  "data": {
    "id": 101,
    "organizationId": 1,
    "name": "幻想冒险漫剧",
    "description": "一段奇幻的冒险故事",
    "coverImage": null,
    "status": "draft",
    "isPublic": false,
    "ownerId": 10001,
    "createdAt": "2026-04-06T10:00:00.000Z",
    "updatedAt": "2026-04-06T10:00:00.000Z"
  }
}
```

### 7.2 列表

```http
GET /api/v1/projects?page=1&size=20&status=draft&organizationId=1
Authorization: Bearer {token}
```

**可见性**：员工 → `project_members`；管理员 → 已加入组织下的全部项目；超级管理员 → 可 `list_all_projects`。

#### 响应示例

```json
{
  "code": 0,
  "data": {
    "list": [
      {
        "id": 101,
        "organizationId": 1,
        "name": "幻想冒险漫剧",
        "description": "一段奇幻的冒险故事",
        "coverImage": null,
        "status": "draft",
        "progress": 0,
        "episodeCount": 3,
        "updatedAt": "2026-04-06T12:00:00.000Z"
      }
    ],
    "pagination": { "page": 1, "size": 20, "total": 1 }
  }
}
```

### 7.3 详情

```http
GET /api/v1/projects/{projectId}
Authorization: Bearer {token}
```

#### 响应示例

```json
{
  "code": 0,
  "data": {
    "id": 101,
    "organizationId": 1,
    "name": "幻想冒险漫剧",
    "description": "一段奇幻的冒险故事",
    "coverImage": null,
    "status": "draft",
    "isPublic": false,
    "ownerId": 10001,
    "owner": { "id": 10001, "username": "zhangsan", "avatar": null },
    "members": [
      { "userId": 10001, "role": "owner", "joinedAt": "2026-04-06T10:00:00.000Z" },
      { "userId": 10002, "role": "editor", "joinedAt": "2026-04-06T10:05:00.000Z" }
    ],
    "stats": {
      "episodeCount": 3,
      "sceneCount": 5,
      "characterCount": 4,
      "objectCount": 2,
      "totalDuration": 675
    },
    "createdAt": "2026-04-06T10:00:00.000Z",
    "updatedAt": "2026-04-06T12:00:00.000Z"
  }
}
```

### 7.4 更新

```http
PUT /api/v1/projects/{projectId}
Authorization: Bearer {token}
Content-Type: application/json
```

可部分更新：`name`、`description`、`coverImage`、`status`、`isPublic`。

### 7.5 删除

```http
DELETE /api/v1/projects/{projectId}
Authorization: Bearer {token}
```

### 7.6 复制

```http
POST /api/v1/projects/{projectId}/duplicate
Authorization: Bearer {token}
```

**说明**：是否复制画布/资产/片段由产品定；若复制须保持 `organization_id` 一致并重建关联。

---

## 8. 项目成员 Project Members

对应表 **`project_members`**（复合主键 `project_id, user_id`）。

**基础路径**：`/api/v1/projects/{projectId}/members`

### 8.1 列表

```http
GET /api/v1/projects/{projectId}/members
Authorization: Bearer {token}
```

#### 响应示例

```json
{
  "code": 0,
  "data": {
    "list": [
      {
        "userId": 10001,
        "organizationId": 1,
        "role": "owner",
        "assignedBy": null,
        "joinedAt": "2026-04-06T10:00:00.000Z",
        "user": { "id": 10001, "username": "zhangsan", "avatar": null }
      },
      {
        "userId": 10002,
        "organizationId": 1,
        "role": "editor",
        "assignedBy": 10001,
        "joinedAt": "2026-04-06T10:05:00.000Z",
        "user": { "id": 10002, "username": "lisi", "avatar": null }
      }
    ]
  }
}
```

### 8.2 添加成员

**权限**：`can_manage_project_members` 或项目 owner/管理员规则由产品定；用户须已在 **`organization_members`** 中。

```http
POST /api/v1/projects/{projectId}/members
Authorization: Bearer {token}
Content-Type: application/json

{ "userId": 10002, "role": "editor" }
```

服务端写入与 `projects.organization_id` 一致的 `organization_id`。

### 8.3 变更角色

```http
PATCH /api/v1/projects/{projectId}/members/{userId}
Authorization: Bearer {token}
Content-Type: application/json

{ "role": "viewer" }
```

### 8.4 移除

```http
DELETE /api/v1/projects/{projectId}/members/{userId}
Authorization: Bearer {token}
```

---

## 9. 角色 Characters

**基础路径**：`/api/v1/projects/{projectId}/characters`  
**表**：`characters`（含 `organization_id`、`creation_mode`、`source_workflow_id`、`source_node_id`）

### 9.1 创建

```http
POST /api/v1/projects/{projectId}/characters
Authorization: Bearer {token}
Content-Type: application/json
```

**Body（扩展与库 CHECK 一致）**

| 字段 | 说明 |
|------|------|
| name | 必填 |
| role | `main` \| `support` |
| gender | `male` \| `female` \| `other` |
| ageGroup | `child` \| `teen` \| `young` \| `middle` \| `old` |
| style, description, avatar | 可选 |
| referenceImages | string[] |
| modelId, seed | 可选 |
| creationMode | `quick`（默认）\| `workflow` |
| sourceWorkflowId | `creationMode=workflow` 时**必填**，对应 `canvas_workflows.id` |
| sourceNodeId | 可选，画布节点 id |

**约束**：`creationMode=quick` 时 `sourceWorkflowId`、`sourceNodeId` 须为空；`workflow` 时须带 `sourceWorkflowId`。

#### 请求示例

```bash
curl -X POST https://your-api/api/v1/projects/101/characters \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "艾拉",
    "role": "main",
    "gender": "female",
    "ageGroup": "young",
    "style": "二次元",
    "description": "拥有蓝色长发的冒险少女",
    "avatar": null,
    "referenceImages": ["https://cdn.example.com/ref1.png"],
    "creationMode": "quick"
  }'
```

#### 响应示例

```json
{
  "code": 0,
  "data": {
    "id": 201,
    "organizationId": 1,
    "projectId": 101,
    "name": "艾拉",
    "role": "main",
    "gender": "female",
    "ageGroup": "young",
    "style": "二次元",
    "description": "拥有蓝色长发的冒险少女",
    "avatar": null,
    "referenceImages": ["https://cdn.example.com/ref1.png"],
    "modelId": null,
    "seed": null,
    "creationMode": "quick",
    "sourceWorkflowId": null,
    "sourceNodeId": null,
    "usageCount": 0,
    "createdAt": "2026-04-06T10:30:00.000Z",
    "updatedAt": "2026-04-06T10:30:00.000Z"
  }
}
```

### 9.2 列表

```http
GET /api/v1/projects/{projectId}/characters?role=main
Authorization: Bearer {token}
```

#### 响应示例

```json
{
  "code": 0,
  "data": {
    "list": [
      {
        "id": 201,
        "name": "艾拉",
        "role": "main",
        "gender": "female",
        "ageGroup": "young",
        "avatar": null,
        "usageCount": 2,
        "createdAt": "2026-04-06T10:30:00.000Z"
      }
    ],
    "pagination": { "page": 1, "size": 20, "total": 1 }
  }
}
```

### 9.3 详情 / 更新 / 删除

```http
GET    /api/v1/projects/{projectId}/characters/{characterId}
PUT    /api/v1/projects/{projectId}/characters/{characterId}
DELETE /api/v1/projects/{projectId}/characters/{characterId}
```

**响应**含全量字段结构同 9.1 创建的响应示例。`id`/`projectId`/`organizationId` 为 number。

---

## 10. 场景 Scenes

**表**：`scenes`（`status`：`draft` | `in-use`；`gen_method`：`model` | `upload` | `angle` | `custom`；`camera` 为 JSON）

### 10.1 创建

```http
POST /api/v1/projects/{projectId}/scenes
Authorization: Bearer {token}
Content-Type: application/json
```

#### 请求参数

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| name | string | 是 | 场景名称 |
| description | string | 否 | 场景描述 |
| image | string | 否 | 场景图片 URL |
| genMethod | string | 否 | 生成方式：`model` \| `upload` \| `angle` \| `custom` |
| modelId | string | 否 | 模型 ID |
| style | string | 否 | 风格 |
| camera | object | 否 | 镜头参数：`shotType`(`close`\|`medium`\|`wide`)、`distance`、`horizontal`、`vertical` |
| referenceImages | string[] | 否 | 参考图 URL 数组 |
| seed | string | 否 | 随机种子 |
| creationMode | string | 否 | `quick`（默认）\| `workflow` |
| sourceWorkflowId | string | 否 | 工作流 ID（`workflow` 模式必填） |
| sourceNodeId | string | 否 | 画布节点 ID |

#### 请求示例

```bash
curl -X POST https://your-api/api/v1/projects/101/scenes \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "神秘森林",
    "description": "古老的森林，弥漫着薄雾",
    "genMethod": "model",
    "camera": { "shotType": "wide", "distance": 50, "horizontal": 0, "vertical": 10 },
    "creationMode": "quick"
  }'
```

#### 响应示例

```json
{
  "code": 0,
  "data": {
    "id": 301,
    "organizationId": 1,
    "projectId": 101,
    "name": "神秘森林",
    "description": "古老的森林，弥漫着薄雾",
    "image": null,
    "status": "draft",
    "genMethod": "model",
    "modelId": null,
    "style": null,
    "camera": { "shotType": "wide", "distance": 50, "horizontal": 0, "vertical": 10 },
    "referenceImages": [],
    "seed": null,
    "creationMode": "quick",
    "sourceWorkflowId": null,
    "sourceNodeId": null,
    "usageCount": 0,
    "createdAt": "2026-04-06T11:00:00.000Z",
    "updatedAt": "2026-04-06T11:00:00.000Z"
  }
}
```

### 10.2 列表

```http
GET /api/v1/projects/{projectId}/scenes?status=in-use
Authorization: Bearer {token}
```

### 10.3 详情 / 更新 / 删除

同角色路径模式 `{sceneId}`。

---

## 11. 物品 Objects

**表**：`project_objects`（接口路径仍建议 **`/objects`**；`type`：`weapon` | `prop` | `clothing` | `decoration`）

### 11.1 创建

```http
POST /api/v1/projects/{projectId}/objects
Authorization: Bearer {token}
Content-Type: application/json
```

#### 请求参数

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| name | string | 是 | 物品名 |
| type | string | 是 | `weapon` \| `prop` \| `clothing` \| `decoration` |
| description | string | 否 | 描述 |
| image | string | 否 | 图片 URL |
| sceneId | number | 否 | 所属场景 ID |
| genMethod | string | 否 | 生成方式 |
| referenceImages | string[] | 否 | 参考图 URL 数组 |
| creationMode | string | 否 | `quick`（默认）\| `workflow` |
| sourceWorkflowId | string | 否 | 工作流 ID（`workflow` 模式必填） |
| sourceNodeId | string | 否 | 画布节点 ID |

#### 请求示例

```bash
curl -X POST https://your-api/api/v1/projects/101/objects \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "魔法剑",
    "type": "weapon",
    "description": "散发着蓝色光芒的古老长剑"
  }'
```

#### 响应示例

```json
{
  "code": 0,
  "data": {
    "id": 401,
    "organizationId": 1,
    "projectId": 101,
    "name": "魔法剑",
    "type": "weapon",
    "description": "散发着蓝色光芒的古老长剑",
    "image": null,
    "sceneId": null,
    "status": "draft",
    "genMethod": null,
    "referenceImages": [],
    "creationMode": "quick",
    "sourceWorkflowId": null,
    "sourceNodeId": null,
    "createdAt": "2026-04-06T11:30:00.000Z",
    "updatedAt": "2026-04-06T11:30:00.000Z"
  }
}
```

### 11.2 列表

```http
GET /api/v1/projects/{projectId}/objects?type=weapon
Authorization: Bearer {token}
```

### 11.3 详情 / 更新 / 删除

```http
GET    /api/v1/projects/{projectId}/objects/{objectId}
PUT    /api/v1/projects/{projectId}/objects/{objectId}
DELETE /api/v1/projects/{projectId}/objects/{objectId}
```

---

## 12. 片段 Episodes

**表**：`episodes`（`code` 在**同项目内唯一**）；关联表 `episode_characters`、`episode_scenes`、`episode_objects`。

**基础路径**：`/api/v1/projects/{projectId}/episodes`

### 12.1 创建

```http
POST /api/v1/projects/{projectId}/episodes
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "string",
  "code": "EP_001",
  "description": "string",
  "duration": 225,
  "characterIds": [1, 2],
  "sceneIds": [3],
  "objectIds": [4],
  "creationMode": "quick",
  "sourceWorkflowId": null,
  "sourceNodeId": null
}
```

**说明**：`characterIds`/`sceneIds`/`objectIds` 为 **number[]**（与 BIGINT 一致）；创建时写入关联表。

#### 响应示例

```json
{
  "code": 0,
  "data": {
    "id": 501,
    "organizationId": 1,
    "projectId": 101,
    "name": "第一话：出发",
    "code": "EP_001",
    "description": "冒险的开端",
    "status": "draft",
    "progress": 0,
    "duration": 225,
    "creationMode": "quick",
    "sourceWorkflowId": null,
    "sourceNodeId": null,
    "characters": [
      { "id": 201, "name": "艾拉" },
      { "id": 202, "name": "克洛斯" }
    ],
    "scenes": [{ "id": 301, "name": "神秘森林" }],
    "objects": [{ "id": 401, "name": "魔法剑" }],
    "createdAt": "2026-04-06T12:00:00.000Z",
    "updatedAt": "2026-04-06T12:00:00.000Z"
  }
}
```

### 12.2 列表

```http
GET /api/v1/projects/{projectId}/episodes?status=in-progress
Authorization: Bearer {token}
```

### 12.3 详情

```http
GET /api/v1/projects/{projectId}/episodes/{episodeId}
Authorization: Bearer {token}
```

**Response**：含 `characters` / `scenes` / `objects` 摘要列表；`sceneCount` 等统计字段。响应结构同 12.1 创建的响应示例。

### 12.4 更新片段与关联

```http
PUT /api/v1/projects/{projectId}/episodes/{episodeId}
Authorization: Bearer {token}
Content-Type: application/json
```

可更新：`name`、`code`、`description`、`status`、`progress`、`duration` 及 `creationMode`/`sourceWorkflowId`/`sourceNodeId`；关联 id 数组与创建相同语义（全量覆盖或增量由服务端约定，建议**显式**文档化；默认**全量覆盖**关联表）。

### 12.5 仅更新关联（可选）

```http
PATCH /api/v1/projects/{projectId}/episodes/{episodeId}/relations
Authorization: Bearer {token}
Content-Type: application/json

{
  "characterIds": [1, 2],
  "sceneIds": [3],
  "objectIds": [4]
}
```

### 12.6 删除

```http
DELETE /api/v1/projects/{projectId}/episodes/{episodeId}
Authorization: Bearer {token}
```

---

## 13. 画布工作流 Canvas Workflows

对应 **`canvas_workflows`**、**`canvas_nodes`**、**`canvas_edges`**、**`canvas_workflow_members`**。  
JSON 形状与 **`docs/canvas.json`** 中单条工作流对象对齐：根级含 `id`、`name`、`thumbnail`、`createdAt`、`updatedAt`、`projectId`、`sourceType`、`canvasData`（`nodes[]`、`edges[]`、`viewport`）。

**基础路径**：`/api/v1/projects/{projectId}/canvas-workflows`

### 13.1 列表

```http
GET /api/v1/projects/{projectId}/canvas-workflows?page=1&size=20
Authorization: Bearer {token}
```

**项**：`id`（string）、`name`、`thumbnail`、`sourceType`、`projectId`、`createdAt`、`updatedAt`（可无全量 `canvasData` 以减轻负载）。

### 13.2 创建工作流

```http
POST /api/v1/projects/{projectId}/canvas-workflows
Authorization: Bearer {token}
Content-Type: application/json
```

**Body**：可提供完整 `canvasData`，或仅 `name`、`sourceType` 等，由服务端生成 `id`（如 `workflow_*`）。`organizationId` 由服务端根据 `projects.organization_id` 填充。

#### 请求示例

```bash
curl -X POST https://your-api/api/v1/projects/101/canvas-workflows \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "角色生成流程",
    "sourceType": "character",
    "canvasData": {
      "nodes": [],
      "edges": [],
      "viewport": { "x": 0, "y": 0, "zoom": 1 }
    }
  }'
```

#### 响应示例

```json
{
  "code": 0,
  "data": {
    "id": "workflow_a1b2c3",
    "organizationId": 1,
    "projectId": 101,
    "name": "角色生成流程",
    "sourceType": "character",
    "thumbnail": null,
    "canvasData": {
      "nodes": [],
      "edges": [],
      "viewport": { "x": 0, "y": 0, "zoom": 1 }
    },
    "createdAt": "2026-04-06T13:00:00.000Z",
    "updatedAt": "2026-04-06T13:00:00.000Z"
  }
}
```

### 13.3 获取详情（含图数据）

```http
GET /api/v1/projects/{projectId}/canvas-workflows/{workflowId}
Authorization: Bearer {token}
```

#### 响应示例

```json
{
  "code": 0,
  "data": {
    "id": "workflow_a1b2c3",
    "organizationId": 1,
    "projectId": 101,
    "name": "角色生成流程",
    "sourceType": "character",
    "thumbnail": "https://cdn.example.com/thumb.png",
    "canvasData": {
      "nodes": [
        {
          "id": "node_1",
          "type": "textInput",
          "position": { "x": 100, "y": 200 },
          "data": { "label": "提示词", "value": "蓝色长发少女" },
          "width": 200,
          "height": 80
        }
      ],
      "edges": [
        { "id": "edge_1", "source": "node_1", "target": "node_2" }
      ],
      "viewport": { "x": 0, "y": 0, "zoom": 1 }
    },
    "createdAt": "2026-04-06T13:00:00.000Z",
    "updatedAt": "2026-04-06T14:00:00.000Z"
  }
}
```

### 13.4 全量保存（推荐）

```http
PUT /api/v1/projects/{projectId}/canvas-workflows/{workflowId}
Authorization: Bearer {token}
Content-Type: application/json
```

**Body**：完整工作流对象或至少 `name`、`thumbnail`、`sourceType`、`canvasData`；服务端事务更新 `canvas_workflows` 与节点/边表。

### 13.5 删除

```http
DELETE /api/v1/projects/{projectId}/canvas-workflows/{workflowId}
Authorization: Bearer {token}
```

**说明**：若 **`characters.source_workflow_id`** 等外键引用存在，删除策略可为 RESTRICT（库已 `ON DELETE SET NULL` 时按库）。

### 13.6 工作流成员

**表**：`canvas_workflow_members`

```http
GET    /api/v1/projects/{projectId}/canvas-workflows/{workflowId}/members
POST   /api/v1/projects/{projectId}/canvas-workflows/{workflowId}/members
PATCH  /api/v1/projects/{projectId}/canvas-workflows/{workflowId}/members/{userId}
DELETE /api/v1/projects/{projectId}/canvas-workflows/{workflowId}/members/{userId}
```

**POST Body**：`{ "userId": 10002, "role": "editor" }`  
**权限**：建议以具备项目访问为前提（应用层校验）。

---

## 14. 项目资产 Project Assets

**表**：`project_assets`

**基础路径**：`/api/v1/projects/{projectId}/assets`

### 14.1 列表

```http
GET /api/v1/projects/{projectId}/assets?page=1&size=20&sourceType=character
Authorization: Bearer {token}
```

### 14.2 登记资产

```http
POST /api/v1/projects/{projectId}/assets
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "可选",
  "sourceType": "workflow",
  "sourceId": "workflow_xxx",
  "prompt": "string",
  "url": "https://...",
  "metadata": {}
}
```

**sourceType**：`workflow` | `workflow_node` | `character` | `scene` | `project_object` | `episode`  
**sourceId**：与 DDL 注释一致——`workflow` 为 `canvas_workflows.id`；`workflow_node` 建议约定 `"{workflowId}|{nodeId}"`；其余为对应表主键的十进制字符串。

#### 响应示例

```json
{
  "code": 0,
  "data": {
    "id": 601,
    "organizationId": 1,
    "projectId": 101,
    "name": "角色立绘",
    "sourceType": "workflow",
    "sourceId": "workflow_a1b2c3",
    "prompt": "蓝色长发少女",
    "url": "https://cdn.example.com/assets/chara_001.png",
    "metadata": {},
    "createdBy": 10001,
    "createdAt": "2026-04-06T14:00:00.000Z",
    "updatedAt": "2026-04-06T14:00:00.000Z"
  }
}
```

### 14.3 详情 / 更新 / 删除

```http
GET    /api/v1/projects/{projectId}/assets/{assetId}
PUT    /api/v1/projects/{projectId}/assets/{assetId}
DELETE /api/v1/projects/{projectId}/assets/{assetId}
```

---

## 15. AI 模型网关（OpenAI 兼容）


### 15.1 模型调用
OpenAI 兼容接口，使用 Bearer Token 认证。

#### 通用请求头
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `Authorization` | string | 是 | Bearer Token 认证，格式: Bearer sk-xxx |
| `Content-Type` | string | 是 | application/json |

### 15.2 文本对话 (Chat Completions)
**POST** `/api/v1/ai/chat/completions`

#### 请求参数
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `model` | string | 是 | 模型 ID。支持: qwen3-max, qwen3.6-plus, qwen3.5-plus, qwen3.5-flash, qwen-turbo, qwq-plus, qwen-long, deepseek-v3.2, deepseek-r1, qwen3-coder-plus, qwen3-coder-flash, qwen-math-plus, qwen-mt-plus, qwen-mt-flash |
| `messages` | array<object> | 是 | 消息列表。按顺序描述对话历史，每条消息包含 role 和 content |
| `stream` | boolean | 否 | 是否启用流式（SSE）输出。启用后逐 token 返回，适用于打字机效果 (默认: false) |
| `temperature` | float | 否 | 生成随机性控制。0 为确定性输出，值越大越随机。范围 [0, 2] (默认: 1) |
| `top_p` | float | 否 | 核采样概率阈值。从概率累加达到 top_p 的候选 token 中采样。范围 (0, 1] (默认: 1) |
| `max_tokens` | integer | 否 | 生成最大 token 数。限制模型回复长度，不设置则由模型自行决定 |
| `stop` | string | array<string> | 否 | 停止生成的标记。模型输出遇到这些字符串时立即停止。最多 4 个 |
| `presence_penalty` | float | 否 | 存在惩罚。正值增加新话题出现的概率。范围 [-2, 2] (默认: 0) |
| `absence_penalty` | float | 否 | 频率惩罚。正值降低已出现 token 重复的概率。范围 [-2, 2] (默认: 0) |
| `frequency_penalty` | float | 否 | 频率惩罚（同 absence_penalty）。降低重复生成内容的概率。范围 [-2, 2] (默认: 0) |
| `repetition_penalty` | float | 否 | 重复惩罚。值 >1 降低重复，<1 增加重复 (默认: 1) |
| `seed` | integer | 否 | 随机种子。设置后相同参数+种子会得到相似输出，用于结果复现 |
| `top_k` | integer | 否 | Top-K 采样。仅从概率最高的 K 个 token 中采样。部分模型支持 |
| `response_format` | object | 否 | 输出格式控制。如 {"type": "json_object"} 强制输出合法 JSON |
| `tools` | array<object> | 否 | 可调用的工具（函数）列表。用于 Function Calling |
| `tool_choice` | string | object | 否 | 工具选择策略。"auto" 自动选择, "none" 不使用, 或指定具体函数 |
| `n` | integer | 否 | 生成候选回复数。n > 1 时返回多个 choices，每条独立计费 (默认: 1) |
| `user` | string | 否 | 用户标识，用于厂商侧审计和滥用检测 |

#### messages 数组中每条消息的字段
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `role` | string | 是 | 消息角色。system 系统指令, user 用户输入, assistant 模型回复, tool 工具返回 |
| `content` | string | array | 是 | 消息内容。纯文本字符串，或多模态数组格式 [{"type":"text","text":"..."}, {"type":"image_url","image_url":{...}}] |
| `name` | string | 否 | 发送者名称，当 role 为 function/tool 时必填 |
| `tool_calls` | array | 否 | assistant 消息中的工具调用列表（Function Calling 时模型返回） |
| `tool_call_id` | string | 否 | tool 消息中对应的工具调用 ID |

#### 请求示例
```bash
curl -X POST https://your-gateway/api/v1/ai/chat/completions \
  -H "Authorization: Bearer sk-your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"model": "qwen3.5-plus", "messages": [{"role": "user", "content": "Hello"}], "stream": false}'
```


#### 响应示例
```json
{
  "id": "chatcmpl-123",
  "object": "chat.completion",
  "created": 1677652288,
  "model": "qwen3.5-plus",
  "choices": [{
    "index": 0,
    "message": {
      "role": "assistant",
      "content": "Hello there, how may I assist you today?"
    },
    "finish_reason": "stop"
  }],
  "usage": {
    "prompt_tokens": 9,
    "completion_tokens": 12,
    "total_tokens": 21
  }
}
```

### 15.3 文本向量化 (Embeddings)
**POST** `/api/v1/ai/embeddings`

#### 请求参数
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `model` | string | 是 | 模型 ID。支持: text-embedding-v4, text-embedding-v3 |
| `input` | string | array<string> | 是 | 待向量化的文本。单条字符串或字符串数组（最多 2048 条）。每条最长 8192 tokens |
| `dimensions` | integer | 否 | 输出向量维度。text-embedding-v3/v4 支持 512/1024/2048，不设置则使用模型默认维度 |
| `encoding_format` | string | 否 | 返回向量格式。"float"（默认）, "base64" (默认: float) |
| `user` | string | 否 | 用户标识 |


#### 请求示例
```bash
curl -X POST https://your-gateway/api/v1/embeddings \
  -H "Authorization: Bearer sk-your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "text-embedding-v4",
    "input": ["Hello world", "你好世界"],
    "dimensions": 1024
  }'
```

#### 响应示例
```json
{
  "object": "list",
  "data": [
    {
      "object": "embedding",
      "index": 0,
      "embedding": [
        0.0023064255,
        -0.009327292,
        -0.0028842222
      ]
    }
  ],
  "model": "text-embedding-v3",
  "usage": {
    "prompt_tokens": 6,
    "total_tokens": 6
  }
}
```

### 15.4 图像生成 (Image Generations)
**POST** `/api/v1/ai/images/generations`

#### 请求参数
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `model` | string | 是 | 模型 ID。支持: qwen-image-2.0-pro, qwen-image-2.0, qwen-image-plus, wanx2.1-t2i-plus, wanx2.1-t2i-turbo |
| `prompt` | string | 是 | 图像生成提示词。详细描述想要的画面内容、风格、构图等。中文或英文均可 |
| `n` | integer | 否 | 生成图像数量。每次请求生成的图片张数，每张独立计费 (默认: 1) |
| `size` | string | 否 | 输出图像尺寸。可选: "1024x1024", "720x1280", "1280x720" 等。不同模型支持的尺寸不同 (默认: 1024x1024) |
| `response_format` | string | 否 | 返回格式。"url" 返回图片链接, "b64_json" 返回 Base64 编码 (默认: url) |
| `style` | string | 否 | 图像风格。部分模型支持，如 "<auto>" 自动选择 |
| `seed` | integer | 否 | 随机种子。相同种子 + 相同参数可复现相似结果 |
| `negative_prompt` | string | 否 | 反向提示词。描述不希望出现在画面中的元素。部分模型支持 |
| `ref_img` | string | 否 | 参考图片 URL。图生图时提供参考图像的地址。部分模型支持 |
| `strength` | float | 否 | 参考图影响强度。0~1，值越小越接近原图，值越大变化越大。配合 ref_img 使用 |
| `user` | string | 否 | 用户标识 |
| `vendor_params` | object | 否 | 厂商特有参数透传。JSON 对象，键值对会合并到请求参数中，用于传递网关未定义的厂商特有参数 |


#### 请求示例
```bash
curl -X POST https://your-gateway/api/v1/ai/images/generations \
  -H "Authorization: Bearer sk-your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen-image-2.0",
    "prompt": "A futuristic city skyline at sunset, cyberpunk style",
    "n": 1,
    "size": "1024x1024"
  }'
```

#### 响应示例
```json
{
  "created": 1589478378,
  "data": [
    {
      "url": "https://example.com/generated-image-url.png"
    }
  ]
}
```

### 15.5 视频生成 (Video Generations)
**POST** `/api/v1/ai/video/generations`

#### 请求参数
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `model` | string | 是 | 模型 ID。支持: wan2.7-t2v, wan2.6-i2v, wan2.6-i2v-flash, wanx2.1-t2v-turbo |
| `prompt` | string | 是 | 视频生成提示词（文生视频必填）。详细描述视频画面内容、运动、镜头等。中文或英文均可 |
| `img_url` | string | 否 | 首帧图片 URL（图生视频）。提供起始帧图片，模型基于此图片生成视频。与 first_frame_url 二选一 |
| `first_frame_url` | string | 否 | 首帧图片 URL（图生视频）。同 img_url，为兼容字段 |
| `last_frame_url` | string | 否 | 尾帧图片 URL（关键帧生视频）。与 first_frame_url 同时使用时为关键帧插值模式 |
| `ref_image_url` | string | 否 | 参考图片 URL。提供风格/内容参考图，模型参考其风格生成视频 |
| `ref_video_url` | string | 否 | 参考视频 URL（参考视频生成）。提供参考视频，模型基于其风格/运动生成新视频 |
| `video_url` | string | 否 | 输入视频 URL（视频编辑）。提供待编辑的原始视频 |
| `mask_url` | string | 否 | 遮罩图片 URL（视频编辑）。标记视频中需要编辑的区域，白色为编辑区域 |
| `driven_id` | string | 否 | 驱动 ID（数字人/口型同步）。部分模型支持的口型驱动标识 |
| `audio_url` | string | 否 | 输入音频 URL。用于口型同步或音频驱动视频生成 |
| `duration` | float | 是 | 视频时长（秒）。生成视频的总时长，不同模型支持范围不同。直接决定费用: 费用 = 单价 × duration |
| `resolution` | string | 否 | 输出分辨率。可选: "480p", "720p", "1080p"。部分模型不同分辨率价格不同 |
| `seed` | integer | 否 | 随机种子。相同种子 + 相同参数可复现相似结果 |
| `audio` | boolean | 否 | 是否生成带音频的视频。true 同时生成音轨，false 仅画面 |
| `mode` | string | 否 | 生成模式。可选: "standard"（标准）, "professional"（专业）。专业模式质量更高但更慢 |
| `prompt_extend` | boolean | 否 | 是否启用提示词扩展。true 时模型自动扩展和优化用户提示词 (默认: false) |
| `style_level` | string | 否 | 风格化程度。控制生成视频的风格化强度 |
| `aspect_ratio` | string | 否 | 宽高比。如 "16:9", "9:16", "1:1" 等。部分模型通过 size 参数控制 |
| `size` | string | 否 | 视频尺寸。如 "1280x720"。部分模型使用此参数而非 resolution |
| `vendor_params` | object | 否 | 厂商特有参数透传。JSON 对象，键值对会合并到请求参数中 |


#### 请求示例
```bash
curl -X POST https://your-gateway/api/v1/ai/video/generations \
  -H "Authorization: Bearer sk-your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "wan2.7-t2v",
    "prompt": "A beautiful scenery of rolling hills and a winding river.",
    "duration": 5.0
  }'
```

#### 响应示例
```json
{
  "request_id": "xxx-xxx-xxx",
  "output": {
    "task_id": "task-abc123",
    "task_status": "SUCCEEDED",
    "submit_time": "2026-04-06 10:00:00",
    "scheduled_time": "2026-04-06 10:00:01",
    "end_time": "2026-04-06 10:02:30",
    "video_url": "https://dashscope-result-bj.oss-cn-beijing.aliyuncs.com/xxx.mp4"
  },
  "usage": {
    "video_seconds": 5.0,
    "duration": 5.0
  }
}
```

### 15.6 语音合成 (Audio / TTS)
**POST** `/api/v1/ai/audio/speech`

#### 请求参数
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `model` | string | 是 | 模型 ID。TTS 支持: qwen3-tts-flash, cosyvoice-v2; ASR 支持: qwen3-asr-flash |
| `text` | string | 是 | 待合成的文本内容（TTS）。支持中英文混合，字符数直接决定费用: 费用 = 单价 × 字符数 / 10000 |
| `input` | string | 否 | 待合成文本（兼容字段）。与 text 等效，优先使用 text |
| `voice` | string | 否 | 音色选择。不同模型支持不同音色，如 "Cherry", "Serena" 等 (默认: 模型默认) |
| `speed` | float | 否 | 语速控制。0.5 ~ 2.0，1.0 为正常语速 (默认: 1.0) |
| `volume` | float | 否 | 音量控制。0 ~ 100，50 为正常音量 (默认: 50) |
| `pitch` | float | 否 | 音调控制。-12 ~ 12，0 为正常音调 (默认: 0) |
| `format` | string | 否 | 输出音频格式。可选: "mp3", "wav", "pcm", "opus" (默认: mp3) |
| `sample_rate` | integer | 否 | 采样率 (Hz)。可选: 8000, 16000, 22050, 24000, 44100, 48000 (默认: 22050) |
| `response_format` | string | 否 | 响应格式。"url" 返回音频链接, "b64_json" 返回 Base64 编码 (默认: url) |
| `seed` | integer | 否 | 随机种子。控制音色微调的随机性 |
| `vendor_params` | object | 否 | 厂商特有参数透传。JSON 对象，键值对会合并到请求参数中 |


#### 请求示例
```bash
curl -X POST https://your-gateway/api/v1/ai/audio/speech \
  -H "Authorization: Bearer sk-your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen3-tts-flash",
    "text": "Hello, how are you today?",
    "voice": "Cherry",
    "response_format": "url"
  }'
```

#### 响应示例 — 非流式（URL 模式）
```json
{
  "output": {
    "audio": "https://dashscope-result-bj.oss-cn-beijing.aliyuncs.com/xxx.mp3"
  },
  "usage": {
    "characters": 18
  },
  "request_id": "xxx-xxx-xxx"
}
```

#### 响应示例 — 流式（Base64 模式）
```
// 设置 "stream": true 时，以 SSE 格式逐步返回音频片段
// 每个事件包含 Base64 编码的 PCM 音频片段

data: {"output":{"audio":"\u0000\u0001..."},"usage":{"characters":0}}
data: {"output":{"audio":"\u0002\u0003..."},"usage":{"characters":0}}
...
data: {"output":{"audio":"\u00fe\u00ff..."},"usage":{"characters":18}}
```

#### 系统音色列表
| voice | 音色名 | 性别 | 描述 | 支持语种 | 支持模型 |
|-------|--------|------|------|----------|----------|
| `Cherry` | 芊悦 | 女 | 阳光积极、亲切自然小姐姐 | 中/英/法/德/俄/意/西/葡/日/韩 | 千问3-TTS-Flash, 千问3-TTS-Instruct-Flash, 千问-TTS |
| `Serena` | 苏瑶 | 女 | 温柔小姐姐 | 中/英/法/德/俄/意/西/葡/日/韩 | 千问3-TTS-Flash, 千问3-TTS-Instruct-Flash, 千问-TTS |
| `Ethan` | 晨煦 | 男 | 阳光温暖、活力朝气 | 中/英/法/德/俄/意/西/葡/日/韩 | 千问3-TTS-Flash, 千问3-TTS-Instruct-Flash, 千问-TTS |
| `Chelsie` | 千雪 | 女 | 二次元虚拟女友 | 中/英/法/德/俄/意/西/葡/日/韩 | 千问3-TTS-Flash, 千问3-TTS-Instruct-Flash, 千问-TTS |
| `Momo` | 茉兔 | 女 | 撒娇搞怪，逗你开心 | 中/英/法/德/俄/意/西/葡/日/韩 | 千问3-TTS-Flash, 千问3-TTS-Instruct-Flash |
| `Vivian` | 十三 | 女 | 拽拽的、可爱的小暴躁 | 中/英/法/德/俄/意/西/葡/日/韩 | 千问3-TTS-Flash, 千问3-TTS-Instruct-Flash |
| `Moon` | 月白 | 男 | 率性帅气 | 中/英/法/德/俄/意/西/葡/日/韩 | 千问3-TTS-Flash, 千问3-TTS-Instruct-Flash |
| `Maia` | 四月 | 女 | 知性与温柔的碰撞 | 中/英/法/德/俄/意/西/葡/日/韩 | 千问3-TTS-Flash, 千问3-TTS-Instruct-Flash |
| `Kai` | 凯 | 男 | 耳朵的一场SPA | 中/英/法/德/俄/意/西/葡/日/韩 | 千问3-TTS-Flash, 千问3-TTS-Instruct-Flash |
| `Nofish` | 不吃鱼 | 男 | 不会翘舌音的设计师 | 中/英/法/德/俄/意/西/葡/日/韩 | 千问3-TTS-Flash, 千问3-TTS-Instruct-Flash, 千问-TTS |
| `Bella` | 萌宝 | 女 | 喝酒不打醉拳的小萝莉 | 中/英/法/德/俄/意/西/葡/日/韩 | 千问3-TTS-Flash, 千问3-TTS-Instruct-Flash |
| `Jennifer` | 詹妮弗 | 女 | 品牌级、电影质感般美语女声 | 中/英/法/德/俄/意/西/葡/日/韩 | 千问3-TTS-Flash |
| `Ryan` | 甜茶 | 男 | 节奏拉满，戏感炸裂 | 中/英/法/德/俄/意/西/葡/日/韩 | 千问3-TTS-Flash |
| `Katerina` | 卡捷琳娜 | 女 | 御姐音色，韵律回味十足 | 中/英/法/德/俄/意/西/葡/日/韩 | 千问3-TTS-Flash |
| `Aiden` | 艾登 | 男 | 精通厨艺的美语大男孩 | 中/英/法/德/俄/意/西/葡/日/韩 | 千问3-TTS-Flash |
| `Eldric Sage` | 沧明子 | 男 | 沉稳睿智的老者，沧桑如松却心明如镜 | 中/英/法/德/俄/意/西/葡/日/韩 | 千问3-TTS-Flash, 千问3-TTS-Instruct-Flash |
| `Mia` | 乖小妹 | 女 | 温顺如春水，乖巧如初雪 | 中/英/法/德/俄/意/西/葡/日/韩 | 千问3-TTS-Flash, 千问3-TTS-Instruct-Flash |
| `Mochi` | 沙小弥 | 男 | 聪明伶俐的小大人，童真未泯却早慧如禅 | 中/英/法/德/俄/意/西/葡/日/韩 | 千问3-TTS-Flash, 千问3-TTS-Instruct-Flash |
| `Bellona` | 燕铮莺 | 女 | 声音洪亮，金戈铁马入梦来 | 中/英/法/德/俄/意/西/葡/日/韩 | 千问3-TTS-Flash, 千问3-TTS-Instruct-Flash |
| `Vincent` | 田叔 | 男 | 独特的沙哑烟嗓，江湖豪情 | 中/英/法/德/俄/意/西/葡/日/韩 | 千问3-TTS-Flash, 千问3-TTS-Instruct-Flash |
| `Bunny` | 萌小姬 | 女 | "萌属性"爆棚的小萝莉 | 中/英/法/德/俄/意/西/葡/日/韩 | 千问3-TTS-Flash, 千问3-TTS-Instruct-Flash |
| `Neil` | 阿闻 | 男 | 字正腔圆的专业新闻主持人 | 中/英/法/德/俄/意/西/葡/日/韩 | 千问3-TTS-Flash, 千问3-TTS-Instruct-Flash |
| `Elias` | 墨讲师 | 女 | 学科严谨性与叙事技巧并存 | 中/英/法/德/俄/意/西/葡/日/韩 | 千问3-TTS-Flash, 千问3-TTS-Instruct-Flash, 千问-TTS |
| `Arthur` | 徐大爷 | 男 | 被岁月和旱烟浸泡过的质朴嗓音 | 中/英/法/德/俄/意/西/葡/日/韩 | 千问3-TTS-Flash, 千问3-TTS-Instruct-Flash |
| `Nini` | 邻家妹妹 | 女 | 糯米糍一样又软又黏的嗓音 | 中/英/法/德/俄/意/西/葡/日/韩 | 千问3-TTS-Flash, 千问3-TTS-Instruct-Flash |
| `Seren` | 小婉 | 女 | 温和舒缓，助眠好梦 | 中/英/法/德/俄/意/西/葡/日/韩 | 千问3-TTS-Flash, 千问3-TTS-Instruct-Flash |
| `Pip` | 顽屁小孩 | 男 | 调皮捣蛋却充满童真 | 中/英/法/德/俄/意/西/葡/日/韩 | 千问3-TTS-Flash, 千问3-TTS-Instruct-Flash |
| `Stella` | 少女阿月 | 女 | 甜到发腻的迷糊少女音 | 中/英/法/德/俄/意/西/葡/日/韩 | 千问3-TTS-Flash, 千问3-TTS-Instruct-Flash |
| `Bodega` | 博德加 | 男 | 热情的西班牙大叔 | 中/英/法/德/俄/意/西/葡/日/韩 | 千问3-TTS-Flash |
| `Sonrisa` | 索尼莎 | 女 | 热情开朗的拉美大姐 | 中/英/法/德/俄/意/西/葡/日/韩 | 千问3-TTS-Flash |
| `Alek` | 阿列克 | 男 | 战斗民族的冷与毛呢大衣下的暖 | 中/英/法/德/俄/意/西/葡/日/韩 | 千问3-TTS-Flash |
| `Dolce` | 多尔切 | 男 | 慵懒的意大利大叔 | 中/英/法/德/俄/意/西/葡/日/韩 | 千问3-TTS-Flash |
| `Sohee` | 素熙 | 女 | 温柔开朗的韩国欧尼 | 中/英/法/德/俄/意/西/葡/日/韩 | 千问3-TTS-Flash |
| `Ono Anna` | 小野杏 | 女 | 鬼灵精怪的青梅竹马 | 中/英/法/德/俄/意/西/葡/日/韩 | 千问3-TTS-Flash |
| `Lenn` | 莱恩 | 男 | 理性是底色，叛逆藏在细节里 | 中/英/法/德/俄/意/西/葡/日/韩 | 千问3-TTS-Flash |
| `Emilien` | 埃米尔安 | 男 | 浪漫的法国大哥哥 | 中/英/法/德/俄/意/西/葡/日/韩 | 千问3-TTS-Flash |
| `Andre` | 安德雷 | 男 | 声音磁性，自然舒服、沉稳男生 | 中/英/法/德/俄/意/西/葡/日/韩 | 千问3-TTS-Flash |
| `Radio Gol` | 拉迪奥·戈尔 | 男 | 足球诗人，用名字解说足球 | 中/英/法/德/俄/意/西/葡/日/韩 | 千问3-TTS-Flash |
| `Jada` | 上海-阿珍 | 女 | 风风火火的沪上阿姐 | 上海话/英/法/德/俄/意/西/葡/日/韩 | 千问3-TTS-Flash, 千问-TTS |
| `Dylan` | 北京-晓东 | 男 | 北京胡同里长大的少年 | 北京话/英/法/德/俄/意/西/葡/日/韩 | 千问3-TTS-Flash, 千问-TTS |
| `Li` | 南京-老李 | 男 | 耐心的瑜伽老师 | 南京话/英/法/德/俄/意/西/葡/日/韩 | 千问3-TTS-Flash |
| `Marcus` | 陕西-秦川 | 男 | 面宽话短，心实声沉——老陕的味道 | 陕西话/英/法/德/俄/意/西/葡/日/韩 | 千问3-TTS-Flash |
| `Roy` | 闽南-阿杰 | 男 | 诙谐直爽、市井活泼的台湾哥仔 | 闽南语/英/法/德/俄/意/西/葡/日/韩 | 千问3-TTS-Flash |
| `Peter` | 天津-李彼得 | 男 | 天津相声，专业捧哏 | 天津话/英/法/德/俄/意/西/葡/日/韩 | 千问3-TTS-Flash |
| `Sunny` | 四川-晴儿 | 女 | 甜到你心里的川妹子 | 四川话/英/法/德/俄/意/西/葡/日/韩 | 千问3-TTS-Flash, 千问-TTS |
| `Eric` | 四川-程川 | 男 | 跳脱市井的四川成都男子 | 四川话/英/法/德/俄/意/西/葡/日/韩 | 千问3-TTS-Flash |
| `Rocky` | 粤语-阿强 | 男 | 幽默风趣的阿强，在线陪聊 | 粤语/英/法/德/俄/意/西/葡/日/韩 | 千问3-TTS-Flash |
| `Kiki` | 粤语-阿清 | 女 | 甜美的港妹闺蜜 | 粤语/英/法/德/俄/意/西/葡/日/韩 | 千问3-TTS-Flash |

### 15.7 多模态 (Multimodal / Vision)
**POST** `/api/v1/ai/chat/completions`

#### 请求参数
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `model` | string | 是 | 模型 ID。支持: qwen3-vl-plus, qwen3-vl-flash, qwen-vl-max, qwen-vl-plus, qwen-vl-ocr, qvq-max, qvq-plus, qwen-omni-turbo |
| `messages` | array<object> | 是 | 消息列表。支持文本和图片混合输入，格式同 Chat Completions，content 可为数组 |
| `stream` | boolean | 否 | 是否流式输出 (默认: false) |
| `temperature` | float | 否 | 生成随机性控制 [0, 2] (默认: 1) |
| `top_p` | float | 否 | 核采样阈值 (0, 1] (默认: 1) |
| `max_tokens` | integer | 否 | 最大生成 token 数 |
| `seed` | integer | 否 | 随机种子 |
| `user` | string | 否 | 用户标识 |

#### messages 中 content 数组元素的字段
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `type` | string | 是 | 内容类型。"text" 文本, "image_url" 图片, "video_url" 视频 (部分模型) |
| `text` | string | 否 | 文本内容（type=text 时） |
| `image_url` | object | 否 | 图片对象（type=image_url 时）。格式: {"url": "https://..."} 或 {"url": "data:image/jpeg;base64,..."} |


#### 请求示例
```bash
curl -X POST https://your-gateway/api/v1/ai/chat/completions \
  -H "Authorization: Bearer sk-your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen-vl-plus",
    "messages": [
      {
        "role": "user",
        "content": [
          {"type": "text", "text": "What is in this image?"},
          {"type": "image_url", "image_url": {"url": "https://example.com/image.png"}}
        ]
      }
    ]
  }'
```

#### 响应示例
```json
{
  "id": "chatcmpl-456",
  "object": "chat.completion",
  "created": 1677652289,
  "model": "qwen-vl-plus",
  "choices": [{
    "index": 0,
    "message": {
      "role": "assistant",
      "content": "This is a beautiful image of a sunset."
    },
    "finish_reason": "stop"
  }],
  "usage": {
    "prompt_tokens": 12,
    "completion_tokens": 10,
    "total_tokens": 22
  }
}
```

### 15.8 文本重排 (Rerank)
**POST** `/api/v1/ai/rerank`

#### 请求参数
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `model` | string | 是 | 模型 ID。支持: gte-rerank-v2 |
| `query` | string | 是 | 查询文本。用于对文档列表进行相关性排序的基准查询 |
| `documents` | array<string> | 是 | 待排序文档列表。字符串数组，每个元素为一个文档内容。最多 1000 条 |
| `top_n` | integer | 否 | 返回排序最高的 N 个文档。不设置则返回全部文档的排序结果 (默认: 全部) |
| `return_documents` | boolean | 否 | 是否在结果中返回文档原文。true 时每个结果包含 document 字段 (默认: false) |
| `max_chunks_per_doc` | integer | 否 | 每个文档最大分块数。控制长文档的处理粒度 (默认: 1) |


#### 请求示例
```bash
curl -X POST https://your-gateway/api/v1/ai/rerank \
  -H "Authorization: Bearer sk-your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gte-rerank-v2",
    "query": "What is the capital of France?",
    "documents": [
      "Paris is the capital of France.",
      "Berlin is the capital of Germany."
    ]
  }'
```

#### 响应示例
```json
{
  "results": [
    {
      "index": 0,
      "relevance_score": 0.98
    },
    {
      "index": 1,
      "relevance_score": 0.02
    }
  ]
}
```

### 15.9 模型列表
**GET** `/api/v1/ai/models`

查询当前网关支持的所有可用模型。支持 `?modality=text` 等参数筛选。

#### 请求示例

```bash
curl -X GET "https://your-gateway/api/v1/ai/models?modality=text" \
  -H "Authorization: Bearer sk-your-api-key"
```

#### 响应示例

```json
{
  "object": "list",
  "data": [
    {
      "id": "qwen3.5-plus",
      "object": "model",
      "owned_by": "alibaba",
      "modality": "text"
    },
    {
      "id": "deepseek-r1",
      "object": "model",
      "owned_by": "deepseek",
      "modality": "text"
    }
  ]
}
```

### 15.10 余额查询
**GET** `/api/v1/ai/balance`

#### 请求示例

```bash
curl -X GET https://your-gateway/api/v1/ai/balance \
  -H "Authorization: Bearer sk-your-api-key"
```

#### 响应示例

```json
{
  "balance": 98.50,
  "currency": "CNY",
  "updatedAt": "2026-04-06T15:00:00.000Z"
}
```

### 15.11 记录查询
#### 账单列表
**GET** `/api/v1/ai/bills`

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `page` | integer | 否 | 页码 (默认: 1) |
| `page_size` | integer | 否 | 每页条数，最大 100 (默认: 20) |
| `bill_type` | string | 否 | 筛选类型: reserve（预扣）, consume（消费）, refund（退还）, settle（结算） |
| `model_id` | string | 否 | 按模型 ID 筛选 |
| `modality` | string | 否 | 按模态筛选: text, image, video, audio, embedding, rerank, multimodal |
| `start` | datetime | 否 | 起始时间，ISO 8601 格式（如 2025-01-01T00:00:00） |
| `end` | datetime | 否 | 结束时间，ISO 8601 格式 |

#### 请求示例

```bash
curl -X GET "https://your-gateway/api/v1/ai/bills?page=1&page_size=10&bill_type=consume" \
  -H "Authorization: Bearer sk-your-api-key"
```

#### 响应示例

```json
{
  "data": {
    "list": [
      {
        "order_id": "bill_001",
        "bill_type": "consume",
        "model_id": "qwen3.5-plus",
        "modality": "text",
        "amount": 0.02,
        "input_tokens": 100,
        "output_tokens": 50,
        "created_at": "2026-04-06T14:00:00.000Z"
      }
    ],
    "pagination": { "page": 1, "page_size": 10, "total": 1 }
  }
}
```

---

## 16. 文件上传 Upload

**基础路径**：`/api/v1/upload`

### 16.1 预签名

```http
POST /api/v1/upload/presigned
Authorization: Bearer {token}
Content-Type: application/json

{
  "filename": "image.jpg",
  "contentType": "image/jpeg",
  "directory": "characters"
}
```

#### 响应参数

| 字段 | 类型 | 说明 |
|------|------|------|
| uploadUrl | string | 预签名上传地址（PUT） |
| accessUrl | string | 上传成功后的访问地址 |
| expiresIn | number | 签名有效期（秒） |

#### 响应示例

```json
{
  "code": 0,
  "data": {
    "uploadUrl": "https://oss.example.com/upload?sign=xxx&expires=1800",
    "accessUrl": "https://cdn.example.com/characters/image_abc123.jpg",
    "expiresIn": 1800
  }
}
```

### 16.2 确认

```http
POST /api/v1/upload/confirm
Authorization: Bearer {token}
Content-Type: application/json

{
  "accessUrl": "https://cdn...",
  "directory": "characters",
  "relatedId": "1"
}
```

#### 响应示例

```json
{
  "code": 0,
  "data": {
    "accessUrl": "https://cdn.example.com/characters/image_abc123.jpg",
    "confirmed": true
  }
}
```

---

## 17. 积分与流水 Credits & Ledger

**用户余额**：`users.credits`（INT，非负）  
**流水表**：`billing_ledger`

### 17.1 余额

```http
GET /api/v1/credits
Authorization: Bearer {token}
```

#### 响应示例

```json
{
  "code": 0,
  "data": {
    "balance": 500,
    "totalEarned": 1000,
    "totalUsed": 500
  }
}
```

### 17.2 流水列表

```http
GET /api/v1/credits/history?page=1&size=20&entryType=consume
Authorization: Bearer {token}
```

**列表项与 `billing_ledger` 对齐**：

| 字段 | 说明 |
|------|------|
| id | BIGINT |
| entryType | `consume` \| `purchase` \| `refund` \| `allocate` \| `adjust` \| `earn` |
| amount | 整数，扣费为负，入账为正 |
| balanceAfter | 对应 `balance_after` |
| description | 摘要 |
| referenceType | 如 `ai_generation`、`order`、`admin` |
| referenceId | 字符串 |
| metadata | JSON |
| organizationId, projectId | 可选 |
| createdAt | 记账时间 |

**废弃**：旧文档中 `type: use | earn | purchase` 与库不一致，**以 `entryType` 为准**。

#### 响应示例

```json
{
  "code": 0,
  "data": {
    "list": [
      {
        "id": 1001,
        "entryType": "consume",
        "amount": -10,
        "balanceAfter": 490,
        "description": "AI 图像生成",
        "referenceType": "ai_generation",
        "referenceId": "550e8400-e29b-41d4-a716-446655440000",
        "metadata": {},
        "organizationId": 1,
        "projectId": 101,
        "createdAt": "2026-04-06T12:00:30.000Z"
      }
    ],
    "pagination": { "page": 1, "size": 20, "total": 1 }
  }
}
```

---

## 18. 计费额度 Billing

**基础路径**：`/api/v1/billing`  

额度单位与积分体系统一；各级 **`quotaPercent`**（0–100，小数与 `DECIMAL(7,4)` 一致）、**`quotaLimit`**、**`quotaConsumed`**。

### 18.1 企业总额度

```http
GET /api/v1/billing/enterprise/quota
PUT /api/v1/billing/enterprise/quota
```

**PUT** 仅超级管理员；Body：`{ "quotaTotal": 10000000 }`  
**数据**：`billing_enterprise_quota`（固定 `id=1`）。

#### 请求示例（PUT）

```bash
curl -X PUT https://your-api/api/v1/billing/enterprise/quota \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{"quotaTotal": 10000000}'
```

#### 响应示例（GET）

```json
{
  "code": 0,
  "data": {
    "id": 1,
    "quotaTotal": 10000000,
    "quotaConsumed": 2500000,
    "updatedAt": "2026-04-06T08:00:00.000Z"
  }
}
```

### 18.2 组织额度

```http
GET /api/v1/billing/organizations/{organizationId}/quota
PUT /api/v1/billing/organizations/{organizationId}/quota
```

**PUT** 仅超级管理员；Body：`quotaPercent`、`quotaLimit`（可只提交其一，由服务端推算）。

#### 响应示例

```json
{
  "code": 0,
  "data": {
    "organizationId": 1,
    "quotaPercent": 30.0000,
    "quotaLimit": 3000000,
    "quotaConsumed": 800000,
    "updatedAt": "2026-04-06T09:00:00.000Z"
  }
}
```

### 18.3 项目额度

```http
GET /api/v1/billing/projects/{projectId}/quota
PUT /api/v1/billing/projects/{projectId}/quota
```

**PUT**：超级管理员或本组织管理员（与原文档一致）。

#### 响应示例

```json
{
  "code": 0,
  "data": {
    "projectId": 101,
    "quotaPercent": 15.0000,
    "quotaLimit": 450000,
    "quotaConsumed": 120000,
    "updatedAt": "2026-04-06T10:00:00.000Z"
  }
}
```

### 18.4 员工在项目内额度

```http
GET /api/v1/billing/projects/{projectId}/users/{userId}/quota
PUT /api/v1/billing/projects/{projectId}/users/{userId}/quota
```

#### 响应示例

```json
{
  "code": 0,
  "data": {
    "projectId": 101,
    "userId": 10002,
    "quotaPercent": 5.0000,
    "quotaLimit": 22500,
    "quotaConsumed": 3000,
    "updatedAt": "2026-04-06T11:00:00.000Z"
  }
}
```

---

## 19. 数据结构 TypeScript

以下与 **API JSON（camelCase）** 及 **schema.sql** 一致。

### 19.1 Organization

```typescript
interface Organization {
  id: number;
  name: string;
  createdBy?: number;
  createdAt: string;
  updatedAt: string;
}
```

### 19.2 User & SystemRole

```typescript
interface SystemRole {
  id: number;
  code: 'super_admin' | 'admin' | 'employee' | string;
  name: string;
}

interface User {
  id: number;
  roleId: number;
  role?: SystemRole;
  organizationIds?: number[];
  username: string;
  email: string;
  avatar: string | null;
  credits: number;
  createdAt: string;
  updatedAt: string;
}
```

### 19.3 Project

```typescript
interface Project {
  id: number;
  organizationId: number;
  name: string;
  description: string;
  coverImage: string | null;
  status: 'draft' | 'in-progress' | 'completed';
  isPublic: boolean;
  ownerId: number;
  members?: ProjectMember[];
  stats?: ProjectStats;
  createdAt: string;
  updatedAt: string;
}

interface ProjectMember {
  organizationId: number;
  userId: number;
  role: 'owner' | 'editor' | 'viewer';
  assignedBy?: number | null;
  joinedAt: string;
}

interface ProjectStats {
  episodeCount: number;
  sceneCount: number;
  characterCount: number;
  objectCount: number;
  totalDuration: number;
}
```

### 19.4 Character / Scene / Object / Episode（含库扩展字段）

```typescript
type CreationMode = 'quick' | 'workflow';

interface Character {
  id: number;
  organizationId: number;
  projectId: number;
  creationMode: CreationMode;
  sourceWorkflowId: string | null;
  sourceNodeId: string | null;
  name: string;
  role: 'main' | 'support';
  gender: 'male' | 'female' | 'other';
  ageGroup: 'child' | 'teen' | 'young' | 'middle' | 'old';
  style: string | null;
  description: string | null;
  avatar: string | null;
  referenceImages: string[];
  modelId: string | null;
  seed: string | null;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

interface Scene {
  id: number;
  organizationId: number;
  projectId: number;
  creationMode: CreationMode;
  sourceWorkflowId: string | null;
  sourceNodeId: string | null;
  name: string;
  description: string | null;
  image: string | null;
  status: 'draft' | 'in-use';
  genMethod: 'model' | 'upload' | 'angle' | 'custom';
  modelId: string | null;
  style: string | null;
  camera: CameraParams;
  referenceImages: string[];
  seed: string | null;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

interface CameraParams {
  shotType: 'close' | 'medium' | 'wide';
  distance: number;
  horizontal: number;
  vertical: number;
}

interface ObjectItem {
  id: number;
  organizationId: number;
  projectId: number;
  sceneId: number | null;
  creationMode: CreationMode;
  sourceWorkflowId: string | null;
  sourceNodeId: string | null;
  name: string;
  type: 'weapon' | 'prop' | 'clothing' | 'decoration';
  description: string | null;
  image: string | null;
  status: 'draft' | 'in-use';
  genMethod: string;
  referenceImages: string[];
  createdAt: string;
  updatedAt: string;
}

interface Episode {
  id: number;
  organizationId: number;
  projectId: number;
  creationMode: CreationMode;
  sourceWorkflowId: string | null;
  sourceNodeId: string | null;
  name: string;
  code: string;
  description: string | null;
  status: 'draft' | 'in-progress' | 'completed';
  progress: number;
  duration: number;
  sceneCount?: number;
  characters?: Character[];
  scenes?: Scene[];
  objects?: ObjectItem[];
  createdAt: string;
  updatedAt: string;
}
```

### 19.5 Canvas（简型）

```typescript
interface CanvasWorkflow {
  id: string;
  organizationId: number;
  projectId: number;
  name: string;
  thumbnail: string | null;
  sourceType: string;
  canvasData: {
    nodes: unknown[];
    edges: unknown[];
    viewport: { x: number; y: number; zoom: number };
  };
  createdAt: string;
  updatedAt: string;
}
```

### 19.6 ProjectAsset

```typescript
type ProjectAssetSourceType =
  | 'workflow'
  | 'workflow_node'
  | 'character'
  | 'scene'
  | 'project_object'
  | 'episode';

interface ProjectAsset {
  id: number;
  organizationId: number;
  projectId: number;
  name: string | null;
  sourceType: ProjectAssetSourceType;
  sourceId: string;
  prompt: string | null;
  url: string | null;
  metadata: Record<string, unknown>;
  createdBy?: number | null;
  createdAt: string;
  updatedAt: string;
}
```

### 19.7 BillingLedger（积分流水）

```typescript
type BillingEntryType =
  | 'consume'
  | 'purchase'
  | 'refund'
  | 'allocate'
  | 'adjust'
  | 'earn';

interface BillingLedgerEntry {
  id: number;
  organizationId: number | null;
  projectId: number | null;
  userId: number;
  entryType: BillingEntryType;
  amount: number;
  balanceAfter: number | null;
  description: string | null;
  referenceType: string | null;
  referenceId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}
```

### 19.8 额度（同前版 §4.8）

`BillingEnterpriseQuota`、`BillingOrganizationQuota`、`BillingProjectQuota`、`BillingUserProjectQuota` 字段与 **§18** 及库表一致，此处不重复。

---

## 20. 错误码

| code | 说明 | HTTP |
|------|------|------|
| 0 | 成功 | 200 |
| 1001 | 参数错误 | 400 |
| 1002 | 未授权 | 401 |
| 1003 | 禁止访问 | 403 |
| 1004 | 资源不存在 | 404 |
| 1005 | 资源冲突 | 409 |
| 2001 | 用户已存在 | 409 |
| 2002 | 邮箱或密码错误 | 401 |
| 2003 | 积分不足 | 402 |
| 2004 | 额度不足（组织/项目/员工） | 402 |
| 3001 | 生成任务失败 | 500 |
| 3002 | 队列已满 | 429 |
| 9999 | 服务器内部错误 | 500 |

**错误体**：

```json
{
  "code": 1001,
  "message": "参数错误：name 不能为空",
  "data": null
}
```

---

## 21. 实现说明

### 21.1 与 DDL 一致性强约束

- **`characters` / `scenes` / `project_objects` / `episodes`**：`creation_mode` 与 `source_workflow_id` / `source_node_id` 须满足 CHECK；接口层校验失败返回 **400**。  
- **`episodes.code`**：同 `project_id` 唯一；冲突 **409**。  
- **`billing_ledger.amount`** 与 **`users.credits`**、各级 **`quota_consumed`** 的一致性由**应用层事务**保证。  
- **`canvas_workflows.id`** 为字符串主键；节点/边通过 `workflow_id` 级联删除。

### 21.2 文档与前端

单条画布 JSON 结构与 **`docs/canvas.json`** 对齐；数据库分表存储见 **`docs/DATABASE_ARCHITECTURE.md`**（若存在）。

### 21.3 AI 与存储

异步生成、OSS、WebSocket 推送等仍建议按负载与产品分阶段落地；**未建表**的生成任务不影响本接口路径约定。

---

*本文档替代 v1.0 中与 `schema.sql` 不一致的示例（如主键写为 uuid、流水类型与 `billing_ledger` 不一致等）。*
