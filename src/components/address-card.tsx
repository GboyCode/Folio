import { useState } from 'react';
import { Circle, Copy, MapPin, Star } from 'lucide-react';
import type { Entry } from '../types';
import { countryCode } from '../countries';
import { CountryFlag } from './country-flag';
import { AddressAerialImage } from './address-aerial-image';

export function AddressCardFace({entry}:{entry:Entry}) {
  const street = [entry.line1, entry.line2].filter(Boolean).join(', ');
  const locality = [entry.city, entry.region, entry.postal].filter(Boolean).join(', ');
  return <div className="address-home-face">
    <AddressAerialImage country={entry.country} className="address-aerial-photo"/>
    <div className="address-home-head" aria-hidden="true">
      <Circle className="address-aerial-marker" strokeWidth={5}/>
      <span className="address-home-region"><CountryFlag country={entry.country}/><span>{countryCode(entry.country) || '—'}</span></span>
    </div>
    <div className="address-home-content">
      <h3 title={entry.name}>{entry.name}</h3>
      <p className="address-home-street" title={street}>{entry.line1 || '待填写街道地址'}{entry.line2 && <><br/>{entry.line2}</>}</p>
      <p className="address-home-locality" title={locality}>{locality || '\u00a0'}</p>
    </div>
    <div className="address-home-location"><MapPin size={13} aria-hidden="true"/><span title={entry.country}>{entry.country || '未指定地区'}</span>{entry.demo && <span className="address-home-demo">示例</span>}</div>
  </div>;
}

export function AddressEntryTile({entry,onOpen,onFavorite,onCopy}:{entry:Entry;onOpen:()=>void;onFavorite:()=>void;onCopy:()=>void}) {
  const [pressed,setPressed] = useState(false);
  return <article className="entry-tile address-tile address-home">
    <div className="address-home-shell" data-pressed={pressed || undefined}>
      <button type="button" className="address-home-open" aria-label={`查看 ${entry.name}`} onClick={onOpen}
        onPointerDown={event=>{if(event.button===0)setPressed(true);}} onPointerUp={()=>setPressed(false)} onPointerCancel={()=>setPressed(false)} onPointerLeave={()=>setPressed(false)} onBlur={()=>setPressed(false)}>
        <AddressCardFace entry={entry}/>
      </button>
      <div className="address-home-actions">
        <button type="button" className={`favorite-button ${entry.favorite?'is-favorite':''}`} aria-label={`${entry.favorite?'取消收藏':'收藏'} ${entry.name}`} aria-pressed={entry.favorite} onClick={onFavorite}><Star size={15} fill={entry.favorite?'currentColor':'none'}/></button>
        <button type="button" className="icon-button" aria-label={`复制 ${entry.name}`} onClick={onCopy}><Copy size={15}/></button>
      </div>
    </div>
  </article>;
}
