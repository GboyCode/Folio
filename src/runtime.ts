export const desktopMode = import.meta.env?.VITE_DESKTOP === 'true';

export async function nativeCommand<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import('@tauri-apps/api/core');
  try { return await invoke<T>(command, args); }
  catch (error) { throw new Error(typeof error === 'string' ? error : '本地操作失败，请重试。'); }
}
