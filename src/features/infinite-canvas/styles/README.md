# Infinite Canvas Design System

基于 Material Design 3 设计规范，融合三个模板页面的统一风格。

## 🎨 设计原则

- **Material You**: 使用 Material Design 3 的颜色系统和组件规范
- **玻璃态设计**: 导航栏使用 `backdrop-blur` 玻璃效果
- **层次感**: 通过 surface-container 的不同层级创造深度
- **统一圆角**: 统一的圆角规范（2px/4px/8px/12px）

## 📐 颜色系统

### Primary Colors
```
Primary: #3755c3 (主蓝色)
Primary Dim: #2848b7 (深色变体)
Primary Container: #dde1ff (容器背景)
On Primary: #f8f7ff (主色上的文字)
On Primary Container: #2747b6 (容器上的文字)
```

### Surface Colors
```
Surface: #faf8ff (主表面)
Surface Container: #eaedff (容器)
Surface Container Low: #f2f3ff (低层级)
Surface Container High: #e2e7ff (高层级)
Surface Container Highest: #d9e2ff (最高层级)
```

### Semantic Colors
```
Secondary: #526075
Tertiary: #625b77
Error: #9f403d
Outline: #6079b7
Outline Variant: #98b1f2
```

## 🔤 字体系统

- **Body**: Inter
- **Label/Headline**: Manrope

## 🎯 使用方式

### CSS Variables
```css
/* 使用设计系统变量 */
.my-component {
  background-color: var(--ic-surface-container);
  color: var(--ic-on-surface);
  border-radius: var(--ic-radius-lg);
  font-family: var(--ic-font-body);
}
```

### Tailwind Classes
```jsx
// 颜色
<div className="bg-primary text-white">Primary Button</div>
<div className="bg-surface-container">Card</div>

// 圆角
<button className="rounded-lg">Button</button>
<div className="rounded-xl">Card</div>

// 字体
<h1 className="font-display">Headline</h1>
<span className="font-label uppercase">Label</span>

// 阴影
<div className="shadow-primary">Primary Shadow</div>
<div className="shadow-card hover:shadow-card-hover">Hover Card</div>
```

### Utility Classes
```jsx
// 玻璃效果
<nav className="ic-glass">Glass Navigation</nav>

// Hero 渐变
<section className="ic-hero-gradient">Hero Section</section>

// 内容遮罩
<div className="ic-content-overlay">Content Overlay</div>

// 按钮
<button className="ic-btn-primary">Primary Button</button>
<button className="ic-btn-secondary">Secondary Button</button>

// 卡片
<div className="ic-card">
  <div className="ic-card-media">...</div>
  <div className="ic-card-content">...</div>
</div>
```

## 📱 响应式断点

- `sm`: 640px
- `md`: 768px
- `lg`: 1024px
- `xl`: 1280px
- `2xl`: 1536px

## 🌙 暗黑模式

自动支持暗黑模式，通过 `.dark` 类切换：

```html
<html class="dark">
```

或使用 React 状态管理暗黑模式。

## 🧩 组件规范

### 按钮
- Primary: 渐变背景 + 阴影
- Secondary: surface-container-high 背景
- Ghost: 透明背景 + hover 效果

### 卡片
- 白色背景 (surface-container-lowest)
- 12px 圆角
- 1px outline-variant 边框
- Hover 时上浮 + 阴影

### 输入框
- surface-container-low 背景
- 12px 圆角
- Focus 时显示 primary 边框

### 导航栏
- 玻璃效果 (backdrop-blur)
- 固定顶部
- 高度 64px
