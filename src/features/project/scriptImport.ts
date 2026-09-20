import type { ScriptImportResult } from "@/features/project/api/scripts"

export type ScriptImportCounts = ScriptImportResult["created"]

function countTotal(counts: ScriptImportCounts) {
  return counts.episodes + counts.scenes + counts.objects + counts.characters
}

function formatCounts(counts: ScriptImportCounts) {
  return `${counts.episodes} 集、${counts.scenes} 个场景、${counts.objects} 件道具、${counts.characters} 个人物`
}

export function formatScriptImportToast(created: ScriptImportCounts, skipped: ScriptImportCounts) {
  const createdTotal = countTotal(created)
  const skippedTotal = countTotal(skipped)
  const createdText = formatCounts(created)
  const skippedText = formatCounts(skipped)

  if (createdTotal === 0 && skippedTotal > 0) {
    return `这些条目已在项目资产中，未重复创建（跳过 ${skippedText}）。可到「剧集管理」查看。`
  }
  if (skippedTotal > 0) {
    return `已写入 ${createdText}；跳过 ${skippedText}。可到「剧集管理」查看。`
  }
  return `已写入 ${createdText}。可到「剧集管理」查看。`
}
