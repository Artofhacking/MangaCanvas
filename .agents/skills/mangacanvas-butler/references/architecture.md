# MangaCanvas 项目结构与开发规范

## 目录结构

```
src/
├── components/
│   ├── ui/              # shadcn/ui 基础组件（禁止直接修改，如需覆盖用 className）
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── input.tsx
│   │   ├── badge.tsx
│   │   ├── sheet.tsx
│   │   ├── slider.tsx
│   │   ├── textarea.tsx
│   │   ├── avatar.tsx
│   │   ├── dialog.tsx
│   │   ├── label.tsx
│   │   ├── separator.tsx
│   │   └── dropdown-menu.tsx
│   └── layout/          # 布局组件
│       ├── Sidebar.tsx
│       └── ProjectHeader.tsx
├── pages/
│   ├── auth/
│   │   └── Login.tsx
│   ├── project/
│   │   ├── index.tsx              # 项目详情主页面（路由实际引用）
│   │   ├── SceneCreator.tsx       # 场景创建抽屉
│   │   ├── CharacterCreator.tsx   # 角色创建抽屉
│   │   ├── EpisodeCreator.tsx     # 片段创建弹框
│   │   └── tabs/
│   │       ├── EpisodesTab.tsx
│   │       ├── ScenesTab.tsx
│   │       ├── CharactersTab.tsx
│   │       └── PlaceholderTab.tsx
│   ├── Dashboard.tsx
│   ├── ProjectCreator.tsx         # 新建项目弹框
│   ├── Gallery.tsx                # 创作者画廊
│   ├── Pricing.tsx
│   └── App.tsx                    # 首页 + 路由定义
├── lib/
│   └── utils.ts                   # cn() 工具函数
├── index.css
├── tailwind.config.js
└── main.tsx
```

## 路由表（App.tsx）

| 路径 | 组件 | 说明 |
|------|------|------|
| `/` | Home (App.tsx 内联) | 营销首页 |
| `/gallery` | Gallery | 创作者画廊 |
| `/login` | Login | 登录/注册 |
| `/pricing` | Pricing | 价格方案 |
| `/dashboard` | Dashboard | 控制台 |
| `/project/:id` | ProjectDetail (project/index.tsx) | 项目详情 |

## 命名规范

- **组件文件**：PascalCase，如 `SceneCreator.tsx`
- **工具文件**：camelCase，如 `utils.ts`
- **目录**：camelCase，如 `tabs/`, `auth/`
- **路由路径**：kebab-case，如 `/gallery`

## 状态管理策略

当前使用纯前端 Mock 数据：
- 各页面通过 `useState` 管理本地状态
- 数据新增后通过 `setState` 更新列表
- 无全局状态管理库

## 组件分类规则

| 目录 | 用途 | 示例 |
|------|------|------|
| `components/ui/` | shadcn/ui 基础组件 | Button, Card, Dialog, Sheet |
| `components/layout/` | 布局相关组件 | Sidebar, ProjectHeader |
| `pages/` | 页面级组件 | Dashboard, Gallery, Pricing |
| `pages/project/tabs/` | 项目子标签页 | EpisodesTab, ScenesTab |

## 废弃文件注意

`src/pages/ProjectDetail.tsx` 已废弃，路由实际引用的是 `src/pages/project/index.tsx`。
不要删除它，但也不要在其上继续开发。
