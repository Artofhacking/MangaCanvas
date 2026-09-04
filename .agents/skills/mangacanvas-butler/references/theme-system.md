# MangaCanvas 主题系统

## 色彩体系

所有颜色基于 CSS 变量定义在 `src/index.css` 的 `:root` 中。

### 核心变量

```css
--primary: 14 100% 34%          /* 橙红色 #ac2e00 */
--primary-foreground: 0 0% 100% /* 白色 */
--secondary: 0 0% 37%           /* 中灰 */
--surface: 30 20% 98%           /* 米白背景 */
--surface-container: 0 6% 94%
--surface-container-high: 0 5% 91%
--surface-container-highest: 0 3% 89%
--surface-container-low: 20 11% 96%
--surface-container-lowest: 0 0% 100%
--on-surface: 0 0% 11%          /* 主要文字色 */
--on-surface-variant: 12 26% 29% /* 次要文字色 */
--outline-variant: 15 45% 81%   /* 边框/分割线 */
```

## 必用样式类

### 主按钮渐变
```tsx
className="signature-gradient text-white"
```
这是项目标志性渐变（`#ac2e00 → #d73b00`），所有**提交按钮**、**CTA 按钮**、**选中态胶囊**必须使用。

### 输入框标准样式
```tsx
<Input
  className="h-11 rounded-xl bg-[hsl(var(--surface-container-low))] border-none text-sm placeholder:text-[hsl(var(--secondary))] focus-visible:ring-1 focus-visible:ring-[hsl(var(--primary))]"
/>
```

### Textarea 标准样式
```tsx
<Textarea
  className="rounded-xl bg-[hsl(var(--surface-container-low))] border-none text-sm placeholder:text-[hsl(var(--secondary))] resize-none focus-visible:ring-1 focus-visible:ring-[hsl(var(--primary))]"
/>
```

### 卡片标准样式
```tsx
className="bg-[hsl(var(--surface-container-lowest))] rounded-xl border-0"
```

### 虚线上传区标准样式
```tsx
className="bg-[hsl(var(--surface-container-low))] rounded-xl border-2 border-dashed border-[hsl(var(--outline-variant))]/50 flex flex-col items-center justify-center hover:bg-[hsl(var(--surface-container-high))] transition-colors cursor-pointer"
```

## 文字层级

| 元素 | 颜色 |
|------|------|
| 主标题/重要文字 | `text-[hsl(var(--on-surface))]` |
| 次要说明文字 | `text-[hsl(var(--secondary))]` |
| 辅助/占位文字 | `text-[hsl(var(--on-surface-variant))]` |

## 响应式断点

```
sm: 640px
md: 768px
lg: 1024px  ← 侧边栏 256px 展开
xl: 1280px
2xl: 1536px
```

## 禁忌

- ❌ 禁止硬编码十六进制颜色如 `#ff0000`
- ❌ 禁止在按钮上使用纯 `bg-[hsl(var(--primary))]` 代替 `signature-gradient`
- ❌ 禁止输入框保留默认白色边框
