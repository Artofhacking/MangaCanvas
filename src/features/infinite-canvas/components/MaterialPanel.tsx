import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CloseOutlined, InboxOutlined, SoundOutlined } from '@ant-design/icons';
import type { CanvasMaterialItem } from '../types';

interface MaterialPanelProps {
  visible: boolean;
  onClose: () => void;
  onSelectMaterial: (item: CanvasMaterialItem) => void;
}

type LibraryTab = 'materials' | 'subjects';
type CategoryTab = 'all' | 'character' | 'scene' | 'object' | 'style' | 'sound' | 'other';

const libraryTabs: Array<{ key: LibraryTab; label: string }> = [
  { key: 'materials', label: '我的素材' },
  { key: 'subjects', label: '我的主体库' },
];

const categoryTabs: Array<{ key: CategoryTab; label: string }> = [
  { key: 'all', label: '全部' },
  { key: 'character', label: '人物' },
  { key: 'scene', label: '场景' },
  { key: 'object', label: '物品' },
  { key: 'sound', label: '音效' },
];

const mockItems: CanvasMaterialItem[] = [
  {
    id: 'material-character-1',
    library: 'materials',
    category: 'character',
    title: '银发调查员',
    subtitle: '半身设定图',
    status: '已精修',
    cover: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=600&q=80',
  },
  {
    id: 'material-character-2',
    library: 'materials',
    category: 'character',
    title: '机械信使',
    subtitle: '动作参考',
    status: '待入库',
    cover: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=600&q=80',
  },
  {
    id: 'material-scene-1',
    library: 'materials',
    category: 'scene',
    title: '雨夜街巷',
    subtitle: '4K 场景底图',
    status: '常用',
    cover: 'https://images.unsplash.com/photo-1519501025264-65ba15a82390?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'material-scene-2',
    library: 'materials',
    category: 'scene',
    title: '旧港仓库',
    subtitle: '透视参考',
    status: '草稿',
    cover: 'https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'material-object-1',
    library: 'materials',
    category: 'object',
    title: '折叠终端箱',
    subtitle: '道具主视图',
    status: '已完成',
    cover: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=700&q=80',
  },
  {
    id: 'material-object-2',
    library: 'materials',
    category: 'object',
    title: '磁吸配枪',
    subtitle: '材质参考',
    status: '常用',
    cover: 'https://images.unsplash.com/photo-1516321497487-e288fb19713f?auto=format&fit=crop&w=700&q=80',
  },
  {
    id: 'material-sound-1',
    library: 'materials',
    category: 'sound',
    title: '城市环境氛围',
    subtitle: '32s Loop',
    status: '音效',
  },
  {
    id: 'material-sound-2',
    library: 'materials',
    category: 'sound',
    title: '金属开合声',
    subtitle: '8 variations',
    status: '音效',
  },
  {
    id: 'subject-character-1',
    library: 'subjects',
    category: 'character',
    title: '主角：林雾',
    subtitle: '角色主体',
    status: '绑定 6 场戏',
    cover: 'https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?auto=format&fit=crop&w=600&q=80',
  },
  {
    id: 'subject-character-2',
    library: 'subjects',
    category: 'character',
    title: '配角：阿彻',
    subtitle: '替身主体',
    status: '绑定 3 场戏',
    cover: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=600&q=80',
  },
  {
    id: 'subject-scene-1',
    library: 'subjects',
    category: 'scene',
    title: '废墟高台',
    subtitle: '主场景主体',
    status: '已锁定',
    cover: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'subject-object-1',
    library: 'subjects',
    category: 'object',
    title: '能量核心',
    subtitle: '关键道具主体',
    status: '已复用',
    cover: 'https://images.unsplash.com/photo-1511467687858-23d96c32e4ae?auto=format&fit=crop&w=700&q=80',
  },
  {
    id: 'subject-sound-1',
    library: 'subjects',
    category: 'sound',
    title: '角色出场提示音',
    subtitle: '1.6s Logo Hit',
    status: '已绑定',
  },
];

const MATERIAL_DRAG_MIME = 'application/x-mangacanvas-material';

const MaterialPanel: React.FC<MaterialPanelProps> = ({ visible, onClose, onSelectMaterial }) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const [activeLibrary, setActiveLibrary] = useState<LibraryTab>('materials');
  const [activeCategory, setActiveCategory] = useState<CategoryTab>('character');

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

  const emptyText = useMemo(
    () => (activeLibrary === 'materials' ? '暂无素材' : '暂无主体'),
    [activeLibrary]
  );

  const visibleItems = useMemo(() => {
    return mockItems.filter((item) => {
      if (item.library !== activeLibrary) return false;
      if (activeCategory === 'all') return true;
      return item.category === activeCategory;
    });
  }, [activeCategory, activeLibrary]);

  const handleItemDragStart = (event: React.DragEvent<HTMLButtonElement>, item: CanvasMaterialItem) => {
    if (!item.cover) return;
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
          {visibleItems.length > 0 ? (
            <div className="grid grid-cols-6 gap-2">
              {visibleItems.map((item) => (
                <button
                  key={item.id}
                  className={`group text-left ${item.cover ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'}`}
                  title={`${item.title} · ${item.subtitle}`}
                  onClick={() => item.cover && onSelectMaterial(item)}
                  draggable={Boolean(item.cover)}
                  onDragStart={(event) => handleItemDragStart(event, item)}
                >
                  {item.cover ? (
                    <div className="overflow-hidden rounded-2xl border border-[hsl(var(--outline-variant))]/15 bg-[hsl(var(--surface-container-low))] transition-all group-hover:-translate-y-0.5 group-hover:border-[hsl(var(--outline-variant))]/30 group-hover:shadow-md">
                      <div className="aspect-square overflow-hidden bg-[hsl(var(--surface-container-high))]">
                        <img src={item.cover} alt={item.title} className="h-full w-full object-cover" />
                      </div>
                    </div>
                  ) : (
                    <div className="flex aspect-square items-center justify-center rounded-2xl border border-[hsl(var(--outline-variant))]/15 bg-[hsl(var(--surface-container-low))] text-[hsl(var(--secondary))] transition-all group-hover:-translate-y-0.5 group-hover:border-[hsl(var(--outline-variant))]/30 group-hover:shadow-md">
                      <SoundOutlined style={{ fontSize: 18 }} />
                    </div>
                  )}

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
                <div className="text-[17px] font-semibold text-[hsl(var(--on-surface))]">{emptyText}</div>
                <div className="mt-2 text-[13px] leading-6 text-[hsl(var(--secondary))]">
                  {activeLibrary === 'materials'
                    ? '后续可在这里快速插入人物、场景、物品等素材。'
                    : '后续可在这里管理可复用的主体资产。'}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes materialPanelSlideIn {
          from {
            opacity: 0;
            transform: translateX(-20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `}</style>
    </div>
  );
};

export default MaterialPanel;
export { MATERIAL_DRAG_MIME };
