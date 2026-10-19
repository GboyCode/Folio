import { useState, type CSSProperties } from 'react';
import { Circle } from 'lucide-react';
import type { Entry } from '../types';
import { artById } from '../data';
import { CountryFlag, countryFlagUrl } from './country-flag';
import { AddressAerialImage } from './address-aerial-image';
import '../entry-miniature.css';

function MiniChip() {
  return <svg className="entry-mini-chip" viewBox="0 0 28 22" fill="none" focusable="false">
    <rect x=".75" y=".75" width="26.5" height="20.5" rx="4" fill="var(--mini-chip-fill)"/>
    <path d="M9 1v5L6 9H1m26 0h-5l-3-3V1M9 21v-5l-3-3H1m26 0h-5l-3 3v5M9 6h10v10H9z"/>
    <rect x=".75" y=".75" width="26.5" height="20.5" rx="4"/>
  </svg>;
}

// Use the chosen artwork without overlaying private record fields in the overview.
export function EntryMiniature({ entry }: { entry: Pick<Entry, 'type' | 'country' | 'artId' | 'customImage'> }) {
  const [failedImage, setFailedImage] = useState<string>();
  const image = entry.type === 'bank' || entry.type === 'crypto'
    ? entry.customImage || artById.get(entry.artId)?.image : undefined;
  const hasImage = !!image && image !== failedImage;
  const flag = entry.type === 'sim' ? countryFlagUrl(entry.country) : undefined;
  return <span className={`entry-miniature entry-miniature--${entry.type}${hasImage ? ' has-artwork' : ''}`} aria-hidden="true"
    style={flag ? { '--mini-flag': `url("${flag}")` } as CSSProperties : undefined}>
    <span className={`entry-mini-face${hasImage ? ' entry-mini-artwork' : ''}`}>
      {hasImage ? <img src={image} alt="" loading="lazy" onError={() => setFailedImage(image)}/> : entry.type === 'sim' ? <>
        <span className="entry-mini-flag-art"/>
        <MiniChip/>
        <svg className="entry-mini-signal" viewBox="0 0 12 10" fill="none" focusable="false"><path d="M1 9V7m3 2V5m3 4V3m3 6V1"/></svg>
      </> : entry.type === 'address' ? <>
        <AddressAerialImage country={entry.country} className="entry-mini-address-photo" thumbnail/>
        <Circle className="entry-mini-address-marker" strokeWidth={5}/>
        <span className="entry-mini-country"><CountryFlag country={entry.country}/></span>
      </> : <>
        {entry.type === 'bank' ? <MiniChip/> : <svg className="entry-mini-u" viewBox="0 0 26 26" fill="none" focusable="false"><circle cx="13" cy="13" r="11"/><path d="M9 8v7a4 4 0 0 0 8 0V8"/></svg>}
        <span className="entry-mini-country"><CountryFlag country={entry.country}/></span>
        <svg className="entry-mini-payment-lines" viewBox="0 0 72 48" fill="none" focusable="false"><path d="M9 36h24m-24 5h13m18-5h7"/><circle cx="55" cy="36" r="4"/><circle cx="61" cy="36" r="4"/></svg>
      </>}
    </span>
  </span>;
}
