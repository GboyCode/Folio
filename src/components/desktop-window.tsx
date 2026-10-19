import { useEffect, useState } from 'react';
import { Copy, Minus, Square, X } from 'lucide-react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { nativeCommand } from '../runtime';

export function DesktopWindow({ onError }: { onError: (message: string) => void }) {
  const [maximized, setMaximized] = useState(false);
  useEffect(() => {
    const window = getCurrentWindow();
    let mounted = true;
    const sync = async () => {
      try { const value = await window.isMaximized(); if (mounted) setMaximized(value); }
      catch { /* Keep the controls usable if the state query fails. */ }
    };
    void sync();
    const resize = window.onResized(() => void sync());
    const drag = (event: MouseEvent) => {
      if (event.button !== 0 || !(event.target instanceof Element)) return;
      if (!event.target.closest('.topbar, .sidebar-brand, [data-window-drag]') || event.target.closest('button, a, input, select, textarea, [role=button]')) return;
      event.preventDefault();
      const action = event.detail === 2 ? window.toggleMaximize() : window.startDragging();
      void action.catch(() => onError('暂时无法调整窗口，请重试。'));
    };
    document.addEventListener('mousedown', drag);
    return () => {
      mounted = false;
      document.removeEventListener('mousedown', drag);
      void resize.then(unlisten => unlisten()).catch(() => {});
    };
  }, [onError]);
  const run = (action: () => Promise<void>) => { void action().catch(() => onError('窗口操作失败，请重试。')); };
  return <>
    <div className="desktop-drag-fallback" data-window-drag aria-hidden="true"/>
    <div className="desktop-window-controls" role="group" aria-label="窗口控制">
      <button type="button" data-slot="window-control" aria-label="最小化窗口" title="最小化" onClick={() => run(() => getCurrentWindow().minimize())}><Minus size={15}/></button>
      <button type="button" data-slot="window-control" aria-label={maximized ? '还原窗口' : '最大化窗口'} title={maximized ? '还原' : '最大化'} onClick={() => run(() => getCurrentWindow().toggleMaximize())}>{maximized ? <Copy size={13}/> : <Square size={13}/>}</button>
      <button type="button" data-slot="window-control" className="desktop-window-close" aria-label="关闭窗口" title="关闭" onClick={() => run(() => nativeCommand<void>('close_app'))}><X size={16}/></button>
    </div>
  </>;
}
