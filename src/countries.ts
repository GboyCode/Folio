export const commonCountries = ['中国大陆','中国香港','中国澳门','中国台湾','美国','英国','新加坡','日本','韩国','加拿大','澳大利亚','德国','法国','荷兰','瑞士','阿联酋','马来西亚','泰国','印度尼西亚','菲律宾','越南','新西兰','全球'];

const regionCodes = 'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW'.split(' ');
const names = new Intl.DisplayNames(['zh-CN'], {type:'region'});
export const countries = [...new Set([...commonCountries, ...regionCodes.map(code => names.of(code) || code)])];

const normalize = (value:string) => value.normalize('NFKC').trim().toLowerCase().replace(/[.\s_-]+/g, '');
const countryCodes = new Map<string,string>();
for (const locale of ['zh-CN', 'zh-TW', 'en']) {
  const displayNames = new Intl.DisplayNames([locale], {type:'region'});
  for (const code of regionCodes) {
    countryCodes.set(normalize(code), code);
    countryCodes.set(normalize(displayNames.of(code) || code), code);
  }
}
const aliases: Record<string,string[]> = {
  CN: ['中国大陆','中國大陸','大陆','大陸','Mainland China','PRC'],
  HK: ['中国香港','中國香港','香港','Hong Kong'],
  MO: ['中国澳门','中國澳門','澳门','澳門','Macao','Macau'],
  TW: ['中国台湾','中國台灣','中國臺灣','台湾','台灣','臺灣','Taiwan'],
  US: ['美国','美國','USA','United States of America'],
  GB: ['英国','英國','UK','Great Britain'],
  KR: ['韩国','韓國','South Korea'],
  AE: ['阿联酋','阿聯酋','UAE'],
};
for (const [code, values] of Object.entries(aliases)) {
  for (const value of values) countryCodes.set(normalize(value), code);
}

export const countryCode = (country:string): string | undefined => countryCodes.get(normalize(country));
// App flag presentation is separate from region identity and stored values.
export const countryFlagCode = (country:string): string | undefined => {
  const code = countryCode(country);
  return code === 'TW' ? 'CN' : code;
};
export const countryShort = (country:string) => countryCode(country) || (country === '全球' ? '◎' : country.slice(0,2));
