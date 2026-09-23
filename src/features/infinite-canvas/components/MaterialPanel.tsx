import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CloseOutlined, InboxOutlined } from '@ant-design/icons';
import { useParams } from 'react-router-dom';
import { projectApi } from '@/api/projectApi';
import type { CanvasMaterialItem } from '../types';
import { mediaUrl } from '@/lib/mediaUrl';
import { resolveAssetMedia } from '@/lib/assetSeed';

interface MaterialPanelProps {
  visible: boolean;
  onClose: () => void;
  onSelectMaterial: (item: CanvasMaterialItem) => void;
}

type LibraryTab = 'materials' | 'subjects';
type CategoryTab = 'all' | 'character' | 'scene' | 'object';

const libraryTabs: Array<{ key: LibraryTab; label: string }> = [
  { key: 'materials', label: '素材库' },
  { key: 'subjects', label: '角色库' },
];

const categoryTabs: Array<{ key: CategoryTab; label: string }> = [
  { key: 'all', label: '全部' },
  { key: 'character', label: '角色' },
  { key: 'scene', label: '场景' },
  { key: 'object', label: '物品' },
];

const MATERIAL_DRAG_MIME = 'application/x-mangacanvas-material';

function toMaterialItem(
  item: { id: number; name: string; image?: string; description?: string; hasImage?: boolean },
  meta: Pick<CanvasMaterialItem, 'library' | 'category' | 'subtitle' | 'status'>,
): CanvasMaterialItem | null {
  const resolved = resolveAssetMedia({
    name: item.name,
    prompt: item.description,
    image: item.image,
    hasImage: item.hasImage,
  });
  if (resolved.kind === 'none') return null;
  return {
    id: `${meta.category}-${item.id}`,
    library: meta.library,
    category: meta.category,
    title: item.name,
    subtitle: meta.subtitle,
    status: meta.status,
    cover: resolved.imageUrl,
    video: resolved.videoUrl,
    prompt: resolved.prompt || undefined,
    mediaType: resolved.kind,
    hasImage: resolved.kind === 'image',
    hasVideo: resolved.kind === 'video',
  };
}

const MaterialPanel: React.FC<MaterialPanelProps> = ({ visible, onClose, onSelectMaterial }) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const { projectId, id } = useParams();
  const numericProjectId = Number(projectId || id);
  const [activeLibrary, setActiveLibrary] = useState<LibraryTab>('materials');
  const [activeCategory, setActiveCategory] = useState<CategoryTab>('all');
  const [items, setItems] = useState<CanvasMaterialItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!panelRef.current?.contains(event.target as Node)) {
        onClose();
      }
    };

    if (visible) {
      window.setTimeout(() => {
        document.addEventListener('mousedown', handlePointerDown);
      }, 0);
    }

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
    };
  }, [visible, onClose]);

  useEffect(() => {
    if (!visible || Number.isNaN(numericProjectId) || numericProjectId <= 0) return;
    let cancelled = false;
    setLoading(true);
    void Promise.all([
      projectApi.characters.getAll(numericProjectId),
      projectApi.scenes.getAll(numericProjectId),
      projectApi.objects.getAll(numericProjectId),
    ]).then(([characters, scenes, objects]) => {
      if (cancelled) return;
      const next = [
        ...(characters.data || []).map((item) =>
          toMaterialItem(item, {
            library: 'subjects',
            category: 'character',
            subtitle: item.role,
            status: item.role,
          }),
        ),
        ...(scenes.data || []).map((item) =>
          toMaterialItem(item, {
            library: 'materials',
            category: 'scene',
            subtitle: item.status === 'in-use' ? '使用中' : '草稿',
            status: item.status,
          }),
        ),
        ...(objects.data || []).map((item) =>
          toMaterialItem(item, {
            library: 'materials',
            category: 'object',
            subtitle: item.type,
            status: item.status,
          }),
        ),
      ].filter((item): item is CanvasMaterialItem => Boolean(item));
      setItems(next);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [numericProjectId, visible]);

  const visibleItems = useMemo(() => {
    return items.filter((item) => {
      if (activeLibrary === 'subjects' && item.category !== 'character') return false;
      if (activeCategory !== 'all' && item.category !== activeCategory) return false;
      return true;
    });
  }, [activeCategory, activeLibrary, items]);

  const emptyCopy = useMemo(() => {
    if (activeLibrary === 'subjects' || activeCategory === 'character') {
      return {
        title: '暂无角色',
        desc: '在资产管理中创建角色后，就可以拖进画布。',
      };
    }
    if (activeCategory === 'scene') {
      return {
        title: '暂无场景',
        desc: '在资产管理中创建场景后，就可以拖进画布。',
      };
    }
    if (activeCategory === 'object') {
      return {
        title: '暂无物品',
        desc: '在资产管理中创建物品后，就可以拖进画布。',
      };
    }
    return {
      title: '暂无素材',
      desc: '在资产管理中创建角色、场景或物品后，就可以拖进画布。',
    };
  }, [activeCategory, activeLibrary]);

  const handleItemDragStart = (event: React.DragEvent<HTMLButtonElement>, item: CanvasMaterialItem) => {
    event.dataTransfer.setData(MATERIAL_DRAG_MIME, JSON.stringify(item));
    event.dataTransfer.effectAllowed = 'copy';
  };

  if (!visible) return null;

  return (
    <div
      ref={panelRef}
      className="absolute bottom-3 left-[88px] top-20 z-20 w-[380px] overflow-hidden rounded-[26px] border border-[hsl(var(--outline-variant))]/20 bg-[hsl(var(--surface-container-lowest))]/96 text-[hsl(var(--on-surface))] shadow-2xl shadow-black/10 backdrop-blur-xl"
      style={{ animation: 'materialPanelSlideIn 0.24s ease-out' }}
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b border-[hsl(var(--outline-variant))]/15 px-4 py-3.5">
          <div className="flex min-w-0 items-center gap-3">
            {libraryTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveLibrary(tab.key)}
                className={`truncate text-[15px] font-bold transition-colors ${
                  activeLibrary === tab.key
                    ? 'text-[hsl(var(--on-surface))]'
                    : 'text-[hsl(var(--secondary))] hover:text-[hsl(var(--on-surface))]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-[hsl(var(--secondary))] transition-colors hover:bg-[hsl(var(--surface-container-low))] hover:text-[hsl(var(--on-surface))]"
            aria-label="关闭素材面板"
          >
            <CloseOutlined style={{ fontSize: 18 }} />
          </button>
        </div>

        <div className="border-b border-[hsl(var(--outline-variant))]/10 px-4 py-3">
          <div className="flex flex-wrap gap-2">
            {categoryTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveCategory(tab.key)}
                className={`rounded-full px-3.5 py-2 text-[13px] font-medium leading-none transition-all ${
                  activeCategory === tab.key
                    ? 'bg-[hsl(var(--surface-container-high))] text-[hsl(var(--on-surface))] shadow-sm'
                    : 'text-[hsl(var(--secondary))] hover:bg-[hsl(var(--surface-container-low))] hover:text-[hsl(var(--on-surface))]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex h-full items-center justify-center text-sm text-[hsl(var(--secondary))]">加载素材中...</div>
          ) : visibleItems.length > 0 ? (
            <div className="grid grid-cols-6 gap-2">
              {visibleItems.map((item) => (
                <button
                  key={item.id}
                  className="group cursor-grab text-left active:cursor-grabbing"
                  title={`${item.title} · ${item.subtitle}`}
                  onClick={() => onSelectMaterial(item)}
                  draggable
                  onDragStart={(event) => handleItemDragStart(event, item)}
                >
                  <div className="overflow-hidden rounded-2xl border border-[hsl(var(--outline-variant))]/15 bg-[hsl(var(--surface-container-low))] transition-all group-hover:-translate-y-0.5 group-hover:border-[hsl(var(--outline-variant))]/30 group-hover:shadow-md">
                    <div className="aspect-square overflow-hidden bg-[hsl(var(--surface-container-high))]">
                      {item.mediaType === 'image' && item.cover ? (
                        <img src={mediaUrl(item.cover)} alt={item.title} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[11px] font-medium text-[hsl(var(--secondary))]">
                          {item.mediaType === 'video' ? '视频' : '文本'}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="px-0.5 pt-1">
                    <div className="line-clamp-1 text-[11px] font-medium leading-4 text-[hsl(var(--on-surface))]">
                      {item.title}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="flex h-full items-center justify-center">
              <div className="flex w-full max-w-[248px] flex-col items-center rounded-[22px] border border-dashed border-[hsl(var(--outline-variant))]/30 bg-[hsl(var(--surface-container-low))]/60 px-5 py-8 text-center">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[hsl(var(--surface-container-high))] text-[hsl(var(--secondary))]">
                  <InboxOutlined style={{ fontSize: 22 }} />
                </div>
                <div className="text-[17px] font-semibold text-[hsl(var(--on-surface))]">{emptyCopy.title}</div>
                <div className="mt-2 text-[13px] leading-6 text-[hsl(var(--secondary))]">
                  {emptyCopy.desc}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes materialPanelSlideIn {
          from { opacity: 0; transform: translateX(-20px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
};

export default MaterialPanel;
export { MATERIAL_DRAG_MIME };
