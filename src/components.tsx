import { useEffect, useRef, useState, type ReactNode, type FormEvent, type PointerEvent } from 'react';
import { usePresence, useReducedMotion } from 'framer-motion';
import { X, CreditCard, Smartphone, MapPin, Plus, Upload, Check, ArrowUpRight, Wifi, Image as ImageIcon } from 'lucide-react';
import { artById, catalog, countries, countryShort } from './data';
import { type Entry, type ItemType, typeLabels } from './types';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './components/ui/dialog';
import { Button } from './components/ui/button';
import { ToggleGroup, ToggleGroupItem } from './components/ui/toggle-group';
import { Input } from './components/ui/input';
import { Tabs, TabsList, TabsTrigger } from './components/ui/tabs';
import { searchArtworks } from './artwork-search';
import { applyArtwork } from './artwork-entry';
import { AddressPaste } from './components/address-paste';
import { CountryFlag } from './components/country-flag';
import { SimCardFace } from './components/sim-card';
import { AddressCardFace } from './components/address-card';
import { isHttpUrl, MAX_MAP_URL_LENGTH } from './validation';

export function Modal({title,subtitle,onClose,children,wide=false,sheet=false,className=''}:{title:string;subtitle?:string;onClose:()=>void;children:ReactNode;wide?:boolean;sheet?:boolean;className?:string}) {
  const restoreFocus = useRef<HTMLElement | null>(document.activeElement instanceof HTMLElement ? document.activeElement : null);
  const [present, safeToRemove] = usePresence();
  const reducedMotion = useReducedMotion();
  useEffect(() => {
    if (present || !safeToRemove) return;
    // Keep the parent mounted for Radix's exit animation, including programmatic closes.
    const timer = setTimeout(safeToRemove, reducedMotion ? 0 : 220);
    return () => clearTimeout(timer);
  }, [present, safeToRemove, reducedMotion]);
  return <Dialog open={present} onOpenChange={open=>{if(!open)onClose();}}><DialogContent className={`modal ${wide?'wide':''} ${sheet?'detail-sheet':''} ${className}`} showCloseButton={false} inert={!present} onCloseAutoFocus={event=>{
    event.preventDefault();
    const activeDialog = document.querySelector('[data-slot="dialog-content"][data-state="open"]');
    const target = restoreFocus.current;
    // Closing a detail sheet must not steal focus from the editor opened on top of it.
    if (target?.isConnected && (!activeDialog || activeDialog.contains(target))) target.focus();
    else if (!activeDialog) document.querySelector<HTMLElement>('[aria-current="page"]')?.focus();
  }}><div className="modal-inner"><DialogHeader className="modal-head"><div><DialogTitle>{title}</DialogTitle><DialogDescription className={subtitle?undefined:"sr-only"}>{subtitle||title}</DialogDescription></div><Button type="button" variant="ghost" size="icon-sm" aria-label="关闭窗口" onClick={onClose}><X size={18}/></Button></DialogHeader><div className="modal-body">{children}</div></div></DialogContent></Dialog>;
}
function tiltCard(event: PointerEvent<HTMLDivElement>) {
  if (event.pointerType !== 'mouse' || !window.matchMedia('(hover: hover) and (prefers-reduced-motion: no-preference)').matches) return;
  const card = event.currentTarget;
  const rect = card.getBoundingClientRect();
  const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
  const y = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
  card.style.setProperty('--card-rx', `${(0.5-y)*7}deg`);
  card.style.setProperty('--card-ry', `${(x-0.5)*9}deg`);
  card.style.setProperty('--card-light-x', `${x*100}%`);
  card.style.setProperty('--card-light-y', `${y*100}%`);
}
function resetCard(event: PointerEvent<HTMLDivElement>) {
  for (const name of ['--card-rx','--card-ry','--card-light-x','--card-light-y']) event.currentTarget.style.removeProperty(name);
  delete event.currentTarget.dataset.pressed;
}
export function CardArt({entry,small=false}:{entry:Partial<Entry>;small?:boolean}) {
  const art=artById.get(entry.artId||'');
  const src=entry.customImage||art?.image;
  const [failed,setFailed]=useState(false);
  useEffect(()=>setFailed(false),[src]);
  const hasImage = !!src && !failed;
  if(entry.type==='sim')return <SimCardFace entry={entry}/>;
  return <div className={`card-art ${hasImage?'':'generated'} ${small?'small':''}`} onPointerMove={tiltCard} onPointerLeave={resetCard} onPointerCancel={resetCard} onPointerDown={event=>{if(event.button===0&&event.currentTarget.closest('button'))event.currentTarget.dataset.pressed='true';}} onPointerUp={event=>{delete event.currentTarget.dataset.pressed;}}>
    <div className="card-art-surface" style={hasImage?undefined:{background:entry.color||'#6570d8'}}>
      {hasImage?<img src={src} alt={`${art?.name||entry.name||'自定义'}卡面`} loading="lazy" onError={()=>setFailed(true)}/>:<><div className="card-wordmark">{entry.issuer||'Folio'}<Wifi size={23}/></div><div className="chip"><i/><i/><i/></div><div className="card-art-bottom"><span>{entry.name||'YOUR EVERYDAY CARD'}</span><strong>{entry.network||'CARD'}</strong></div></>}
      <span className="card-art-sheen" aria-hidden="true"/>
    </div>
  </div>;
}
export function CountryBadge({country}:{country:string}){return <span className="country-badge" title={country}><CountryFlag country={country}/>{countryShort(country)}</span>;}

export function EntryForm({initial,onClose,onSave,busy,isEdit=false}:{initial:Entry;onClose:()=>void;onSave:(e:Entry)=>Promise<void>;busy:boolean;isEdit?:boolean}) {
  const [entry,setEntry]=useState({...initial});
  const [error,setError]=useState('');
  const [uploading,setUploading]=useState(false);
  const [artSearch,setArtSearch]=useState('');
  const [artFilter,setArtFilter]=useState('all');
  const [showArt,setShowArt]=useState(false);
  const scrollRef=useRef<HTMLDivElement>(null);
  const artPickerRef=useRef<HTMLElement>(null);
  useEffect(()=>{scrollRef.current?.scrollTo({top:0});},[entry.type]);
  useEffect(()=>{const scroll=scrollRef.current,picker=artPickerRef.current;if(showArt&&scroll&&picker)scroll.scrollTo({top:scroll.scrollTop+picker.getBoundingClientRect().top-scroll.getBoundingClientRect().top});},[showArt]);
  const patch=(key:keyof Entry,value:string|boolean)=>setEntry(e=>({...e,[key]:value}));
  const payment=entry.type==='bank'||entry.type==='crypto';
  const hasArtwork=payment;
  const availableArt=searchArtworks(catalog.filter(art=>artFilter==='all'||art.type===artFilter),artSearch);
  const chooseArt=(id:string)=>{const art=artById.get(id);if(art)setEntry(e=>applyArtwork(e,art));setShowArt(false);scrollRef.current?.scrollTo({top:0});};
  const field=(key:keyof Entry,label:string,placeholder='',required=false,type='text',span=6)=><label className={`entry-field span-${span} field-${key}`}>{label}{required&&<span className="required"> *</span>}{key==='notes'?<textarea value={String(entry[key])} placeholder={placeholder} rows={2} maxLength={5000} onChange={e=>patch(key,e.target.value)}/>:<Input type={type} value={String(entry[key])} placeholder={placeholder} required={required} maxLength={key==='number'?30:key==='mapUrl'?MAX_MAP_URL_LENGTH:300} onChange={e=>patch(key,e.target.value)}/>}</label>;
  const upload=async(file?:File)=>{
    if(!file)return;
    if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>5*1024*1024){setError('请选择不超过 5 MB 的 JPG、PNG 或 WebP 图片。');return;}
    setUploading(true);setError('');
    try{const bitmap=await createImageBitmap(file);const canvas=document.createElement('canvas');const scale=Math.min(1,900/Math.max(bitmap.width,bitmap.height));canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);canvas.getContext('2d')!.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();patch('customImage',canvas.toDataURL('image/webp',0.88));}catch{setError('无法读取这张图片，请换一张试试。');}finally{setUploading(false);}
  };
  const submit=async(e:FormEvent)=>{
    e.preventDefault();setError('');
    const clean={...entry,demo:false,name:entry.name.trim(),country:entry.country.trim(),number:entry.number.replace(/[\s-]/g,''),mapUrl:entry.mapUrl.trim(),updatedAt:new Date().toISOString()};
    if(!clean.name||!clean.country){setError('请填写名称和国家 / 地区。');return;}
    if(payment&&clean.number&&!/^(\d{4}|\d{12,19})$/.test(clean.number)){setError('卡号请填写末 4 位或 12–19 位数字。');return;}
    if(entry.type==='sim'&&!/^[+\d\s()-]{5,30}$/.test(entry.phone)){setError('请填写有效的电话号码，包含国际区号。');return;}
    if(entry.type==='address'&&!entry.line1.trim()){setError('请填写街道地址。');return;}
    if(clean.mapUrl&&!isHttpUrl(clean.mapUrl)){setError('地图 / 位置网址需填写有效的 http:// 或 https:// 链接。');return;}
    try{await onSave(clean);}catch(err){setError((err as Error).message);}
  };
  return <Modal title={isEdit?'编辑记录':'添加记录'} onClose={onClose} wide className="entry-form-modal">
    <form className="entry-editor" onSubmit={submit}>
      <ToggleGroup type="single" variant="outline" spacing={2} className="type-picker" value={entry.type} onValueChange={value=>{if(value){setArtFilter('all');setShowArt(false);setError('');setEntry(e=>({...e,type:value as ItemType,artId:'',customImage:'',subtype:value==='sim'?e.simType:value==='crypto'?'虚拟卡':'借记卡'}));}}}>{(Object.keys(typeLabels) as ItemType[]).map(type=><ToggleGroupItem value={type} key={type} aria-label={typeLabels[type]}>{type==='sim'?<Smartphone size={16}/>:type==='address'?<MapPin size={16}/>:<CreditCard size={16}/>} {type==='sim'?'SIM 卡':type==='address'?'地址':typeLabels[type]}</ToggleGroupItem>)}</ToggleGroup>
      <div className="entry-form-scroll" ref={scrollRef}>
        <div className="entry-form-layout">
          <aside className={`entry-preview ${payment?'payment-preview':'automatic-preview'}`}>
            <div className="entry-preview-art">
              <span className="entry-preview-label">预览</span>
              {payment?<CardArt entry={entry}/>:entry.type==='sim'?<SimCardFace entry={entry}/>:<AddressCardFace entry={entry}/>}
            </div>
            {hasArtwork&&<div className="entry-art-controls">
              <Button variant="outline" type="button" onClick={()=>setShowArt(!showArt)} aria-expanded={showArt} aria-controls="entry-art-picker"><ImageIcon size={15}/>{showArt?'收起卡面':'选择卡面'}</Button>
              <label className="upload-button entry-upload"><Upload size={15}/>{uploading?'上传中…':'上传卡面'}<input type="file" aria-label="上传卡面" accept="image/png,image/jpeg,image/webp" onChange={e=>upload(e.target.files?.[0])}/></label>
              <label className="color-field">底色<input type="color" aria-label="卡片底色" value={entry.color||'#646ce3'} onChange={e=>setEntry(v=>({...v,color:e.target.value,artId:'',customImage:''}))}/></label>
            </div>}
          </aside>
          <div className="form-fields entry-fields">
            {entry.type==='address'&&<AddressPaste entry={entry} onApply={setEntry} disabled={busy}/>}
            {field('name',entry.type==='address'?'地址名称':'卡片名称',entry.type==='address'?'如：收件地址':'如：日常卡',true,'text',8)}
            <label className="entry-field span-4 field-country">国家 / 地区 <span className="required">*</span><Input required list="country-options" value={entry.country} onChange={e=>patch('country',e.target.value)} placeholder="选择或输入" maxLength={100}/></label>
            {payment&&<>
              {field('issuer','发卡机构','银行或服务商')}{field('holder','持卡人','姓名')}
              {field('number','卡号 / 末 4 位','建议填末 4 位',false,'text',8)}{field('expiry','有效期','',false,'month',4)}
              {field('currency',entry.type==='crypto'?'币种 / 资产':'币种','USD',false,'text',3)}{field('network','卡组织','Visa / 银联',false,'text',4)}{field('subtype','卡片类型','借记卡 / 信用卡',false,'text',5)}
              {field('tags','标签','旅行,日常',false,'text',12)}
            </>}
            {entry.type==='sim'&&<>
              {field('issuer','运营商','Tello / giffgaff',true)}{field('phone','电话号码','含国际区号',true,'tel')}
              <label className="entry-field span-4 field-simType">SIM 类型<select value={entry.simType} onChange={e=>patch('simType',e.target.value)}><option>eSIM</option><option>实体 SIM</option></select></label>{field('plan','套餐','1 GB + 100 分钟',false,'text',8)}
              {field('renewal','续费 / 保号日期','',false,'date',4)}{field('iccid','ICCID','SIM 卡序列号',false,'text',8)}
              {field('tags','标签','旅行,备用',false,'text',12)}
            </>}
            {entry.type==='address'&&<>
              {field('holder','收件人','姓名')}{field('phone','联系电话','含国际区号',false,'tel')}
              {field('line1','街道地址','门牌、街道',true,'text',8)}{field('line2','楼层 / 房间','地址补充',false,'text',4)}
              {field('city','城市','',false,'text',4)}{field('region','省 / 州','',false,'text',4)}{field('postal','邮编','',false,'text',4)}
              {field('mapUrl','地图链接','https://',false,'url',8)}{field('tags','标签','收件,账单',false,'text',4)}
            </>}
            {field('notes','备注','勿填密码或安全码',false,'text',12)}
          </div>
        </div>
        {showArt&&hasArtwork&&<section ref={artPickerRef} id="entry-art-picker" className="inline-art-picker"><div className="section-heading"><h3>选择卡面</h3><Input aria-label="搜索可选卡面" value={artSearch} onChange={e=>setArtSearch(e.target.value)} placeholder="搜索品牌或卡面"/></div><Tabs value={artFilter} onValueChange={setArtFilter}><TabsList aria-label="卡面分类"><TabsTrigger value="all">全部</TabsTrigger><TabsTrigger value="bank">银行卡</TabsTrigger><TabsTrigger value="crypto">U 卡</TabsTrigger></TabsList></Tabs><p className="art-picker-hint" role="status">{availableArt.length} 张卡面</p>{availableArt.length?<div className="art-options">{availableArt.map(a=><button type="button" key={a.id} onClick={()=>chooseArt(a.id)} className={entry.artId===a.id?'chosen':''}><img src={a.image} alt={a.name} loading="lazy"/><span>{a.name}</span>{entry.artId===a.id&&<Check size={14}/>}</button>)}</div>:<div className="art-picker-empty"><p>没有匹配的卡面</p><Button type="button" variant="outline" onClick={()=>{setArtSearch('');setArtFilter('all');}}>清除筛选</Button></div>}</section>}
      </div>
      {error&&<div className="error-message entry-form-error" role="alert">{error}</div>}
      <footer className="modal-actions entry-form-actions"><label className="entry-favorite"><input type="checkbox" checked={entry.favorite} onChange={e=>patch('favorite',e.target.checked)}/> 收藏</label><Button variant="outline" type="button" onClick={onClose}>取消</Button><Button variant="default" type="submit" disabled={busy||uploading}>{busy?'保存中…':'保存'}</Button></footer>
    </form><datalist id="country-options">{countries.map(c=><option key={c} value={c}/>)}</datalist>
  </Modal>;
}

export function SourceLink({artId}:{artId:string}) {const art=artById.get(artId);return art?<a href={art.source} target="_blank" rel="noreferrer" className="source-link">卡面来源 <ArrowUpRight size={12}/></a>:null;}
