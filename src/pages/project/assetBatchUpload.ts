import type { CharacterCreateData, ObjectCreateData, SceneCreateData } from "@/types"

export type AssetBatchUploadKind = "character" | "scene" | "object"

export type AssetBatchUploadCreateData =
  | CharacterCreateData
  | SceneCreateData
  | ObjectCreateData

export function fileNameToAssetName(filename: string, fallback: string) {
  const basename = filename.split("/").pop() || filename
  return basename.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ").trim() || fallback
}

export function buildUploadedAssetPayload(
  kind: AssetBatchUploadKind,
  name: string,
  imageUrl: string,
): AssetBatchUploadCreateData {
  if (kind === "character") {
    return {
      name,
      gender: "other",
      ageGroup: "young",
      genMethod: "upload",
      model: "",
      description: "",
      referenceImage: imageUrl,
      creationMode: "quick",
    } satisfies CharacterCreateData
  }
  if (kind === "scene") {
    return {
      name,
      genMethod: "upload",
      model: "",
      description: "",
      distance: 8,
      zoom: 0.6,
      status: "in-use",
      referenceImage: imageUrl,
      creationMode: "quick",
    } satisfies SceneCreateData
  }
  return {
    name,
    genMethod: "upload",
    model: "",
    prompt: "",
    aspectRatio: "1:1",
    referenceImage: imageUrl,
    creationMode: "quick",
  } satisfies ObjectCreateData
}
