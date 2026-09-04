import { useState, useCallback } from 'react';
import { message } from 'antd';
import { imageService, isI2IModel } from '@/api/aigc';
import type { TaskStatus } from '@/api/aigc';
import type { ImageGenerationParams } from '../types';

const STATUS_LABEL: Record<TaskStatus, string> = {
  PENDING: '任务排队中...',
  RUNNING: '图片生成中...',
  SUCCEEDED: '生成完成！',
  FAILED: '生成失败',
  UNKNOWN: '处理中...',
};

interface UseImageGenerationReturn {
  generate: (params: ImageGenerationParams, onProgress?: (status: string) => void) => Promise<string[] | null>;
  loading: boolean;
  error: string | null;
  status: string;
}

export function useImageGeneration(): UseImageGenerationReturn {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('');

  const generate = useCallback(async (
    params: ImageGenerationParams,
    onProgress?: (status: string) => void
  ): Promise<string[] | null> => {
    setLoading(true);
    setError(null);
    setStatus('准备中...');

    try {
      const urls = await imageService.generate({
        model: params.model,
        prompt: params.prompt,
        size: params.size,
        quality: params.quality,
        images: isI2IModel(params.model) ? params.images : undefined,
        n: params.n,
        onProgress: (progress) => {
          const label = STATUS_LABEL[progress.status] ?? progress.status;
          setStatus(label);
          onProgress?.(label);
        },
      });

      setLoading(false);
      setStatus('');
      return urls;
    } catch (err: unknown) {
      const is429 = err instanceof Error && (
        err.message.includes('429') ||
        (err as { response?: { status?: number } }).response?.status === 429
      );
      const errorMessage = is429 ? 'API_RATE_LIMIT' : (err instanceof Error ? err.message : '图片生成失败');
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
