import rawCatalog from './catalog.json';
import { blankEntry, type Artwork, type Wallet, type Entry } from './types';
export const catalog = rawCatalog as Artwork[];
export const artById = new Map(catalog.map(a=>[a.id,a]));
export { commonCountries, countries, countryShort } from './countries';
export function demoWallet(): Wallet {
  const base = (values: Partial<Entry>): Entry => ({...blankEntry(),...values,demo:true,createdAt:'2026-10-01T00:00:00.000Z',updatedAt:'2026-10-01T00:00:00.000Z'});
  return {version:1,updatedAt:new Date().toISOString(),entries:[
    base({id:'demo-wise',type:'bank',name:'Wise 日常卡',issuer:'Wise',country:'英国',artId:'wise',number:'4829',currency:'GBP / EUR / USD',subtype:'借记卡',network:'Mastercard',tags:'旅行,日常消费',favorite:true,expiry:'2029-08',notes:'示例卡片，可删除后添加自己的卡片。'}),
    base({id:'demo-hsbc',type:'bank',name:'汇丰万事达扣账卡',issuer:'HSBC 汇丰银行',country:'中国香港',artId:'hsbc-hk-mastercard-debit',number:'6801',currency:'HKD',network:'Mastercard',tags:'日常消费',favorite:true,expiry:'2028-12'}),
    base({id:'demo-amex',type:'bank',name:'American Express Platinum',issuer:'American Express',country:'美国',artId:'amex-platinum',number:'1008',currency:'USD',network:'AMEX',subtype:'信用卡',tags:'旅行,信用卡',expiry:'2030-06'}),
    base({id:'demo-redotpay',type:'crypto',name:'RedotPay 虚拟卡',issuer:'RedotPay',country:'全球',artId:'redotpay',number:'9206',currency:'USDT',subtype:'虚拟卡',tags:'订阅付款',expiry:'2028-04'}),
    base({id:'demo-etherfi',type:'crypto',name:'Ether.fi Cash',issuer:'Ether.fi',country:'全球',artId:'etherfi-core',number:'3815',currency:'USDC',subtype:'实体卡',tags:'旅行',favorite:true,expiry:'2029-10'}),
    base({id:'demo-revolut',type:'bank',name:'Revolut Standard',issuer:'Revolut',country:'英国',artId:'revolut-standard',number:'7052',currency:'GBP',tags:'日常消费',expiry:'2029-02'}),
    base({id:'demo-giffgaff',type:'sim',name:'英国日常号码',issuer:'giffgaff',country:'英国',phone:'+44 7700 900123',simType:'实体 SIM',plan:'Pay as you go',renewal:'2026-12-01',tags:'保号',color:'#efd455'}),
    base({id:'demo-tello',type:'sim',name:'美国备用号码',issuer:'Tello',country:'美国',phone:'+1 202 555 0148',simType:'eSIM',plan:'100 分钟 + 1 GB',renewal:'2026-11-15',tags:'备用',color:'#5682d6'}),
    base({id:'demo-address-us',type:'address',name:'美国收件地址',country:'美国',holder:'DEMO USER',line1:'123 Example Avenue',line2:'Suite 100',city:'Portland',region:'Oregon',postal:'97201',tags:'收件地址',favorite:true}),
    base({id:'demo-address-hk',type:'address',name:'香港联系地址',country:'中国香港',holder:'示例用户',line1:'示例街 18 号',line2:'8 楼 A 室',city:'香港',region:'中西区',tags:'联系地址'}),
    base({id:'demo-address-uk',type:'address',name:'英国账单地址',country:'英国',holder:'DEMO USER',line1:'42 Example Street',city:'London',postal:'SW1A 1AA',tags:'账单地址'}),
  ]};
}
export const formattedAddress = (entry:Entry) => [entry.holder,entry.line1,entry.line2,[entry.city,entry.region,entry.postal].filter(Boolean).join(', '),entry.country,entry.phone].filter(Boolean).join('\n');
export function expiration(entry: Entry): {label:string; urgent:boolean} | null {
  const value = entry.type === 'sim' ? entry.renewal : entry.expiry;
  if(!value) return null;
  const end = entry.type === 'sim' ? new Date(value+'T23:59:59') : new Date(Number(value.slice(0,4)),Number(value.slice(5,7)),0,23,59,59);
  const days = Math.ceil((end.getTime()-Date.now())/86400000);
  if(!Number.isFinite(days)) return null;
  return days < 0 ? {label:entry.type==='sim'?'续费日期已过':'已过期',urgent:true} : days <= 30 ? {label:`${days} 天后${entry.type==='sim'?'续费':'到期'}`,urgent:true} : null;
}
