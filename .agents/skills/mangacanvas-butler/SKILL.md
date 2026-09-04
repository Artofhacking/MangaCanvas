---
name: mangacanvas-butler
description: MangaCanvas AI 漫剧资产管理平台的项目管家。当用户在 MangaCanvas 项目中进行开发时触发，包括：添加新页面/标签页/抽屉/弹框、查询项目规范与组件用法、修复主题/样式一致性问题、生成 Mock 数据、或任何涉及本项目代码结构和开发模式的问题。
---

# MangaCanvas Butler

为 MangaCanvas（AI 漫剧资产管理平台）开发提供一站式规范指引和操作流程。

## 快速参考

遇到问题先查对应 reference 文档：

- **项目结构与开发规范** → [references/architecture.md](references/architecture.md)
- **主题系统与样式类** → [references/theme-system.md](references/theme-system.md)
- **组件模式（抽屉/弹框/卡片等）** → [references/component-patterns.md](references/component-patterns.md)

## 开发新功能的标准流程

### 1. 添加新页面
1. 在 `src/pages/` 下创建组件文件（PascalCase）
2. 在 `src/App.tsx` 中添加 `<Route />`
3. 更新对应 Header 组件中的导航链接

### 2. 添加项目标签页
1. 在 `src/pages/project/tabs/` 创建 `XxxTab.tsx`
2. 在 `src/pages/project/index.tsx` 的 `renderTabContent()` 添加 `case`
3. 在 `secondaryTabs` 数组中添加标签

### 3. 添加抽屉（Sheet）
1. 参考 `SceneCreator.tsx` 或 `CharacterCreator.tsx` 的模式
2. 宽度固定 `w-[900px]`，`side="right"`
3. 顶部必须有：关闭按钮 + 标题 + 右上角 Badge
4. 底部必须有：`signature-gradient` 渐变提交按钮

### 4. 添加弹框（Dialog）
1. 参考 `EpisodeCreator.tsx` 或 `ProjectCreator.tsx` 的模式
2. 宽度根据内容选择 `max-w-[480px]`（表单）或 `max-w-[520px]`（复杂表单）
3. 圆角 `rounded-2xl`，背景 `bg-[hsl(var(--surface))]`
4. 底部提交按钮同样使用 `signature-gradient`

## 样式检查清单

修改或新增组件时，逐条确认：

- [ ] 没有硬编码颜色，使用 `hsl(var(--primary))` 或 `hsl(var(--surface-container-low))` 等 CSS 变量
- [ ] 主按钮/提交按钮使用 `signature-gradient` 类
- [ ] 输入框背景使用 `bg-[hsl(var(--surface-container-low))]`，圆角 `rounded-xl`，无边框 `border-none`
- [ ] 卡片/容器背景使用 `bg-[hsl(var(--surface-container-lowest))]`
- [ ] 所有新增组件文件为 PascalCase，工具文件为 camelCase

## Mock 数据生成

需要为页面生成测试数据时：
- 场景类：使用 `https://images.unsplash.com` 图片，宽高比 4:3，状态 `in-use` 或 `draft`
- 角色类：使用人像图片，宽高比 4:5，区分 `主角` / `配角`
- 片段类：使用 Play 图标占位图，显示 `xx 个场景`
- 项目类：使用风景/概念图，宽高比 16:10，状态 `in-progress` / `completed`

## 禁忌

- 不要修改 `.eslintrc.cjs`、`tsconfig.json` 等配置文件，除非明确请求
- 不要引入新的 UI 库，项目统一使用 shadcn/ui + Tailwind CSS
- 不要改变已有的路由结构，新增路由需在 `App.tsx` 中按现有模式追加
- 不要删除 `src/pages/ProjectDetail.tsx`（已废弃但保留），当前项目详情路由指向 `src/pages/project/index.tsx`
