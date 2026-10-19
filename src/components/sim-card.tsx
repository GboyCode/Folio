import { useState, type CSSProperties } from 'react';
import { Bell, Globe2, Signal, Star } from 'lucide-react';
import type { Entry } from '../types';
import { expiration } from '../data';
import { countryCode } from '../countries';
import { countryFlagUrl } from './country-flag';

// SIMs use a country motif rather than a retail product photo or uploaded artwork.
export function SimCardFace({entry, privacy=false}:{entry:Partial<Entry>; privacy?:boolean}) {
  const flag = countryFlagUrl(entry.country || '');
  const code = countryCode(entry.country || '');
  return <div className={`sim-face ${flag ? 'has-flag' : 'no-flag'}`} style={flag ? {'--sim-flag':`url("${flag}")`} as CSSProperties : undefined}>
    <div className="sim-flag-art" aria-hidden="true"/>
    <div className="sim-face-content">
      <div className="sim-kicker"><Signal size={13}/><span>{entry.simType || 'SIM'}</span></div>
      <svg className="sim-contact" viewBox="0 0 56 44" fill="none" aria-hidden="true">
        <rect x=".75" y=".75" width="54.5" height="42.5" rx="9" fill="currentColor" stroke="var(--sim-contact-line)" strokeWidth="1.5"/>
        <path d="M19 1v11l-6 6H1m54 0H43l-6-6V1M19 43V32l-6-6H1m54 0H43l-6 6v11M19 12h18v20H19z" stroke="var(--sim-contact-line)" strokeWidth="1.25"/>
      </svg>
      <div className="sim-identity"><strong className="sim-operator" title={entry.issuer}>{entry.issuer || '运营商'}</strong><span className="sim-name" title={entry.name}>{entry.name || '我的电话号码'}</span></div>
      <span className="sim-phone">{privacy ? '•••• •••• ••••' : entry.phone || '待填写号码'}</span>
      <div className="sim-country"><span>{entry.country || '选择国家 / 地区'}</span><span className="sim-country-code">{code || <Globe2 size={15}/>}</span></div>
    </div>
  </div>;
}

export function SimEntryTile({entry,privacy,onOpen,onFavorite}:{entry:Entry;privacy:boolean;onOpen:()=>void;onFavorite:()=>void}) {
  const [pressed,setPressed] = useState(false);
  const expiry = expiration(entry);
  return <article className="entry-tile sim-tile">
    <div className="sim-card-shell" data-pressed={pressed || undefined}>
      <button type="button" className="sim-open" aria-label={`查看 ${entry.name}`} onClick={onOpen}
        onPointerDown={event=>{if(event.button===0)setPressed(true);}} onPointerUp={()=>setPressed(false)} onPointerCancel={()=>setPressed(false)} onPointerLeave={()=>setPressed(false)} onBlur={()=>setPressed(false)}>
        <SimCardFace entry={entry} privacy={privacy}/>
      </button>
      <button type="button" className={`favorite-button sim-favorite ${entry.favorite?'is-favorite':''}`} aria-label={`${entry.favorite?'取消收藏':'收藏'} ${entry.name}`} aria-pressed={entry.favorite} onClick={onFavorite}><Star size={15} fill={entry.favorite?'currentColor':'none'}/></button>
    </div>
    {(expiry || entry.demo) && <div className="sim-caption">{expiry && <span className="sim-renewal"><Bell size={12}/>{expiry.label}</span>}{entry.demo && <span>示例</span>}</div>}
  </article>;
}
