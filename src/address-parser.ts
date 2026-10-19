import type { Entry } from './types';

export type AddressFields = Pick<Entry, 'name' | 'holder' | 'phone' | 'country' | 'region' | 'city' | 'line1' | 'line2' | 'postal'>;
export type ParsedAddress = { fields: Partial<AddressFields>; warnings: string[]; unparsed: string[] };

const countryAliases: Record<string, string[]> = {
  中国大陆: ['中国大陆', '中国', '中华人民共和国', 'china', 'mainland china', 'prc', 'cn'],
  中国香港: ['中国香港', '香港', '香港特别行政区', 'hong kong', 'hong kong sar', 'hk'],
  中国澳门: ['中国澳门', '澳门', '澳門', 'macau', 'macao', 'mo'],
  中国台湾: ['中国台湾', '台湾', '台灣', 'taiwan', 'tw'],
  美国: ['美国', '美國', 'united states', 'united states of america', 'usa', 'us', 'u.s.a.', 'u.s.'],
  英国: ['英国', '英國', 'united kingdom', 'great britain', 'uk', 'gb'],
  加拿大: ['加拿大', 'canada', 'ca'],
  澳大利亚: ['澳大利亚', '澳洲', 'australia', 'au'],
  新加坡: ['新加坡', 'singapore', 'sg'],
  日本: ['日本', 'japan', 'jp'],
  德国: ['德国', 'germany', 'de'],
  法国: ['法国', 'france', 'fr'],
  韩国: ['韩国', 'south korea', 'republic of korea', 'kr'],
  马来西亚: ['马来西亚', 'malaysia', 'my'],
  新西兰: ['新西兰', 'new zealand', 'nz'],
};
const countryMap = new Map(Object.entries(countryAliases).flatMap(([name, aliases]) => aliases.map(alias => [alias.toLowerCase(), name])));
const normalizeCountry = (value: string) => countryMap.get(value.trim().toLowerCase());
const fieldAliases: Record<string, keyof AddressFields | 'address'> = {};
const labels: Record<keyof AddressFields | 'address', string[]> = {
  name: ['地址名称', '名称', 'label'],
  holder: ['收件人', '收件人姓名', '收件人 / 联系人', '联系人', '姓名', 'recipient', 'full name', 'name', 'contact'],
  phone: ['电话', '电话号码', '联系电话', '手机', '手机号', 'phone', 'telephone', 'tel', 'mobile'],
  country: ['国家', '国家 / 地区', '国家/地区', '国家或地区', 'country', 'country / region', 'country/region'],
  region: ['省', '州', '省份', '省/州', '省 / 州 / 区', '省/州/区', '省 / 州', 'state', 'province', 'state/province', 'state / province', 'region'],
  city: ['城市', '市', 'city', 'town'],
  line1: ['街道', '街道地址', '地址1', '地址 1', 'address1', 'address 1', 'address line 1', 'street', 'street address'],
  line2: ['地址补充', '地址2', '地址 2', 'address2', 'address 2', 'address line 2', 'apt', 'suite'],
  postal: ['邮编', '邮政编码', 'postal code', 'postcode', 'zip', 'zip code', 'zip/postal code'],
  address: ['地址', '详细地址', '完整地址', 'address', 'full address'],
};
for (const [key, aliases] of Object.entries(labels)) for (const alias of aliases) fieldAliases[alias.toLowerCase()] = key as keyof typeof labels;
const usStateNames = 'AL=Alabama|AK=Alaska|AZ=Arizona|AR=Arkansas|CA=California|CO=Colorado|CT=Connecticut|DE=Delaware|FL=Florida|GA=Georgia|HI=Hawaii|ID=Idaho|IL=Illinois|IN=Indiana|IA=Iowa|KS=Kansas|KY=Kentucky|LA=Louisiana|ME=Maine|MD=Maryland|MA=Massachusetts|MI=Michigan|MN=Minnesota|MS=Mississippi|MO=Missouri|MT=Montana|NE=Nebraska|NV=Nevada|NH=New Hampshire|NJ=New Jersey|NM=New Mexico|NY=New York|NC=North Carolina|ND=North Dakota|OH=Ohio|OK=Oklahoma|OR=Oregon|PA=Pennsylvania|RI=Rhode Island|SC=South Carolina|SD=South Dakota|TN=Tennessee|TX=Texas|UT=Utah|VT=Vermont|VA=Virginia|WA=Washington|WV=West Virginia|WI=Wisconsin|WY=Wyoming|DC=District of Columbia'.split('|').map(pair => pair.split('='));
const usStates = new Set(usStateNames.map(([code]) => code));
const stateNames = usStateNames.map(([code, name]) => ({ code, name: name.toLowerCase() })).sort((a, b) => b.name.length - a.name.length);
const caProvinces = new Set('AB BC MB NB NL NS NT NU ON PE QC SK YT'.split(' '));
const auStates = new Set('ACT NSW NT QLD SA TAS VIC WA'.split(' '));
const cnProvince = /^(河北|山西|辽宁|吉林|黑龙江|江苏|浙江|安徽|福建|江西|山东|河南|湖北|湖南|广东|海南|四川|贵州|云南|陕西|甘肃|青海)省|^(内蒙古自治区|广西壮族自治区|西藏自治区|宁夏回族自治区|新疆维吾尔自治区)/;
const municipalities = /^(北京市|上海市|天津市|重庆市)/;
const ukPostal = /^(?:(.*?)\s+)?((?:GIR\s?0AA|[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}))$/i;
const canadianPostal = '[ABCEGHJ-NPRSTVXY]\\d[ABCEGHJ-NPRSTV-Z]\\s?\\d[ABCEGHJ-NPRSTV-Z]\\d';
const hasStreet = (text: string) => /\d/.test(text) || /[路街巷弄道號号楼樓室村镇鎮]/.test(text) || /\b(?:road|street|avenue|lane|drive|boulevard|po box)\b/i.test(text);

/** Conservative local parsing: explicit labels win, uncertain text stays available for review. */
export function parseAddress(raw: string): ParsedAddress {
  const fields: Partial<AddressFields> = {};
  const warnings: string[] = [];
  const unparsed: string[] = [];
  if (!raw.trim()) return { fields, warnings: ['请先粘贴地址。'], unparsed };
  if (raw.length > 4000) return { fields, warnings: ['地址内容过长，请一次粘贴一条地址（最多 4000 字）。'], unparsed: [raw] };
  const put = (key: keyof AddressFields, value: string) => {
    const clean = value.trim();
    if (!clean) return;
    if (clean.length > (key === 'country' ? 100 : 300)) {
      warnings.push('部分字段过长，请手动拆分后填写。'); unparsed.push(clean); return;
    }
    if (fields[key] && fields[key] !== clean) {
      warnings.push('发现重复字段，保留了第一项，请检查是否粘贴了多条地址。'); unparsed.push(clean); return;
    }
    fields[key] = clean;
  };
  const free: string[] = [];
  for (const line of raw.normalize('NFKC').replace(/\r\n?/g, '\n').split(/[\n;；]+/).map(v => v.trim()).filter(Boolean)) {
    const match = line.match(/^([^:：]{1,30})[:：]\s*(.*)$/);
    const key = match && fieldAliases[match[1].trim().toLowerCase()];
    if (key === 'address') free.push(match![2]);
    else if (key) put(key, key === 'country' ? normalizeCountry(match![2]) || match![2] : match![2]);
    else free.push(line);
  }

  let parts = free.flatMap(line => line.split(/[,，]+/)).map(v => v.trim()).filter(Boolean);
  parts = parts.flatMap(part => {
    const mobile = part.match(/(?:^|\s)(1[3-9]\d{9})(?=\s|$)/);
    if (mobile && /[省市区路街号]/.test(part)) {
      put('phone', mobile[1]);
      return [part.slice(0, mobile.index), part.slice(mobile.index! + mobile[0].length)].map(v => v.trim()).filter(Boolean);
    }
    return [part];
  });
  parts = parts.filter(part => {
    const country = normalizeCountry(part);
    // Two-letter codes are accepted at the end of a free-form address only.
    if (country && (part.length > 2 || part === parts.at(-1))) { put('country', country); return false; }
    const digits = part.replace(/\D/g, '');
    if (/^[+\d()\s.-]+$/.test(part) && ((part.startsWith('+') && digits.length >= 8 && digits.length <= 15) || /^1[3-9]\d{9}$/.test(part))) { put('phone', part); return false; }
    return true;
  });

  // Recognize complete locality lines, never guess a country from a city name or phone code alone.
  for (let i = parts.length - 1; i >= 0; i--) {
    const part = parts[i];
    let stateZip = part.match(/^(?:(.+?)\s+)?([A-Za-z]{2})\s+(\d{5}(?:-\d{4})?)$/);
    const fullStateZip = part.match(/^(.*?)\s+(\d{5}(?:-\d{4})?)$/);
    if (!stateZip && fullStateZip) {
      const locality = fullStateZip[1].toLowerCase();
      const state = stateNames.find(({ name }) => locality === name || locality.endsWith(` ${name}`));
      if (state) stateZip = [part, fullStateZip[1].slice(0, -state.name.length).trim(), state.code, fullStateZip[2]] as RegExpMatchArray;
    }
    const caZip = part.match(new RegExp(`^(?:(.+?)\\s+)?([A-Z]{2})\\s+(${canadianPostal})$`, 'i'));
    const auZip = part.match(/^(?:(.+?)\s+)?(ACT|NSW|NT|QLD|SA|TAS|VIC|WA)\s+(\d{4})$/i);
    const ukZip = part.match(ukPostal);
    if (fields.country && ((stateZip && usStates.has(stateZip[2].toUpperCase()) && fields.country !== '美国') || (caZip && caProvinces.has(caZip[2].toUpperCase()) && fields.country !== '加拿大'))) warnings.push('国家与省 / 州、邮编格式可能不一致，已保留原文，请核对。');
    let locality: { country: string; city: string; region?: string; postal: string } | null = null;
    if (stateZip && usStates.has(stateZip[2].toUpperCase()) && (!fields.country || fields.country === '美国')) locality = { country: '美国', city: stateZip[1] || '', region: stateZip[2].toUpperCase(), postal: stateZip[3] };
    else if (caZip && caProvinces.has(caZip[2].toUpperCase()) && (!fields.country || fields.country === '加拿大')) locality = { country: '加拿大', city: caZip[1] || '', region: caZip[2].toUpperCase(), postal: caZip[3].replace(/\s/g, '').toUpperCase().replace(/(.{3})(.{3})/, '$1 $2') };
    else if (auZip && auStates.has(auZip[2].toUpperCase()) && (!fields.country || fields.country === '澳大利亚')) locality = { country: '澳大利亚', city: auZip[1] || '', region: auZip[2].toUpperCase(), postal: auZip[3] };
    else if (ukZip && (!fields.country || fields.country === '英国')) locality = { country: '英国', city: ukZip[1] || '', postal: ukZip[2].replace(/\s/g, '').toUpperCase().replace(/(.+)(.{3})$/, '$1 $2') };
    else {
      const singapore = part.match(/^(?:Singapore|新加坡)\s*(\d{6})$/i);
      if (singapore && (!fields.country || fields.country === '新加坡')) locality = { country: '新加坡', city: 'Singapore', postal: singapore[1] };
    }
    if (!locality) continue;
    put('country', locality.country); put('postal', locality.postal);
    if (locality.region) put('region', locality.region);
    if (locality.city) put('city', locality.city);
    parts.splice(i, 1);
    if (!locality.city && !fields.city && i > 0 && /^[\p{L} .'-]+$/u.test(parts[i - 1]) && !hasStreet(parts[i - 1])) {
      put('city', parts[i - 1]); parts.splice(i - 1, 1); i--;
    }
  }

  // Chinese administrative prefixes; keep districts in the street field to avoid losing detail.
  parts = parts.flatMap(part => {
    let text = part;
    const prefix = text.match(/^(中国香港|香港特别行政区|香港|中国澳门|澳门|澳門|中国台湾|台湾|台灣|中国大陆|中华人民共和国|中国)\s*/);
    if (prefix) { put('country', normalizeCountry(prefix[1])!); text = text.slice(prefix[0].length); }
    const province = text.match(cnProvince)?.[0];
    const municipality = text.match(municipalities)?.[0];
    if ((!fields.country || fields.country === '中国大陆') && (province || municipality)) {
      put('country', '中国大陆'); put('region', province || municipality!);
      text = text.slice((province || municipality!).length).trim();
      if (municipality) put('city', municipality);
      else { const city = text.match(/^([\p{Script=Han}]{2,10}?(?:市|自治州|地区|盟))/u); if (city) { put('city', city[1]); text = text.slice(city[0].length); } }
    } else if (fields.country === '中国台湾') {
      const city = text.match(/^([\p{Script=Han}]{2,5}?[市縣县])/u);
      if (city) { put('city', city[1]); text = text.slice(city[0].length); }
    }
    if (fields.country === '中国香港') put('city', '香港');
    if (fields.country === '中国澳门') put('city', '澳门');
    if (!text.trim()) return [];
    if (fields.country === '中国大陆' && /^\d{6}$/.test(text.trim())) { put('postal', text); return []; }
    return [text.trim()];
  });

  if (!fields.country && fields.region && fields.postal) {
    if ((usStates.has(fields.region.toUpperCase()) || stateNames.some(({ name }) => fields.region!.toLowerCase() === name)) && /^\d{5}(?:-\d{4})?$/.test(fields.postal)) put('country', '美国');
    else if (caProvinces.has(fields.region.toUpperCase()) && new RegExp(`^${canadianPostal}$`, 'i').test(fields.postal)) put('country', '加拿大');
  }
  // A separate recipient line is recognized only when a street line follows it.
  const streetIndex = parts.findIndex(hasStreet);
  if (!fields.holder && streetIndex === 1 && /^[\p{L} .'-]{1,80}$/u.test(parts[0])) put('holder', parts.shift()!);
  if (!fields.line1 && parts.length && hasStreet(parts[0])) put('line1', parts.shift()!);
  if (fields.line1 && parts.length && parts.every(part => !/[:：]/.test(part))) put('line2', parts.splice(0).join(', '));
  unparsed.push(...parts);
  if (!fields.country) warnings.push('未能确定国家 / 地区，请手动补充。');
  if (!fields.line1) warnings.push('未能确定街道地址，请按推荐格式补充或手动填写。');
  if (unparsed.length) warnings.push('部分内容未填入，请对照原文补充。');
  return { fields, warnings: [...new Set(warnings)], unparsed };
}

export function applyParsedAddress(entry: Entry, fields: Partial<AddressFields>, overwrite = false): Entry {
  const next = { ...entry };
  // Replacing a full address must not leave an old unit, postal code or contact behind.
  if (overwrite && fields.line1) {
    for (const key of ['holder', 'phone', 'country', 'region', 'city', 'line1', 'line2', 'postal', 'mapUrl'] as const) next[key] = '';
  }
  for (const [key, value] of Object.entries(fields) as [keyof AddressFields, string][]) {
    if (value && (!next[key].trim() || (overwrite && key !== 'name'))) next[key] = value;
  }
  if (!next.name.trim() && fields.line1) next.name = `${next.city || next.country || '新'}收件地址`;
  return next;
}
