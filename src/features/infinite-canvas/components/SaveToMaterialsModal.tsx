import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Input, Select, Tabs, Button, message } from 'antd';

type MaterialCategory = 'character' | 'scene' | 'object';
type SaveMode = 'create' | 'existing';

interface SaveToMaterialsModalProps {
  open: boolean;
  onClose: () => void;
  imageUrl?: string;
  initialName?: string;
  initialCategory?: string;
}

const categoryOptions = [
  { label: '人物', value: 'character' },
  { label: '场景', value: 'scene' },
  { label: '物品', value: 'object' },
];

const existingFolderOptions = [
  { label: '角色设定素材', value: 'folder-character' },
  { label: '场景参考图库', value: 'folder-scene' },
  { label: '物品道具库', value: 'folder-object' },
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
}) => {
  const [mode, setMode] = useState<SaveMode>('create');
  const [name, setName] = useState(initialName || '');
  const [category, setCategory] = useState<MaterialCategory>(normalizeCategory(initialCategory));
  const [targetFolder, setTargetFolder] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setMode('create');
    setName(initialName || '图片素材');
    setCategory(normalizeCategory(initialCategory));
    setTargetFolder(undefined);
    setSubmitting(false);
  }, [open, initialCategory, initialName]);

  const modalTitle = useMemo(
    () => (mode === 'create' ? '创建素材文件夹' : '添加到已有素材文件'),
    [mode]
  );

  const handleSubmit = async () => {
    if (!imageUrl) {
      message.warning('当前图片节点没有可保存的图片');
      return;
    }

    if (mode === 'create') {
      if (!name.trim()) {
        message.warning('请输入素材名称');
        return;
      }

      if (!category) {
        message.warning('请选择素材分类');
        return;
      }
    }

    if (mode === 'existing' && !targetFolder) {
      message.warning('请选择要添加到的素材文件');
      return;
    }

    setSubmitting(true);
    window.setTimeout(() => {
      message.success(mode === 'create' ? '素材文件夹已创建' : '已添加到现有素材文件');
      setSubmitting(false);
      onClose();
    }, 300);
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
              { key: 'create', label: '创建素材文件夹' },
              { key: 'existing', label: '添加到已有素材文件' },
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
                将当前图片节点保存为素材，便于后续在画布中重复使用。
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
                  <label className="mb-2 block text-sm font-medium text-[hsl(var(--on-surface))]">
                    素材文件
                  </label>
                  <Select
                    value={targetFolder}
                    onChange={(value) => setTargetFolder(value)}
                    options={existingFolderOptions}
                    placeholder="请选择已有素材文件"
                    className="w-full"
                    size="large"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-[hsl(var(--on-surface))]">当前图片名称</label>
                  <Input
                    value={initialName || ''}
                    readOnly
                    className="h-12 rounded-2xl bg-[hsl(var(--surface-container-low))] px-4"
                  />
                </div>
              </div>
            )}

            <div className="mt-auto flex justify-end gap-3 pt-10">
              <Button onClick={onClose} size="large" className="rounded-2xl px-6">
                取消
              </Button>
              <Button type="primary" onClick={handleSubmit} loading={submitting} size="large" className="rounded-2xl px-8">
                {mode === 'create' ? '创建' : '保存'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default SaveToMaterialsModal;
