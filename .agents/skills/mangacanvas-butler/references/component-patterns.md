# MangaCanvas 组件模式

## 1. 右侧抽屉（Sheet）

### 使用场景
场景创建、角色创建等复杂表单。

### 标准模板
```tsx
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { X } from "lucide-react"

interface XxxCreatorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function XxxCreator({ open, onOpenChange }: XxxCreatorProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-[900px] sm:max-w-[900px] p-0 overflow-hidden bg-[hsl(var(--surface))]"
        style={{ maxWidth: '900px' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[hsl(var(--outline-variant))]/20 bg-[hsl(var(--surface))]">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
              <X className="w-5 h-5" />
            </Button>
            <h2 className="text-xl font-bold text-[hsl(var(--on-surface))]">标题</h2>
          </div>
          <Badge className="signature-gradient text-white border-0 px-4 py-1.5">
            任务列表
          </Badge>
        </div>

        {/* Body */}
        <div className="h-[calc(100vh-70px)] overflow-y-auto p-6 pb-28 space-y-6">
          {/* 表单内容 */}
        </div>

        {/* Footer */}
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-[hsl(var(--surface))] to-transparent">
          <Button className="w-full py-6 signature-gradient text-white rounded-xl font-bold text-lg border-0">
            提交任务
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
```

## 2. 居中弹框（Dialog）

### 使用场景
新建项目、创建片段等中等复杂度表单。

### 标准模板
```tsx
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface XxxCreatorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function XxxCreator({ open, onOpenChange }: XxxCreatorProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-[480px] p-0 overflow-hidden border-0 rounded-2xl bg-[hsl(var(--surface))]">
        <DialogHeader className="px-6 pt-6 pb-2 text-left">
          <DialogTitle className="text-xl font-bold text-[hsl(var(--on-surface))]">
            标题
          </DialogTitle>
        </DialogHeader>

        <div className="px-6 py-4 space-y-5 max-h-[70vh] overflow-y-auto">
          {/* 表单内容 */}
        </div>

        <div className="px-6 pb-6 pt-2">
          <Button className="w-full h-11 signature-gradient text-white rounded-xl font-bold text-base border-0">
            确认
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

## 3. 卡片网格（标签页内）

### 标准结构
```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
  {/* 添加卡片 */}
  <div
    onClick={onAddNew}
    className="aspect-[4/3] bg-[hsl(var(--surface-container))] border-2 border-dashed border-[hsl(var(--outline-variant))] flex flex-col items-center justify-center rounded-xl hover:bg-[hsl(var(--surface-container-low))] transition-all cursor-pointer group"
  >
    <div className="w-12 h-12 rounded-full bg-[hsl(var(--surface-container-high))] flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
      <Plus className="w-6 h-6 text-[hsl(var(--primary))]" />
    </div>
    <span className="text-sm font-bold text-[hsl(var(--on-surface-variant))]">添加新场景</span>
  </div>

  {/* 数据卡片 */}
  {items.map((item) => (
    <div
      key={item.id}
      className="group relative bg-[hsl(var(--surface-container-lowest))] rounded-xl overflow-hidden hover:shadow-xl hover:shadow-[hsl(var(--on-surface))]/5 transition-all hover:-translate-y-1"
    >
      {/* 图片或内容区 */}
      {/* Hover 操作按钮区 */}
      {/* 底部文字信息 */}
    </div>
  ))}
</div>
```

## 4. 胶囊式切换按钮组

### 使用场景
生成方式选择、标签切换、模式切换。

```tsx
<div className="flex flex-wrap gap-2">
  {options.map((option) => (
    <button
      key={option.id}
      onClick={() => setSelected(option.id)}
      className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
        selected === option.id
          ? "signature-gradient text-white"
          : "bg-[hsl(var(--surface-container-high))] text-[hsl(var(--on-surface))] hover:bg-[hsl(var(--surface-container-highest))]"
      }`}
    >
      {option.label}
    </button>
  ))}
</div>
```

## 5. DropdownMenu 下拉选择

### 使用场景
性别选择、年龄段选择、模型选择等。

```tsx
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu"

<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button
      variant="ghost"
      className="w-full h-11 justify-between rounded-xl bg-[hsl(var(--surface-container-low))] hover:bg-[hsl(var(--surface-container-high))] text-sm font-normal px-3"
    >
      <span className={value ? "text-[hsl(var(--on-surface))]" : "text-[hsl(var(--secondary))]"}>
        {value ? options.find(o => o.value === value)?.label : "请选择"}
      </span>
      <ChevronDown className="w-4 h-4 text-[hsl(var(--secondary))]" />
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent className="w-56">
    {options.map((option) => (
      <DropdownMenuItem key={option.value} onClick={() => setValue(option.value)}>
        {option.label}
      </DropdownMenuItem>
    ))}
  </DropdownMenuContent>
</DropdownMenu>
```

## 6. 模型选择卡片（横向滚动）

### 使用场景
风格模型、AI 模型选择。

```tsx
<div className="flex gap-3 overflow-x-auto pb-2">
  {models.map((model) => (
    <div
      key={model.id}
      onClick={() => setSelectedModel(model.id)}
      className={`relative flex-shrink-0 cursor-pointer border-2 rounded-xl overflow-hidden aspect-square w-24 transition-all ${
        selectedModel === model.id
          ? "border-[hsl(var(--primary))]"
          : "border-transparent hover:border-[hsl(var(--outline-variant))]"
      }`}
    >
      <img className="w-full h-full object-cover" src={model.image} alt={model.name} />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex items-end p-2">
        <span className="text-[11px] font-bold text-white leading-tight">{model.name}</span>
      </div>
    </div>
  ))}
</div>
```
