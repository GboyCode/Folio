import { useEffect, useRef, useState } from 'react';
import { Cloud, Download, Upload } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Modal } from '../components';
import { desktopMode, nativeCommand } from '../runtime';
import { normalizeDavConfig, runWebDav, validateDavBackup, DAV_FOLDER, DAV_FILENAME, type DavConfig, type DavRequest, type DavResponse, type DavResult } from '../webdav';

type Settings = DavConfig & { enabled: boolean };
const defaults: Settings = { enabled: false, url: '', username: '', password: '' };

export function useWebDavSettings(scope: string, persistent = true) {
  const key = `folio.webdav.v1:${scope}`;
  const [settings, setSettings] = useState<Settings>(() => {
    try {
      const saved = JSON.parse((persistent && localStorage.getItem(key)) || '{}');
      return { ...defaults, enabled: saved.enabled === true, ...Object.fromEntries(['url', 'username'].filter(field => typeof saved[field] === 'string').map(field => [field, saved[field]])) };
    } catch { return { ...defaults }; }
  });
  const save = (input: DavConfig) => {
    const clean = { ...normalizeDavConfig(input), enabled: true };
    const { password: _password, ...persisted } = clean;
    if (persistent) localStorage.setItem(key, JSON.stringify(persisted));
    setSettings(clean);
  };
  const forget = () => { if (persistent) localStorage.removeItem(key); setSettings({ ...defaults }); };
  const clearPassword = () => setSettings(current => ({ ...current, password: '' }));
  return { settings, setSettings, save, forget, clearPassword };
}

async function davRequest(input: DavRequest): Promise<DavResult> {
  if (import.meta.env.MODE === 'demo') throw new Error('演示模式不连接网盘，请使用自部署网页版或桌面版。');
  if (desktopMode) return runWebDav(input, request => nativeCommand<DavResponse>('webdav_request', { request }));
  let response: Response;
  try {
    response = await fetch('/api/webdav', { method: 'POST', credentials: 'same-origin', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input), signal: AbortSignal.timeout(input.action === 'write' ? 130_000 : input.action === 'read' ? 95_000 : 35_000) });
  } catch { throw new Error(input.action === 'write' ? '连接中断，上传结果尚未确认。请先拉取远程文件检查。' : '无法连接同步服务，请检查网络后重试。'); }
  if (response.status === 401) window.dispatchEvent(new Event('mrgcard-session-expired'));
  const result = await response.json().catch(() => ({ error: '同步服务返回异常，请确认网页服务已更新。' }));
  if (!response.ok || result.error) throw new Error(result.error || 'WebDAV 请求失败。');
  return result;
}

export function WebDavPanel({ controller, local, encrypted, saving, getRaw, onDownload }: {
  controller: ReturnType<typeof useWebDavSettings>; local: boolean; encrypted: boolean; saving: boolean;
  getRaw: () => string; onDownload: (source: { raw: string; name: string }) => void;
}) {
  const { settings } = controller;
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('');
  const [draft, setDraft] = useState<DavConfig | null>(null);
  const [upload, setUpload] = useState<{ raw: string; etag: string | null; exists: boolean; config: DavConfig } | null>(null);
  const active = useRef(true), pending = useRef(false);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const run = async (action: () => Promise<void> | void) => {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError(''); setMessage('');
    try { await action(); } catch (err) { if (active.current) setError(err instanceof Error ? err.message : 'WebDAV 操作失败。'); }
    finally { pending.current = false; if (active.current) setBusy(false); }
  };
  const disabled = busy || saving;
  const openConfig = () => { setDraft({ ...settings }); setError(''); setMessage(''); };
  const closeConfig = () => { if (!busy) { setDraft(null); setError(''); } };
  const update = (field: keyof DavConfig, value: string) => setDraft(current => current && ({ ...current, [field]: value }));
  const sync = (action: 'upload' | 'read') => {
    if (!settings.password) { openConfig(); return; }
    void run(async () => {
      const config = normalizeDavConfig(settings);
      if (action === 'read') {
        const remote = await davRequest({ config, action: 'read' });
        if (!remote.exists || !remote.raw) throw new Error('网盘中还没有 Folio 备份，请先在另一端上传。');
        validateDavBackup(remote.raw);
        if (active.current) onDownload({ raw: remote.raw, name: DAV_FILENAME });
      } else {
        const raw = getRaw(); validateDavBackup(raw);
        const remote = await davRequest({ config, action: 'read' });
        if (remote.exists && !remote.etag) throw new Error('该网盘不支持安全覆盖备份，请使用支持文件版本校验的 WebDAV 服务。');
        if (active.current) setUpload({ raw, etag: remote.etag ?? null, exists: !!remote.exists, config });
      }
    });
  };
  return <section className="settings-panel webdav-panel">
    <div className="settings-row webdav-row">
      <div className="settings-icon"><Cloud size={21}/></div>
      <div><h3>WebDAV 同步</h3><p>{settings.enabled ? (local ? '本地' : '网页') + '卡包与网盘独立保存，按需同步。' : '连接网盘，在网页与本地之间同步备份。'}</p></div>
      <div className="webdav-actions">
        <Button variant="ghost" disabled={disabled} onClick={openConfig}>配置</Button>
        <Button variant="outline" disabled={disabled || !settings.enabled} onClick={() => sync('upload')}><Upload size={15}/>上传</Button>
        <Button variant="outline" disabled={disabled || !settings.enabled} onClick={() => sync('read')}><Download size={15}/>拉取</Button>
      </div>
    </div>
    {busy && !upload && !draft && <p className="webdav-status tiny muted" role="status">正在连接…</p>}
    {message && <p className="webdav-status tiny muted" role="status">{message}</p>}
    {error && !upload && !draft && <p className="webdav-status error-message" role="alert">{error}</p>}
    {draft && <Modal title="连接 WebDAV" onClose={closeConfig}>
      <form onSubmit={event => { event.preventDefault(); void run(async () => {
        const config = normalizeDavConfig(draft);
        await davRequest({ config, action: 'test' });
        if (active.current) { controller.save(config); setDraft(null); setMessage('连接配置已保存'); }
      }); }}>
        <div className="webdav-form-body"><fieldset className="webdav-fields" disabled={busy}>
          <label className="webdav-address">WebDAV 地址<Input type="url" autoFocus autoComplete="off" required value={draft.url} maxLength={2048} placeholder="https://dav.example.com/dav/" onChange={e => update('url', e.target.value)}/></label>
          <label>用户名<Input autoComplete="off" required value={draft.username} maxLength={300} onChange={e => update('username', e.target.value)}/></label>
          <label>密码 / 应用密码<Input type="password" autoComplete="off" required value={draft.password} maxLength={1000} onChange={e => update('password', e.target.value)}/></label>
        </fieldset>
        <p className="tiny muted">自动使用 {DAV_FOLDER} 文件夹。密码仅在当前会话使用。</p>
        {error && <p className="error-message" role="alert">{error}</p>}
        </div>
        <div className="modal-actions">
          {settings.enabled && <Button type="button" variant="ghost" disabled={busy} onClick={() => void run(() => { controller.forget(); setDraft(null); setMessage('已断开，网盘备份保留'); })}>断开</Button>}
          <Button type="button" variant="outline" disabled={busy} onClick={closeConfig}>取消</Button>
          <Button disabled={busy}>{busy ? '正在连接…' : '连接并保存'}</Button>
        </div>
      </form>
    </Modal>}
    {upload && <Modal title={upload.exists ? '更新网盘备份？' : '上传到网盘？'} onClose={() => { if (!busy) { setUpload(null); setError(''); } }}>
      <p className="modal-message">{upload.exists ? '将替换网盘中的 Folio 备份，其他端的资料不会自动改变。' : '自动创建 ' + DAV_FOLDER + ' 文件夹并保存当前卡包。'}</p>
      {!encrypted && <p className="notice">当前卡包未加密，备份中包含明文个人资料。</p>}
      {error && <p className="error-message" role="alert">{error}</p>}
      <div className="modal-actions"><Button variant="outline" disabled={busy} onClick={() => { setUpload(null); setError(''); }}>取消</Button><Button disabled={disabled} onClick={() => void run(async () => {
        if (getRaw() !== upload.raw) throw new Error('当前卡包已变化，请取消并重新发起上传。');
        await davRequest({ config: upload.config, action: 'write', raw: upload.raw, etag: upload.etag });
        if (active.current) { setUpload(null); setMessage('备份已上传并校验'); }
      })}>{busy ? '正在上传…' : '确认上传'}</Button></div>
    </Modal>}
  </section>;
}
