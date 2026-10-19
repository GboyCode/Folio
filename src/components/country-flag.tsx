import { useState } from 'react';
import { Globe2 } from 'lucide-react';
import { countryFlagCode } from '../countries';

const flagFiles = import.meta.glob<string>('/node_modules/flag-icons/flags/4x3/*.svg', {
  eager: true,
  query: '?url&no-inline',
  import: 'default',
});

export function countryFlagUrl(country:string) {
  const code = countryFlagCode(country);
  return code ? flagFiles[`/node_modules/flag-icons/flags/4x3/${code.toLowerCase()}.svg`] : undefined;
}

export function CountryFlag({country}:{country:string}) {
  const src = countryFlagUrl(country);
  const [failedSrc, setFailedSrc] = useState<string>();
  return <span className="country-flag" aria-hidden="true">
    {src && src !== failedSrc
      ? <img src={src} alt="" width={20} height={15} onError={() => setFailedSrc(src)}/>
      : <Globe2 size={16}/>}
  </span>;
}

export function CountryLabel({country}:{country:string}) {
  return <span className="country-label" title={country}><CountryFlag country={country}/><span>{country}</span></span>;
}
