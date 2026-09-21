import {
  AimOutlined,
  MinusOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import { useReactFlow, useStore } from 'reactflow';

export function formatCanvasZoomPercent(zoom: number): string {
  return `${Math.round(zoom * 100)}%`;
}

/** Live zoom % from React Flow's transform, not Zustand viewport. */
export function CanvasZoomPercent() {
  const zoom = useStore((state) => state.transform[2]);
  const { zoomTo } = useReactFlow();

  return (
    <button
      type="button"
      onClick={() => zoomTo(1)}
      className="min-w-[48px] rounded-lg px-1 py-1.5 text-center text-xs font-medium text-[hsl(var(--secondary))] transition-colors hover:bg-[hsl(var(--surface-container-low))] hover:text-[hsl(var(--on-surface))]"
      title="重置为 100%"
    >
      {formatCanvasZoomPercent(zoom)}
    </button>
  );
}

export function CanvasZoomControls() {
  const { zoomIn, zoomOut, fitView } = useReactFlow();

  return (
    <>
      <button
        type="button"
        onClick={() => fitView({ padding: 0.2 })}
        className="rounded-xl p-2.5 text-[hsl(var(--secondary))] hover:bg-[hsl(var(--surface-container-low))] hover:text-[hsl(var(--on-surface))] transition-colors"
        title="适应视图"
      >
        <AimOutlined style={{ fontSize: 16 }} />
      </button>
      <div className="h-5 w-px bg-[hsl(var(--outline-variant))]/40" />
      <div className="flex items-center gap-1 px-2">
        <button
          type="button"
          onClick={() => zoomOut()}
          className="rounded-lg p-1.5 text-[hsl(var(--secondary))] hover:bg-[hsl(var(--surface-container-low))] hover:text-[hsl(var(--on-surface))] transition-colors"
          title="缩小"
        >
          <MinusOutlined style={{ fontSize: 14 }} />
        </button>
        <CanvasZoomPercent />
        <button
          type="button"
          onClick={() => zoomIn()}
          className="rounded-lg p-1.5 text-[hsl(var(--secondary))] hover:bg-[hsl(var(--surface-container-low))] hover:text-[hsl(var(--on-surface))] transition-colors"
          title="放大"
        >
          <PlusOutlined style={{ fontSize: 14 }} />
        </button>
      </div>
    </>
  );
}
