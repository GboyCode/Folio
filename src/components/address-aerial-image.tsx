import { useState } from 'react';
import { addressArtwork } from '../address-artwork';

export function AddressAerialImage({country, className, thumbnail = false}:{country:string; className:string; thumbnail?:boolean}) {
  const artwork = addressArtwork(country);
  const source = thumbnail ? artwork.thumbnail : artwork.src;
  const [failedSource, setFailedSource] = useState<string>();
  const fallback = addressArtwork('');
  const src = failedSource === source ? (thumbnail ? fallback.thumbnail : fallback.src) : source;
  return <img className={className} src={src} alt="" aria-hidden="true" title={artwork.description} data-address-preset={artwork.code}
    width={thumbnail ? 198 : 720} height={thumbnail ? 132 : 480} loading="lazy" decoding="async"
    onError={() => { if (src === source && failedSource !== source) setFailedSource(source); }}/>
}
