import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Input, Select, Tabs, Button, Checkbox, message } from 'antd';
import { useParams } from 'react-router-dom';
import { persistMedia } from '@/api/aigc/imageService';
import { projectAssetsApi } from '@/api/projectAssetsApi';
import { projectApi } from '@/api/projectApi';
import type { ProjectAssetDTO } from '@/api/types';
import { buildCollectMetadata, favoriteSourceId, notifyFavoritesChanged } from '@/lib/favorites';
import {
  listProjectVideoAssets,
  materialCategoryOptions,
  normalizeMaterialCategory,
  type MaterialLibraryCategory,
} from '@/lib/projectVideos';
import { mediaUrl } from '@/lib/mediaUrl';
import { resolveProjectId } from '@/lib/session';
import { useProjectStore } from '@/store/projectStore';
import {
  ALSO_ADD_TO_FAVORITES_LABEL,
  initialAlsoFavorite,
  saveMaterialsEmptyWarning,
  saveMaterialsModalTitle,
  saveMaterialsResultMessage,
  saveMaterialsSubmitLabel,
} from './saveToMaterialsCopy';

type SaveMode = 'create' | 'existing';
type MediaType = 'image' | 'video';

interface SaveToMaterialsModalProps {
  open: boolean;
  onClose: () => void;
  imageUrl?: string;
  mediaType?: MediaType;
  initialName?: string;
  initialCategory?: string;
  nodeId?: string;
  confirmLabel?: string;
  /** Initial state of「同时加入我的收藏」. Preview star passes true; node menus leave it off. */
  asFavorite?: boolean;
  prompt?: string;
  onSaved?: (asset: ProjectAssetDTO) => void;
}

const SaveToMaterialsModal: React.FC<SaveToMaterialsModalProps> = ({
  open,
  onClose,
  imageUrl,
  mediaType = 'image',
  initialName,
  initialCategory,
  nodeId,
  confirmLabel,
  asFavorite = false,
  prompt,
  onSaved,
}) => {
  const { projectId, workflowId, id } = useParams();
  const routeProjectId = Number(projectId || id);
  const numericProjectId =
    Number.isFinite(routeProjectId) && routeProjectId > 0 ? routeProjectId : resolveProjectId();
  const loadProjectAssets = useProjectStore((state) => state.loadProjectAssets);
  const [mode, setMode] = useState<SaveMode>('create');
  const [name, setName] = useState(initialName || '');
  const [category, setCategory] = useState<MaterialLibraryCategory>(normalizeMaterialCategory(initialCategory, mediaType));
  const [targetId, setTargetId] = useState<number>();
  const [existingOptions, setExistingOptions] = useState<Array<{ label: string; value: number }>>([]);
  const [submitting, setSubmitting] = useState(false);
  const [alsoFavorite, setAlsoFavorite] = useState(() => initialAlsoFavorite(asFavorite));

  useEffect(() => {
    if (!open) return;
    setMode('create');
    setName(initialName || (mediaType === 'video' ? '视频素材' : '图片素材'));
    setCategory(normalizeMaterialCategory(initialCategory, mediaType));
    setTargetId(undefined);
    setSubmitting(false);
    setAlsoFavorite(initialAlsoFavorite(asFavorite));
  }, [open, initialCategory, initialName, mediaType, asFavorite]);

  useEffect(() => {
    if (!open || !numericProjectId) return;
    let cancelled = false;
    const apply = (options: Array<{ label: string; value: number }>) => {
      if (!cancelled) setExistingOptions(options);
    };
    if (category === 'video') {
      void listProjectVideoAssets(numericProjectId)
        .then((items) => {
          apply(items.map((item) => ({ label: item.name?.trim() || `视频 ${item.id}`, value: item.id })));
        })
        .catch(() => apply([]));
    } else {
      const loader =
        category === 'character'
          ? projectApi.characters.getAll(numericProjectId)
          : category === 'scene'
            ? projectApi.scenes.getAll(numericProjectId)
            : projectApi.objects.getAll(numericProjectId);
      void loader.then((response) => {
        if (!response.success) return;
        apply(
          (response.data || []).map((item) => ({
            label: item.name,
            value: item.id,
          }))
        );
      });
    }
    return () => {
      cancelled = true;
    };
  }, [category, numericProjectId, open]);

  const modalTitle = useMemo(() => saveMaterialsModalTitle(mode), [mode]);

  const finishSave = async (catalogFailed = false, asset?: ProjectAssetDTO) => {
    if (!numericProjectId) return;
    await loadProjectAssets(numericProjectId, true);
    if (alsoFavorite) notifyFavoritesChanged();
    if (asset) onSaved?.(asset);
    const result = saveMaterialsResultMessage({
      alsoFavorite,
      mode,
      category,
      catalogFailed,
    });
    if (result.level === 'warning') message.warning(result.text);
    else message.success(result.text);
    onClose();
  };

  const handleSubmit = async () => {
    if (!imageUrl) {
      message.warning(saveMaterialsEmptyWarning(mediaType));
      return;
    }
    if (!numericProjectId) {
      message.error('当前项目信息缺失');
      return;
    }
    if (mode === 'create' && !name.trim()) {
      message.warning('请输入素材名称');
      return;
    }
    if (mode === 'existing' && !targetId) {
      message.warning('请选择要添加到的素材');
      return;
    }

    setSubmitting(true);
    try {
      let persistedUrl = imageUrl;
      try {
        persistedUrl = await persistMedia(imageUrl);
      } catch {
        persistedUrl = imageUrl;
      }
      const creationMode = workflowId ? 'workflow' : 'quick';
      const writeCatalog = async () => {
        if (category === 'video') return;
        if (mode === 'create') {
          if (category === 'character') {
            const created = await projectApi.characters.create(numericProjectId, {
              name: name.trim(),
              gender: 'unknown',
              ageGroup: 'young',
              role: 'support',
              genMethod: 'ai',
              model: 'wan2.6-t2i',
              description: '',
              referenceImage: persistedUrl,
              creationMode,
              sourceWorkflowId: workflowId,
              sourceNodeId: nodeId,
            });
            if (!created.success) throw new Error(created.message || '保存角色失败');
          } else if (category === 'scene') {
            const created = await projectApi.scenes.create(numericProjectId, {
              name: name.trim(),
              genMethod: 'ai',
              model: 'wan2.6-t2i',
              description: '',
              distance: 20,
              status: 'draft',
              referenceImage: persistedUrl,
              creationMode,
              sourceWorkflowId: workflowId,
              sourceNodeId: nodeId,
            });
            if (!created.success) throw new Error(created.message || '保存场景失败');
          } else {
            const created = await projectApi.objects.create(numericProjectId, {
              name: name.trim(),
              genMethod: 'upload',
              prompt: '',
              referenceImage: persistedUrl,
              creationMode,
              sourceWorkflowId: workflowId,
              sourceNodeId: nodeId,
            });
            if (!created.success) throw new Error(created.message || '保存物品失败');
          }
        } else if (targetId) {
          if (category === 'character') {
            await projectApi.characters.update(numericProjectId, targetId, { image: persistedUrl });
          } else if (category === 'scene') {
            await projectApi.scenes.update(numericProjectId, targetId, { image: persistedUrl });
          } else {
            await projectApi.objects.update(numericProjectId, targetId, { image: persistedUrl });
          }
        }
      };

      const saveProjectAsset = () =>
        projectAssetsApi.create(numericProjectId, {
          name: (name.trim() || initialName || '画布素材').slice(0, 128),
          sourceType: 'workflow',
          sourceId: (alsoFavorite
            ? favoriteSourceId(nodeId, persistedUrl)
            : workflowId || nodeId || `node-${Date.now()}`
          ).slice(0, 64),
          url: persistedUrl,
          prompt: prompt?.trim() || undefined,
          metadata: buildCollectMetadata(
            { category, nodeId, mediaType, sourceUrl: imageUrl },
            alsoFavorite,
          ),
        });

      if (category === 'video' && mode === 'existing' && targetId) {
        await projectAssetsApi.update(numericProjectId, targetId, {
          url: persistedUrl,
          ...(prompt?.trim() ? { prompt: prompt.trim() } : {}),
          ...(alsoFavorite
            ? {
                metadata: buildCollectMetadata(
                  { category: 'video', nodeId, mediaType: 'video', sourceUrl: imageUrl },
                  true,
                ),
              }
            : {}),
        });
        await finishSave();
        return;
      }

      if (alsoFavorite) {
        const asset = await saveProjectAsset();
        let catalogError: unknown = null;
        try {
          await writeCatalog();
        } catch (error) {
          catalogError = error;
        }
        await finishSave(Boolean(catalogError), asset);
        return;
      }

      await writeCatalog();
      await saveProjectAsset();
      await finishSave();
    } catch (error) {
      message.error(error instanceof Error ? error.message : '保存素材失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      destroyOnClose
      width={920}
      title={null}
      zIndex={1200}
      styles={{
        body: { padding: 0 },
        content: {
          overflow: 'hidden',
          borderRadius: 24,
          padding: 0,
          background: 'hsl(var(--surface))',
        },
      }}
    >
      <div className="flex flex-col">
        <div className="border-b border-[hsl(var(--outline-variant))]/20 px-6 pt-5">
          <Tabs
            activeKey={mode}
            onChange={(key) => setMode(key as SaveMode)}
            items={[
              { key: 'create', label: '保存为新素材' },
              { key: 'existing', label: '添加到已有素材' },
            ]}
            className="[&_.ant-tabs-nav]:mb-0 [&_.ant-tabs-tab]:px-0 [&_.ant-tabs-tab]:pb-4 [&_.ant-tabs-tab]:pt-0 [&_.ant-tabs-tab+.ant-tabs-tab]:ml-8 [&_.ant-tabs-tab-btn]:text-base [&_.ant-tabs-tab-active_.ant-tabs-tab-btn]:font-semibold"
          />
        </div>

        <div className="grid grid-cols-[360px_minmax(0,1fr)] gap-8 px-6 py-6">
          <div>
            <div className="mb-3 text-sm font-medium text-[hsl(var(--secondary))]">封面</div>
            <div className="overflow-hidden rounded-[24px] border border-[hsl(var(--outline-variant))]/20 bg-[hsl(var(--surface-container-low))]">
              <div className="aspect-[3/4] w-full bg-[hsl(var(--surface-container-low))]">
                {imageUrl ? (
                  mediaType === 'video' ? (
                    <video
                      src={mediaUrl(imageUrl)}
                      className="h-full w-full bg-black object-cover"
                      muted
                      playsInline
                      autoPlay
                      loop
                      preload="metadata"
                    />
                  ) : (
                    <img src={mediaUrl(imageUrl)} alt={initialName || '素材封面'} className="h-full w-full object-cover" />
                  )
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-[hsl(var(--secondary))]">
                    暂无封面
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex min-h-[520px] flex-col">
            <div className="mb-6">
              <div className="text-2xl font-bold text-[hsl(var(--on-surface))]">{modalTitle}</div>
              <div className="mt-2 text-sm text-[hsl(var(--secondary))]">
                {mediaType === 'video'
                  ? '默认写入「项目资产 → 视频管理」。也可以归到角色、场景或物品，并在素材面板里拖回画布。'
                  : '将当前图片写回角色、场景或物品库，之后可在素材面板和片段中继续使用。'}
              </div>
            </div>

            {mode === 'create' ? (
              <div className="space-y-6">
                <div>
                  <label className="mb-2 block text-sm font-medium text-[hsl(var(--on-surface))]">
                    名称 <span className="text-red-500">*</span>
                  </label>
                  <Input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="请输入素材名称"
                    className="h-12 rounded-2xl bg-[hsl(var(--surface-container-low))] px-4"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-[hsl(var(--on-surface))]">
                    分类 <span className="text-red-500">*</span>
                  </label>
                  <Select
                    value={category}
                    onChange={(value) => setCategory(value)}
                    options={materialCategoryOptions(mediaType)}
                    className="w-full"
                    size="large"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div>
                  <label className="mb-2 block text-sm font-medium text-[hsl(var(--on-surface))]">分类</label>
                  <Select
                    value={category}
                    onChange={(value) => {
                      setCategory(value);
                      setTargetId(undefined);
                    }}
                    options={materialCategoryOptions(mediaType)}
                    className="w-full"
                    size="large"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-[hsl(var(--on-surface))]">已有素材</label>
                  <Select
                    value={targetId}
                    onChange={(value) => setTargetId(value)}
                    options={existingOptions}
                    placeholder="请选择已有素材"
                    className="w-full"
                    size="large"
                  />
                </div>
              </div>
            )}

            <div className="mt-auto pt-10">
              <div className="rounded-2xl bg-[hsl(var(--surface-container-low))] px-4 py-3">
                <Checkbox
                  checked={alsoFavorite}
                  onChange={(event) => setAlsoFavorite(event.target.checked)}
                >
                  <span className="text-sm font-medium text-[hsl(var(--on-surface))]">
                    {ALSO_ADD_TO_FAVORITES_LABEL}
                  </span>
                </Checkbox>
                <p className="mt-1 pl-6 text-xs leading-5 text-[hsl(var(--secondary))]">
                  勾选后会带上收藏标记，并出现在「项目资产 → 我的收藏」。
                </p>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <Button onClick={onClose} size="large" className="rounded-2xl px-6">
                  取消
                </Button>
                <Button type="primary" onClick={() => void handleSubmit()} loading={submitting} size="large" className="rounded-2xl px-8">
                  {saveMaterialsSubmitLabel(mode, alsoFavorite, confirmLabel)}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default SaveToMaterialsModal;
