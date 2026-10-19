import { useEffect, useState } from 'react';
import { FolderOpen, HardDrive, RefreshCw } from 'lucide-react';
import App from './App';
import { Brand } from './components/brand';
import { Button } from './components/ui/button';
import { DesktopWindow } from './components/desktop-window';
import { Modal } from './components';
import { nativeCommand } from './runtime';
import type { Wallet, EncryptedWallet } from './types';
import './desktop.css';

type LocalWallet = { payload: Wallet | EncryptedWallet; revision: number; directory: string };
type DirectoryChoice = { directory: string; hasWallet: boolean; entries: number | null; encrypted: boolean };

export default function DesktopApp() {
  const [boot, setBoot] = useState<LocalWallet | null>(null);
  const [error, setError] = useState('');
  const load = async () => {
    try { setError(''); setBoot(await nativeCommand<LocalWallet>('load_wallet')); }
    catch (error) { setError((error as Error).message); }
  };
  useEffect(() => { void load(); }, []);
  useEffect(() => {
    const externalLink = (event: MouseEvent) => {
      const anchor = event.target instanceof Element ? event.target.closest('a[href]') : null;
      if (event.defaultPrevented || !(anchor instanceof HTMLAnchorElement) || !/^https?:\/\//i.test(anchor.href) || anchor.origin === window.location.origin) return;
      event.preventDefault();
      void nativeCommand('open_external', { url: anchor.href }).catch(error => setError(error.message));
    };
    document.addEventListener('click', externalLink);
    return () => document.removeEventListener('click', externalLink);
  }, []);
  useEffect(() => {
    if (!boot || !error) return;
    const timer = setTimeout(() => setError(''), 5000);
    return () => clearTimeout(timer);
  }, [boot, error]);
  return <div className="desktop-app"><DesktopWindow onError={setError}/>{!boot ? <div className="lock-screen"><div className="lock-panel"><Brand/><HardDrive size={32}/><h1>{error ? '暂时无法打开本地资料' : '打开你的个人空间'}</h1><p>{error || '正在读取本地资料…'}</p>{error && <><Button onClick={load}><RefreshCw size={16}/>重试</Button><DirectoryPanel onChanged={setBoot}/></>}</div></div> : <App key={`${boot.directory}:${boot.revision}`} initialRaw={JSON.stringify(boot.payload)} initialRevision={boot.revision} username="本地空间"
    storageKind="local" settingsPanel={<DirectoryPanel directory={boot.directory} onChanged={setBoot}/>}
    onPersist={(payload, revision) => nativeCommand<{ revision: number }>('save_wallet', { payload, revision, directory: boot.directory })}
    onLogout={() => nativeCommand<void>('close_app')} onExit={() => nativeCommand<void>('quit_app')}/>} {boot && error && <div className="toast" role="alert">{error}</div>}</div>;
}

function DirectoryPanel({ directory, onChanged }: { directory?: string; onChanged: (boot: LocalWallet) => void }) {
  const [choice, setChoice] = useState<DirectoryChoice | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const choose = async () => {
    setBusy(true); setError('');
    try { setChoice(await nativeCommand<DirectoryChoice | null>('choose_data_directory')); }
    catch (error) { setError((error as Error).message); }
    finally { setBusy(false); }
  };
  const change = async () => {
    if (!choice) return;
    setBusy(true); setError('');
    try { onChanged(await nativeCommand<LocalWallet>('change_data_directory', { mode: choice.hasWallet ? 'open' : directory ? 'copy' : 'empty' })); setChoice(null); }
    catch (error) { setError((error as Error).message); }
    finally { setBusy(false); }
  };
  return <><section className="settings-panel desktop-directory"><div className="settings-row"><div className="settings-icon"><HardDrive size={21}/></div><div><h3>本地数据位置</h3><p>资料保存在这台电脑，可离线使用。</p></div><Button variant="outline" disabled={busy} onClick={choose}><FolderOpen size={16}/>选择文件夹</Button></div>{directory && <div className="desktop-path"><code>{directory}</code><button className="text-link" onClick={() => { void nativeCommand('open_data_directory').catch(error => setError(error.message)); }}>打开目录</button></div>}{error && !choice && <p className="error-message" role="alert">{error}</p>}</section>
    {choice && <Modal title={choice.hasWallet ? '打开此目录的资料？' : '使用新的数据位置？'} onClose={() => { if (!busy) setChoice(null); }}>
      <p className="modal-message">{choice.hasWallet ? `此目录已有${choice.encrypted ? '加密资料' : ` ${choice.entries} 条记录`}。切换后显示该目录的内容，当前资料仍保留在原目录。` : directory ? '将当前资料复制到此目录，并从这里继续保存。原目录的文件会保留。' : '将在此目录建立新的本地资料文件。'}</p><code className="desktop-path-choice">{choice.directory}</code>
      {error && <p className="error-message" role="alert">{error}</p>}<div className="modal-actions"><Button variant="outline" disabled={busy} onClick={() => setChoice(null)}>取消</Button><Button disabled={busy} onClick={change}>{busy ? '正在切换…' : choice.hasWallet ? '打开资料' : directory ? '复制并切换' : '使用此目录'}</Button></div>
    </Modal>}</>;
}
