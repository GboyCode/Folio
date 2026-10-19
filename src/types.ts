export type ItemType = 'bank' | 'crypto' | 'sim' | 'address';
export interface Entry {
  id: string; type: ItemType; name: string; issuer: string; country: string;
  favorite: boolean; demo: boolean; createdAt: string; updatedAt: string;
  artId: string; color: string; number: string; holder: string; expiry: string;
  currency: string; network: string; subtype: string; tags: string; notes: string;
  phone: string; plan: string; renewal: string; iccid: string; simType: string;
  line1: string; line2: string; city: string; region: string; postal: string; mapUrl: string;
  customImage: string;
}
export interface Wallet { version: 1; entries: Entry[]; updatedAt: string }
export interface Artwork { id: string; name: string; issuer: string; type: string; subtype: string; network: string; region: string; image: string; color: string; source: string; providerSource: string; collectedAt: string }
export interface EncryptedWallet { format: 'mrgcard-encrypted'; version: 1; salt: string; iv: string; data: string; iterations: 600000 }
export const typeLabels: Record<ItemType, string> = { bank:'银行卡', crypto:'U 卡', sim:'SIM 电话卡', address:'地址信息' };
// getRandomValues also works on local-network HTTP, where randomUUID is unavailable.
export const newId = () => typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,'0')).join('');
export const blankEntry = (type: ItemType = 'bank'): Entry => ({ id:newId(), type, name:'', issuer:'', country:'', favorite:false, demo:false, createdAt:new Date().toISOString(), updatedAt:new Date().toISOString(), artId:'', color:'#646ce3', number:'', holder:'', expiry:'', currency:'', network:'Visa', subtype:'借记卡', tags:'', notes:'', phone:'', plan:'', renewal:'', iccid:'', simType:'eSIM', line1:'', line2:'', city:'', region:'', postal:'', mapUrl:'', customImage:'' });
