import { useState, useCallback } from 'react';
import { message } from 'antd';
import { videoService } from '@/api/aigc';
import type { TaskStatus } from '@/api/aigc';
import type { VideoGenerationParams } from '../types';

const STATUS_LABEL: Record<TaskStatus, string> = {
  PENDING: '任务排队中...',
  RUNNING: '视频生成中...',
  SUCCEEDED: '生成完成！',
  FAILED: '生成失败',
  UNKNOWN: '处理中...',
};

interface UseVideoGenerationReturn {
  generate: (params: VideoGenerationParams, onProgress?: (status: string) => void) => Promise<string | null>;
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
    onProgress?: (status: string) => void
  ): Promise<string | null> => {
    setLoading(true);
    setError(null);
    setStatus('准备中...');

    try {
      const videoUrl = await videoService.generate({
        model: params.model,
        prompt: params.prompt,
        firstFrameImage: params.first_frame_image,
        lastFrameImage: params.last_frame_image,
        size: params.size,
        resolution: params.resolution,
        duration: params.seconds,
        template: params.template,
        onProgress: (progress) => {
          const label = STATUS_LABEL[progress.status] ?? progress.status;
          setStatus(label);
          onProgress?.(label);
        },
      });

      message.success('视频生成完成！');
      setLoading(false);
      setStatus('');
      return videoUrl;
    } catch (err: unknown) {
      const is429 = err instanceof Error && (
        err.message.includes('429') ||
        (err as { response?: { status?: number } }).response?.status === 429
      );
      const errorMessage = is429 ? 'API_RATE_LIMIT' : (err instanceof Error ? err.message : '视频生成失败');
      setError(errorMessage);
      setStatus('');
      if (!is429) {
        message.error(errorMessage);
      }
      setLoading(false);
      throw new Error(errorMessage);
    }
  }, []);

  return { generate, loading, error, status };
}
