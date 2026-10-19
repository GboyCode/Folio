import type { Wallet, Entry, EncryptedWallet, ItemType } from './types.ts';
export const STORAGE_KEY = 'mrgcard.wallet.v1';
export const MAX_BACKUP_BYTES = 12 * 1024 * 1024;
const allowedTypes: ItemType[] = ['bank','crypto','sim','address'];
const fields = ['name','issuer','country','artId','color','number','holder','expiry','currency','network','subtype','tags','notes','phone','plan','renewal','iccid','simType','line1','line2','city','region','postal','mapUrl','customImage'] as const;

export const MAX_MAP_URL_LENGTH = 4096;
export function isHttpUrl(value:string): boolean {
  if (!/^https?:\/\//i.test(value)) return false;
  try { const url = new URL(value); return (url.protocol === 'https:' || url.protocol === 'http:') && !!url.hostname; }
  catch { return false; }
}

export function validateWallet(input: unknown): Wallet {
  if (!input || typeof input !== 'object') throw new Error('备份格式不正确。');
  const v = input as Record<string, unknown>;
  if (v.version !== 1 || !Array.isArray(v.entries) || v.entries.length > 2000) throw new Error('不支持的备份版本或记录数量超出 2,000 条。');
  const ids = new Set<string>();
  const entries = v.entries.map((raw: unknown) => {
    if (!raw || typeof raw !== 'object') throw new Error('备份包含无效记录。');
    const r = raw as Record<string, unknown>;
    if (typeof r.id !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(r.id) || ids.has(r.id)) throw new Error('备份包含无效或重复的记录 ID。');
    if (!allowedTypes.includes(r.type as ItemType)) throw new Error('备份包含未知记录类型。');
    if (typeof r.name !== 'string' || !r.name.trim()) throw new Error('每条记录都需要名称。');
    ids.add(r.id);
    const entry = { id:r.id, type:r.type, favorite:r.favorite === true, demo:r.demo === true } as Entry;
    for (const field of fields) {
      const value = r[field] ?? '';
      const max = field === 'customImage' ? 750000 : field === 'notes' ? 5000 : field === 'mapUrl' ? MAX_MAP_URL_LENGTH : 300;
      if (typeof value !== 'string' || value.length > max) throw new Error('记录字段无效或过长。');
      entry[field] = value;
    }
    entry.mapUrl = entry.mapUrl.trim();
    if (entry.mapUrl && !isHttpUrl(entry.mapUrl)) throw new Error('地图 / 位置网址需填写有效的 http:// 或 https:// 链接。');
    if (entry.customImage && !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(entry.customImage)) throw new Error('卡面图片格式无效。');
    if (entry.color && !/^#[0-9a-fA-F]{6}$/.test(entry.color)) throw new Error('卡面颜色无效。');
    for (const field of ['createdAt','updatedAt'] as const) {
      if (typeof r[field] !== 'string' || !Number.isFinite(Date.parse(r[field] as string))) throw new Error('记录日期无效。');
      entry[field] = r[field] as string;
    }
    return entry;
  });
  return { version:1, entries, updatedAt: typeof v.updatedAt === 'string' && Number.isFinite(Date.parse(v.updatedAt)) ? v.updatedAt : new Date().toISOString() };
}

export function isEncrypted(input: unknown): input is EncryptedWallet {
  return !!input && typeof input === 'object' && (input as Record<string,unknown>).format === 'mrgcard-encrypted';
}
