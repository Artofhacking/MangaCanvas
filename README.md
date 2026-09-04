# MangaCanvas

基于 React + TypeScript + Vite 的漫画创作管理平台原型，包含项目工作台、资产管理、成员管理、Infinite Canvas 工作流，以及一套已经落地的轻量请求层。

## 快速开始

```bash
npm install
npm run dev
```

默认开发地址：`http://localhost:5174`

常用命令：

```bash
npm run dev
npm run build
npm run preview
npm run lint
```

## 当前技术栈

- React 18
- TypeScript 5
- Vite 5
- React Router DOM 6
- Zustand
- Tailwind CSS
- Radix UI / shadcn 风格基础组件
- Ant Design
- Axios `1.14.0`
- React Flow

## 当前路由

以下内容以 [src/App.tsx](/Users/hanqian/My_/my_code/jurilu/src/App.tsx) 为准：

| 路径 | 页面 |
|------|------|
| `/` | Home |
| `/login` | Login |
| `/pricing` | Pricing |
| `/gallery` | Gallery |
| `/workflow` | Workflow |
| `/terms` | Terms |
| `/privacy` | Privacy |
| `/contact` | Contact |
| `/dashboard` | Dashboard |
| `/project/:id/dashboard` | Dashboard |
| `/projects` | ProjectsList |
| `/project/:id` | ProjectDetail |
| `/project/:id/:tab` | ProjectDetail |
| `/project/:projectId/episode/:episodeId` | EpisodeDetail |
| `/project/:projectId/episode/:episodeId/canvas` | WorkflowCanvas |
| `/project/:projectId/workflows/:workflowId` | WorkflowCanvas |
| `/project/:projectId/permissions` | ProjectPermissions |
| `/members` | Members |
| `/assets` | Assets |

补充说明：

- `IdentityRouteGuard` 已启用。
- 当前身份如果没有项目权限，例如“新成员”，访问 `/dashboard` 或 `/project/*` 会被重定向到 `/projects`。

## 当前功能概览

这里描述的是“代码里现在确实存在的能力”，不再区分愿景和计划中功能。

- Landing Page：营销首页、价格页、工作流介绍、画廊、条款、隐私、联系页
- 登录页：Mock 登录，登录态写入本地存储
- Dashboard：项目看板/快速入口
- ProjectsList：项目列表、通知抽屉、用户菜单、身份切换
- ProjectDetail：项目工作台壳层
- 项目 tab：片段、角色、场景、物品、工作流
- 场景/角色/片段/物品创建器：以弹框/抽屉形式存在
- ProjectPermissions：项目权限管理页
- Members：成员管理页
- Assets：资产管理页，支持看板/列表切换
- Infinite Canvas：基于 React Flow 的工作流画布，包含图像/视频/文本/效果节点
- 统一反馈系统：全局 toast + confirm 弹窗

## 状态管理 & 登录态

### Zustand Stores

| Store | 职责 |
|-------|------|
| `src/stores/projectStore.ts` | 项目工作台：片段、场景、角色、物品的 CRUD |
| `src/store/modelsStore.ts` | AI 模型列表全局缓存，按 modality 分片，带 TTL + 冷却期 |
| `src/features/infinite-canvas/stores/canvasStore.ts` | Canvas 画布状态（节点、边、视口、历史记录） |
| `src/features/infinite-canvas/stores/projectsStore.ts` | Canvas 项目列表 |
| `src/features/infinite-canvas/stores/themeStore.ts` | Canvas 主题切换 |

### 登录态 & localStorage

登录态由 `src/lib/session.ts` 统一管理，登录成功后 `saveSession()` 会：

1. 保存完整 session JSON（`mangacanvas-session`）
2. 拆分存储 user 字段到独立 key，方便单字段读取

当前 localStorage 中存储的关键参数：

| Key | 说明 | 来源 |
|-----|------|------|
| `mangacanvas-session` | 完整 session（token + refreshToken + user） | 登录接口 |
| `mangacanvas-user-id` | 用户 ID | 拆分自 session |
| `mangacanvas-user-username` | 用户名 | 拆分自 session |
| `mangacanvas-user-email` | 邮箱 | 拆分自 session |
| `mangacanvas-user-roleId` | 角色 ID（1=超管 2=管理员 3=员工） | 拆分自 session |
| `mangacanvas-user-credits` | 积分 | 拆分自 session |
| `mangacanvas-user-organizationIds` | 组织 ID 列表 | 拆分自 session |
| `mangacanvas-active-project-id` | 当前活跃项目 ID | 用户操作 |
| `apiKey` | 业务 API Key | 用户设置 |
| `dashscopeApiKey` | DashScope API Key | 用户设置 |
| `models-storage-v2` | 模型列表缓存 | modelsStore persist |

### 其他全局状态

- `src/components/feedback/FeedbackProvider.tsx` — 提供 `notify` 和 `confirm`
- `src/lib/mock-identities.ts` — 管理身份模拟、权限能力与身份切换事件

## 项目结构

```text
src/
├── api/
│   ├── aigc/              ← AIGC 统一服务层（生图/生视频/聊天）
│   │   ├── types.ts
│   │   ├── taskRunner.ts
│   │   ├── imageService.ts
│   │   ├── videoService.ts
│   │   ├── chatService.ts
│   │   └── index.ts
│   ├── clients/           ← HTTP 客户端实例
│   │   ├── appClient.ts
│   │   └── dashscopeClient.ts
│   ├── core/              ← 底层能力（工厂/错误/运行时配置/fetch）
│   ├── authApi.ts         ← 业务 API
│   ├── imageGenerationApi.ts
│   ├── uploadApi.ts
│   ├── hooks.ts
│   ├── index.ts           ← 统一出口
│   └── types.ts
├── components/
│   ├── feedback/
│   ├── layout/
│   └── ui/
├── data/
├── features/
│   └── infinite-canvas/   ← Canvas 工作流子系统
│       ├── api/           （遗留，逐步迁移到 api/aigc/）
│       ├── components/
│       ├── config/
│       ├── hooks/
│       ├── stores/
│       ├── styles/
│       ├── types/
│       └── utils/
├── hooks/
├── lib/
│   └── session.ts         ← 登录态 & localStorage 管理
├── pages/
│   ├── auth/
│   └── project/
├── store/
│   └── modelsStore.ts     ← 模型列表全局缓存
├── stores/
├── types/
└── utils/
```

几个容易混淆的点：

- `src/pages/ProjectDetail.tsx` 仍然存在，但当前主项目工作台入口是 `src/pages/project/index.tsx`
- `src/api/projectApi.ts` 目前是 mock API，不是真实后端接口层
- `src/features/infinite-canvas/` 是一个相对独立的子系统，不要把它和主工作台状态混为一层
- `src/features/infinite-canvas/api/` 下的 `image.ts`、`video.ts`、`chat.ts` 是遗留文件，新代码已统一使用 `src/api/aigc/`

## 前端整体架构

项目采用分层架构，从底层到顶层依次为：

```text
┌─────────────────────────────────────────────────────┐
│  Pages / Components（页面 & UI 组件）                 │
├─────────────────────────────────────────────────────┤
│  Hooks（useImageGeneration / useVideoGeneration ...）│
├─────────────────────────────────────────────────────┤
│  AIGC Service Layer      │  Business APIs            │
│  src/api/aigc/           │  authApi / projectsApi ..  │
├──────────────────────────┴──────────────────────────┤
│  HTTP Clients（appClient / dashscopeClient）         │
├─────────────────────────────────────────────────────┤
│  Core（createHttpClient / error / runtime / fetch）   │
└─────────────────────────────────────────────────────┘
```

各层职责：

| 层 | 目录 | 职责 |
|----|------|------|
| **Core** | `src/api/core/` | axios 工厂、`HttpError` 标准化、运行时配置读取、fetch 辅助 |
| **Clients** | `src/api/clients/` | 具体的 HTTP 客户端实例，各自管理 baseURL / 鉴权 / 错误文案 |
| **AIGC Service** | `src/api/aigc/` | 统一的 AIGC 生成能力（图像 / 视频 / 聊天），自动路由到 DashScope 直连或后端代理 |
| **Business APIs** | `src/api/*.ts` | 普通 CRUD 接口（auth、projects、members、assets、upload 等） |
| **Hooks** | `src/hooks/`、`src/features/*/hooks/` | 提供 React 组件可直接使用的状态 + 调用封装 |
| **Pages** | `src/pages/` | 页面级组件，消费 Hooks |

## AIGC 服务层

项目的核心能力是 AI 生成（生图、生视频、AI 聊天），统一收口在 `src/api/aigc/`。

### 目录结构

```text
src/api/aigc/
├── types.ts           # 统一类型：TaskStatus, ImageGenerateOptions, VideoGenerateOptions 等
├── taskRunner.ts      # 通用异步任务引擎：submitAndPoll() + pollDashScopeTask()
├── imageService.ts    # 图像生成统一入口
├── videoService.ts    # 视频生成统一入口
├── chatService.ts     # 聊天统一入口（同步 + 流式）
└── index.ts           # 统一导出
```

### 核心设计

**taskRunner — 通用异步任务引擎**

所有 DashScope AIGC 任务都遵循「提交 → 轮询 → 提取结果」模式。`taskRunner.ts` 提供 `submitAndPoll()` 函数统一处理这个流程，消除重复代码：

```ts
const result = await submitAndPoll<T>(
  () => submitFn(),           // 提交任务，返回 taskId
  (data) => extractUrl(data), // 从轮询响应中提取结果
  { pollInterval, maxAttempts, onProgress }
)
```

**imageService — 图像生成自动路由**

| 模型系列 | 路由 | 说明 |
|---------|------|------|
| `wan2.x` | DashScope 直连 | 异步任务，支持文生图 / 图生图 |
| `qwen-image` / `wanx` | 后端代理 | 走 `/api/v1/ai/images/generations` |

**videoService — 五种视频模式**

| 模式 | 模型示例 | 说明 |
|------|---------|------|
| 文生视频 (T2V) | `wan2.6-t2v` | 纯文本输入 |
| 图生视频 (I2V) | `wan2.6-i2v-flash` | 首帧图片 + 提示词 |
| 关键帧生视频 (KF2V) | `wan2.2-kf2v-flash` | 首帧 + 尾帧 |
| 视频特效 | `wan2.6-i2v-flash` + template | 图片 + 特效模板 |

**chatService — 聊天三种方式**

| 方法 | 说明 |
|------|------|
| `chatService.complete()` | 同步调用（后端代理） |
| `chatService.streamBackend()` | 流式输出（后端代理） |
| `chatService.streamDashScope()` | 流式输出（DashScope Compatible） |

### 使用示例

**图像生成：**

```ts
import { imageService } from "@/api/aigc"

// DashScope 文生图
const urls = await imageService.generate({
  model: 'wan2.6-t2i',
  prompt: '赛博朋克风格的城市夜景',
  size: '1280*1280',
  onProgress: (p) => console.log(p.status), // PENDING → RUNNING → SUCCEEDED
})

// DashScope 图生图
const urls2 = await imageService.generate({
  model: 'wan2.6-image',
  prompt: '转为水彩风格',
  images: ['https://example.com/ref.jpg'],
})

// 后端代理
const urls3 = await imageService.generate({
  model: 'qwen-image-2.0',
  prompt: '一只猫咪',
})
```

**视频生成：**

```ts
import { videoService } from "@/api/aigc"

// 文生视频
const videoUrl = await videoService.generate({
  model: 'wan2.6-t2v',
  prompt: '夕阳下海浪拍打沙滩',
  size: '1280*720',
  duration: 5,
})

// 图生视频
const videoUrl2 = await videoService.generate({
  model: 'wan2.6-i2v-flash',
  prompt: '镜头缓缓推进',
  firstFrameImage: 'https://example.com/frame.jpg',
  resolution: '720P',
  duration: 5,
})

// 视频特效
const videoUrl3 = await videoService.generate({
  model: 'wan2.6-i2v-flash',
  prompt: '',
  firstFrameImage: 'https://example.com/photo.jpg',
  template: 'dance1',
})
```

**聊天 / AI 润色：**

```ts
import { chatService } from "@/api/aigc"

// 同步
const answer = await chatService.complete({
  model: 'qwen-plus',
  messages: [
    { role: 'system', content: '你是提示词优化大师' },
    { role: 'user', content: '一只猫' },
  ],
})

// 流式
for await (const chunk of chatService.streamDashScope({
  model: 'qwen-plus',
  messages: [{ role: 'user', content: '你好' }],
})) {
  process.stdout.write(chunk)
}
```

**在 React 组件中使用 Hooks：**

```ts
import { useImageGeneration } from '@/features/infinite-canvas/hooks'

const { generate, loading, status } = useImageGeneration()
const urls = await generate({ model: 'wan2.6-t2i', prompt: '...', size: '1280*1280' })
```

### 模型判断工具

```ts
import {
  isDashScopeDirectModel, isI2IModel,  // 图像
  isT2VModel, isI2VModel, isKF2VModel, // 视频
} from "@/api/aigc"

isDashScopeDirectModel('wan2.6-t2i')  // true - DashScope 直连
isI2IModel('wan2.6-image')            // true - 图生图
isT2VModel('wan2.6-t2v')              // true - 文生视频
isKF2VModel('wan2.2-kf2v-flash')      // true - 关键帧生视频
```

## 请求层架构

项目有一套轻量请求层，不要在业务代码里重复 `axios.create()`。

### Core 层

| 文件 | 职责 |
|------|------|
| `src/api/core/createHttpClient.ts` | axios 实例工厂 + 统一拦截器 + 异常标准化为 `HttpError` |
| `src/api/core/error.ts` | `HttpError` 类 + 错误提取 / 归一化方法 |
| `src/api/core/runtime.ts` | 运行时配置读取（baseURL / API Key / 鉴权头） |
| `src/api/core/fetch.ts` | fetch 场景的响应校验（流式接口和非 axios 场景使用） |
| `src/api/core/response.ts` | 后端 `{ code, data, message }` 响应格式适配 |

### Clients 层

| 文件 | 职责 |
|------|------|
| `src/api/clients/appClient.ts` | 主业务客户端，baseURL 由 `VITE_APP_API_BASE_URL` 控制，自动注入 Bearer Token，401 自动跳转登录 |
| `src/api/clients/dashscopeClient.ts` | DashScope 专用客户端，负责 API Key 鉴权和错误文案翻译 |

### 使用方式

```bash
# 环境变量
VITE_APP_API_BASE_URL=http://124.156.186.82:8080/api/v1
```

```ts
// 普通请求
import { appClient } from "@/api"
const { data } = await appClient.get<MyResponse>("/projects")

// 提取 response.data 的辅助函数
import { appClient, createRequest } from "@/api"
const data = await createRequest<MyResponse>(appClient, { url: "/projects", method: "GET" })

// 流式 / fetch
import { getResponseReader, parseJsonResponse } from "@/api"
```

### 约定

- 新增普通 HTTP 接口：优先复用 `appClient`，不要 `axios.create()`
- 新增第三方服务：在 `src/api/clients/` 下新增独立 client
- 新增流式接口：可用 `fetch`，优先复用 `src/api/core/fetch.ts`
- **新增 AIGC 能力：在 `src/api/aigc/` 下扩展，不要在组件里直接调 DashScope**
- UI 提示（`message.error` 等）不写进 `core`，放在 client 或 hook 层

### 给下一个 AI 的建议

- AIGC 相关功能统一使用 `src/api/aigc/` 的 `imageService` / `videoService` / `chatService`
- `src/features/infinite-canvas/api/` 下的 `image.ts`、`video.ts`、`chat.ts` 是遗留代码，不要再引用
- 新增业务接口补在 `src/api/` 下，不要写在页面组件里
- 新增 AI 模型提供商时，在 `src/api/clients/` 新增 client，在 `src/api/aigc/` 中新增路由分支

### 文件上传

**Hook 方式（推荐）：**

```ts
import { useUpload } from "@/hooks/useUpload"

const { uploading, progress, upload } = useUpload({
  directory: 'characters',
  onSuccess: (url) => console.log('上传成功:', url),
  onError: (error) => console.error('上传失败:', error.message),
})

await upload(file) // 自动完成预签名 → 直传 OSS → 确认流程
```

**API 方式：**

```ts
import { uploadApi } from "@/api"
const url = await uploadApi.uploadSingleFile(file, 'scenes')
```

## UI 与反馈约定

- 统一反馈优先使用 `useFeedback()`
- 不要直接用浏览器原生 `alert` / `confirm`
- 悬浮菜单、用户菜单、抽屉、对话框优先复用已有基础组件
- 身份切换、项目权限、通知抽屉等交互已经有现成实现，改动前先搜现有组件

## 主题说明

当前视觉基调以暖橙、米白浅色系为主，核心样式变量定义在 `src/index.css`。

常用类：

```tsx
signature-gradient
bg-[hsl(var(--primary))]
bg-[hsl(var(--surface-container-low))]
```

## 构建与环境

- Node.js 18+
- npm 9+

生产构建：

```bash
npm run build
```

说明：

- 当前构建可以通过，零警告
- 已配置代码分割优化，首屏加载性能显著提升

### 构建优化

项目已配置 Vite 代码分割和路由懒加载：

| 优化项 | 说明 |
|--------|------|
| **Vendor 分离** | React、UI 库、重型库分别打包，利于浏览器缓存 |
| **路由懒加载** | 非核心页面按需加载，首屏仅加载必要代码 |
| **首屏体积** | 核心 JS 约 140KB (gzip)，其余按需加载 |

具体配置见 `vite.config.ts` 和 `App.tsx` 中的 `React.lazy` 用法。

### Mock 模式

项目支持通过环境变量切换 Mock 数据/真实接口：

```bash
# .env.development
VITE_MOCK_MODE=true  # 使用 Mock 数据
VITE_MOCK_MODE=false # 使用真实接口
```

Mock 数据位于 `src/api/mock/` 目录，包含：
- 完整的 CRUD 模拟
- 300ms-500ms 模拟网络延迟
- 支持创建、更新、删除操作（内存存储）

**使用场景：**
- 后端接口未就绪时
- 演示产品流程
- 本地开发测试

## 参考文档

- 后端接口文档位于仓库根目录 [BACKEND_API_SPEC_V2.md](/Users/hanqian/My_/my_code/jurilu/BACKEND_API_SPEC_V2.md)
- 如存在旧版 `BACKEND_API_SPEC.md`，联调与实现以 `BACKEND_API_SPEC_V2.md` 为准
