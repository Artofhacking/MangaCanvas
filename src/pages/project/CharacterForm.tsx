import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu"
import { ChevronDown } from "lucide-react"
import type { Character } from "@/types"

const genderOptions = [
  { value: "male", label: "男" },
  { value: "female", label: "女" },
  { value: "other", label: "其他" },
]

const ageOptions = [
  { value: "child", label: "儿童" },
  { value: "teen", label: "少年" },
  { value: "young", label: "青年" },
  { value: "middle", label: "中年" },
  { value: "old", label: "老年" },
]

export type CharacterFormValues = {
  name: string
  gender: string
  ageGroup: string
  style: string
  prompt: string
}

interface CharacterFormProps {
  initialData?: Character | null
  onValuesChange?: (values: CharacterFormValues) => void
  promptLocked?: boolean
}

export default function CharacterForm({
  initialData,
  onValuesChange,
  promptLocked = false,
}: CharacterFormProps) {
  const [gender, setGender] = useState(initialData?.gender || "")
  const [age, setAge] = useState(initialData?.ageGroup || "")
  const [characterName, setCharacterName] = useState(initialData?.name || "")
  const [style, setStyle] = useState(initialData?.style || "")
  const [prompt, setPrompt] = useState(initialData?.description || "")

  useEffect(() => {
    onValuesChange?.({
      name: characterName,
      gender,
      ageGroup: age,
      style,
      prompt,
    })
  }, [age, characterName, gender, onValuesChange, prompt, style])

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-[hsl(var(--on-surface))]">
            <span className="text-red-500 mr-1">*</span>角色名称
          </label>
          <Input
            value={characterName}
            onChange={(e) => setCharacterName(e.target.value)}
            placeholder="请输入"
            className="h-11 rounded-xl bg-[hsl(var(--surface-container-low))] border-none text-sm placeholder:text-[hsl(var(--secondary))] focus-visible:ring-1 focus-visible:ring-[hsl(var(--primary))]"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-[hsl(var(--on-surface))]">
            <span className="text-red-500 mr-1">*</span>性别
          </label>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="w-full h-11 justify-between rounded-xl bg-[hsl(var(--surface-container-low))] hover:bg-[hsl(var(--surface-container-high))] text-sm font-normal px-3"
              >
                <span className={gender ? "text-[hsl(var(--on-surface))]" : "text-[hsl(var(--secondary))]"}>
                  {gender ? genderOptions.find(g => g.value === gender)?.label : "请选择"}
                </span>
                <ChevronDown className="w-4 h-4 text-[hsl(var(--secondary))]" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56">
              {genderOptions.map((option) => (
                <DropdownMenuItem key={option.value} onClick={() => setGender(option.value)}>
                  {option.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-[hsl(var(--on-surface))]">
            <span className="text-red-500 mr-1">*</span>年龄段
          </label>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="w-full h-11 justify-between rounded-xl bg-[hsl(var(--surface-container-low))] hover:bg-[hsl(var(--surface-container-high))] text-sm font-normal px-3"
              >
                <span className={age ? "text-[hsl(var(--on-surface))]" : "text-[hsl(var(--secondary))]"}>
                  {age ? ageOptions.find(a => a.value === age)?.label : "请选择"}
                </span>
                <ChevronDown className="w-4 h-4 text-[hsl(var(--secondary))]" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56">
              {ageOptions.map((option) => (
                <DropdownMenuItem key={option.value} onClick={() => setAge(option.value)}>
                  {option.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-[hsl(var(--on-surface))]">风格</label>
          <Input
            value={style}
            onChange={(e) => setStyle(e.target.value)}
            placeholder="如：赛博朋克、水墨风"
            className="h-11 rounded-xl bg-[hsl(var(--surface-container-low))] border-none text-sm placeholder:text-[hsl(var(--secondary))] focus-visible:ring-1 focus-visible:ring-[hsl(var(--primary))]"
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-[hsl(var(--on-surface))]">
          提示词
          {promptLocked ? (
            <span className="ml-2 text-xs font-normal text-[hsl(var(--secondary))]">已锁定，改之前请先解锁</span>
          ) : null}
        </label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          disabled={promptLocked}
          placeholder="外貌、服装和气质。出图请到无限画布。"
          className="min-h-[132px] w-full resize-none rounded-2xl border border-[hsl(var(--outline-variant))]/35 bg-[hsl(var(--surface-container-low))] px-4 py-4 text-base text-[hsl(var(--on-surface))] placeholder:text-[hsl(var(--secondary))] focus:outline-none disabled:opacity-50"
        />
      </div>
    </div>
  )
}
