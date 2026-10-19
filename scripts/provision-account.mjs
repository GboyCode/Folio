import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { randomBytes, pbkdf2Sync } from 'node:crypto';

const args=process.argv.slice(2);
const value = name => { const i=args.indexOf(name); return i<0 ? undefined : args[i+1]; };
const local=args.includes('--local');
const username=value('--username') || 'admin';
if(!/^[A-Za-z0-9_.-]{3,64}$/.test(username)) throw Error('用户名须为 3–64 个字母、数字、点、下划线或横线。');
const url=value('--url') || (local ? 'http://localhost:5173' : '');
if(!url || !/^https?:$/.test(new URL(url).protocol) || (!local && new URL(url).protocol!=='https:')) throw Error('远程初始化请使用 --url https://你的域名；本地初始化使用 --local。');
const prefix=local?'local-':'';
const file=`.secrets/${prefix}credentials.json`;
await mkdir('.secrets',{recursive:true});
let credentials;
try { credentials=JSON.parse(await readFile(file,'utf8')); }
catch(error) {
  if(error.code!=='ENOENT') throw error;
  credentials={url,username,password:randomBytes(24).toString('base64url')};
  await writeFile(file,JSON.stringify(credentials,null,2)+'\n',{flag:'wx',mode:0o600});
  await writeFile(`.secrets/${prefix}登录信息.txt`,`Folio\n网址：${url}\n账号：${username}\n初始密码：${credentials.password}\n\n请保管此文件，不要上传或分享。登录后可在「数据隐私」修改登录密码。\n`,{flag:'wx',mode:0o600});
}
if(!/^[A-Za-z0-9_.-]{3,64}$/.test(credentials.username) || typeof credentials.password!=='string' || credentials.password.length<16) throw Error('已有初始化文件格式无效；未覆盖文件。');
const salt=randomBytes(16).toString('hex');
const hash=pbkdf2Sync(credentials.password,salt,100000,32,'sha256').toString('hex');
const sql=`INSERT OR IGNORE INTO account(id,username,password_hash,password_salt,password_iterations,updated_at) VALUES(1,'${credentials.username}','${hash}','${salt}',100000,'${new Date().toISOString()}');\n`;
await writeFile(`.secrets/${prefix}account.sql`,sql,{mode:0o600});
console.log(`已生成初始化 SQL。登录信息仅保存在 ${file}，未输出密码。重复运行不会覆盖已有账号。`);
