import { countryCode } from './countries.ts';
import { regionCoordinates } from './region-coordinates.ts';
import type { Entry, ItemType } from './types.ts';

export interface InformationRegion {
  key: string;
  label: string;
  code?: string;
  position?: readonly [number, number];
  entries: Entry[];
  counts: Record<ItemType, number>;
}

const names = new Intl.DisplayNames(['zh-CN'], {type:'region'});
const labels: Record<string,string> = {CN:'中国大陆',HK:'中国香港',MO:'中国澳门',TW:'中国台湾'};

// The coastline spans y=17.7..404.5; trim only empty ocean around the original projection.
export const mapViewport = {top:15,width:1000,height:392} as const;

// Matches the equirectangular projection in public/world-map.svg.
export function projectRegion(longitude: number, latitude: number): readonly [number, number] {
  return [(longitude + 180) / 360 * 1000, Math.min(440, (90 - latitude) / 360 * 1000)];
}

export function groupInformationRegions(entries: readonly Entry[]): InformationRegion[] {
  const regions = new Map<string,InformationRegion>();
  for (const entry of entries) {
    const value = entry.country.normalize('NFKC').trim();
    const code = countryCode(value);
    const global = /^(全球|global|worldwide)$/i.test(value);
    const key = code || (global ? 'global' : `custom:${value.toLowerCase()}`);
    let region = regions.get(key);
    if (!region) {
      const coordinate = code ? regionCoordinates[code] : undefined;
      region = {
        key, code,
        label: code ? labels[code] || names.of(code) || value : global ? '全球' : value || '未指定地区',
        position: coordinate ? projectRegion(...coordinate) : undefined,
        entries: [], counts: {bank:0,crypto:0,sim:0,address:0},
      };
      regions.set(key, region);
    }
    region.entries.push(entry);
    region.counts[entry.type]++;
  }
  return [...regions.values()].sort((a,b)=>b.entries.length-a.entries.length || a.label.localeCompare(b.label,'zh-CN'));
}

export function clusterMapRegions(regions: readonly InformationRegion[], width: number) {
  const clusters: {x:number;y:number;regions:InformationRegion[]}[] = [];
  const distance = 46 * 1000 / Math.max(width, 240);
  for (const region of regions) {
    if (!region.position) continue;
    const [x,y] = region.position;
    const cluster = clusters.find(item=>Math.hypot(item.x-x,item.y-y)<distance);
    if (cluster) {
      const size = cluster.regions.length;
      cluster.x = (cluster.x * size + x) / (size+1);
      cluster.y = (cluster.y * size + y) / (size+1);
      cluster.regions.push(region);
    } else clusters.push({x,y,regions:[region]});
  }
  return clusters;
}
