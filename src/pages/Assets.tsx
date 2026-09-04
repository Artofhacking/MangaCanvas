import { useEffect, useMemo, useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import Sidebar from "@/components/layout/Sidebar"
import { 
  Search, 
  Plus, 
  Filter, 
  MoreHorizontal,
  Image,
  FileText,
  Video,
  Music,
  Box,
  Grid3X3,
  List
} from "lucide-react"
import { projectAssetsApi, projectsApi } from "@/api"
import { getActiveProjectId } from "@/lib/session"
import { mapAssetItem } from "@/lib/projectMappers"

// 资产类型
const assetTypes = [
  { id: "all", label: "全部", count: 128 },
  { id: "image", label: "图片", count: 56 },
  { id: "video", label: "视频", count: 24 },
  { id: "audio", label: "音频", count: 18 },
  { id: "document", label: "文档", count: 30 },
]

// 看板列
const kanbanColumns = [
  { id: "draft", label: "草稿", color: "bg-gray-500" },
  { id: "processing", label: "处理中", color: "bg-blue-500" },
  { id: "review", label: "审核中", color: "bg-yellow-500" },
  { id: "approved", label: "已通过", color: "bg-green-500" },
  { id: "archived", label: "已归档", color: "bg-purple-500" },
]

const getAssetIcon = (type: string) => {
  switch (type) {
    case "image": return <Image className="w-5 h-5" />
    case "video": return <Video className="w-5 h-5" />
    case "audio": return <Music className="w-5 h-5" />
    case "document": return <FileText className="w-5 h-5" />
    default: return <Box className="w-5 h-5" />
  }
}

const getStatusColor = (status: string) => {
  switch (status) {
    case "draft": return "bg-gray-500"
    case "processing": return "bg-blue-500"
    case "review": return "bg-yellow-500"
    case "approved": return "bg-green-500"
    case "archived": return "bg-purple-500"
    default: return "bg-gray-500"
  }
}

const getStatusLabel = (status: string) => {
  switch (status) {
    case "draft": return "草稿"
    case "processing": return "处理中"
    case "review": return "审核中"
    case "approved": return "已通过"
    case "archived": return "已归档"
    default: return "未知"
  }
}

export default function Assets() {
  const [activeType, setActiveType] = useState("all")
  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban")
  const [searchQuery, setSearchQuery] = useState("")
  const [projectName, setProjectName] = useState("当前项目")
  const [assets, setAssets] = useState<Array<ReturnType<typeof mapAssetItem>>>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const projectId = getActiveProjectId()
    if (!projectId) {
      setIsLoading(false)
      return
    }

    const load = async () => {
      setIsLoading(true)
      try {
        const [assetData, project] = await Promise.all([
          projectAssetsApi.list(projectId, { page: 1, size: 200 }),
          projectsApi.getById(projectId),
        ])
        setAssets(assetData.list.map((item) => mapAssetItem(item)))
        setProjectName(project.name)
      } finally {
        setIsLoading(false)
      }
    }

    void load()
  }, [])

  const filteredAssets = useMemo(() => assets.filter(asset => 
    activeType === "all" || asset.type === activeType
  ).filter(asset =>
    asset.name.toLowerCase().includes(searchQuery.toLowerCase())
  ), [activeType, assets, searchQuery])

  const assetsByStatus = useMemo(() => kanbanColumns.map(col => ({
    ...col,
    assets: filteredAssets.filter(asset => asset.status === col.id)
  })), [filteredAssets])

  return (
    <div className="min-h-screen bg-[hsl(var(--surface))]">
      <Sidebar />
      
      <main className="ml-64 min-h-screen">
        {/* Header */}
        <header className="sticky top-0 z-30 border-b border-[hsl(var(--outline-variant))]/15 bg-[hsl(var(--surface-container-lowest))]/80 backdrop-blur-md px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h1 className="text-xl font-bold text-[hsl(var(--on-surface))]">资产管理</h1>
              <span className="text-xs text-[hsl(var(--secondary))]">{projectName}</span>
              <Badge variant="secondary" className="text-xs">
                {filteredAssets.length} 个资产
              </Badge>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(var(--secondary))]" />
                <Input 
                  placeholder="搜索资产..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 w-64 bg-[hsl(var(--surface-container-low))] border-none"
                />
              </div>
              <Button variant="ghost" size="icon">
                <Filter className="w-4 h-4" />
              </Button>
              <div className="flex items-center bg-[hsl(var(--surface-container-low))] rounded-lg p-1">
                <button
                  onClick={() => setViewMode("kanban")}
                  className={`p-2 rounded-md transition-colors ${viewMode === "kanban" ? "bg-[hsl(var(--surface-container-high))] text-[hsl(var(--primary))]" : "text-[hsl(var(--secondary))]"}`}
                >
                  <Grid3X3 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode("list")}
                  className={`p-2 rounded-md transition-colors ${viewMode === "list" ? "bg-[hsl(var(--surface-container-high))] text-[hsl(var(--primary))]" : "text-[hsl(var(--secondary))]"}`}
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
              <Button className="signature-gradient text-white border-0">
                <Plus className="w-4 h-4 mr-2" />
                上传资产
              </Button>
            </div>
          </div>

          {/* Asset Type Filter */}
          <div className="flex items-center gap-2 mt-4">
            {assetTypes.map((type) => (
              <button
                key={type.id}
                onClick={() => setActiveType(type.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors ${
                  activeType === type.id
                    ? "bg-[hsl(var(--primary))] text-white"
                    : "bg-[hsl(var(--surface-container-low))] text-[hsl(var(--on-surface))] hover:bg-[hsl(var(--surface-container-high))]"
                }`}
              >
                {type.label}
                <span className={`text-xs ${activeType === type.id ? "text-white/80" : "text-[hsl(var(--secondary))]"}`}>
                  {type.count}
                </span>
              </button>
            ))}
          </div>
        </header>

        {/* Content */}
        <div className="p-8">
          {isLoading ? (
            <div className="mb-6 rounded-xl bg-[hsl(var(--surface-container-lowest))] p-4 text-sm text-[hsl(var(--secondary))]">
              正在加载项目资产...
            </div>
          ) : null}
          {viewMode === "kanban" ? (
            // Kanban View
            <div className="flex gap-6 overflow-x-auto pb-4">
              {assetsByStatus.map((column) => (
                <div key={column.id} className="flex-shrink-0 w-80">
                  {/* Column Header */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <span className={`w-3 h-3 rounded-full ${column.color}`} />
                      <span className="font-semibold text-[hsl(var(--on-surface))]">{column.label}</span>
                      <span className="text-sm text-[hsl(var(--secondary))]">{column.assets.length}</span>
                    </div>
                    <button className="text-[hsl(var(--secondary))] hover:text-[hsl(var(--on-surface))]">
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Column Cards */}
                  <div className="space-y-3">
                    {column.assets.map((asset) => (
                      <Card 
                        key={asset.id} 
                        className="p-4 bg-[hsl(var(--surface-container-lowest))] border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer group"
                      >
                        {/* Thumbnail */}
                        <div className="aspect-video rounded-lg bg-[hsl(var(--surface-container-low))] mb-3 overflow-hidden">
                          {asset.thumbnail ? (
                            <img 
                              src={asset.thumbnail} 
                              alt={asset.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[hsl(var(--secondary))]">
                              {getAssetIcon(asset.type)}
                            </div>
                          )}
                        </div>

                        {/* Info */}
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-[hsl(var(--on-surface))] truncate">
                              {asset.name}
                            </p>
                            <p className="text-xs text-[hsl(var(--secondary))] mt-1">
                              {asset.size} · {asset.updatedAt}
                            </p>
                          </div>
                          <button className="text-[hsl(var(--secondary))] hover:text-[hsl(var(--on-surface))] opacity-0 group-hover:opacity-100 transition-opacity">
                            <MoreHorizontal className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Footer */}
                        <div className="flex items-center justify-between mt-3 pt-3 border-t border-[hsl(var(--outline-variant))]/20">
                          <div className="flex items-center gap-2">
                            <div className="w-5 h-5 rounded-full bg-[hsl(var(--primary))]/10 flex items-center justify-center text-[10px] text-[hsl(var(--primary))]">
                              {asset.author[0]}
                            </div>
                            <span className="text-xs text-[hsl(var(--secondary))]">{asset.author}</span>
                          </div>
                          <Badge variant="secondary" className="text-[10px]">
                            {getStatusLabel(asset.status)}
                          </Badge>
                        </div>
                      </Card>
                    ))}
                    
                    {/* Add Button */}
                    <button className="w-full py-3 border-2 border-dashed border-[hsl(var(--outline-variant))]/50 rounded-lg text-[hsl(var(--secondary))] hover:border-[hsl(var(--primary))]/30 hover:text-[hsl(var(--primary))] transition-colors text-sm">
                      + 添加资产
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            // List View
            <div className="bg-[hsl(var(--surface-container-lowest))] rounded-xl border border-[hsl(var(--outline-variant))]/20">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[hsl(var(--outline-variant))]/20">
                    <th className="text-left py-3 px-4 text-xs font-medium text-[hsl(var(--secondary))]">名称</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-[hsl(var(--secondary))]">类型</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-[hsl(var(--secondary))]">大小</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-[hsl(var(--secondary))]">状态</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-[hsl(var(--secondary))]">作者</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-[hsl(var(--secondary))]">更新时间</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAssets.map((asset) => (
                    <tr key={asset.id} className="border-b border-[hsl(var(--outline-variant))]/10 hover:bg-[hsl(var(--surface-container-low))]/50">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-[hsl(var(--surface-container-low))] flex items-center justify-center text-[hsl(var(--secondary))]">
                            {asset.thumbnail ? (
                              <img src={asset.thumbnail} alt="" className="w-full h-full rounded-lg object-cover" />
                            ) : (
                              getAssetIcon(asset.type)
                            )}
                          </div>
                          <span className="text-sm font-medium text-[hsl(var(--on-surface))]">{asset.name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm text-[hsl(var(--secondary))]">{asset.type}</td>
                      <td className="py-3 px-4 text-sm text-[hsl(var(--secondary))]">{asset.size}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${getStatusColor(asset.status)}`} />
                          <span className="text-sm">{getStatusLabel(asset.status)}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm text-[hsl(var(--secondary))]">{asset.author}</td>
                      <td className="py-3 px-4 text-sm text-[hsl(var(--secondary))]">{asset.updatedAt}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
