import { useCallback, useEffect, useState } from 'react';
import { nativeCommand } from './runtime';

export type Profile = { displayName: string; avatar: string };
export type CloseBehavior = 'exit' | 'tray';
export type Preferences = {
  profile: Profile;
  closeBehavior: CloseBehavior;
  autostart: boolean | null;
  autostartError?: string | null;
  version: string;
};
export const MAX_AVATAR_LENGTH = 400 * 1024;

export function validateProfile(profile: Profile): Profile {
  const displayName = profile.displayName.trim();
  if (!displayName || [...displayName].length > 32 || /[\u0000-\u001f\u007f]/.test(displayName)) throw new Error('名称需要 1–32 个字符。');
  if (profile.avatar && (profile.avatar.length > MAX_AVATAR_LENGTH || !/^data:image\/png;base64,iVBORw0KGgo[A-Za-z0-9+/=]+$/.test(profile.avatar))) throw new Error('头像无效或过大，请重新选择图片。');
  return { displayName, avatar: profile.avatar };
}

export function usePreferences(local: boolean, username: string, persistent = true) {
  const [preferences, setPreferences] = useState<Preferences>(() => ({ profile: { displayName: username, avatar: '' }, closeBehavior: 'exit', autostart: null, version: '' }));
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const key = `folio.profile.v1:${username}`;
  const reload = useCallback(async () => {
    setLoading(true); setError('');
    try {
      if (local) setPreferences(await nativeCommand<Preferences>('load_preferences'));
      else {
        const raw = persistent ? localStorage.getItem(key) : null;
        const profile = raw ? validateProfile(JSON.parse(raw)) : { displayName: username, avatar: '' };
        setPreferences({ profile, closeBehavior: 'exit', autostart: null, version: '' });
      }
    } catch { setError('暂时无法读取设置，请重试。原设置已保留。'); }
    finally { setLoading(false); }
  }, [local, username, key, persistent]);
  useEffect(() => { void reload(); }, [reload]);
  const saveProfile = async (value: Profile) => {
    if (loading || error) throw new Error('请先重新加载设置。');
    const profile = validateProfile(value);
    const saved = local ? await nativeCommand<Profile>('save_profile', { profile }) : profile;
    if (!local && persistent) {
      try { localStorage.setItem(key, JSON.stringify(saved)); }
      catch { throw new Error('浏览器无法保存资料，请检查存储空间或隐私设置。'); }
    }
    setPreferences(current => ({ ...current, profile: saved }));
    return saved;
  };
  const setCloseBehavior = async (behavior: CloseBehavior) => {
    const saved = await nativeCommand<CloseBehavior>('set_close_behavior', { behavior });
    setPreferences(current => ({ ...current, closeBehavior: saved }));
  };
  const setAutostart = async (enabled: boolean) => {
    const saved = await nativeCommand<boolean>('set_autostart', { enabled });
    setPreferences(current => ({ ...current, autostart: saved, autostartError: null }));
    if (saved !== enabled) throw new Error('系统未应用此更改，已显示当前状态。');
  };
  return { preferences, loading, error, reload, saveProfile, setCloseBehavior, setAutostart };
}

export type PreferenceController = ReturnType<typeof usePreferences>;

export async function prepareAvatar(file: File): Promise<string> {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw new Error('请选择 PNG、JPEG 或 WebP 图片。');
  if (file.size > 5 * 1024 * 1024) throw new Error('图片不能超过 5 MB。');
  const bitmap = await createImageBitmap(file).catch(() => { throw new Error('无法读取这张图片，请换一张。'); });
  try {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 256;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('无法处理头像图片。');
    const side = Math.min(bitmap.width, bitmap.height);
    context.drawImage(bitmap, (bitmap.width-side)/2, (bitmap.height-side)/2, side, side, 0, 0, 256, 256);
    const avatar = canvas.toDataURL('image/png');
    if (avatar.length > MAX_AVATAR_LENGTH) throw new Error('头像过大，请选择更简单的图片。');
    return avatar;
  } finally { bitmap.close(); }
}
