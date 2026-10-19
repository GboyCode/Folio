import { useEffect, useRef, useState, type FormEvent } from 'react';
import { DropdownMenu, Select, Switch } from 'radix-ui';
import { ArrowRight, Check, ChevronDown, Download, Info, LogOut, MoreHorizontal, Power, Settings, Upload, UserRound } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { prepareAvatar, type CloseBehavior, type PreferenceController, type Profile } from '../preferences';
import './preferences-page.css';

export function ProfileAvatar({ profile, large = false }: { profile: Profile; large?: boolean }) {
  return <span className={`profile-avatar${large ? ' profile-avatar-large' : ''}`} aria-hidden="true">{profile.avatar ? <img src={profile.avatar} alt=""/> : Array.from(profile.displayName)[0]?.toUpperCase() || <UserRound size={20}/>}</span>;
}

export function ProfileMenu({ onSettings, onExit, local }: { onSettings: () => void; onExit: () => void; local: boolean }) {
  return <DropdownMenu.Root><DropdownMenu.Trigger asChild><button className="profile-more" aria-label="打开个人菜单"><MoreHorizontal size={18}/></button></DropdownMenu.Trigger><DropdownMenu.Portal><DropdownMenu.Content className="profile-menu" side="top" align="end" sideOffset={10} collisionPadding={12}>
    <DropdownMenu.Item onSelect={onSettings}><Settings size={16}/>设置</DropdownMenu.Item>
    <DropdownMenu.Separator/>
    <DropdownMenu.Item onSelect={onExit}><LogOut size={16}/>{local ? '退出 Folio' : '退出账号'}</DropdownMenu.Item>
  </DropdownMenu.Content></DropdownMenu.Portal></DropdownMenu.Root>;
}

export function PreferencesPage({ controller, local, onData }: { controller: PreferenceController; local: boolean; onData: () => void }) {
  const { preferences, loading, error: loadError, reload, saveProfile, setCloseBehavior, setAutostart } = controller;
  const [draft, setDraft] = useState(preferences.profile);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { setDraft(preferences.profile); }, [preferences.profile]);
  const disabled = loading || !!loadError || !!busy;
  const dirty = draft.displayName !== preferences.profile.displayName || draft.avatar !== preferences.profile.avatar;
  const perform = async (key: string, action: () => Promise<unknown>) => {
    setBusy(key); setError(''); setSaved(false);
    try { await action(); if (mounted.current) setSaved(true); }
    catch (error) { if (mounted.current) setError(error instanceof Error ? error.message : '保存失败，请重试。'); }
    finally { if (mounted.current) setBusy(''); }
  };
  const submit = (event: FormEvent) => { event.preventDefault(); void perform('profile', () => saveProfile(draft)); };
  return <div className="preferences-page">
    <div className="content-heading settings-heading"><div><h1>设置</h1><p>让 Folio 更贴合你的使用习惯。</p></div><span className="preferences-edition">{local ? '本地离线版' : '在线版'}</span></div>
    {loadError && <div className="preferences-feedback" role="alert"><span>{loadError}</span><Button variant="outline" onClick={() => void reload()} disabled={loading}>重新加载</Button></div>}
    <section className="settings-panel preferences-section" aria-labelledby="profile-title">
      <div className="preferences-title"><UserRound size={19}/><h2 id="profile-title">个人资料</h2></div>
      <form onSubmit={submit} className="preferences-profile-form">
        <div className="preferences-avatar-row"><ProfileAvatar profile={draft} large/><div><div className="preferences-avatar-actions"><Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => fileInput.current?.click()}><Upload size={14}/>更换头像</Button>{draft.avatar && <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={() => { setDraft(current => ({ ...current, avatar: '' })); setSaved(false); }}>移除</Button>}</div><p>PNG、JPEG 或 WebP，最大 5 MB</p></div>
          <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" tabIndex={-1} aria-label="选择头像图片" onChange={event => {
            const file = event.target.files?.[0]; event.target.value = ''; if (!file) return;
            setBusy('avatar'); setError(''); setSaved(false);
            void prepareAvatar(file).then(avatar => { if (mounted.current) setDraft(current => ({ ...current, avatar })); }).catch(error => { if (mounted.current) setError(error.message); }).finally(() => { if (mounted.current) setBusy(''); });
          }}/>
        </div>
        <div className="preferences-name-row"><label htmlFor="profile-name">显示名称<Input id="profile-name" value={draft.displayName} disabled={disabled} maxLength={32} required autoComplete="nickname" onChange={event => { setDraft(current => ({ ...current, displayName: event.target.value })); setSaved(false); }}/></label><Button type="submit" disabled={disabled || !dirty}>{busy === 'profile' ? '保存中…' : '保存资料'}</Button></div>
        <p className="preferences-hint">{local ? '名称和头像仅保存在这台电脑。' : '名称和头像仅保存在此浏览器，不影响登录账号。'}</p>
      </form>
    </section>
    {local && <section className="settings-panel preferences-section" aria-labelledby="desktop-title"><div className="preferences-title"><Power size={19}/><h2 id="desktop-title">启动与关闭</h2></div>
      <div className="preferences-row"><label htmlFor="close-behavior">关闭窗口时</label>
        <Select.Root value={preferences.closeBehavior} disabled={disabled} onValueChange={value => void perform('close', () => setCloseBehavior(value as CloseBehavior))}>
          <Select.Trigger asChild><Button id="close-behavior" variant="outline" className="preferences-select" aria-label="关闭窗口时"><Select.Value/><Select.Icon><ChevronDown size={14}/></Select.Icon></Button></Select.Trigger>
          <Select.Portal><Select.Content className="profile-menu preferences-select-menu" position="popper" align="end" sideOffset={6} collisionPadding={12}><Select.Viewport>
            {([{ value: 'exit', label: '退出' }, { value: 'tray', label: '最小化' }] as const).map(option => <Select.Item key={option.value} value={option.value} className="preferences-select-option"><Select.ItemText>{option.label}</Select.ItemText><Select.ItemIndicator><Check size={14}/></Select.ItemIndicator></Select.Item>)}
          </Select.Viewport></Select.Content></Select.Portal>
        </Select.Root>
      </div>
      <div className="preferences-row"><div><label htmlFor="autostart">开机自启动</label><p>{preferences.autostartError || '登录 Windows 后自动打开 Folio'}</p></div><Switch.Root id="autostart" data-slot="switch" className="preferences-switch" checked={preferences.autostart === true} disabled={disabled || preferences.autostart === null} onCheckedChange={enabled => void perform('autostart', () => setAutostart(enabled))}><Switch.Thumb/></Switch.Root></div>
    </section>}
    <section className="settings-panel preferences-section" aria-labelledby="about-title"><div className="preferences-title"><Info size={19}/><h2 id="about-title">关于 Folio</h2>{preferences.version && <span className="preferences-version">v{preferences.version}</span>}</div>
      <div className="preferences-row"><div><strong>检查更新</strong><p>尚未配置更新源</p></div><Button variant="outline" disabled title="后续接入 GitHub Releases"><Download size={15}/>检查更新</Button></div>
      <div className="preferences-row"><div><strong>数据与隐私</strong><p>{local ? '数据位置、备份与加密' : '账号、备份与加密'}</p></div><Button variant="ghost" onClick={onData}>管理<ArrowRight size={15}/></Button></div>
      <p className="preferences-hint">{local ? '离线使用，资料保存在你选择的文件夹。' : '可自部署的在线版，资料保存在当前服务器。'}</p>
    </section>
    <div className="preferences-result" aria-live="polite">{error ? <span role="alert" className="preferences-error">{error}</span> : saved ? <span><Check size={15}/>已保存</span> : loading ? <span>正在读取设置…</span> : null}</div>
  </div>;
}
