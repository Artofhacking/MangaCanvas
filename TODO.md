# MangaCanvas 待办清单

> 当前状态：**API 已大量对接**，剩余 16 个接口待接入。
> 
> **后端开发请参考**: [`BACKEND_API_SPEC_V2.md`](./BACKEND_API_SPEC_V2.md)

---

## 📊 接口对接统计（共 66 个接口）

| 模块 | 已对接 | 未对接 | 总计 |
|------|--------|--------|------|
| Health | 0 | 1 | 1 |
| Auth | 4 | 1 (OAuth) | 5 |
| Organizations | 0 | 6 | 6 |
| Users | 0 | 1 | 1 |
| Projects | 5 | 1 (复制) | 6 |
| Project Members | 4 | 0 | 4 |
| Characters | 5 | 0 | 5 |
| Scenes | 5 | 0 | 5 |
| Objects | 5 | 0 | 5 |
| Episodes | 5 | 1 (关联) | 6 |
| Workflows | 9 | 0 | 9 |
| Assets | 1 | 3 | 4 |
| Upload | 3 | 0 | 3 |
| AI Gateway | 1 | 0* | 1* |
| Credits | 0 | 2 | 2 |
| Billing | 0 | 8 | 8 |
| **总计** | **50** | **16** | **66** |

> *注：AI Gateway 目前直接调用 DashScope，未走后端网关。

---

## 🔴 P0 — 核心阻塞

### 1. 片段关联管理
- [ ] `PATCH /api/v1/projects/{projectId}/episodes/{episodeId}/relations` - 更新片段关联（角色/场景/物品）

---

## 🟠 P1 — 重要功能

### 2. 项目资产补充（3个接口）
- [ ] `POST /api/v1/projects/{projectId}/assets` - 登记资产
- [ ] `GET /api/v1/projects/{projectId}/assets/{assetId}` - 获取资产详情
- [ ] `PUT /api/v1/projects/{projectId}/assets/{assetId}` - 更新资产
- [ ] `DELETE /api/v1/projects/{projectId}/assets/{assetId}` - 删除资产

### 3. 项目管理补充
- [ ] `POST /api/v1/projects/{projectId}/duplicate` - 复制项目

### 4. 组织管理模块（6个接口）
- [ ] `POST /api/v1/organizations` - 创建组织
- [ ] `GET /api/v1/organizations` - 组织列表
- [ ] `GET /api/v1/organizations/{organizationId}` - 组织详情
- [ ] `POST /api/v1/organizations/{organizationId}/members` - 添加成员
- [ ] `DELETE /api/v1/organizations/{organizationId}/members/{userId}` - 移除成员
- [ ] `GET /api/v1/users/me/organizations` - 我的组织列表

---

## 🟡 P2 — 辅助功能

### 5. 认证补充
- [ ] `POST /api/v1/auth/oauth/{provider}` - OAuth 登录
- [ ] `GET /api/v1/health` - 健康检查

### 6. 积分系统（2个接口）
- [ ] `GET /api/v1/credits` - 积分余额
- [ ] `GET /api/v1/credits/history` - 积分流水

### 7. 计费额度（8个接口）
- [ ] `GET /api/v1/billing/enterprise/quota` - 企业额度
- [ ] `PUT /api/v1/billing/enterprise/quota` - 更新企业额度
- [ ] `GET /api/v1/billing/organizations/{organizationId}/quota` - 组织额度
- [ ] `PUT /api/v1/billing/organizations/{organizationId}/quota` - 更新组织额度
- [ ] `GET /api/v1/billing/projects/{projectId}/quota` - 项目额度
- [ ] `PUT /api/v1/billing/projects/{projectId}/quota` - 更新项目额度
- [ ] `GET /api/v1/billing/projects/{projectId}/users/{userId}/quota` - 用户项目额度
- [ ] `PUT /api/v1/billing/projects/{projectId}/users/{userId}/quota` - 更新用户项目额度

---

## 🟢 P3 — 体验优化

### 8. Dashboard 功能补全
- [ ] 项目卡片更多操作（DropdownMenu：重命名、删除、复制）
- [ ] 侧边栏导航高亮（仪表盘/项目当前页高亮）
- [ ] 侧边栏其他页面壳（资源 / 团队 / 设置 / 分析）

### 9. 认证系统
- [ ] Header 根据登录状态显示用户头像

### 10. 首页交互
- [ ] 场景编排卡片点击跳转 `/dashboard`

---

## ✅ 已对接接口清单（50个）

### 认证 Auth（4个）
- [x] `POST /api/v1/auth/register` - 注册
- [x] `POST /api/v1/auth/login` - 登录
- [x] `POST /api/v1/auth/refresh` - 刷新 Token
- [x] `GET /api/v1/auth/me` - 当前用户

### 项目 Projects（5个）
- [x] `POST /api/v1/projects` - 创建项目
- [x] `GET /api/v1/projects` - 项目列表
- [x] `GET /api/v1/projects/{projectId}` - 项目详情
- [x] `PUT /api/v1/projects/{projectId}` - 更新项目
- [x] `DELETE /api/v1/projects/{projectId}` - 删除项目

### 项目成员 Project Members（4个）
- [x] `GET /api/v1/projects/{projectId}/members` - 成员列表
- [x] `POST /api/v1/projects/{projectId}/members` - 添加成员
- [x] `PATCH /api/v1/projects/{projectId}/members/{userId}` - 更新成员角色
- [x] `DELETE /api/v1/projects/{projectId}/members/{userId}` - 移除成员

### 角色 Characters（5个）
- [x] `GET /api/v1/projects/{projectId}/characters` - 角色列表
- [x] `POST /api/v1/projects/{projectId}/characters` - 创建角色
- [x] `GET /api/v1/projects/{projectId}/characters/{characterId}` - 角色详情
- [x] `PUT /api/v1/projects/{projectId}/characters/{characterId}` - 更新角色
- [x] `DELETE /api/v1/projects/{projectId}/characters/{characterId}` - 删除角色

### 场景 Scenes（5个）
- [x] `GET /api/v1/projects/{projectId}/scenes` - 场景列表
- [x] `POST /api/v1/projects/{projectId}/scenes` - 创建场景
- [x] `GET /api/v1/projects/{projectId}/scenes/{sceneId}` - 场景详情
- [x] `PUT /api/v1/projects/{projectId}/scenes/{sceneId}` - 更新场景
- [x] `DELETE /api/v1/projects/{projectId}/scenes/{sceneId}` - 删除场景

### 物品 Objects（5个）
- [x] `GET /api/v1/projects/{projectId}/objects` - 物品列表
- [x] `POST /api/v1/projects/{projectId}/objects` - 创建物品
- [x] `GET /api/v1/projects/{projectId}/objects/{objectId}` - 物品详情
- [x] `PUT /api/v1/projects/{projectId}/objects/{objectId}` - 更新物品
- [x] `DELETE /api/v1/projects/{projectId}/objects/{objectId}` - 删除物品

### 片段 Episodes（5个）
- [x] `GET /api/v1/projects/{projectId}/episodes` - 片段列表
- [x] `POST /api/v1/projects/{projectId}/episodes` - 创建片段
- [x] `GET /api/v1/projects/{projectId}/episodes/{episodeId}` - 片段详情
- [x] `PUT /api/v1/projects/{projectId}/episodes/{episodeId}` - 更新片段
- [x] `DELETE /api/v1/projects/{projectId}/episodes/{episodeId}` - 删除片段

### 画布工作流 Canvas Workflows（9个）
- [x] `GET /api/v1/projects/{projectId}/canvas-workflows` - 工作流列表
- [x] `POST /api/v1/projects/{projectId}/canvas-workflows` - 创建工作流
- [x] `GET /api/v1/projects/{projectId}/canvas-workflows/{workflowId}` - 工作流详情
- [x] `PUT /api/v1/projects/{projectId}/canvas-workflows/{workflowId}` - 更新工作流
- [x] `DELETE /api/v1/projects/{projectId}/canvas-workflows/{workflowId}` - 删除工作流
- [x] `GET /api/v1/projects/{projectId}/canvas-workflows/{workflowId}/members` - 获取工作流成员
- [x] `POST /api/v1/projects/{projectId}/canvas-workflows/{workflowId}/members` - 添加工作流成员
- [x] `PATCH /api/v1/projects/{projectId}/canvas-workflows/{workflowId}/members/{userId}` - 更新成员角色
- [x] `DELETE /api/v1/projects/{projectId}/canvas-workflows/{workflowId}/members/{userId}` - 移除工作流成员

### 项目资产 Assets（1个）
- [x] `GET /api/v1/projects/{projectId}/assets` - 资产列表

### 文件上传 Upload（3个）
- [x] `POST /api/v1/upload/presigned` - 预签名上传 URL
- [x] `POST /api/v1/upload/confirm` - 上传完成确认
- [x] `GET /api/v1/upload/files` - 文件列表

### AI 图像生成（1个）
- [x] `POST /api/v1/ai/images/generations` - 图像生成

---

## 📝 更新日志

### 2026-04-12
- 重新梳理所有接口，基于 `BACKEND_API_SPEC_V2.md` 完整统计
- 更新接口对接统计：已对接 50 个，未对接 16 个
- 重新分类待办事项，按优先级排序

### 2026-04-10
- 更新策略说明：API 已大量对接，不再是纯前端 Mock
- 重新梳理 API 对接情况

