import { useState, useCallback } from 'react';
import { message } from 'antd';
import { videoService } from '@/api/aigc';
import type { TaskStatus } from '@/api/aigc';
import { isCanceledError } from '@/api/core';
import type { VideoGenerationParams } from '../types';
import type { GenerationProgressHandler } from './useImageGeneration';

const STATUS_LABEL: Record<TaskStatus, string> = {
  PENDING: '任务排队中...',
  RUNNING: '视频生成中...',
  SUCCEEDED: '生成完成！',
  FAILED: '生成失败',
  UNKNOWN: '处理中...',
};

interface UseVideoGenerationReturn {
  generate: (params: VideoGenerationParams, onProgress?: GenerationProgressHandler) => Promise<string | null>;
  loading: boolean;
  error: string | null;
  status: string;
}

export function useVideoGeneration(): UseVideoGenerationReturn {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('');

  const generate = useCallback(async (
    params: VideoGenerationParams,
    onProgress?: GenerationProgressHandler
  ): Promise<string | null> => {
    setLoading(true);
    setError(null);
    setStatus('准备中...');

    try {
      const videoUrl = await videoService.generate({
        model: params.model,
        prompt: params.prompt,
        firstFrameImage: params.first_frame_image || params.images?.[0],
        lastFrameImage: params.last_frame_image,
        images: params.images,
        imageNames: params.imageNames,
        size: params.size,
        resolution: params.resolution,
        duration: params.seconds,
        template: params.template,
        signal: params.signal,
        onProgress: (progress) => {
          const label = STATUS_LABEL[progress.status] ?? progress.status;
          setStatus(label);
          onProgress?.(label, progress.percent);
        },
      });

      message.success('视频生成完成！');
      setLoading(false);
      setStatus('');
      return videoUrl;
    } catch (err: unknown) {
      setLoading(false);
      setStatus('');
      if (isCanceledError(err) || params.signal?.aborted) {
        throw err;
      }
      const is429 = err instanceof Error && (
        err.message.includes('429') ||
        (err as { response?: { status?: number } }).response?.status === 429
      );
      const errorMessage = is429 ? 'API_RATE_LIMIT' : (err instanceof Error ? err.message : '视频生成失败');
      setError(errorMessage);
      if (!is429) {
        message.error(errorMessage);
      }
      throw new Error(errorMessage);
    }
  }, []);

  return { generate, loading, error, status };
}
