import iconUrl from '../assets/folio-icon.svg?url&no-inline';
import { desktopMode } from '../runtime';

export function BrandIcon({size=34,className='brand-icon'}:{size?:number;className?:string}) {
  return <img className={className} src={iconUrl} width={size} height={size} alt="" aria-hidden="true"/>;
}

export function Brand({ onHome }: { onHome?: () => void } = {}) {
  if (desktopMode) return onHome
    ? <button type="button" className="brand" onClick={onHome} aria-label="Folio，返回我的信息" title="返回我的信息"><BrandIcon/><span>Folio</span></button>
    : <span className="brand"><BrandIcon/><span>Folio</span></span>;
  return <a className="brand" href="/" aria-label="Folio，返回我的信息并刷新" title="返回我的信息并刷新"><BrandIcon/><span>Folio</span></a>;
}
