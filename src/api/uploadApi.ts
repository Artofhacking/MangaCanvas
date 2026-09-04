/**
 * 文件上传 API
 * 支持预签名上传流程：获取上传 URL -> 直传 OSS -> 确认上传
 */

import { appClient } from './clients/appClient'
import { requestData } from './core/response'
import type { ListData } from './types'

// ==================== 类型定义 ====================

/** 文件目录类型 */
export type UploadDirectory = 'characters' | 'scenes' | 'objects' | 'episodes' | 'assets' | 'avatars'

/** 预签名请求参数 */
export interface PresignedUrlRequest {
  /** 原始文件名 */
  filename: string
  /** MIME 类型，如 image/jpeg */
  contentType: string
  /** 上传目录 */
  directory: UploadDirectory
}

/** 预签名响应 */
export interface PresignedUrlResponse {
  /** 预签名上传地址（PUT 请求） */
  uploadUrl: string
  /** 上传成功后的访问地址 */
  accessUrl: string
  /** 签名有效期（秒） */
  expiresIn: number
}

/** 上传确认请求 */
export interface UploadConfirmRequest {
  /** 文件的访问地址 */
  accessUrl: string
  /** 上传目录 */
  directory: UploadDirectory
  /** 关联的资源 ID（可选） */
  relatedId?: number | string
}

/** 上传确认响应 */
export interface UploadConfirmResponse {
  /** 访问地址 */
  accessUrl: string
  /** 是否确认成功 */
  confirmed: boolean
}

/** 已上传文件信息 */
export interface UploadedFile {
  id: number
  url: string
  directory: UploadDirectory
  filename: string
  contentType: string
  size?: number
  relatedId?: number | string
  createdBy?: number
  createdAt: string
}

// ==================== API 实现 ====================

export const uploadApi = {
  /**
   * 获取预签名上传 URL
   * @param params 预签名请求参数
   * @returns 预签名响应，包含 uploadUrl 和 accessUrl
   */
  async getPresignedUrl(params: PresignedUrlRequest): Promise<PresignedUrlResponse> {
    return requestData<PresignedUrlResponse>(appClient, {
      url: '/upload/presigned',
      method: 'POST',
      data: params,
    })
  },

  /**
   * 确认上传完成
   * @param params 上传确认请求参数
   * @returns 确认响应
   */
  async confirmUpload(params: UploadConfirmRequest): Promise<UploadConfirmResponse> {
    return requestData<UploadConfirmResponse>(appClient, {
      url: '/upload/confirm',
      method: 'POST',
      data: params,
    })
  },

  /**
   * 直传文件到 OSS（使用预签名 URL）
   * @param uploadUrl 预签名上传 URL
   * @param file 文件对象
   * @param contentType MIME 类型
   * @returns 是否上传成功
   */
  async uploadToOSS(uploadUrl: string, file: File, contentType: string): Promise<boolean> {
    const response = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': contentType,
      },
      body: file,
    })

    if (!response.ok) {
      throw new Error(`上传失败: ${response.status} ${response.statusText}`)
    }

    return true
  },

  /**
   * 完整的单文件上传流程（简化版）
   * @param file 要上传的文件
   * @param directory 上传目录
   * @param relatedId 关联资源 ID（可选）
   * @returns 上传后的访问地址
   */
  async uploadSingleFile(
    file: File,
    directory: UploadDirectory,
    relatedId?: number | string
  ): Promise<string> {
    // 1. 获取预签名 URL
    const presigned = await this.getPresignedUrl({
      filename: file.name,
      contentType: file.type,
      directory,
    })

    // 2. 直传 OSS
    await this.uploadToOSS(presigned.uploadUrl, file, file.type)

    // 3. 确认上传
    await this.confirmUpload({
      accessUrl: presigned.accessUrl,
      directory,
      relatedId,
    })

    return presigned.accessUrl
  },

  /**
   * 获取已上传文件列表（管理后台用）
   * @param params 查询参数
   * @returns 文件列表
   */
  async listFiles(params?: {
    page?: number
    size?: number
    directory?: UploadDirectory
    relatedId?: number | string
  }): Promise<ListData<UploadedFile>> {
    return requestData<ListData<UploadedFile>>(appClient, {
      url: '/upload/files',
      method: 'GET',
      params,
    })
  },
}

export default uploadApi
