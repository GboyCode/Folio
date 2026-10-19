import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowDownToLine, ArrowRight, ArrowUpRight, Bell, BookOpen, Check, ChevronDown, ChevronRight, CircleHelp, Copy, CreditCard, Database, Download, Eye, EyeOff, Grid2X2, HardDrive, Heart, Image, List, LockKeyhole, MapPin, Menu, Pencil, Plus, Search, Settings2, ShieldCheck, SlidersHorizontal, Smartphone, Sparkles, Star, Trash2, Upload, WalletCards, X } from 'lucide-react';
import { blankEntry, type Entry, type ItemType, type Wallet, type EncryptedWallet, typeLabels } from './types';
import { artById, catalog, expiration, formattedAddress } from './data';
import { MAX_BACKUP_BYTES, validateWallet, isEncrypted, encryptWallet, decryptWallet, createEncryption, mergeWallets, downloadFile } from './storage';
import { Modal, EntryForm, CardArt, SourceLink } from './components';
import { Brand } from './components/brand';
import { ResizableShell } from './components/resizable-shell';
import { IconAction } from './components/icon-action';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Badge } from './components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './components/ui/tabs';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from './components/ui/empty';
import { InputGroup, InputGroupInput, InputGroupAddon, InputGroupButton } from './components/ui/input-group';
import { ToggleGroup, ToggleGroupItem } from './components/ui/toggle-group';
import { FadeIn } from './components/amicro/fade-in';
import { searchArtworks } from './artwork-search';
import { applyArtwork } from './artwork-entry';
import { CountryLabel } from './components/country-flag';
import { SimCardFace, SimEntryTile } from './components/sim-card';
import { AddressCardFace, AddressEntryTile } from './components/address-card';
import { WalletOverview } from './components/wallet-overview';
import { WorldDistribution } from './components/world-distribution';
import { usePreferences } from './preferences';
import { PreferencesPage, ProfileAvatar, ProfileMenu } from './components/preferences-page';

type Page='wallet'|'payment'|'favorites'|'sim'|'address'|'library'|'settings'|'preferences';
function readInitial(raw:string){
  try {const parsed:unknown=JSON.parse(raw);return isEncrypted(parsed)?{raw,wallet:null,encrypted:parsed,error:''}:{raw,wallet:validateWallet(parsed),encrypted:null,error:''};}
  catch {return {raw,wallet:null,encrypted:null,error:'无法读取卡包。现有数据已保留，请先下载原始备份，再导入有效备份恢复。'};}
}
const pageTitles:Record<Page,string>={wallet:'我的信息',payment:'支付信息',favorites:'我的收藏',sim:'SIM卡信息',address:'地址信息',library:'卡面图鉴',settings:'数据隐私',preferences:'设置'};
const pageDescriptions:Record<Page,string>={wallet:'收好每一份信息，连接你的世界。',payment:'管理银行卡与 U 卡，随时查找支付信息。',sim:'管理号码、套餐和续费日期。',address:'保存常用收件地址与账单地址。',favorites:'已收藏的卡片、号码和地址。',library:'选择一张卡面，添加到你的信息。',settings:'管理账号、备份和加密。',preferences:'个人资料与使用偏好。'};
const artworkTypeOrder:Record<string,number>={bank:0,crypto:1,sim:2};
const navItems = [{id:'wallet',label:'我的信息',icon:WalletCards},{id:'payment',label:'支付信息',icon:CreditCard},{id:'sim',label:'SIM卡信息',icon:Smartphone},{id:'address',label:'地址信息',icon:MapPin},{id:'favorites',label:'我的收藏',icon:Star}] as const;

export default function App({initialRaw,initialRevision,username,onLogout,onExit,onPersist,settingsPanel,notice,storageKind='cloud'}:{initialRaw:string;initialRevision:number;username:string;onLogout:()=>Promise<void>;onExit?:()=>Promise<void>;onPersist:(payload:unknown,revision:number)=>Promise<{revision:number}>;settingsPanel:ReactNode;notice?:ReactNode;storageKind?:'cloud'|'local'|'demo'}){
  const local = storageKind === 'local';
  const demo = storageKind === 'demo';
  const preferences = usePreferences(local, username, !demo);
  const [initial]=useState(()=>readInitial(initialRaw));
  const reducedMotion = useReducedMotion();
  const revisionRef=useRef(initialRevision);
  const [wallet,setWallet]=useState<Wallet|null>(initial.wallet);
  const [encrypted,setEncrypted]=useState<EncryptedWallet|null>(initial.encrypted);
  const [fatal,setFatal]=useState(initial.error);
  const rawRef=useRef<string|null>(initial.raw);
  const keyRef=useRef<CryptoKey|null>(null);
  const [page,setPage]=useState<Page>('wallet');
  const [search,setSearch]=useState('');
  const [filter,setFilter]=useState('all');
  const [region,setRegion]=useState('all');
  const [sort,setSort]=useState('recent');
  const [layout,setLayout]=useState('grid');
  const [privacy,setPrivacy]=useState(false);
  const [mobileNav,setMobileNav]=useState(false);
  const [form,setForm]=useState<Entry|null>(null);
  const [detail,setDetail]=useState<Entry|null>(null);
  const [reveal,setReveal]=useState(false);
  const [deleteEntry,setDeleteEntry]=useState<Entry|null>(null);
  const [confirm,setConfirm]=useState<'demo'|'all'|null>(null);
  const [showEncryption,setShowEncryption]=useState(false);
  const [showImport,setShowImport]=useState(false);
  const [help,setHelp]=useState(false);
  const [busy,setBusy]=useState(false);
  const busyRef=useRef(false);
  const [toast,setToast]=useState('');
  const [online,setOnline]=useState(navigator.onLine);
  const inputRef=useRef<HTMLInputElement>(null);
  const menuRef=useRef<HTMLButtonElement>(null);
  const entries=wallet?.entries||[];
  const bankCards=entries.filter(e=>e.type==='bank');
  const cryptoCards=entries.filter(e=>e.type==='crypto');
  const simCards=entries.filter(e=>e.type==='sim');
  const addresses=entries.filter(e=>e.type==='address');
  const favoriteCount=entries.filter(e=>e.favorite).length;
  const pageCounts:Record<Page,number>={wallet:entries.length,payment:bankCards.length+cryptoCards.length,sim:simCards.length,address:addresses.length,favorites:favoriteCount,library:catalog.length,settings:entries.length,preferences:0};
  const demoCount=entries.filter(e=>e.demo).length;
  const geoCountries=[...new Set(entries.map(e=>e.country).filter(c=>c&&c!=='全球'))];
  const addressCountryCount=new Set(addresses.map(e=>e.country).filter(c=>c&&c!=='全球')).size;
  const reminders=entries.filter(e=>expiration(e));
  const navigate=(next:Page)=>{setPage(next);setSearch('');setFilter('all');setRegion('all');setMobileNav(false);window.scrollTo({top:0,behavior:reducedMotion?'instant':'smooth'});};
  const notify=(message:string)=>{setToast(message);};
  useEffect(()=>{if(!toast)return;const timer=setTimeout(()=>setToast(''),4000);return()=>clearTimeout(timer);},[toast]);
  const closeDetail=()=>{setDetail(null);setReveal(false);};
  const lock=()=>{if(!encrypted||busyRef.current)return;keyRef.current=null;setWallet(null);setForm(null);closeDetail();setShowEncryption(false);setShowImport(false);setDeleteEntry(null);setConfirm(null);setSearch('');setPrivacy(false);};
  useEffect(()=>{
    let timer:ReturnType<typeof setTimeout>;
    const reset=()=>{clearTimeout(timer);if(encrypted&&wallet)timer=setTimeout(lock,5*60*1000);};
    const hide=()=>{setReveal(false);if(document.hidden&&encrypted)lock();};
    const network=()=>setOnline(navigator.onLine);
    document.addEventListener('visibilitychange',hide);window.addEventListener('pointerdown',reset);window.addEventListener('keydown',reset);window.addEventListener('online',network);window.addEventListener('offline',network);reset();if(document.hidden && encrypted)lock();
    return()=>{clearTimeout(timer);document.removeEventListener('visibilitychange',hide);window.removeEventListener('pointerdown',reset);window.removeEventListener('keydown',reset);window.removeEventListener('online',network);window.removeEventListener('offline',network);};
  },[encrypted,wallet]);
  useEffect(()=>{
    const shortcut=(e:KeyboardEvent)=>{if((e.metaKey||e.ctrlKey)&&e.key==='k'){e.preventDefault();inputRef.current?.focus();}};
    window.addEventListener('keydown',shortcut);return()=>{window.removeEventListener('keydown',shortcut);};
  },[]);
  useEffect(()=>{
    if(!mobileNav)return;
    const closeNavigation=(event:KeyboardEvent)=>{if(event.key==='Escape'){setMobileNav(false);menuRef.current?.focus();}};
    window.addEventListener('keydown',closeNavigation);
    return()=>window.removeEventListener('keydown',closeNavigation);
  },[mobileNav]);
  const persistRaw=async(raw:string)=>{
    const result=await onPersist(JSON.parse(raw),revisionRef.current);
    revisionRef.current=result.revision;rawRef.current=raw;
  };
  const commit=async(next:Wallet)=>{
    if(busyRef.current)throw new Error('正在保存，请稍后再试。');
    busyRef.current=true;setBusy(true);
    try{const clean=validateWallet({...next,updatedAt:new Date().toISOString()});
      if(encrypted){if(!keyRef.current)throw new Error('请先解锁卡包。');const envelope=await encryptWallet(clean,keyRef.current,encrypted.salt);await persistRaw(JSON.stringify(envelope));setEncrypted(envelope);}else await persistRaw(JSON.stringify(clean));
      setWallet(clean);return clean;
    }finally{busyRef.current=false;setBusy(false);}
  };
  const saveEntry=async(entry:Entry)=>{if(!wallet)return;const exists=wallet.entries.some(e=>e.id===entry.id);await commit({...wallet,entries:exists?wallet.entries.map(e=>e.id===entry.id?entry:e):[entry,...wallet.entries]});setForm(null);notify(exists?'记录已更新':'已添加到你的卡包');};
  const favorite=async(entry:Entry)=>{if(!wallet)return;try{await commit({...wallet,entries:entries.map(e=>e.id===entry.id?{...e,favorite:!e.favorite}:e)});if(detail?.id===entry.id)setDetail({...entry,favorite:!entry.favorite});}catch(err){notify((err as Error).message);}};
  const remove=async()=>{if(!wallet||!deleteEntry)return;try{await commit({...wallet,entries:entries.filter(e=>e.id!==deleteEntry.id)});setDeleteEntry(null);closeDetail();notify('记录已删除');}catch(err){notify((err as Error).message);}};
  const copy=async(text:string)=>{try{await navigator.clipboard.writeText(text);notify('已复制到剪贴板');}catch{notify('浏览器不允许自动复制，请在详情中选中文本手动复制。');}};
  const exportBackup=async()=>{try{const content=rawRef.current||JSON.stringify(wallet);const saved=await downloadFile(content,`folio-${new Date().toISOString().slice(0,10)}${encrypted?'-encrypted':''}.json`);if(saved)notify(encrypted?'已导出密码加密备份':'已导出备份，请妥善保存其中的个人信息');}catch(error){notify(error instanceof Error?error.message:'导出失败，请检查保存位置。');}};
  const add=(type?:ItemType)=>setForm(blankEntry(type||(page==='sim'||page==='address'?page:filter==='crypto'?'crypto':'bank')));
  const displayed=useMemo(()=>{
    let list=entries.filter(e=>page==='favorites'?e.favorite:page==='wallet'?true:page==='payment'?(e.type==='bank'||e.type==='crypto'):e.type===page);
    if(filter!=='all')list=list.filter(e=>e.type===filter);
    if(region!=='all')list=list.filter(e=>e.country===region);
    if(search.trim()){const q=search.trim().toLowerCase();list=list.filter(e=>[e.name,e.issuer,e.country,e.tags,e.number,e.phone,e.line1,e.city].join(' ').toLowerCase().includes(q));}
    return [...list].sort((a,b)=>sort==='name'?a.name.localeCompare(b.name,'zh-CN'):sort==='favorite'?Number(b.favorite)-Number(a.favorite):b.createdAt.localeCompare(a.createdAt));
  },[entries,page,filter,region,search,sort]);
  const libraryCards=searchArtworks(catalog.filter(a=>(filter==='all'||a.type===filter)&&(region==='all'||a.region===region)),search)
    .sort((a,b)=>(artworkTypeOrder[a.type]??1)-(artworkTypeOrder[b.type]??1));
  const openEntry=(e:Entry)=>{setDetail(e);setReveal(false);};

  if(fatal)return <div className="lock-screen"><div className="lock-panel"><Brand/><h1>数据需要恢复</h1><p>{fatal}</p><Button variant="outline" className="button secondary" onClick={()=>{const raw=rawRef.current;if(raw)void downloadFile(raw,'folio-recovery-raw.json').catch(error=>setFatal(error.message));}}>下载原始数据</Button><Button variant="default" className="button primary" onClick={()=>setShowImport(true)}>导入有效备份</Button></div><AnimatePresence>{showImport&&<ImportModal key="recovery-import" onClose={()=>setShowImport(false)} current={{version:1,entries:[],updatedAt:new Date().toISOString()}} onImport={async next=>{const clean=validateWallet(next);await persistRaw(JSON.stringify(clean));setWallet(clean);setEncrypted(null);setFatal('');setShowImport(false);}} recovery/>}</AnimatePresence></div>;
  if(encrypted&&!wallet)return <><UnlockScreen onUnlock={async password=>{const result=await decryptWallet(encrypted,password);keyRef.current=result.key;setWallet(result.wallet);}} onExport={exportBackup} onLogout={onLogout} local={local}/>{toast&&<div className="toast" role="status">{toast}</div>}</>;

  return <ResizableShell persistent={!demo}>
    {mobileNav&&<button className="nav-backdrop" aria-label="关闭导航" onClick={()=>setMobileNav(false)}/>}
    <aside id="app-navigation" className={`sidebar ${mobileNav?'open':''}`}>
      <div className="sidebar-brand"><Brand onHome={local||demo?()=>navigate('wallet'):undefined}/></div>
      <span className="nav-label">信息</span>
      <nav aria-label="主导航">{navItems.map(({id,label,icon:Icon})=><button key={id} className={`nav-link ${page===id?'active':''}`} aria-current={page===id?'page':undefined} onClick={()=>navigate(id)}><Icon size={17}/><span>{label}</span><em>{pageCounts[id]}</em></button>)}</nav>
      <span className="nav-label second">工具</span>
      <nav aria-label="管理工具"><button className={`nav-link ${page==='library'?'active':''}`} aria-current={page==='library'?'page':undefined} onClick={()=>navigate('library')}><Image size={17}/><span>卡面图鉴</span><em>{catalog.length}</em></button><button className={`nav-link ${page==='settings'?'active':''}`} aria-current={page==='settings'?'page':undefined} onClick={()=>navigate('settings')}><Settings2 size={17}/><span>数据隐私</span></button></nav>
      <div className="sidebar-bottom"><button className="help-link" onClick={()=>setHelp(true)}><CircleHelp size={16}/> 使用指南 <ArrowUpRight size={14}/></button><div className="profile"><ProfileAvatar profile={preferences.preferences.profile}/><div className="profile-copy"><strong title={preferences.preferences.profile.displayName}>{preferences.preferences.profile.displayName}</strong><small><i/>{demo?'演示数据':local?'本地数据':'在线数据'}{encrypted&&<LockKeyhole size={11} aria-label="资料已加密"/>}</small></div><ProfileMenu local={local} onSettings={()=>navigate('preferences')} onExit={()=>{void (onExit||onLogout)().catch(error=>notify(error.message));}}/></div></div>
    </aside>
    <div className={`main-shell${page==='wallet'?' information-shell':''}`}>
      <header className="topbar"><div className="breadcrumb"><Button variant="ghost" size="icon-sm" ref={menuRef} className="menu-toggle" aria-label="打开导航" aria-controls="app-navigation" aria-expanded={mobileNav} onClick={()=>setMobileNav(true)}><Menu size={19}/></Button><strong>{pageTitles[page]}</strong></div><div className="topbar-actions"><span className={`local-status ${!local&&!online?'offline':''}`}><i/>{demo?'演示模式':busy?'正在保存…':local?'本地保存':online?'已连接':'当前离线'}</span><span className="topbar-divider"/><IconAction label={privacy?'显示尾号':'隐藏尾号'} onClick={()=>setPrivacy(!privacy)}>{privacy?<EyeOff size={17}/>:<Eye size={17}/>}</IconAction><IconAction label="查看到期提醒" className="notification-button" onClick={()=>{if(reminders.length){setDetail(reminders[0]);}else notify('未来 30 天暂无到期或续费提醒');}}><Bell size={17}/>{reminders.length>0&&<i/>}</IconAction></div></header>
      {notice}
      <FadeIn key={page} className="page-transition"><main className={page==='settings'||page==='preferences'?'settings-content':page==='wallet'?'information-content':undefined}>
        {page==='preferences'?<PreferencesPage controller={preferences} local={local} onData={()=>navigate('settings')}/>:page==='settings'?<><div className="content-heading settings-heading"><div><h1>数据隐私</h1><p>{local?'管理本地资料、备份和加密。':'管理账号、备份和卡包加密。'}</p></div></div>{settingsPanel}<SettingsPage local={local} encrypted={!!encrypted} entries={entries} onExport={exportBackup} onImport={()=>setShowImport(true)} onEncrypt={()=>setShowEncryption(true)} onLock={lock} onClearDemo={()=>setConfirm('demo')} onClear={()=>setConfirm('all')}/></>:<>
          <div className="content-heading"><div><div className="heading-title"><h1>{pageTitles[page]}</h1><Badge variant="secondary" className="count-badge">{pageCounts[page]}</Badge></div><p>{pageDescriptions[page]}</p></div><div className="heading-actions">{page==='wallet'&&<Button variant="outline" className="button secondary desktop-only" onClick={()=>setShowImport(true)}><Upload size={15}/>导入备份</Button>}<Button className="button primary" onClick={()=>add()}><Plus size={16}/>{page==='wallet'?'添加信息':page==='payment'?(filter==='bank'?'添加银行卡':filter==='crypto'?'添加 U 卡':'添加卡片'):page==='address'?'添加地址':page==='sim'?'添加号码':'添加卡片'}</Button></div></div>
          {page==='wallet'?<><WalletOverview counts={{bank:bankCards.length,crypto:cryptoCards.length,sim:simCards.length,address:addressCountryCount}} onSelect={kind=>{if(kind==='bank'||kind==='crypto'){navigate('payment');setFilter(kind);}else navigate(kind);}}/><WorldDistribution initialGlobe={demo} entries={entries} onOpen={openEntry} onAdd={()=>add()}/></>:<>
          {page==='library'&&<div className="library-note"><BookOpen size={15}/><span>{catalog.length} 张内置卡面 · 仅用于识别与个人收藏，产品信息以发卡机构为准。</span></div>}
          <div className="collection-layout"><div className="collection-main">
            <Tabs value={filter} onValueChange={setFilter}>
              <div className="toolbar"><div>{(page==='payment'||page==='library'||page==='favorites')?<TabsList aria-label="记录类型">{[{id:'all',label:'全部'},{id:'bank',label:'银行卡'},{id:'crypto',label:'U 卡'},...(page==='favorites'?[{id:'sim',label:'SIM / eSIM'},{id:'address',label:'地址'}]:[])].map(t=><TabsTrigger key={t.id} value={t.id}>{t.label}</TabsTrigger>)}</TabsList>:<span className="results-label">{page==='sim'?'全部号码':'全部地址'}</span>}</div><ToggleGroup type="single" variant="outline" size="sm" value={layout} onValueChange={value=>{if(value)setLayout(value as 'grid'|'list');}} aria-label="切换视图"><ToggleGroupItem value="grid" aria-label="网格视图"><Grid2X2 size={16}/></ToggleGroupItem><ToggleGroupItem value="list" aria-label="列表视图"><List size={17}/></ToggleGroupItem></ToggleGroup></div>
              <div className="search-row"><InputGroup className="search-box"><InputGroupInput ref={inputRef} aria-label="搜索记录" value={search} onChange={e=>setSearch(e.target.value)} placeholder={page==='address'?'搜索名称、城市或地址':page==='library'?'搜索银行、品牌或卡面':'搜索名称、机构或标签'}/><InputGroupAddon><Search size={15}/></InputGroupAddon><InputGroupAddon align="inline-end">{search?<InputGroupButton size="icon-xs" aria-label="清除搜索" onClick={()=>setSearch('')}><X size={14}/></InputGroupButton>:<kbd>Ctrl K</kbd>}</InputGroupAddon></InputGroup><label className="filter-select"><SlidersHorizontal size={14}/><select aria-label="筛选地区" value={region} onChange={e=>setRegion(e.target.value)}><option value="all">全部地区</option>{page==='library'?<><option value="cn">中国大陆</option><option value="hk">中国香港</option><option value="us">美国</option><option value="uk">英国</option><option value="more">其他地区</option><option value="global">全球 / 未指定</option></>:geoCountries.map(c=><option key={c}>{c}</option>)}{page!=='library'&&<option value="全球">全球</option>}</select></label>{page!=='library'&&<select className="sort-select" aria-label="排序方式" value={sort} onChange={e=>setSort(e.target.value)}><option value="recent">最近添加</option><option value="name">名称排序</option><option value="favorite">收藏优先</option></select>}</div>
              <TabsContent key={`${filter}-${region}-${layout}-${sort}`} value={filter} className="collection-content">
                {page==='library'?<div className={`cards-grid library-grid ${layout==='list'?'list-view':''}`}>{libraryCards.map(art=><article className="library-card" key={art.id}><button className="art-add-button" aria-label={`使用 ${art.name} 卡面`} onClick={()=>setForm(applyArtwork(blankEntry(),art))}><CardArt entry={{artId:art.id}}/><span className="art-hover"><Plus size={17}/> 使用此卡面</span></button><div className="library-card-info"><strong>{art.name}</strong><span>{art.issuer} · {art.subtype}</span><SourceLink artId={art.id}/></div></article>)}{!libraryCards.length&&<EmptyState onAdd={()=>{setSearch('');setFilter('all');setRegion('all');}} search label="清除筛选"/>}</div>:<div className={`cards-grid ${page==='sim'?'sim-grid':''} ${page==='address'?'address-grid':''} ${layout==='list'?'list-view':''}`}>{displayed.map(entry=><EntryTile key={entry.id} entry={entry} privacy={privacy} onOpen={()=>openEntry(entry)} onFavorite={()=>favorite(entry)} onCopy={()=>copy(formattedAddress(entry))}/>)}{!displayed.length&&<EmptyState search={!!search||(filter!=='all'&&page!=='payment')||region!=='all'} onAdd={()=>{if(search||(filter!=='all'&&page!=='payment')||region!=='all'){setSearch('');setFilter('all');setRegion('all');}else add();}} label={search||(filter!=='all'&&page!=='payment')||region!=='all'?'清除筛选':undefined} onLibrary={page==='payment'&&!search&&region==='all'?()=>{const cardType=filter;navigate('library');setFilter(cardType);}:undefined}/>}</div>}
              </TabsContent>
            </Tabs>
            {demoCount>0&&page!=='library'&&<div className="demo-note"><span>包含 {demoCount} 条示例记录</span><button onClick={()=>setConfirm('demo')}>清除示例 <ArrowRight size={13}/></button></div>}
            <div className="collection-footer"><span>{page==='library'?libraryCards.length:displayed.length} 条{search||filter!=='all'||region!=='all'?'匹配结果':'记录'}</span><span>完整信息默认隐藏</span></div>
          </div></div></>}
        </>}
        <footer className="page-footer"><span>Folio</span><span><LockKeyhole size={12}/>{encrypted?'卡包已加密':'仅自己可见'}</span></footer>
      </main></FadeIn>
    </div>
    <nav className="mobile-bottom" aria-label="移动导航">{[{id:'wallet',icon:WalletCards,label:'信息'},{id:'payment',icon:CreditCard,label:'支付信息'},{id:'sim',icon:Smartphone,label:'SIM'},{id:'address',icon:MapPin,label:'地址信息'}].map(({id,icon:Icon,label})=><button key={id} className={page===id?'active':''} aria-current={page===id?'page':undefined} onClick={()=>navigate(id as Page)}><Icon size={19}/><span>{label}</span></button>)}</nav>
    <AnimatePresence>
    {form&&<EntryForm key={form.id} initial={form} isEdit={entries.some(e=>e.id===form.id)} onClose={()=>setForm(null)} onSave={saveEntry} busy={busy}/>}
    {detail&&<Modal key="entry-detail" sheet title={detail.name} subtitle={`${typeLabels[detail.type]}${detail.demo?' · 示例记录':''}`} onClose={closeDetail}><div className="detail-body">{(detail.type==='bank'||detail.type==='crypto')&&<div className="detail-art"><CardArt entry={detail}/></div>}<div className="detail-sim" hidden={detail.type!=='sim'}>{detail.type==='sim'&&<SimCardFace entry={detail} privacy={privacy}/>}</div>{detail.type==='address'&&<div className="detail-postcard"><AddressCardFace entry={detail}/></div>}<div className="detail-toolbar"><Button variant="outline" className="button secondary" onClick={()=>favorite(detail)}><Star size={15} fill={detail.favorite?'currentColor':'none'}/>{detail.favorite?'已收藏':'收藏'}</Button><Button variant="outline" className="button secondary" onClick={()=>{setForm(detail);closeDetail();}}><Pencil size={15}/> 编辑</Button><Button variant="ghost" className="button ghost danger" onClick={()=>setDeleteEntry(detail)}><Trash2 size={15}/> 删除</Button></div><dl className="detail-fields">{(detail.type==='address'?[['国家 / 地区',detail.country],['收件人',detail.holder],['街道地址',detail.line1],['地址补充',detail.line2],['城市',detail.city],['省 / 州',detail.region],['邮编',detail.postal],['联系电话',detail.phone],['地图 / 位置网址',detail.mapUrl]]:detail.type==='sim'?[['运营商',detail.issuer],['国家 / 地区',detail.country],['电话号码',detail.phone],['SIM 类型',detail.simType],['套餐',detail.plan],['续费 / 保号日期',detail.renewal],['ICCID',reveal?detail.iccid:detail.iccid?'•••• '+detail.iccid.slice(-4):'']]:[['发卡机构',detail.issuer],['国家 / 地区',detail.country],['卡号',reveal?detail.number:detail.number?'•••• •••• •••• '+detail.number.slice(-4):''],['持卡人',detail.holder],['有效期',detail.expiry],['币种 / 资产',detail.currency],['卡组织',detail.network],['类型',detail.subtype]]).filter(([,v])=>v).map(([label,value])=><div key={label}><dt>{label}</dt><dd>{label==='国家 / 地区'?<CountryLabel country={value}/>:label==='地图 / 位置网址'?<a className="detail-map-link" href={value} target="_blank" rel="noopener noreferrer" title={value}>打开地图<ArrowUpRight size={14}/></a>:value}{['卡号','电话号码','ICCID'].includes(label)&&<button className="icon-button" aria-label={`复制${label}`} onClick={()=>copy(label==='卡号'?detail.number:label==='ICCID'?detail.iccid:detail.phone)}><Copy size={14}/></button>}</dd></div>)}</dl>{(detail.number.length>4||detail.iccid)&&<button className="text-link" onClick={()=>setReveal(!reveal)}>{reveal?<EyeOff size={15}/>:<Eye size={15}/>} {reveal?'隐藏完整信息':'显示完整信息'}</button>}{detail.tags&&<div className="detail-tags">{detail.tags.split(/[,，]/).filter(Boolean).map((tag,i)=><span key={i}>{tag.trim()}</span>)}</div>}{detail.notes&&<div className="detail-notes"><strong>备注</strong><p>{detail.notes}</p></div>}{detail.type==='address'&&<Button variant="default" className="button primary full-width" onClick={()=>copy(formattedAddress(detail))}><Copy size={16}/> 复制完整地址</Button>}<div className="detail-source">{detail.type!=='sim'&&<SourceLink artId={detail.artId}/>}<span>更新于 {new Date(detail.updatedAt).toLocaleDateString('zh-CN')}</span></div></div></Modal>}
    {deleteEntry&&<Modal key="delete-entry" title="删除这条记录？" onClose={()=>setDeleteEntry(null)}><p className="modal-message">「{deleteEntry.name}」将从当前卡包移除。此操作无法撤销。</p><div className="modal-actions"><Button variant="outline" className="button secondary" onClick={()=>setDeleteEntry(null)}>取消</Button><Button variant="destructive" className="button destructive" disabled={busy} onClick={remove}>确认删除</Button></div></Modal>}
    {confirm&&<Modal key="confirm" title={confirm==='demo'?'清除示例，开始自己的收藏':'清空当前卡包？'} onClose={()=>setConfirm(null)}><p className="modal-message">{confirm==='demo'?`将删除 ${demoCount} 条示例记录。你自己添加的记录会保留。`:'所有卡片、号码和地址将从当前卡包删除。建议先导出备份，此操作无法撤销。'}</p><div className="modal-actions"><Button variant="outline" className="button secondary" onClick={()=>setConfirm(null)}>取消</Button><Button variant="destructive" className="button destructive" disabled={busy} onClick={async()=>{if(!wallet)return;try{await commit({...wallet,entries:confirm==='demo'?entries.filter(e=>!e.demo):[]});setConfirm(null);notify('已清除指定记录');}catch(err){notify((err as Error).message);}}}>确认清除</Button></div></Modal>}
    {showEncryption&&wallet&&<PasswordModal key="encryption" onClose={()=>setShowEncryption(false)} onSubmit={async password=>{if(busyRef.current)return;busyRef.current=true;setBusy(true);try{const result=await createEncryption(wallet,password);await persistRaw(JSON.stringify(result.envelope));keyRef.current=result.key;setEncrypted(result.envelope);setShowEncryption(false);notify('密码加密已开启，请妥善保管密码');}finally{busyRef.current=false;setBusy(false);}}}/>}
    {showImport&&wallet&&<ImportModal key="import" onClose={()=>setShowImport(false)} current={wallet} onImport={async next=>{await commit(next);setShowImport(false);notify('备份导入成功');}}/>}
    {help&&<Modal key="help" title="随身卡包，使用指南" onClose={()=>setHelp(false)}><div className="help-content"><p><strong>01 · 收藏你的卡片</strong>从卡面图鉴选择样式，或上传自己的空白卡面。支持银行卡、U 卡和 SIM 电话卡。</p><p><strong>02 · 管理地址信息</strong>按国家、城市整理收件与账单地址，一键复制完整地址。</p><p><strong>03 · 保存与使用</strong>{local?'资料直接保存在所选文件夹，无需联网。可在数据隐私中选择其他目录，或使用备份在设备间迁移。':'登录后从云端数据库读取卡包，每次保存即时写入。另一台设备刷新页面即可获取最新记录。'}</p><p><strong>04 · 备份与密码</strong>在「数据隐私」中导出备份、导入到其他设备，或开启密码加密。忘记加密密码无法恢复，请妥善保管。</p><p><strong>05 · 备份与迁移</strong>{local?'网页端导出的普通或加密备份，都可以在本地版导入。资料不会自动上传云端。':'旧版本地卡包可先导出，再登录本站导入。'}</p><p className="tiny muted">本工具只整理信息，不连接银行，不处理资金。卡面和商标归相应权利人所有。</p></div></Modal>}
    </AnimatePresence>
    <AnimatePresence>
    {toast&&<motion.div key={toast} className="toast" role="status" initial={{opacity:0,x:"-50%",y:reducedMotion?0:12}} animate={{opacity:1,x:"-50%",y:0}} exit={{opacity:0,y:reducedMotion?0:6}} transition={{duration:reducedMotion?0:0.18}}><Check size={17}/>{toast}<button aria-label="关闭提示" onClick={()=>setToast('')}><X size={14}/></button></motion.div>}
    </AnimatePresence>
  </ResizableShell>;
}

function EmptyState({search=false,onAdd,label,onLibrary}:{search?:boolean;onAdd:()=>void;label?:string;onLibrary?:()=>void}){return <Empty className="empty-state"><EmptyHeader><EmptyMedia variant="icon"><WalletCards strokeWidth={1.5}/></EmptyMedia><EmptyTitle>{search?'没有匹配的记录':'还没有添加卡片'}</EmptyTitle><EmptyDescription>{search?'调整关键词或筛选条件后再试。':'添加一条记录，或先从图鉴中选择卡面。'}</EmptyDescription></EmptyHeader><EmptyContent><div className="empty-actions"><Button variant="outline" onClick={onAdd}><Plus size={15}/>{label||'添加记录'}</Button>{onLibrary&&<Button variant="ghost" onClick={onLibrary}>浏览卡面<ArrowRight size={15}/></Button>}</div></EmptyContent></Empty>;}
function EntryTile({entry,privacy,onOpen,onFavorite,onCopy}:{entry:Entry;privacy:boolean;onOpen:()=>void;onFavorite:()=>void;onCopy:()=>void}){
  if(entry.type==='sim')return <SimEntryTile entry={entry} privacy={privacy} onOpen={onOpen} onFavorite={onFavorite}/>;
  if(entry.type==='address')return <AddressEntryTile entry={entry} onOpen={onOpen} onFavorite={onFavorite} onCopy={onCopy}/>;
  const expiry=expiration(entry);
  const cardType=entry.type==='crypto'?'U 卡':entry.subtype||'银行卡';
  const cardNumber=privacy?'••••':`•••• ${entry.number.slice(-4)||'—'}`;
  return <article className={`entry-tile ${entry.type}-tile payment-tile`}>
    <div className="tile-top-actions">{entry.demo&&<span className="demo-badge">示例</span>}<button className={`favorite-button ${entry.favorite?'is-favorite':''}`} aria-label={`${entry.favorite?'取消收藏':'收藏'} ${entry.name}`} aria-pressed={entry.favorite} onClick={onFavorite}><Star size={15} fill={entry.favorite?'currentColor':'none'}/></button></div>
    <button className="tile-main" onClick={onOpen} aria-label={`查看 ${entry.name}`}>
      <div className="card-stage"><CardArt entry={entry}/></div>
      <div className="tile-info"><h3 title={entry.name}>{entry.name}</h3><div className="card-meta"><span className="card-identity"><span className="card-issuer" title={entry.issuer}>{entry.issuer}</span><span className="card-type" title={cardType}>{cardType}</span></span><span className="masked-number list-card-number">{cardNumber}</span></div></div>
    </button><div className="tile-footer"><span className="tile-region"><CountryLabel country={entry.country}/></span><span className="masked-number grid-card-number">{cardNumber}</span></div>{expiry&&<div className="expiry-note"><Bell size={12}/>{expiry.label}</div>}
  </article>;
}

function SettingsPage({local=false,encrypted,entries,onExport,onImport,onEncrypt,onLock,onClearDemo,onClear}:{local?:boolean;encrypted:boolean;entries:Entry[];onExport:()=>void;onImport:()=>void;onEncrypt:()=>void;onLock:()=>void;onClearDemo:()=>void;onClear:()=>void}){
  const size=(new Blob([JSON.stringify(entries)]).size/1024).toFixed(1);
  return <div className="settings-page"><section className="settings-panel"><div className="settings-panel-title"><Database size={21}/><div><h3>卡包存储</h3><p>{entries.length} 条记录 · 约 {size} KB</p></div><span className="status-tag">{encrypted?'已加密':'未加密'}</span></div><p className="settings-description">{local?'卡包保存在你选择的本地文件夹，保存成功后即时写入磁盘。建议定期导出备份。':'卡包保存在 Cloudflare D1 数据库，保存成功后同步到云端。在其他设备登录即可读取。'}</p></section><section className="settings-panel"><div className="settings-row"><div className="settings-icon"><LockKeyhole size={21}/></div><div><h3>密码加密</h3><p>{encrypted?'已开启 AES-GCM 加密，切换后台或闲置 5 分钟后自动锁定。':local?'在本机加密后再保存。开启前，文件中的记录可直接读取。':'在浏览器加密后再上传。开启前，记录可由服务器读取。'}</p></div><Button variant="outline" className="button secondary" onClick={encrypted?onLock:onEncrypt}>{encrypted?'立即锁定':'开启加密'}<ArrowRight size={14}/></Button></div><p className="tiny muted">加密密码仅在当前设备用于加密和解密，不会上传。密码遗失后无法找回，请妥善保管。</p></section><section className="settings-panel"><div className="settings-row"><div className="settings-icon"><Download size={21}/></div><div><h3>导出备份</h3><p>{encrypted?'导出包含全部记录和自定义卡面的密码加密文件。':'导出全部记录和自定义卡面为 JSON 文件，文件包含明文个人资料。'}</p></div><Button variant="outline" className="button secondary" onClick={onExport}><ArrowDownToLine size={15}/> 导出</Button></div><div className="settings-divider"/><div className="settings-row"><div className="settings-icon"><Upload size={21}/></div><div><h3>从备份恢复</h3><p>支持普通与加密备份。先预览，再选择合并或替换。</p></div><Button variant="outline" className="button secondary" onClick={onImport}><Upload size={15}/> 导入</Button></div></section><section className="settings-panel"><div className="settings-row"><div className="settings-icon"><Sparkles size={21}/></div><div><h3>示例数据</h3><p>当前有 {entries.filter(e=>e.demo).length} 条示例。清除不会影响自己添加的记录。</p></div><Button variant="outline" className="button secondary" disabled={!entries.some(e=>e.demo)} onClick={onClearDemo}>清除示例</Button></div><div className="settings-divider"/><div className="settings-row"><div className="settings-icon danger"><Trash2 size={21}/></div><div><h3>清空卡包</h3><p>删除当前卡包中的所有记录，请先备份。</p></div><Button variant="ghost" className="button ghost danger" disabled={!entries.length} onClick={onClear}>清空数据</Button></div></section><section className="settings-panel source-panel"><BookOpen size={20}/><div><h3>关于卡面与设计参考</h3><p>内置 {catalog.length} 张公开卡面，来源于发卡机构、运营商、零售商的公开页面与 <a href="https://card.lengziyu.cn/cards" target="_blank" rel="noreferrer">CardFi 集卡</a>，每张卡面保留独立来源链接。商标与卡面版权归各自权利人，收录不代表合作、背书或当前可申请状态。</p></div></section></div>;
}

function PasswordModal({onClose,onSubmit}:{onClose:()=>void;onSubmit:(password:string)=>Promise<void>}){
  const [password,setPassword]=useState(''),[repeat,setRepeat]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  return <Modal title="开启卡包加密" subtitle="设置密码后，数据和备份将加密保存。" onClose={onClose}><form className="password-form" onSubmit={async e=>{e.preventDefault();setError('');if(password!==repeat){setError('两次输入的密码不一致。');return;}setBusy(true);try{await onSubmit(password);}catch(err){setError((err as Error).message);}finally{setBusy(false);}}}><label>加密密码<Input type="password" minLength={10} maxLength={200} required autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="至少 10 个字符"/></label><label>确认密码<Input type="password" required autoComplete="new-password" value={repeat} onChange={e=>setRepeat(e.target.value)} placeholder="再次输入密码"/></label><p className="notice">请妥善保管密码。没有服务器替你找回密码，遗失后将无法解密。</p>{error&&<p className="error-message" role="alert">{error}</p>}<Button variant="default" className="button primary full-width" disabled={busy}>{busy?'正在加密…':'开启密码加密'}</Button></form></Modal>;
}
function UnlockScreen({onUnlock,onExport,onLogout,local=false}:{local?:boolean;onUnlock:(password:string)=>Promise<void>;onExport:()=>void;onLogout:()=>Promise<void>}){
  const [password,setPassword]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const submit=async(e:FormEvent)=>{e.preventDefault();setBusy(true);setError('');try{await onUnlock(password);}catch(err){setError((err as Error).message);}finally{setBusy(false);}};
  return <div className="lock-screen"><div className="lock-panel"><Brand/><div className="lock-illustration"><LockKeyhole size={33}/></div><h1>欢迎回到你的卡包</h1><p>卡包已加密。输入加密密码，继续你的收藏。</p><form onSubmit={submit}><label className="sr-only" htmlFor="unlock-password">解锁密码</label><Input id="unlock-password" type="password" autoFocus required autoComplete="current-password" placeholder="输入卡包密码" value={password} onChange={e=>setPassword(e.target.value)}/>{error&&<div className="error-message" role="alert">{error}</div>}<Button variant="default" className="button primary full-width" disabled={busy}>{busy?'正在解锁…':'解锁卡包'}<ArrowRight size={17}/></Button></form><button className="text-link" onClick={onExport}><Download size={14}/> 下载加密备份</button><button className="text-link" onClick={async()=>{try{await onLogout();}catch(err){setError((err as Error).message);}}}>{local?'关闭窗口':'退出账号'}</button><span className="tiny muted">加密密码不会上传，也无法找回。</span></div></div>;
}
function ImportModal({onClose,current,onImport,recovery=false}:{onClose:()=>void;current:Wallet;onImport:(wallet:Wallet)=>Promise<void>;recovery?:boolean}){
  const [parsed,setParsed]=useState<Wallet|null>(null),[envelope,setEnvelope]=useState<EncryptedWallet|null>(null),[password,setPassword]=useState(''),[error,setError]=useState(''),[mode,setMode]=useState(recovery?'replace':'merge'),[busy,setBusy]=useState(false),[filename,setFilename]=useState('');
  const read=async(file?:File)=>{setParsed(null);setEnvelope(null);setError('');setPassword('');setFilename(file?.name||'');if(!file)return;try{if(file.size>MAX_BACKUP_BYTES)throw new Error('备份文件不能超过 12 MB。');const input:unknown=JSON.parse(await file.text());if(isEncrypted(input))setEnvelope(input);else setParsed(validateWallet(input));}catch(err){setError(err instanceof SyntaxError?'这不是有效的 JSON 备份文件。':(err as Error).message);}};
  const duplicateCount=parsed?.entries.filter(e=>current.entries.some(c=>c.id===e.id)).length||0;
  return <Modal title="从备份恢复" subtitle="选择文件并预览，确认后保存到当前卡包。" onClose={onClose}><div className="import-body"><label className="import-drop"><Upload size={28}/><strong>{filename||'选择 Folio 备份文件'}</strong><span>JSON · 最大 12 MB · 支持加密备份</span><input type="file" accept="application/json,.json" aria-label="选择备份文件" onChange={e=>read(e.target.files?.[0])}/></label>{envelope&&!parsed&&<form className="password-form" onSubmit={async e=>{e.preventDefault();setBusy(true);setError('');try{setParsed((await decryptWallet(envelope,password)).wallet);setPassword('');}catch(err){setError((err as Error).message);}finally{setBusy(false);}}}><label>备份密码<Input type="password" required value={password} onChange={e=>setPassword(e.target.value)}/></label><Button variant="outline" className="button secondary" disabled={busy}>解密并预览</Button></form>}{parsed&&<div className="import-preview"><h3><Check size={18}/> 已读取 {parsed.entries.length} 条记录</h3><div className="import-counts">{(Object.keys(typeLabels) as ItemType[]).map(type=><span key={type}>{typeLabels[type]} <b>{parsed.entries.filter(e=>e.type===type).length}</b></span>)}</div><label className="radio-option"><input type="radio" name="import-mode" value="merge" checked={mode==='merge'} disabled={recovery} onChange={()=>setMode('merge')}/><span><strong>合并到当前卡包</strong><small>保留现有记录，跳过 {duplicateCount} 条相同 ID 的记录。</small></span></label><label className="radio-option"><input type="radio" name="import-mode" value="replace" checked={mode==='replace'} onChange={()=>setMode('replace')}/><span><strong>替换当前卡包</strong><small>{recovery?'将覆盖无法读取的数据，请先下载原始备份。':`将替换当前 ${current.entries.length} 条记录，此操作无法撤销。`}</small></span></label>{recovery&&<p className="notice">恢复后的数据以明文保存。恢复完成后可重新开启密码加密。</p>}</div>}{error&&<div className="error-message" role="alert">{error}</div>}</div><div className="modal-actions"><Button variant="outline" className="button secondary" onClick={onClose}>取消</Button><Button variant="default" className="button primary" disabled={!parsed||busy} onClick={async()=>{if(!parsed)return;setBusy(true);setError('');try{await onImport(mode==='merge'?mergeWallets(current,parsed):parsed);}catch(err){setError((err as Error).message);}finally{setBusy(false);}}}>{busy?'正在导入…':'确认导入'}</Button></div></Modal>;
}
