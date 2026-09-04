# MangaCanvas 后端接口设计文档

> 本文档供后端开发人员参考，描述 MangaCanvas 项目需要的完整 API 接口设计。

---

## 1. 项目概述

### 1.1 项目简介

**MangaCanvas** 是一个基于 React + AI 的漫画/漫剧（AIGC）创作管理平台。

**核心定位**：帮助漫画创作者通过 AI 工具，将静态漫画转化为动态漫剧（视频）。平台提供资产管理、角色/场景设计、分镜编排、AI 生成等功能。

**技术栈**：
- 前端：React 18 + TypeScript + Vite + shadcn/ui + Tailwind CSS
- 当前状态：纯前端 Mock 闭环，等待后端 API 接入
- 部署：静态站点（CDN），API 需独立部署

### 1.2 核心用户流程

```
1. 注册/登录 → Dashboard
2. 创建项目 → 进入项目工作台
3. 在项目中创建：角色、场景、物品、片段
4. 进入片段详情 → 分镜编排 → AI 生成视频
5. 导出成片
```

### 1.3 核心概念

| 概念 | 说明 | 对应前端页面 |
|------|------|-------------|
| **Project（项目）** | 一个漫剧作品，包含多个片段 | Dashboard, ProjectDetail |
| **Episode（片段/集）** | 项目中的一个章节，包含多个分镜 | EpisodesTab, EpisodeDetail |
| **Scene（场景）** | 背景环境，可被多个片段复用 | ScenesTab, SceneCreator |
| **Character（角色）** | 漫剧中的人物，有形象设定 | CharactersTab, CharacterCreator |
| **Object（物品/道具）** | 武器、道具、服装等 | ObjectsTab, ObjectCreator |
| **Shot（分镜/镜头）** | 片段中的一个镜头，包含角色、场景、台词 | EpisodeDetail 时间线 |

---

## 2. 接口模块总览

后端需要提供以下 **6 大模块**的 API：

| 模块 | 核心功能 | 优先级 |
|------|----------|--------|
| **1. 认证模块** | 用户注册、登录、JWT 管理 | P0 |
| **2. 项目管理** | 项目 CRUD、成员管理 | P0 |
| **3. 资产管理** | 角色、场景、物品的 CRUD | P0 |
| **4. 片段管理** | 片段 CRUD、分镜编排 | P0 |
| **5. AI 生成** | 图片生成、视频生成、任务队列 | P1 |
| **6. 文件存储** | 图片上传、视频存储、CDN | P1 |

---

## 3. 详细接口设计

### 3.1 认证模块 (Auth)

**基础路径**: `/api/v1/auth`

#### 3.1.1 用户注册
```http
POST /api/v1/auth/register
Content-Type: application/json

{
  "username": "string",     // 用户名，唯一
  "email": "string",        // 邮箱，唯一
  "password": "string",     // 密码，需加密存储
  "avatar": "string"        // 可选，头像 URL
}

Response 201:
{
  "code": 0,
  "data": {
    "user": {
      "id": "uuid",
      "username": "string",
      "email": "string",
      "avatar": "string",
      "createdAt": "2024-01-01T00:00:00Z"
    },
    "token": "jwt_token",
    "refreshToken": "refresh_token"
  }
}
```

#### 3.1.2 用户登录
```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "string",
  "password": "string"
}

Response 200:
{
  "code": 0,
  "data": {
    "user": { /* 同上 */ },
    "token": "jwt_token",
    "refreshToken": "refresh_token"
  }
}
```

#### 3.1.3 Token 刷新
```http
POST /api/v1/auth/refresh
Authorization: Bearer {refresh_token}

Response 200:
{
  "code": 0,
  "data": {
    "token": "new_jwt_token",
    "refreshToken": "new_refresh_token"
  }
}
```

#### 3.1.4 获取当前用户信息
```http
GET /api/v1/auth/me
Authorization: Bearer {token}

Response 200:
{
  "code": 0,
  "data": {
    "id": "uuid",
    "username": "string",
    "email": "string",
    "avatar": "string",
    "credits": 100,           // 积分余额（用于 AI 生成）
    "createdAt": "string"
  }
}
```

#### 3.1.5 第三方登录（OAuth）
```http
POST /api/v1/auth/oauth/{provider}  // provider: google | github
Content-Type: application/json

{
  "code": "oauth_code",     // OAuth 授权码
  "redirectUri": "string"   // 回调地址
}

Response 200: { /* 同登录响应 */ }
```

---

### 3.2 项目管理 (Projects)

**基础路径**: `/api/v1/projects`

#### 3.2.1 创建项目
```http
POST /api/v1/projects
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "string",              // 项目名称，必填
  "description": "string",       // 项目描述
  "coverImage": "string",        // 封面图 URL
  "isPublic": false,             // 是否公开
  "password": "string"           // 访问密码（可选）
}

Response 201:
{
  "code": 0,
  "data": {
    "id": "uuid",
    "name": "string",
    "description": "string",
    "coverImage": "string",
    "status": "draft",             // draft | in-progress | completed
    "isPublic": false,
    "ownerId": "uuid",
    "members": [],
    "createdAt": "string",
    "updatedAt": "string"
  }
}
```

#### 3.2.2 获取项目列表
```http
GET /api/v1/projects?page=1&size=20&status=draft
Authorization: Bearer {token}

Response 200:
{
  "code": 0,
  "data": {
    "list": [
      {
        "id": "uuid",
        "name": "string",
        "description": "string",
        "coverImage": "string",
        "status": "string",
        "progress": 35,            // 总进度百分比
        "episodeCount": 5,         // 片段数量
        "updatedAt": "string"
      }
    ],
    "pagination": {
      "page": 1,
      "size": 20,
      "total": 100
    }
  }
}
```

#### 3.2.3 获取项目详情
```http
GET /api/v1/projects/{projectId}
Authorization: Bearer {token}

Response 200:
{
  "code": 0,
  "data": {
    "id": "uuid",
    "name": "string",
    "description": "string",
    "coverImage": "string",
    "status": "string",
    "isPublic": false,
    "owner": { /* 用户信息 */ },
    "members": [ /* 成员列表 */ ],
    "stats": {
      "episodeCount": 5,
      "sceneCount": 12,
      "characterCount": 8,
      "objectCount": 15,
      "totalDuration": 720         // 总时长（秒）
    },
    "createdAt": "string",
    "updatedAt": "string"
  }
}
```

#### 3.2.4 更新项目
```http
PUT /api/v1/projects/{projectId}
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "string",
  "description": "string",
  "coverImage": "string",
  "status": "string",
  "isPublic": false
}

Response 200: { /* 更新后的项目数据 */ }
```

#### 3.2.5 删除项目
```http
DELETE /api/v1/projects/{projectId}
Authorization: Bearer {token}

Response 200:
{
  "code": 0,
  "message": "删除成功"
}
```

#### 3.2.6 复制项目
```http
POST /api/v1/projects/{projectId}/duplicate
Authorization: Bearer {token}

Response 201: { /* 新创建的项目 */ }
```

---

### 3.3 角色管理 (Characters)

**基础路径**: `/api/v1/projects/{projectId}/characters`

#### 3.3.1 创建角色
```http
POST /api/v1/projects/{projectId}/characters
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "string",              // 角色名称
  "role": "main",                // main | support（主角/配角）
  "gender": "male",              // male | female | other
  "ageGroup": "young",           // child | teen | young | middle | old
  "style": "string",             // 风格标签（如：赛博朋克）
  "description": "string",       // 详细描述（用于 AI 生成）
  "avatar": "string",            // 头像 URL
  "referenceImages": ["string"], // 参考图列表
  "modelId": "string",           // 使用的 AI 模型
  "seed": "string"               // 随机种子（用于复现）
}

Response 201:
{
  "code": 0,
  "data": {
    "id": "uuid",
    "projectId": "uuid",
    "name": "string",
    "role": "main",
    "gender": "male",
    "ageGroup": "young",
    "style": "string",
    "description": "string",
    "avatar": "string",
    "referenceImages": [],
    "modelId": "string",
    "seed": "string",
    "usageCount": 0,               // 被使用次数
    "createdAt": "string",
    "updatedAt": "string"
  }
}
```

#### 3.3.2 获取角色列表
```http
GET /api/v1/projects/{projectId}/characters?role=main
Authorization: Bearer {token}

Response 200:
{
  "code": 0,
  "data": {
    "list": [
      {
        "id": "uuid",
        "name": "string",
        "role": "main",
        "avatar": "string",
        "style": "string",
        "usageCount": 5,
        "updatedAt": "string"
      }
    ]
  }
}
```

#### 3.3.3 获取角色详情
```http
GET /api/v1/projects/{projectId}/characters/{characterId}
Authorization: Bearer {token}

Response 200: { /* 完整角色信息 */ }
```

#### 3.3.4 更新角色
```http
PUT /api/v1/projects/{projectId}/characters/{characterId}
Authorization: Bearer {token}

{ /* 同创建字段 */ }
```

#### 3.3.5 删除角色
```http
DELETE /api/v1/projects/{projectId}/characters/{characterId}
Authorization: Bearer {token}
```

---

### 3.4 场景管理 (Scenes)

**基础路径**: `/api/v1/projects/{projectId}/scenes`

#### 3.4.1 创建场景
```http
POST /api/v1/projects/{projectId}/scenes
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "string",              // 场景名称
  "description": "string",       // 场景描述
  "image": "string",             // 场景图片 URL
  "genMethod": "model",          // model | upload | angle | custom
  "modelId": "string",           // AI 模型
  "style": "string",             // 风格
  "camera": {
    "shotType": "wide",          // close | medium | wide
    "distance": 8.0,             // 距离
    "horizontal": 0,             // 水平角度
    "vertical": 31               // 垂直角度
  },
  "referenceImages": ["string"], // 参考图
  "seed": "string"               // 随机种子
}

Response 201:
{
  "code": 0,
  "data": {
    "id": "uuid",
    "projectId": "uuid",
    "name": "string",
    "description": "string",
    "image": "string",
    "status": "draft",             // draft | in-use
    "genMethod": "model",
    "modelId": "string",
    "style": "string",
    "camera": { /* 镜头参数 */ },
    "usageCount": 0,
    "createdAt": "string",
    "updatedAt": "string"
  }
}
```

#### 3.4.2 获取场景列表
```http
GET /api/v1/projects/{projectId}/scenes?status=in-use
Authorization: Bearer {token}

Response 200:
{
  "code": 0,
  "data": {
    "list": [
      {
        "id": "uuid",
        "name": "string",
        "image": "string",
        "status": "in-use",
        "usageCount": 3,
        "updatedAt": "string"
      }
    ]
  }
}
```

#### 3.4.3 - 3.4.5 获取详情、更新、删除（同角色管理模式）

---

### 3.5 物品管理 (Objects)

**基础路径**: `/api/v1/projects/{projectId}/objects`

#### 3.5.1 创建物品
```http
POST /api/v1/projects/{projectId}/objects
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "string",              // 物品名称
  "type": "weapon",              // weapon | prop | clothing | decoration
  "description": "string",       // 描述
  "image": "string",             // 图片 URL
  "sceneId": "uuid",             // 关联场景 ID（可选）
  "genMethod": "model",          // 生成方式
  "referenceImages": ["string"]  // 参考图
}

Response 201:
{
  "code": 0,
  "data": {
    "id": "uuid",
    "projectId": "uuid",
    "name": "string",
    "type": "weapon",
    "description": "string",
    "image": "string",
    "sceneId": "uuid",
    "status": "draft",
    "createdAt": "string",
    "updatedAt": "string"
  }
}
```

#### 3.5.2 获取物品列表
```http
GET /api/v1/projects/{projectId}/objects?type=weapon
Authorization: Bearer {token}

Response 200:
{
  "code": 0,
  "data": {
    "list": [
      {
        "id": "uuid",
        "name": "string",
        "type": "weapon",
        "image": "string",
        "sceneName": "string",     // 关联场景名称
        "updatedAt": "string"
      }
    ]
  }
}
```

---

### 3.6 片段管理 (Episodes)

**基础路径**: `/api/v1/projects/{projectId}/episodes`

#### 3.6.1 创建片段
```http
POST /api/v1/projects/{projectId}/episodes
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "string",              // 片段名称
  "code": "EP_001",              // 片段代码
  "description": "string",       // 剧情简介
  "duration": 225,               // 预计时长（秒）
  "characterIds": ["uuid"],      // 关联角色
  "sceneIds": ["uuid"],          // 关联场景
  "objectIds": ["uuid"]          // 关联物品
}

Response 201:
{
  "code": 0,
  "data": {
    "id": "uuid",
    "projectId": "uuid",
    "name": "string",
    "code": "EP_001",
    "description": "string",
    "status": "draft",             // draft | in-progress | completed
    "progress": 0,                 // 制作进度 %
    "duration": 225,
    "sceneCount": 0,
    "characters": [ /* 角色列表 */ ],
    "scenes": [ /* 场景列表 */ ],
    "objects": [ /* 物品列表 */ ],
    "createdAt": "string",
    "updatedAt": "string"
  }
}
```

#### 3.6.2 获取片段列表
```http
GET /api/v1/projects/{projectId}/episodes?status=in-progress
Authorization: Bearer {token}

Response 200:
{
  "code": 0,
  "data": {
    "list": [
      {
        "id": "uuid",
        "name": "string",
        "code": "EP_001",
        "status": "in-progress",
        "progress": 65,
        "sceneCount": 12,
        "duration": 225,
        "updatedAt": "string"
      }
    ]
  }
}
```

#### 3.6.3 获取片段详情（核心接口）
```http
GET /api/v1/projects/{projectId}/episodes/{episodeId}
Authorization: Bearer {token}

Response 200:
{
  "code": 0,
  "data": {
    "id": "uuid",
    "name": "string",
    "code": "EP_001",
    "description": "string",
    "status": "in-progress",
    "progress": 65,
    "duration": 225,
    "sceneCount": 12,
    "characters": [
      {
        "id": "uuid",
        "name": "string",
        "avatar": "string",
        "role": "main"
      }
    ],
    "scenes": [
      {
        "id": "uuid",
        "name": "string",
        "image": "string",
        "shotCount": 5
      }
    ],
    "objects": [ /* 物品列表 */ ],
    "shots": [ /* 分镜列表，见 3.7 */ ],
    "stats": {
      "completed": 8,
      "inProgress": 2,
      "pending": 4
    },
    "createdAt": "string",
    "updatedAt": "string"
  }
}
```

---

### 3.7 分镜管理 (Shots)

**基础路径**: `/api/v1/projects/{projectId}/episodes/{episodeId}/shots`

#### 3.7.1 创建分镜
```http
POST /api/v1/projects/{projectId}/episodes/{episodeId}/shots
Authorization: Bearer {token}
Content-Type: application/json

{
  "sequence": 1,                 // 顺序序号
  "name": "string",              // 分镜名称
  "description": "string",       // 描述/动作
  "sceneId": "uuid",             // 场景 ID
  "characterIds": ["uuid"],      // 出现的角色
  "objectIds": ["uuid"],         // 出现的物品
  "dialogue": "string",          // 台词
  "duration": 15,                // 时长（秒）
  "cameraAngle": "string",       // 机位角度
  "image": "string"              // 生成后的图片
}

Response 201:
{
  "code": 0,
  "data": {
    "id": "uuid",
    "episodeId": "uuid",
    "sequence": 1,
    "name": "string",
    "description": "string",
    "scene": { /* 场景信息 */ },
    "characters": [ /* 角色信息 */ ],
    "objects": [ /* 物品信息 */ ],
    "dialogue": "string",
    "duration": 15,
    "status": "pending",           // pending | in-progress | completed
    "image": "string",
    "video": "string",             // 生成后的视频片段
    "createdAt": "string",
    "updatedAt": "string"
  }
}
```

#### 3.7.2 获取分镜列表
```http
GET /api/v1/projects/{projectId}/episodes/{episodeId}/shots
Authorization: Bearer {token}

Response 200:
{
  "code": 0,
  "data": {
    "list": [
      {
        "id": "uuid",
        "sequence": 1,
        "name": "string",
        "description": "string",
        "duration": 15,
        "status": "completed",
        "image": "string"
      }
    ]
  }
}
```

#### 3.7.3 批量更新分镜顺序
```http
PUT /api/v1/projects/{projectId}/episodes/{episodeId}/shots/reorder
Authorization: Bearer {token}
Content-Type: application/json

{
  "shotIds": ["uuid1", "uuid2", "uuid3"]  // 按顺序排列的分镜 ID 列表
}

Response 200: { "code": 0 }
```

---

### 3.8 AI 生成模块 (AI Generation)

**基础路径**: `/api/v1/ai`

#### 3.8.1 创建生成任务（通用）
```http
POST /api/v1/ai/generate
Authorization: Bearer {token}
Content-Type: application/json

{
  "type": "image",               // image | video
  "taskType": "character",       // character | scene | object | shot
  "projectId": "uuid",
  "targetId": "uuid",            // 关联的角色/场景/分镜 ID
  "prompt": "string",            // 正向提示词
  "negativePrompt": "string",    // 负向提示词
  "modelId": "string",           // 使用的模型
  "parameters": {                // 额外参数
    "width": 512,
    "height": 768,
    "seed": 123456,
    "steps": 30,
    "cfgScale": 7.5
  },
  "referenceImages": ["string"]  // 参考图 URL
}

Response 201:
{
  "code": 0,
  "data": {
    "taskId": "uuid",
    "status": "queued",            // queued | processing | completed | failed
    "position": 3,                 // 队列位置
    "estimatedTime": 120,          // 预计等待时间（秒）
    "creditsDeducted": 2           // 扣除的积分
  }
}
```

#### 3.8.2 获取生成任务状态
```http
GET /api/v1/ai/tasks/{taskId}
Authorization: Bearer {token}

Response 200:
{
  "code": 0,
  "data": {
    "id": "uuid",
    "type": "image",
    "status": "processing",
    "progress": 65,                // 进度百分比
    "message": "正在渲染光照层...",
    "result": "string",            // 生成结果的 URL（完成后）
    "createdAt": "string",
    "startedAt": "string",
    "completedAt": "string"
  }
}
```

#### 3.8.3 获取任务队列
```http
GET /api/v1/ai/queue
Authorization: Bearer {token}

Response 200:
{
  "code": 0,
  "data": {
    "queue": [
      {
        "taskId": "uuid",
        "type": "image",
        "name": "任务名称",
        "status": "processing",
        "progress": 45
      }
    ],
    "total": 5
  }
}
```

#### 3.8.4 取消任务
```http
DELETE /api/v1/ai/tasks/{taskId}
Authorization: Bearer {token}

Response 200:
{
  "code": 0,
  "message": "任务已取消",
  "data": {
    "creditsRefunded": 2          // 退还的积分
  }
}
```

---

### 3.9 文件上传 (Upload)

**基础路径**: `/api/v1/upload`

#### 3.9.1 获取预签名上传 URL
```http
POST /api/v1/upload/presigned
Authorization: Bearer {token}
Content-Type: application/json

{
  "filename": "image.jpg",       // 文件名
  "contentType": "image/jpeg",   // MIME 类型
  "directory": "characters"      // 目录：characters | scenes | objects | shots
}

Response 200:
{
  "code": 0,
  "data": {
    "uploadUrl": "https://oss...",     // 直接上传的 URL
    "accessUrl": "https://cdn...",     // 访问用的 CDN URL
    "expiresIn": 300                   // URL 过期时间（秒）
  }
}
```

#### 3.9.2 确认上传完成
```http
POST /api/v1/upload/confirm
Authorization: Bearer {token}
Content-Type: application/json

{
  "accessUrl": "https://cdn...",
  "directory": "characters",
  "relatedId": "uuid"            // 关联的资源 ID
}

Response 200: { "code": 0 }
```

---

### 3.10 用户积分 (Credits)

**基础路径**: `/api/v1/credits`

#### 3.10.1 获取积分余额
```http
GET /api/v1/credits
Authorization: Bearer {token}

Response 200:
{
  "code": 0,
  "data": {
    "balance": 100,                // 当前余额
    "totalEarned": 200,
    "totalUsed": 100
  }
}
```

#### 3.10.2 获取积分记录
```http
GET /api/v1/credits/history?page=1&size=20
Authorization: Bearer {token}

Response 200:
{
  "code": 0,
  "data": {
    "list": [
      {
        "id": "uuid",
        "type": "use",             // use | earn | purchase
        "amount": -2,
        "balance": 98,
        "description": "生成角色图片",
        "createdAt": "string"
      }
    ],
    "pagination": { /* 分页 */ }
  }
}
```

---

## 4. 数据结构定义

### 4.1 用户 (User)
```typescript
interface User {
  id: string;                    // UUID
  username: string;              // 用户名
  email: string;                 // 邮箱
  avatar: string;                // 头像 URL
  credits: number;               // 积分余额
  plan: 'free' | 'pro' | 'enterprise';  // 套餐
  createdAt: string;             // ISO 8601
  updatedAt: string;
}
```

### 4.2 项目 (Project)
```typescript
interface Project {
  id: string;
  name: string;
  description: string;
  coverImage: string;
  status: 'draft' | 'in-progress' | 'completed';
  isPublic: boolean;
  password?: string;             // 访问密码（加密存储）
  ownerId: string;
  members: ProjectMember[];
  stats: ProjectStats;
  createdAt: string;
  updatedAt: string;
}

interface ProjectMember {
  userId: string;
  role: 'owner' | 'editor' | 'viewer';
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

### 4.3 角色 (Character)
```typescript
interface Character {
  id: string;
  projectId: string;
  name: string;
  role: 'main' | 'support';
  gender: 'male' | 'female' | 'other';
  ageGroup: 'child' | 'teen' | 'young' | 'middle' | 'old';
  style: string;
  description: string;
  avatar: string;
  referenceImages: string[];
  modelId: string;
  seed: string;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}
```

### 4.4 场景 (Scene)
```typescript
interface Scene {
  id: string;
  projectId: string;
  name: string;
  description: string;
  image: string;
  status: 'draft' | 'in-use';
  genMethod: 'model' | 'upload' | 'angle' | 'custom';
  modelId: string;
  style: string;
  camera: CameraParams;
  referenceImages: string[];
  seed: string;
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
```

### 4.5 物品 (Object)
```typescript
interface ObjectItem {
  id: string;
  projectId: string;
  name: string;
  type: 'weapon' | 'prop' | 'clothing' | 'decoration';
  description: string;
  image: string;
  sceneId?: string;
  status: 'draft' | 'in-use';
  genMethod: string;
  referenceImages: string[];
  createdAt: string;
  updatedAt: string;
}
```

### 4.6 片段 (Episode)
```typescript
interface Episode {
  id: string;
  projectId: string;
  name: string;
  code: string;
  description: string;
  status: 'draft' | 'in-progress' | 'completed';
  progress: number;              // 0-100
  duration: number;              // 秒
  sceneCount: number;
  characters: Character[];
  scenes: Scene[];
  objects: ObjectItem[];
  shots: Shot[];
  createdAt: string;
  updatedAt: string;
}
```

### 4.7 分镜 (Shot)
```typescript
interface Shot {
  id: string;
  episodeId: string;
  sequence: number;              // 顺序
  name: string;
  description: string;
  scene: Scene;
  characters: Character[];
  objects: ObjectItem[];
  dialogue: string;
  duration: number;              // 秒
  cameraAngle: string;
  status: 'pending' | 'in-progress' | 'completed';
  image?: string;                // 生成的图片
  video?: string;                // 生成的视频片段
  createdAt: string;
  updatedAt: string;
}
```

---

## 5. 错误码定义

| 错误码 | 说明 | HTTP 状态码 |
|--------|------|------------|
| 0 | 成功 | 200 |
| 1001 | 参数错误 | 400 |
| 1002 | 未授权 | 401 |
| 1003 | 禁止访问 | 403 |
| 1004 | 资源不存在 | 404 |
| 1005 | 资源冲突 | 409 |
| 2001 | 用户已存在 | 409 |
| 2002 | 邮箱或密码错误 | 401 |
| 2003 | 积分不足 | 402 |
| 3001 | 生成任务失败 | 500 |
| 3002 | 队列已满 | 429 |
| 9999 | 服务器内部错误 | 500 |

错误响应格式：
```json
{
  "code": 1001,
  "message": "参数错误：name 不能为空",
  "data": null
}
```

---

## 6. 技术实现建议

### 6.1 数据库设计建议

**核心表**：
- `users` - 用户表
- `projects` - 项目表
- `project_members` - 项目成员关联表
- `characters` - 角色表
- `scenes` - 场景表
- `objects` - 物品表
- `episodes` - 片段表
- `episode_characters` - 片段-角色关联表
- `episode_scenes` - 片段-场景关联表
- `shots` - 分镜表
- `shot_characters` - 分镜-角色关联表
- `generation_tasks` - AI 生成任务表
- `credits_history` - 积分记录表

### 6.2 AI 生成服务架构

```
Frontend → API Server → Message Queue (Redis/RabbitMQ)
                              ↓
                    Generation Workers (GPU 服务器)
                              ↓
                         File Storage (OSS/S3)
                              ↓
                         Callback → API Server
```

**建议**：
1. 使用消息队列管理生成任务队列
2. 独立 GPU 服务器运行 Stable Diffusion / ComfyUI 等
3. WebSocket 推送任务进度到前端
4. 支持任务优先级（付费用户优先）

### 6.3 文件存储

**建议方案**：阿里云 OSS / AWS S3 + CDN
- 图片：WebP 格式，多尺寸缩略图
- 视频：MP4 格式，H.264/H.265 编码
- 目录结构：`{userId}/{projectId}/{resourceType}/{filename}`

---

## 7. 开发阶段建议

### Phase 1: MVP（核心功能）
- [ ] 认证模块（注册/登录/JWT）
- [ ] 项目管理（CRUD）
- [ ] 角色管理（CRUD）
- [ ] 场景管理（CRUD）
- [ ] 片段管理（CRUD + 基础分镜）
- [ ] 文件上传

### Phase 2: AI 能力
- [ ] AI 图片生成任务队列
- [ ] 生成任务管理
- [ ] 积分系统

### Phase 3: 高级功能
- [ ] AI 视频生成
- [ ] 团队协作（权限管理）
- [ ] 支付系统（积分购买）

---

*文档版本: 1.0*  
*最后更新: 2024-04-05*
