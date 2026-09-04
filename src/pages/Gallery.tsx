import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Link } from "react-router-dom"
import { Search, Heart, Download, Eye } from "lucide-react"

const categories = [
  { id: "all", label: "全部" },
  { id: "scene", label: "场景" },
  { id: "character", label: "角色" },
  { id: "style", label: "风格参考" },
  { id: "concept", label: "概念稿" },
]

const galleryItems = [
  {
    id: 1,
    title: "赛博街区 7 号扇区",
    category: "scene",
    image: "https://images.unsplash.com/photo-1614726365723-49cfae927846?w=600&h=800&fit=crop",
    author: "龙崎真治",
    likes: 128,
    views: 3420,
  },
  {
    id: 2,
    title: "月城雪兔",
    category: "character",
    image: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=600&h=750&fit=crop",
    author: "月城",
    likes: 256,
    views: 5600,
  },
  {
    id: 3,
    title: "黄昏教室 2B",
    category: "scene",
    image: "https://images.unsplash.com/photo-1542640244-7e672d6cef4e?w=600&h=450&fit=crop",
    author: "Elena",
    likes: 89,
    views: 2100,
  },
  {
    id: 4,
    title: "水墨意境",
    category: "style",
    image: "https://images.unsplash.com/photo-1545569341-9eb8b30979d9?w=600&h=900&fit=crop",
    author: "Marcus",
    likes: 312,
    views: 7800,
  },
  {
    id: 5,
    title: "神乐千鹤",
    category: "character",
    image: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=600&h=720&fit=crop",
    author: "神乐",
    likes: 198,
    views: 4300,
  },
  {
    id: 6,
    title: "低语森林",
    category: "scene",
    image: "https://images.unsplash.com/photo-1448375240586-882707db888b?w=600&h=500&fit=crop",
    author: "林小北",
    likes: 145,
    views: 2900,
  },
  {
    id: 7,
    title: "赛博朋克屋顶景观",
    category: "concept",
    image: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&h=600&fit=crop",
    author: "CyberX",
    likes: 420,
    views: 9100,
  },
  {
    id: 8,
    title: "古寺庭院",
    category: "scene",
    image: "https://images.unsplash.com/photo-1563089145-599997674d42?w=600&h=450&fit=crop",
    author: "古风侠",
    likes: 76,
    views: 1800,
  },
  {
    id: 9,
    title: "热血少年",
    category: "character",
    image: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=600&h=800&fit=crop",
    author: "黑崎",
    likes: 334,
    views: 6700,
  },
  {
    id: 10,
    title: "霓虹夜景",
    category: "style",
    image: "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=600&h=400&fit=crop",
    author: "NightOwl",
    likes: 267,
    views: 5400,
  },
  {
    id: 11,
    title: "机甲核心",
    category: "concept",
    image: "https://images.unsplash.com/photo-1615840287214-7ff58936c4cf?w=600&h=700&fit=crop",
    author: "MechaMaster",
    likes: 512,
    views: 12000,
  },
  {
    id: 12,
    title: "春野樱",
    category: "character",
    image: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=600&h=750&fit=crop",
    author: "樱花雨",
    likes: 289,
    views: 6100,
  },
]

export default function Gallery() {
  const [activeCategory, setActiveCategory] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")

  const filteredItems = galleryItems.filter((item) => {
    const matchCategory = activeCategory === "all" || item.category === activeCategory
    const matchSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        item.author.toLowerCase().includes(searchQuery.toLowerCase())
    return matchCategory && matchSearch
  })

  return (
    <div className="min-h-screen bg-[hsl(var(--surface))]">
      {/* Top Navigation */}
      <nav className="fixed top-0 w-full z-50 glass-effect bg-[hsl(var(--surface))]/80 shadow-[0_40px_40px_rgba(27,28,28,0.04)]">
        <div className="flex justify-between items-center px-8 h-20 w-full max-w-7xl mx-auto">
          <div className="flex items-center gap-12">
            <Link to="/" className="text-2xl font-black text-[hsl(var(--on-surface))] tracking-tighter hover:opacity-80 transition-opacity">
              MangaCanvas
            </Link>
            <div className="hidden md:flex items-center gap-8 text-sm font-medium">
              <Link to="/gallery" className="text-[hsl(var(--primary))]">
                画廊
              </Link>
              <Link to="#" className="text-[hsl(var(--on-secondary-fixed-variant))] hover:text-[hsl(var(--primary))] transition-colors duration-300">
                工作流
              </Link>
              <Link to="/pricing" className="text-[hsl(var(--on-secondary-fixed-variant))] hover:text-[hsl(var(--primary))] transition-colors duration-300">
                价格
              </Link>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/login">
              <Button variant="ghost" className="hidden md:block text-[hsl(var(--on-secondary-fixed-variant))] hover:text-[hsl(var(--primary))]">
                登录
              </Button>
            </Link>
            <Link to="/dashboard">
              <Button className="signature-gradient text-white px-6 py-2.5 rounded-xl text-sm font-semibold scale-95 active:scale-90 transition-transform border-0">
                创建项目
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      <main className="pt-20">
        {/* Hero */}
        <section className="px-8 py-16 text-center">
          <h1 className="text-4xl md:text-5xl font-black text-[hsl(var(--on-surface))] tracking-tighter mb-4">
            创作者画廊
          </h1>
          <p className="text-lg text-[hsl(var(--secondary))] max-w-xl mx-auto">
            探索来自社区的优秀作品，获取灵感，发现无限可能。
          </p>
        </section>

        {/* Filters & Search */}
        <section className="px-8 pb-8 sticky top-20 z-30 bg-[hsl(var(--surface))]/95 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
            {/* Category Tabs */}
            <div className="flex flex-wrap items-center justify-center gap-2">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                    activeCategory === cat.id
                      ? "signature-gradient text-white"
                      : "bg-[hsl(var(--surface-container-high))] text-[hsl(var(--on-surface))] hover:bg-[hsl(var(--surface-container-highest))]"
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="relative w-full md:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--secondary))] w-4 h-4" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜索作品或作者..."
                className="w-full pl-10 pr-4 py-2 bg-[hsl(var(--surface-container-low))] border-none rounded-xl text-sm font-medium placeholder:text-[hsl(var(--secondary))]/50 focus-visible:ring-1 focus-visible:ring-[hsl(var(--primary))]"
              />
            </div>
          </div>
        </section>

        {/* Gallery Grid */}
        <section className="px-8 pb-20">
          <div className="max-w-7xl mx-auto columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-6 space-y-6">
            {filteredItems.map((item) => (
              <div
                key={item.id}
                className="break-inside-avoid group relative bg-[hsl(var(--surface-container-lowest))] rounded-xl overflow-hidden hover:shadow-xl hover:shadow-[hsl(var(--on-surface))]/5 transition-all cursor-pointer"
              >
                <img
                  src={item.image}
                  alt={item.title}
                  className="w-full object-cover group-hover:scale-105 transition-transform duration-700"
                />
                {/* Hover Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-[hsl(var(--on-surface))]/80 via-[hsl(var(--on-surface))]/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-4">
                  <h3 className="text-sm font-bold text-white mb-1">{item.title}</h3>
                  <p className="text-xs text-white/80 mb-3">by {item.author}</p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1 text-xs text-white/90">
                        <Eye className="w-3.5 h-3.5" />
                        {item.views}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-white/90">
                        <Heart className="w-3.5 h-3.5" />
                        {item.likes}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-8 h-8 text-white hover:bg-white/20"
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                {/* Category Badge */}
                <Badge className="absolute top-3 left-3 bg-black/40 text-white border-0 text-[10px] px-2 py-0.5 rounded-full backdrop-blur-sm">
                  {categories.find((c) => c.id === item.category)?.label}
                </Badge>
              </div>
            ))}
          </div>

          {filteredItems.length === 0 && (
            <div className="text-center py-24">
              <p className="text-[hsl(var(--secondary))]">没有找到匹配的作品</p>
            </div>
          )}
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-[hsl(var(--surface))] w-full py-12 px-8 border-t border-[hsl(var(--outline-variant))]/15">
        <div className="flex flex-col md:flex-row justify-between items-center max-w-7xl mx-auto gap-8">
          <div className="flex flex-col items-center md:items-start gap-4">
            <span className="font-bold text-[hsl(var(--on-surface))] text-xl">MangaCanvas</span>
            <p className="text-xs text-[hsl(var(--on-secondary-fixed-variant))] max-w-xs text-center md:text-left">
              面向全球漫画和连环画创作者的顶级编辑生态系统。
            </p>
          </div>
          <div className="flex gap-8">
            <Link to="/privacy" className="text-xs text-[hsl(var(--secondary))] hover:text-[hsl(var(--primary))] transition-opacity opacity-80 hover:opacity-100">
              隐私政策
            </Link>
            <Link to="/terms" className="text-xs text-[hsl(var(--secondary))] hover:text-[hsl(var(--primary))] transition-opacity opacity-80 hover:opacity-100">
              服务条款
            </Link>
            <Link to="/contact" className="text-xs text-[hsl(var(--secondary))] hover:text-[hsl(var(--primary))] transition-opacity opacity-80 hover:opacity-100">
              联系我们
            </Link>
          </div>
          <p className="text-xs text-[hsl(var(--on-secondary-fixed-variant))]">
            © 2024 Kinetic Gallery. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}
