# AI 模型列表 API 使用文档

## 设计方案

采用**全局缓存策略**：
- 应用启动时请求一次模型列表
- 所有组件共享同一份缓存数据
- 5 分钟缓存有效期
- 支持本地持久化（localStorage）

## 快速开始

### 1. 应用初始化（只需一次）

在应用根组件（如 `App.tsx` 或 `Layout.tsx`）中添加：

```tsx
import { useInitApp } from '@/hooks/useInitApp'

function App() {
  useInitApp()  // 自动加载模型列表等全局数据
  return <YourApp />
}
```

或者使用组件包裹：

```tsx
import { AppInit } from '@/hooks/useInitApp'

function Root() {
  return (
    <AppInit>
      <Router />
    </AppInit>
  )
}
```

### 2. 在任意组件中使用模型列表

```tsx
import { useModels, useImageModels, useVideoModels } from '@/features/infinite-canvas/hooks'

// 获取所有启用的图片模型（从全局缓存读取，不重复请求）
function ImageModelSelector() {
  const { models, loading } = useImageModels()
  
  return (
    <select>
      {loading ? (
        <option>加载中...</option>
      ) : (
        models.map(model => (
          <option key={model.id} value={model.id}>{model.name}</option>
        ))
      )}
    </select>
  )
}

// 获取视频模型
function VideoModelSelector() {
  const { models, loading } = useVideoModels()
  // ...
}

// 获取所有类型的模型
function AllModels() {
  const { models, loading } = useModels()
  // ...
}
```

### 3. 在无限画布节点中使用

```tsx
import { useImageModels } from '@/features/infinite-canvas/hooks'

function ImageConfigNode({ data, id }) {
  // 所有图片配置节点共享同一份缓存
  const { models, loading } = useImageModels()
  
  return (
    <div>
      <label>选择模型</label>
      <select 
        value={data.model} 
        onChange={(e) => updateNode(id, { model: e.target.value })}
        disabled={loading}
      >
        {models.map(model => (
          <option key={model.id} value={model.id}>
            {model.name}
          </option>
        ))}
      </select>
    </div>
  )
}
```

### 4. 场景创建页面使用

```tsx
import { useImageModels } from '@/features/infinite-canvas/hooks'

function SceneCreator() {
  // 与无限画布共享同一份模型列表
  const { models: imageModels, loading } = useImageModels()
  
  return (
    <div>
      <label>生成方式</label>
      <select>
        <option value="upload">自己上传图片</option>
        <option value="model">通过模型生成场景</option>
      </select>
      
      <label>选择模型</label>
      <select disabled={loading}>
        {imageModels.map(model => (
          <option key={model.id} value={model.id}>{model.name}</option>
        ))}
      </select>
    </div>
  )
}
```

## 高级用法

### 手动刷新模型列表

```tsx
import { useModels } from '@/features/infinite-canvas/hooks'

function ModelSettings() {
  const { models, loading, refetch } = useModels()
  
  return (
    <div>
      <button onClick={refetch} disabled={loading}>
        刷新模型列表
      </button>
      {/* ... */}
    </div>
  )
}
```

### 直接操作全局 Store

```tsx
import { useModelsStore, refreshModels } from '@/store/modelsStore'

function SomeComponent() {
  // 直接读取全局状态（不触发请求）
  const imageModels = useModelsStore(state => state.modelsByModality.image)
  const getModelById = useModelsStore(state => state.getModelById)
  
  // 强制刷新
  const handleRefresh = () => {
    refreshModels()
  }
  
  // 清除缓存
  const handleClear = () => {
    useModelsStore.getState().clearCache()
  }
}
```

### 在业务逻辑中使用

```tsx
import { useModelsStore } from '@/store/modelsStore'

async function generateImage(prompt: string, modelId?: string) {
  // 获取默认图片模型
  const { getEnabledModels } = useModelsStore.getState()
  const imageModels = getEnabledModels('image')
  
  const model = modelId 
    ? imageModels.find(m => m.id === modelId)
    : imageModels[0]
    
  if (!model) {
    throw new Error('没有可用的图片模型')
  }
  
  // 使用 model 进行生成...
}
```

## API 参考

### Hooks

| Hook | 说明 |
|------|------|
| `useModels(options?)` | 获取模型列表（支持筛选） |
| `useImageModels()` | 获取图片生成模型 |
| `useVideoModels()` | 获取视频生成模型 |
| `useTextModels()` | 获取文本/LLM 模型 |
| `useAudioModels()` | 获取音频模型 |
| `useMultimodalModels()` | 获取多模态模型 |

### Store Actions

| Action | 说明 |
|--------|------|
| `fetchModels(force?)` | 获取模型列表（force=true 强制刷新） |
| `getModelsByModality(type)` | 按类型获取模型 |
| `getModelById(id)` | 根据 ID 获取模型 |
| `getEnabledModels(type?)` | 获取启用的模型 |
| `clearCache()` | 清除缓存 |

### 工具函数

| 函数 | 说明 |
|------|------|
| `useInitApp()` | 应用初始化 Hook |
| `initModelsStore()` | 手动初始化模型 Store |
| `refreshModels()` | 强制刷新模型列表 |

## 缓存策略

1. **首次加载**: 应用启动时自动请求
2. **缓存有效期**: 5 分钟
3. **重复请求**: 缓存有效期内不重复请求
4. **强制刷新**: 调用 `refetch()` 或 `refreshModels()`
5. **本地持久化**: 刷新页面后保留已缓存数据

## 类型定义

```typescript
interface ModelDTO {
  id: string              // 模型唯一标识
  name: string            // 显示名称
  provider: string        // 提供商
  modality: 'text' | 'image' | 'video' | 'audio' | 'multimodal'
  description?: string    // 描述
  isEnabled: boolean      // 是否启用
  defaultParams?: Record<string, unknown>
  capabilities?: ModelCapability[]
  parameters?: ModelParameter[]
}
```
