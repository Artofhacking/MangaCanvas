import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Input, Select, Tabs, Button, message } from 'antd';
import { useParams } from 'react-router-dom';
import { persistMedia } from '@/api/aigc/imageService';
import { projectAssetsApi } from '@/api/projectAssetsApi';
import { projectApi } from '@/api/projectApi';
import { useProjectStore } from '@/store/projectStore';

type MaterialCategory = 'character' | 'scene' | 'object';
type SaveMode = 'create' | 'existing';

interface SaveToMaterialsModalProps {
  open: boolean;
  onClose: () => void;
  imageUrl?: string;
  initialName?: string;
  initialCategory?: string;
  nodeId?: string;
}

const categoryOptions = [
  { label: '人物', value: 'character' },
  { label: '场景', value: 'scene' },
  { label: '物品', value: 'object' },
];

const normalizeCategory = (value?: string): MaterialCategory => {
  if (value === 'character' || value === 'scene' || value === 'object') {
    return value;
  }
  return 'object';
};

const SaveToMaterialsModal: React.FC<SaveToMaterialsModalProps> = ({
  open,
  onClose,
  imageUrl,
  initialName,
  initialCategory,
  nodeId,
}) => {
  const { projectId, workflowId, id } = useParams();
  const numericProjectId = Number(projectId || id);
  const loadProjectAssets = useProjectStore((state) => state.loadProjectAssets);
  const [mode, setMode] = useState<SaveMode>('create');
  const [name, setName] = useState(initialName || '');
  const [category, setCategory] = useState<MaterialCategory>(normalizeCategory(initialCategory));
  const [targetId, setTargetId] = useState<number>();
  const [existingOptions, setExistingOptions] = useState<Array<{ label: string; value: number }>>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setMode('create');
    setName(initialName || '图片素材');
    setCategory(normalizeCategory(initialCategory));
    setTargetId(undefined);
    setSubmitting(false);
  }, [open, initialCategory, initialName]);

  useEffect(() => {
    if (!open || Number.isNaN(numericProjectId) || numericProjectId <= 0) return;
    const loader =
      category === 'character'
        ? projectApi.characters.getAll(numericProjectId)
        : category === 'scene'
          ? projectApi.scenes.getAll(numericProjectId)
          : projectApi.objects.getAll(numericProjectId);
    void loader.then((response) => {
      if (!response.success) return;
      setExistingOptions(
        (response.data || []).map((item) => ({
          label: item.name,
          value: item.id,
        }))
      );
    });
  }, [category, numericProjectId, open]);

  const modalTitle = useMemo(
    () => (mode === 'create' ? '保存为新素材' : '添加到已有素材'),
    [mode]
  );

  const handleSubmit = async () => {
    if (!imageUrl) {
      message.warning('当前图片节点没有可保存的图片');
      return;
    }
    if (Number.isNaN(numericProjectId) || numericProjectId <= 0) {
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

      await projectAssetsApi.create(numericProjectId, {
        name: name.trim() || initialName || '画布素材',
        sourceType: 'workflow',
        sourceId: workflowId || nodeId || `node-${Date.now()}`,
        url: persistedUrl,
        metadata: { category, nodeId },
      });
      await loadProjectAssets(numericProjectId, true);
      message.success(mode === 'create' ? '已保存到项目素材库' : '已更新已有素材');
      onClose();
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
                  <img src={imageUrl} alt={initialName || '素材封面'} className="h-full w-full object-cover" />
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
                将当前图片写回角色、场景或物品库，之后可在素材面板和片段中继续使用。
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
                    options={categoryOptions}
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
                    options={categoryOptions}
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

            <div className="mt-auto flex justify-end gap-3 pt-10">
              <Button onClick={onClose} size="large" className="rounded-2xl px-6">
                取消
              </Button>
              <Button type="primary" onClick={() => void handleSubmit()} loading={submitting} size="large" className="rounded-2xl px-8">
                {mode === 'create' ? '保存' : '更新'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default SaveToMaterialsModal;
