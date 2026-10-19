import { validateWallet, isEncrypted, MAX_BACKUP_BYTES } from '../src/validation';

type Account = { username: string; password_hash: string; password_salt: string; password_iterations: number; auth_version: number };
const encoder = new TextEncoder();
const SESSION_SECONDS = 7 * 24 * 60 * 60;
const ITERATIONS = 100_000;
const cookieName = 'mrgcard_session';
class HttpError extends Error { constructor(public status: number, message: string) { super(message); } }
const hex = (bytes: ArrayBuffer | Uint8Array) => [...new Uint8Array(bytes)].map(n => n.toString(16).padStart(2, '0')).join('');
const random = (length: number) => hex(crypto.getRandomValues(new Uint8Array(length)));
const digest = async (value: string) => hex(await crypto.subtle.digest('SHA-256', encoder.encode(value)));
async function passwordHash(password: string, salt: string, iterations = ITERATIONS) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: encoder.encode(salt), iterations }, key, 256));
}
function equal(a: string, b: string) { let difference = a.length ^ b.length; for (let i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ (b.charCodeAt(i) || 0); return difference === 0; }
function cookie(request: Request, token = '', age = SESSION_SECONDS) {
  return `${cookieName}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${new URL(request.url).protocol === 'https:' ? '; Secure' : ''}`;
}
function json(data: unknown, status = 200, headers: Record<string, string> = {}) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', ...headers } });
}
async function body(request: Request, limit = 4096): Promise<Record<string, unknown>> {
  if (!request.headers.get('content-type')?.startsWith('application/json')) throw new HttpError(415, '请求必须使用 JSON。');
  if (Number(request.headers.get('content-length')) > limit) throw new HttpError(413, '数据超过大小限制。');
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, '请求内容为空。');
  const chunks: Uint8Array[] = []; let total = 0;
  while (true) { const { value, done } = await reader.read(); if (done) break; total += value.length; if (total > limit) { await reader.cancel(); throw new HttpError(413, '卡包最大支持 12 MB，请减少自定义图片。'); } chunks.push(value); }
  const bytes = new Uint8Array(total); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  try { const result = JSON.parse(new TextDecoder().decode(bytes)); if (!result || Array.isArray(result) || typeof result !== 'object') throw Error(); return result; }
  catch { throw new HttpError(400, 'JSON 格式不正确。'); }
}
async function tokenHash(request: Request) {
  const token = request.headers.get('cookie')?.split(';').map(x => x.trim()).find(x => x.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
  return token && /^[a-f0-9]{64}$/.test(token) ? digest(token) : '';
}
async function session(request: Request, env: Env) {
  const hash = await tokenHash(request);
  const account = hash ? await env.DB.prepare('SELECT a.username, a.auth_version FROM account a JOIN sessions s ON s.auth_version=a.auth_version WHERE a.id=1 AND s.token_hash=? AND s.expires_at>?').bind(hash, Date.now()).first<{ username: string; auth_version: number }>() : null;
  if (!account) throw new HttpError(401, '请登录后继续。');
  return { ...account, hash };
}
async function throttle(request: Request, env: Env) {
  const key = await digest(`login:${request.headers.get('CF-Connecting-IP') || 'local'}`);
  const now = Date.now();
  const result = await env.DB.prepare('INSERT INTO login_attempts(key,attempts,reset_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN reset_at<=? THEN 1 ELSE attempts+1 END, reset_at=CASE WHEN reset_at<=? THEN excluded.reset_at ELSE reset_at END RETURNING attempts').bind(key, now + 15 * 60_000, now, now).first<{ attempts: number }>();
  if (!result || result.attempts > 10) throw new HttpError(429, '尝试次数过多，请 15 分钟后重试。');
  return key;
}
function cleanPayload(input: unknown) {
  if (!isEncrypted(input)) { try { return validateWallet(input); } catch (error) { throw new HttpError(400, (error as Error).message); } }
  if (input.version !== 1 || input.iterations !== 600000 || typeof input.salt !== 'string' || !/^[A-Za-z0-9+/]{22}==$/.test(input.salt) || typeof input.iv !== 'string' || !/^[A-Za-z0-9+/]{16}$/.test(input.iv) || typeof input.data !== 'string' || input.data.length < 24 || !/^[A-Za-z0-9+/]+={0,2}$/.test(input.data)) throw new HttpError(400, '加密卡包格式不正确。');
  return { format: 'mrgcard-encrypted', version: 1, iterations: 600000, salt: input.salt, iv: input.iv, data: input.data };
}
async function api(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const { pathname, origin } = new URL(request.url);
  if (!['GET', 'HEAD'].includes(request.method)) {
    if (request.headers.get('Origin') !== origin || request.headers.get('Sec-Fetch-Site') === 'cross-site') throw new HttpError(403, '请求来源不允许。');
  }
  if (pathname === '/api/login' && request.method === 'POST') {
    const attemptKey = await throttle(request, env);
    const { username, password } = await body(request);
    if (typeof username !== 'string' || typeof password !== 'string' || password.length > 200 || username.length > 80) throw new HttpError(400, '请输入账号和密码。');
    const account = await env.DB.prepare('SELECT * FROM account WHERE id=1').first<Account>();
    const hash = await passwordHash(password, account?.password_salt || 'unprovisioned-account', account?.password_iterations || ITERATIONS);
    if (!account || !equal(hash, account.password_hash) || !equal(username, account.username)) throw new HttpError(401, '账号或密码不正确。');
    const token = random(32);
    const added = await env.DB.prepare('INSERT INTO sessions(token_hash,auth_version,expires_at) SELECT ?,auth_version,? FROM account WHERE id=1 AND auth_version=?').bind(await digest(token), Date.now() + SESSION_SECONDS * 1000, account.auth_version).run();
    if (!added.meta.changes) throw new HttpError(401, '密码刚刚更新，请重新登录。');
    ctx.waitUntil(env.DB.batch([env.DB.prepare('DELETE FROM login_attempts WHERE key=? OR reset_at<?').bind(attemptKey, Date.now()), env.DB.prepare('DELETE FROM sessions WHERE expires_at<?').bind(Date.now())]).then(() => {}).catch(() => {}));
    return json({ username: account.username }, 200, { 'Set-Cookie': cookie(request, token) });
  }
  if (pathname === '/api/logout' && request.method === 'POST') {
    const hash = await tokenHash(request);
    if (hash) await env.DB.prepare('DELETE FROM sessions WHERE token_hash=?').bind(hash).run();
    return json({ ok: true }, 200, { 'Set-Cookie': cookie(request, '', 0) });
  }
  const user = await session(request, env);
  if (pathname === '/api/session' && request.method === 'GET') return json({ username: user.username });
  if (pathname === '/api/password' && request.method === 'POST') {
    const attemptKey = await throttle(request, env);
    const { currentPassword, newPassword } = await body(request);
    if (typeof currentPassword !== 'string' || currentPassword.length > 200 || typeof newPassword !== 'string' || newPassword.length < 12 || newPassword.length > 200) throw new HttpError(400, '新密码需要 12–200 个字符。');
    const account = await env.DB.prepare('SELECT * FROM account WHERE id=1').first<Account>();
    if (!account || account.auth_version !== user.auth_version || !equal(await passwordHash(currentPassword, account.password_salt, account.password_iterations), account.password_hash)) throw new HttpError(400, '当前密码不正确。');
    const salt = random(16), hash = await passwordHash(newPassword, salt);
    const changed = await env.DB.prepare('UPDATE account SET password_hash=?,password_salt=?,password_iterations=?,auth_version=auth_version+1,updated_at=? WHERE id=1 AND auth_version=?').bind(hash, salt, ITERATIONS, new Date().toISOString(), user.auth_version).run();
    if (!changed.meta.changes) throw new HttpError(409, '账号已更新，请重新登录。');
    await env.DB.batch([env.DB.prepare('DELETE FROM sessions WHERE auth_version<=?').bind(user.auth_version), env.DB.prepare('DELETE FROM login_attempts WHERE key=?').bind(attemptKey)]);
    return json({ ok: true }, 200, { 'Set-Cookie': cookie(request, '', 0) });
  }
  if (pathname === '/api/wallet' && request.method === 'GET') {
    const [state, chunks] = await env.DB.batch<{revision:number;updated_at:string;data:string}>([env.DB.prepare('SELECT revision,updated_at FROM wallet_state WHERE id=1'), env.DB.prepare('SELECT data FROM wallet_chunks ORDER BY chunk_index')]);
    if (!state.results.length) throw new HttpError(503, '数据库尚未初始化。');
    return json({ revision: state.results[0].revision, payload: chunks.results.length ? JSON.parse(chunks.results.map(row => row.data).join('')) : { version: 1, entries: [], updatedAt: state.results[0].updated_at } });
  }
  if (pathname === '/api/wallet' && request.method === 'PUT') {
    const { revision, payload } = await body(request, MAX_BACKUP_BYTES + 1024);
    if (!Number.isSafeInteger(revision) || (revision as number) < 0) throw new HttpError(400, '数据版本不正确。');
    const raw = JSON.stringify(cleanPayload(payload));
    if (encoder.encode(raw).length > MAX_BACKUP_BYTES) throw new HttpError(413, '卡包最大支持 12 MB，请减少自定义图片。');
    const mutation = random(16);
    // Conditional statements in one atomic D1 batch prevent stale devices overwriting newer data.
    const statements = [env.DB.prepare('UPDATE wallet_state SET revision=revision+1,mutation_id=?,updated_at=? WHERE id=1 AND revision=? AND EXISTS(SELECT 1 FROM sessions s JOIN account a ON a.auth_version=s.auth_version WHERE a.id=1 AND s.token_hash=? AND s.expires_at>?)').bind(mutation, new Date().toISOString(), revision, user.hash, Date.now()), env.DB.prepare('DELETE FROM wallet_chunks WHERE EXISTS(SELECT 1 FROM wallet_state WHERE id=1 AND mutation_id=?)').bind(mutation)];
    for (let offset = 0, index = 0; offset < raw.length; index++) {
      let end = Math.min(offset + 400_000, raw.length);
      if (end < raw.length && raw.charCodeAt(end - 1) >= 0xd800 && raw.charCodeAt(end - 1) <= 0xdbff) end--;
      statements.push(env.DB.prepare('INSERT INTO wallet_chunks(chunk_index,data) SELECT ?,? WHERE EXISTS(SELECT 1 FROM wallet_state WHERE id=1 AND mutation_id=?)').bind(index, raw.slice(offset, end), mutation));
      offset = end;
    }
    const result = await env.DB.batch(statements);
    if (!result[0].meta.changes) throw new HttpError(409, '其他设备已更新卡包或登录已过期。请保留当前修改，刷新后重试。');
    return json({ revision: (revision as number) + 1 });
  }
  throw new HttpError(404, '接口不存在。');
}
export default {
  async fetch(request, env, ctx) {
    if (!new URL(request.url).pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    try { return await api(request, env, ctx); }
    catch (error) { if (error instanceof HttpError) return json({ error: error.message }, error.status); console.error('API request failed', { path: new URL(request.url).pathname, kind: error instanceof Error ? error.name : 'Unknown' }); return json({ error: '服务暂时不可用，请稍后重试。' }, 503); }
  },
} satisfies ExportedHandler<Env>;
