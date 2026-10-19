import type { Artwork, Entry } from './types';

export function applyArtwork(entry: Entry, art: Artwork): Entry {
  if (art.type !== 'bank' && art.type !== 'crypto' && art.type !== 'sim') return entry;
  return {
    ...entry,
    type: art.type,
    artId: art.id,
    customImage: '',
    name: entry.name || art.name,
    issuer: art.issuer,
    network: art.network,
    color: art.color,
    subtype: art.subtype,
    simType: art.type === 'sim' ? art.subtype : entry.simType,
    country: entry.country || ({ cn: '中国大陆', hk: '中国香港', us: '美国', uk: '英国' }[art.region] || ''),
  };
}
