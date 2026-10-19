import { useEffect, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { ArrowRight, Cloud, LockKeyhole, LogOut, RefreshCw, ShieldCheck } from 'lucide-react';
import App from './App';
import { Brand, BrandIcon } from './components/brand';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Field, FieldGroup, FieldLabel } from './components/ui/field';
import { FadeIn } from './components/amicro/fade-in';
import { Modal } from './components';
import { STORAGE_KEY, downloadFile } from './storage';

export class ApiError extends Error { constructor(public status: number, message: string) { super(message); } }
export async function api<T>(path: string, method = 'GET', data?: unknown): Promise<T> {
  let response: Response;
  try { response = await fetch(`/api/${path}`, { method, credentials: 'same-origin', cache: 'no-store', headers: data === undefined ? {} : { 'Content-Type': 'application/json' }, body: data === undefined ? undefined : JSON.stringify(data) }); }
  catch { throw new Error('无法连接服务器。当前修改尚未保存，请检查网络后重试。'); }
  const result = await response.json().catch(() => ({ error: '服务器响应异常，请刷新后重试。' }));
  if (!response.ok) {
    if (response.status === 401 && !['login','session'].includes(path)) window.dispatchEvent(new Event('mrgcard-session-expired'));
    throw new ApiError(response.status, result.error || '请求失败。');
  }
  return result as T;
}

type Boot = { username: string; raw: string; revision: number };
export default function CloudApp() {
  const [boot, setBoot] = useState<Boot | null>(null), [loading, setLoading] = useState(true), [error, setError] = useState(''), [message, setMessage] = useState('');
  const load = async () => {
    setLoading(true); setError('');
    try { const user = await api<{ username: string }>('session'); const wallet = await api<{ payload: unknown; revision: number }>('wallet'); setBoot({ username: user.username, raw: JSON.stringify(wallet.payload), revision: wallet.revision }); }
    catch (err) { if (!(err instanceof ApiError && err.status === 401)) setError((err as Error).message); setBoot(null); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); const expired = () => { setBoot(null); setMessage('登录已过期，请重新登录。'); }; window.addEventListener('mrgcard-session-expired', expired); return () => window.removeEventListener('mrgcard-session-expired', expired); }, []);
  const logout = async () => { await api('logout', 'POST'); setBoot(null); setMessage('已安全退出。'); };
  if (loading || error) return <div className="lock-screen"><div className="lock-panel"><Cloud size={36}/><h1>{loading ? '打开你的个人空间' : '暂时无法连接'}</h1><p>{error || '正在读取云端卡包…'}</p>{error && <Button variant="default" className="button primary full-width" onClick={load}><RefreshCw size={16}/> 重试连接</Button>}</div></div>;
  if (boot) return <App initialRaw={boot.raw} initialRevision={boot.revision} username={boot.username} onLogout={logout} onPersist={(payload, revision) => api<{revision:number}>('wallet','PUT',{payload,revision})} settingsPanel={<AccountPanel username={boot.username} onLogout={logout} onPasswordChanged={() => { setBoot(null); setMessage('密码已更新，所有设备已退出。请使用新密码登录。'); }}/>}/>;
  return <Login message={message} onLogin={load}/>;
}
function Login({ message, onLogin }: { message: string; onLogin: () => Promise<void> }) {
  const [username,setUsername]=useState(''), [password,setPassword]=useState(''), [error,setError]=useState(''), [busy,setBusy]=useState(false);
  const [legacy] = useState(() => { try { return !!localStorage.getItem(STORAGE_KEY); } catch { return false; } });
  return <div className="login-shell">
    <header className="login-header"><Brand/><span>个人信息管理</span></header>
    <main className="login-main"><FadeIn className="login-panel"><BrandIcon className="login-symbol" size={48}/><h1>登录 Folio</h1><p>访问你的卡片、号码和地址。</p>
      {message&&<p className="notice" role="status">{message}</p>}
      <form className="password-form" onSubmit={async e=>{e.preventDefault();setError('');setBusy(true);try{await api('login','POST',{username,password});setPassword('');await onLogin();}catch(err){setError((err as Error).message);}finally{setBusy(false);}}}>
        <FieldGroup className="login-fields"><Field><FieldLabel htmlFor="login-account">账号</FieldLabel><Input id="login-account" autoFocus autoComplete="username" required maxLength={80} value={username} onChange={e=>setUsername(e.target.value)} placeholder="输入账号"/></Field>
        <Field><FieldLabel htmlFor="login-password">密码</FieldLabel><Input id="login-password" type="password" autoComplete="current-password" required maxLength={200} value={password} onChange={e=>setPassword(e.target.value)} placeholder="输入登录密码"/></Field></FieldGroup>
        {error&&<p className="error-message" role="alert">{error}</p>}
        <Button className="login-submit" disabled={busy}>{busy?'正在登录…':'登录'}<ArrowRight size={16}/></Button>
      </form>
      {legacy&&<button className="text-link legacy-link" onClick={()=>{const raw=localStorage.getItem(STORAGE_KEY);if(raw)void downloadFile(raw,'folio-local-migration.json').catch(error=>setError(error.message));}}>下载此浏览器的旧版本地卡包</button>}
      <p className="login-caption"><LockKeyhole size={13}/>仅限个人账号访问</p>
    </FadeIn></main>
    <footer className="login-bottom"><span>Folio</span><span>卡片 · 号码 · 地址</span></footer>
  </div>;
}
export function AccountPanel({ username, onLogout, onPasswordChanged }: { username: string; onLogout: () => Promise<void>; onPasswordChanged: () => void }) {
  const [open,setOpen]=useState(false), [currentPassword,setCurrent]=useState(''),[newPassword,setNew]=useState(''),[repeat,setRepeat]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const [legacy] = useState(() => { try { return !!localStorage.getItem(STORAGE_KEY); } catch { return false; } });
  return <><section className="settings-panel"><div className="settings-row"><div className="settings-icon"><LockKeyhole size={21}/></div><div><h3>账号 · {username}</h3><p>登录状态保留 7 天。修改密码后，所有设备需要重新登录。</p></div><Button variant="outline" className="button secondary" onClick={()=>{setError('');setOpen(true);}}>修改登录密码</Button><Button variant="ghost" className="button ghost" disabled={busy} onClick={async()=>{setBusy(true);setError('');try{await onLogout();}catch(err){setError((err as Error).message);}finally{setBusy(false);}}}><LogOut size={16}/> 退出</Button></div>{error&&!open&&<p className="error-message" role="alert">{error}</p>}</section>{legacy&&<section className="settings-panel"><h3>此浏览器中有旧版本地卡包</h3><p className="settings-description">原数据仍保留。先下载旧版备份，再使用下方「从备份恢复」预览并导入云端。</p><Button variant="outline" className="button secondary" onClick={()=>{const raw=localStorage.getItem(STORAGE_KEY);if(raw)void downloadFile(raw,'folio-local-migration.json').catch(error=>setError(error.message));}}>下载旧版卡包</Button></section>}<AnimatePresence>{open&&<Modal key="account-password" title="修改登录密码" subtitle="此密码用于账号登录，与可选的卡包加密密码相互独立。" onClose={()=>{if(!busy){setOpen(false);setCurrent('');setNew('');setRepeat('');}}}><form className="password-form" onSubmit={async e=>{e.preventDefault();setError('');if(newPassword!==repeat){setError('两次新密码不一致。');return;}setBusy(true);try{await api('password','POST',{currentPassword,newPassword});onPasswordChanged();}catch(err){setError((err as Error).message);}finally{setBusy(false);}}}><label>当前登录密码<Input type="password" required maxLength={200} autoComplete="current-password" value={currentPassword} onChange={e=>setCurrent(e.target.value)}/></label><label>新登录密码<Input type="password" required minLength={12} maxLength={200} autoComplete="new-password" value={newPassword} onChange={e=>setNew(e.target.value)} placeholder="至少 12 个字符"/></label><label>确认新密码<Input type="password" required minLength={12} maxLength={200} autoComplete="new-password" value={repeat} onChange={e=>setRepeat(e.target.value)}/></label>{error&&<p className="error-message" role="alert">{error}</p>}<Button variant="default" className="button primary full-width" disabled={busy}>{busy?'正在更新…':'更新密码并退出'}</Button></form></Modal>}</AnimatePresence></>;
}
