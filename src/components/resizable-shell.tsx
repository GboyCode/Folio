import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';

const STORAGE_KEY = 'mrgcard.sidebar-width';
const DEFAULT_WIDTH = 216;
const MIN_WIDTH = 200;
const MAX_WIDTH = 320;
const clampWidth = (width: number) => Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Math.round(width)));

function readWidth() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved !== null && Number.isFinite(Number(saved))) return clampWidth(Number(saved));
  } catch { /* Storage may be unavailable in private or restricted browsers. */ }
  return DEFAULT_WIDTH;
}

export function ResizableShell({ children }: { children: ReactNode }) {
  const [width, setWidth] = useState(readWidth);
  const [resizing, setResizing] = useState(false);
  const drag = useRef<{ pointerId: number; startX: number; startWidth: number } | null>(null);

  useEffect(() => {
    if (resizing) return;
    try { localStorage.setItem(STORAGE_KEY, String(width)); } catch { /* Keep resizing usable without persistence. */ }
  }, [width, resizing]);

  useEffect(() => {
    if (!resizing) return;
    const stop = () => { drag.current = null; setResizing(false); };
    const mobile = window.matchMedia('(max-width: 800px)');
    window.addEventListener('blur', stop);
    mobile.addEventListener('change', stop);
    return () => {
      window.removeEventListener('blur', stop);
      mobile.removeEventListener('change', stop);
    };
  }, [resizing]);

  const start = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || !event.isPrimary) return;
    event.preventDefault();
    event.currentTarget.focus();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { pointerId: event.pointerId, startX: event.clientX, startWidth: width };
    setResizing(true);
  };
  const move = (event: PointerEvent<HTMLDivElement>) => {
    const current = drag.current;
    if (!current || event.pointerId !== current.pointerId) return;
    setWidth(clampWidth(current.startWidth + event.clientX - current.startX));
  };
  const finish = (event: PointerEvent<HTMLDivElement>, cancel = false) => {
    const current = drag.current;
    if (!current || event.pointerId !== current.pointerId) return;
    if (cancel) setWidth(current.startWidth);
    drag.current = null;
    setResizing(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const keyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape' && drag.current) {
      const current = drag.current;
      setWidth(current.startWidth);
      drag.current = null;
      setResizing(false);
      if (event.currentTarget.hasPointerCapture(current.pointerId)) event.currentTarget.releasePointerCapture(current.pointerId);
      event.preventDefault();
      return;
    }
    if (resizing) return;
    const step = event.shiftKey ? 24 : 8;
    const next = event.key === 'ArrowLeft' ? width - step : event.key === 'ArrowRight' ? width + step : event.key === 'Home' ? MIN_WIDTH : event.key === 'End' ? MAX_WIDTH : null;
    if (next === null) return;
    event.preventDefault();
    setWidth(clampWidth(next));
  };

  return <div className="app-shell" data-resizing={resizing || undefined} style={{ '--sidebar-width': `${width}px` } as CSSProperties}>
    {children}
    <div className="sidebar-resizer" role="separator" tabIndex={0}
      aria-label="调整侧栏宽度" aria-orientation="vertical" aria-controls="app-navigation"
      aria-valuemin={MIN_WIDTH} aria-valuemax={MAX_WIDTH} aria-valuenow={width} aria-valuetext={`${width} 像素`}
      title="拖动调整侧栏宽度，双击恢复默认；支持左右方向键"
      onPointerDown={start} onPointerMove={move} onPointerUp={event => finish(event)}
      onPointerCancel={event => finish(event, true)} onLostPointerCapture={event => finish(event)}
      onDoubleClick={() => setWidth(DEFAULT_WIDTH)} onKeyDown={keyDown}/>
  </div>;
}
