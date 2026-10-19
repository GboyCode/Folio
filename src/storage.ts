import type { Wallet, Entry, EncryptedWallet, ItemType } from './types.ts';

import { MAX_BACKUP_BYTES, validateWallet } from './validation.ts';
import { desktopMode, nativeCommand } from './runtime.ts';
export { STORAGE_KEY, MAX_BACKUP_BYTES, validateWallet, isEncrypted } from './validation.ts';

const bytes64 = (bytes: Uint8Array) => {
  let s = '';
  for (let i=0; i<bytes.length; i+=8192) s += String.fromCharCode(...bytes.subarray(i,i+8192));
  return btoa(s);
};
const from64 = (str: string) => Uint8Array.from(atob(str), c => c.charCodeAt(0));

export async function deriveKey(password: string, salt: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  if (!globalThis.crypto?.subtle) throw new Error('加密功能需要 HTTPS 或 localhost。请在电脑使用 localhost，手机使用 HTTPS 地址。');
  const material = await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveKey']);
  return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:600000,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}
export async function encryptWallet(wallet: Wallet, key: CryptoKey, salt: string): Promise<EncryptedWallet> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({name:'AES-GCM',iv},key,new TextEncoder().encode(JSON.stringify(validateWallet(wallet))));
  return {format:'mrgcard-encrypted',version:1,iterations:600000,salt,iv:bytes64(iv),data:bytes64(new Uint8Array(encrypted))};
}
export async function createEncryption(wallet: Wallet, password: string) {
  if (password.length < 10) throw new Error('密码至少需要 10 个字符。');
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveKey(password,salt);
  const envelope = await encryptWallet(wallet,key,bytes64(salt));
  return { key, envelope };
}
export async function decryptWallet(envelope: EncryptedWallet, password: string) {
  if (envelope.version !== 1 || envelope.iterations !== 600000 || typeof envelope.data !== 'string' || envelope.data.length > MAX_BACKUP_BYTES * 1.4) throw new Error('不支持的加密备份格式。');
  try {
    const salt = from64(envelope.salt), iv = from64(envelope.iv);
    if (salt.length !== 16 || iv.length !== 12) throw new Error('Invalid parameters');
    const key = await deriveKey(password,salt);
    const decrypted = await crypto.subtle.decrypt({name:'AES-GCM',iv},key,from64(envelope.data));
    const wallet = validateWallet(JSON.parse(new TextDecoder().decode(decrypted)));
    return { wallet, key };
  } catch { throw new Error('密码不正确，或加密备份已损坏。原数据未被修改。'); }
}
export function mergeWallets(current: Wallet, imported: Wallet): Wallet {
  const ids = new Set(current.entries.map(e=>e.id));
  const additions = imported.entries.filter(e=>!ids.has(e.id));
  return validateWallet({ version:1, entries:[...current.entries,...additions], updatedAt:new Date().toISOString() });
}
export async function downloadFile(content: string, filename: string): Promise<boolean> {
  if (desktopMode) return nativeCommand<boolean>('export_backup', { content, filename });
  const url = URL.createObjectURL(new Blob([content],{type:'application/json'}));
  const anchor = document.createElement('a'); anchor.href=url; anchor.download=filename;
  document.body.append(anchor); anchor.click(); anchor.remove(); setTimeout(()=>URL.revokeObjectURL(url),1000);
  return true;
}
