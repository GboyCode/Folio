import { countryCode } from './countries';

const presetCodes = new Set([
  'CN', 'HK', 'MO', 'TW', 'JP', 'KR', 'SG', 'MY', 'TH', 'VN', 'ID', 'PH', 'IN',
  'AE', 'SA', 'TR', 'GE', 'KZ',
  'US', 'CA', 'MX', 'BR',
  'GB', 'DE', 'FR', 'IT', 'ES', 'NL', 'CH', 'PT', 'SE', 'RU',
  'AU', 'NZ',
]);

// These local images illustrate housing styles, not a record's actual location.
export function addressArtwork(country: string) {
  const countryId = countryCode(country);
  const matched = !!countryId && presetCodes.has(countryId);
  const code = matched ? countryId! : 'US';
  const base = `/addresses/${code.toLowerCase()}`;
  return {
    code,
    src: `${base}.webp`,
    thumbnail: `${base}-thumb.webp`,
    description: matched ? '住宅街区预设（示意图）' : '通用街区预设（示意图）',
  };
}
