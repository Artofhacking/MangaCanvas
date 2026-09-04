# 前端接口需求文档

> 本文档列出前端当前**缺失或需要改进**的接口，供后端开发参考。
> 
> **主接口文档**: [`BACKEND_API_SPEC_V2.md`](./BACKEND_API_SPEC_V2.md)

---

## 🔴 高优先级（阻塞功能）

### 1. 通过邮箱邀请项目成员

**当前问题**：
- 前端 UI 是"输入邮箱邀请成员"
- 但现有接口 `POST /projects/{id}/members` 只接受 `userId: number`
- 用户不知道对方的 userId

**需要的接口**：

```http
# 方案A：邮箱查询用户（推荐）
GET /api/v1/users?email=user@example.com
Authorization: Bearer {token}

# 响应
{
  "code": 0,
  "data": {
    "id": 10001,
    "username": "zhangsan",
    "email": "user@example.com",
    "avatar": "..."
  }
}
```

```http
# 方案B：添加成员接口支持邮箱
POST /api/v1/projects/{projectId}/members
Authorization: Bearer {token}
Content-Type: application/json

{
  "email": "user@example.com",  // 与 userId 二选一
  "role": "editor"
}

# 或
{
  "userId": 10001,
  "role": "editor"
}
```

**相关页面**: `src/pages/Members.tsx`

---

### 2. 片段关联管理

**需要的接口**：

```http
PATCH /api/v1/projects/{projectId}/episodes/{episodeId}/relations
Authorization: Bearer {token}
Content-Type: application/json

{
  "characterIds": [1, 2, 3],
  "sceneIds": [4, 5],
  "objectIds": [6]
}
```

**说明**：
- 用于片段详情页关联角色/场景/物品
- 创建片段时虽然支持传这些 ID，但需要单独的更新关联接口

**相关页面**: 片段详情页（待开发）

---

## 🟠 中优先级（功能完善）

### 3. 积分系统

```http
# 获取当前用户积分余额
GET /api/v1/credits
Authorization: Bearer {token}

# 响应
{
  "code": 0,
  "data": {
    "credits": 500,
    "frozenCredits": 50  // 冻结中（进行中的任务）
  }
}
```

```http
# 获取积分流水
GET /api/v1/credits/history?page=1&size=20&entryType=consume
Authorization: Bearer {token}

# 响应
{
  "code": 0,
  "data": {
    "list": [
      {
        "id": 1,
        "entryType": "consume",  // consume/recharge/refund
        "amount": -10,
        "balance": 490,
        "description": "图像生成",
        "referenceType": "image_generation",
        "referenceId": "task_xxx",
        "createdAt": "2026-04-12T10:00:00.000Z"
      }
    ],
    "pagination": { "page": 1, "size": 20, "total": 100 }
  }
}
```

**说明**：
- 需要在生成 AI 内容前检查余额
- 显示积分消耗历史

**相关页面**: 全局 Header（显示积分）、画布页面（生成前检查）

---

### 4. 项目资产完整 CRUD

**当前状态**：只对接了 `GET /assets`（列表）

**需要的接口**：

```http
# 登记资产（画布生成的图片保存到资产库）
POST /api/v1/projects/{projectId}/assets
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "角色立绘-蓝发少女",
  "sourceType": "workflow",           // workflow/workflow_node/character/scene/project_object/episode
  "sourceId": "workflow_a1b2c3",      // 关联的工作流ID
  "prompt": "蓝色长发少女，赛博朋克风格",
  "url": "https://cdn.xxx.com/xxx.png"
}
```

```http
# 获取资产详情
GET /api/v1/projects/{projectId}/assets/{assetId}
```

```http
# 更新资产信息
PUT /api/v1/projects/{projectId}/assets/{assetId}
{
  "name": "新名称",
  "prompt": "更新后的提示词"
}
```

```http
# 删除资产
DELETE /api/v1/projects/{projectId}/assets/{assetId}
```

**说明**：
- 画布生成的图片可以保存到素材库
- 素材库支持查看、重命名、删除
- 其他场景可以引用素材库中的资源

**相关页面**: 资产库页面、画布页面（保存到素材库）

---

### 5. 项目复制

```http
POST /api/v1/projects/{projectId}/duplicate
Authorization: Bearer {token}

# 可选参数
{
  "name": "副本名称",           // 不传则默认"原名称 (副本)"
  "includeAssets": true,        // 是否复制资产
  "includeEpisodes": true       // 是否复制片段
}

# 响应
{
  "code": 0,
  "data": {
    "id": 102,
    "name": "幻想冒险漫剧 (副本)",
    ...
  }
}
```

**相关页面**: Dashboard 项目卡片操作菜单

---

### 6. 组织管理（如需要多组织支持）

```http
# 创建组织
POST /api/v1/organizations
{
  "name": "漫画工作室A",
  "description": "..."
}

# 组织列表
GET /api/v1/organizations?page=1&size=20

# 组织详情
GET /api/v1/organizations/{organizationId}

# 添加成员（通过邮箱或用户ID）
POST /api/v1/organizations/{organizationId}/members
{
  "email": "user@example.com",  // 或 userId
  "role": "member"              // member/admin
}

# 移除成员
DELETE /api/v1/organizations/{organizationId}/members/{userId}

# 我的组织列表
GET /api/v1/users/me/organizations
```

**说明**：
- 如果产品是单组织/个人版，这些可以延后

**相关页面**: 组织管理页面（待设计）

---

## 🟡 低优先级（辅助功能）

### 7. 健康检查

```http
GET /api/v1/health
# 无需认证

# 响应
{
  "code": 0,
  "data": {
    "status": "ok",
    "timestamp": 1712486400123
  }
}
```

**说明**：
- 用于负载均衡健康检查
- 前端可用于检测服务可用性

---

### 8. OAuth 登录

```http
# 获取第三方登录 URL
GET /api/v1/auth/oauth/{provider}/url?redirect_uri=...
# provider: wechat/dingtalk/github

# 响应
{
  "code": 0,
  "data": {
    "url": "https://open.weixin.qq.com/..."
  }
}

# OAuth 回调
POST /api/v1/auth/oauth/{provider}/callback
{
  "code": "授权码",
  "state": "..."
}

# 响应（与普通登录相同）
{
  "code": 0,
  "data": {
    "user": { ... },
    "token": "...",
    "refreshToken": "..."
  }
}
```

**相关页面**: 登录页面

---

### 9. 计费额度（企业级功能）

如需要企业/组织的额度管理：

```http
# 查询额度
GET /api/v1/billing/enterprise/quota
GET /api/v1/billing/organizations/{id}/quota
GET /api/v1/billing/projects/{id}/quota
GET /api/v1/billing/projects/{id}/users/{userId}/quota

# 更新额度（管理员）
PUT /api/v1/billing/enterprise/quota
PUT /api/v1/billing/organizations/{id}/quota
...
```

**说明**：
- 企业级功能，个人版可暂不实现

---

## 📋 汇总

| 优先级 | 接口 | 状态 | 阻塞功能 |
|--------|------|------|----------|
| 🔴 | 邮箱查询用户 / 邮箱邀请 | **未实现** | 成员邀请 |
| 🔴 | 片段关联管理 | **未实现** | 片段详情 |
| 🟠 | 积分余额/流水 | **未实现** | AI 生成限制 |
| 🟠 | 资产登记/更新/删除 | **未实现** | 素材库管理 |
| 🟠 | 项目复制 | **未实现** | Dashboard |
| 🟠 | 组织管理 | **未实现** | 多组织支持 |
| 🟡 | 健康检查 | **未实现** | - |
| 🟡 | OAuth 登录 | **未实现** | 第三方登录 |
| 🟡 | 计费额度 | **未实现** | 企业管理 |

---

## 💬 备注

1. **AI 网关**: 当前前端直接调用 DashScope，后续可考虑走后端网关统一鉴权和计费
2. **WebSocket**: 如需实时通知（如生成完成推送），需要 WebSocket 支持
3. **文件上传**: 已对接预签名上传，工作正常

---

**文档维护**: 前端团队  
**最后更新**: 2026-04-12
