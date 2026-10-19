import { useId } from 'react';

// A decorative residence, shared by the address card and its compact preview.
export function AddressHomeArtwork({className}:{className?:string}) {
  const id=useId();
  return <svg className={className} viewBox="0 0 128 96" fill="none" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id={`${id}-wall`} x1="26" y1="36" x2="76" y2="84" gradientUnits="userSpaceOnUse"><stop stopColor="#fffdf7"/><stop offset="1" stopColor="#ddd9cf"/></linearGradient>
      <linearGradient id={`${id}-roof`} x1="67" y1="7" x2="91" y2="46" gradientUnits="userSpaceOnUse"><stop stopColor="#8795a6"/><stop offset="1" stopColor="#4e5e72"/></linearGradient>
      <linearGradient id={`${id}-glass`} x1="32" y1="47" x2="48" y2="65" gradientUnits="userSpaceOnUse"><stop stopColor="#bfd5df"/><stop offset="1" stopColor="#7b9aaa"/></linearGradient>
    </defs>
    <ellipse cx="65" cy="84" rx="47" ry="7" fill="#2b3544" opacity=".12"/>
    <path d="m77 43 24-12v36L77 80Z" fill="#b7bdbf"/>
    <path d="m26 43 25-21 26 21v37H26Z" fill={`url(#${id}-wall)`}/>
    <path d="M17 44 51 16 77 3 43 31Z" fill="#a1acb8"/>
    <path d="m51 16 34 28 26-13L77 3Z" fill={`url(#${id}-roof)`}/>
    <path d="m17 44 6 4 28-24 28 24 6-4-34-28Z" fill="#647386"/>
    <path d="m85 44 26-13v4L85 48Z" fill="#445367"/>
    <path d="m86 26 8-4V10l-8 4Z" fill="#bfc4c8"/><path d="m79 22 7 4V14l-7-4Z" fill="#e7e7e2"/><path d="m79 10 7 4 8-4-7-3Z" fill="#9ba5af"/>
    <path d="M33 47h16v19H33Z" fill="#fffdf7"/><path d="M35 49h12v15H35Z" fill={`url(#${id}-glass)`}/>
    <path d="M41 49v15m-6-7h12" stroke="#f7faf9" strokeWidth="1.4"/>
    <path d="m85 47 11-5v15l-11 5Z" fill="#7795a4"/><path d="m90 45 1 14m-6-5 11-5" stroke="#e1e8e6" strokeWidth="1.2"/>
    <path d="M54 54h16v26H54Z" fill="#f5f3ec"/><path d="M56 56h12v24H56Z" fill="#87949d"/>
    <path d="M58 59h8v9h-8Z" fill="#aabac1"/><circle cx="65" cy="72" r="1" fill="#e7d6ad"/>
    <path d="M53 80h18l5 5H53Z" fill="#c3c8c8"/><path d="M53 85h23v2H53Z" fill="#a6afb2"/>
    <path d="M24 80h27M78 80l25-13" stroke="#a0a9a9" strokeWidth="1.4"/>
  </svg>;
}
