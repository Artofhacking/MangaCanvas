import { useState } from "react"
import { ImageGenerationForm } from "@/components/forms/ImageGenerationForm"
import { defaultImageGenerationConfig } from "@/lib/generateSettings"

export default function GenerateSettingsPreview() {
  const [value, setValue] = useState(() =>
    defaultImageGenerationConfig({
      model: "wan2.7-image",
      prompt: "一位手持灯笼的少年，暖纸色漫画风，3:4 构图。",
    })
  )

  return (
    <div className="min-h-screen bg-[hsl(var(--surface))] px-6 py-10">
      <div className="mx-auto w-full max-w-[720px] space-y-4">
        <p className="text-xs font-semibold tracking-wide text-[hsl(var(--secondary))]">DEV · 素材生成参数</p>
        <h1 className="text-2xl font-bold text-[hsl(var(--on-surface))]">Lib 风格生成设置预览</h1>
        <div className="rounded-2xl bg-[hsl(var(--surface-container-lowest))] p-6 shadow-sm">
          <ImageGenerationForm value={value} onChange={setValue} directory="characters" />
        </div>
      </div>
    </div>
  )
}
