// Collect licenses from locally installed, lockfile-pinned dependencies.
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
const root=path.resolve(import.meta.dirname,'..');
const chunks=['Folio — Third-party license notices\nCopyright (c) 2026 RyanLin\n\nFolio original code is MIT licensed. Third-party components and artwork retain their own rights. See THIRD_PARTY_NOTICES.md.\n'];
const missing=[];
async function collect(label,folder,license='See upstream license'){
  let entries;try{entries=await fs.readdir(folder,{withFileTypes:true});}catch{return false;}
  const files=entries.filter(x=>x.isFile()&&/^(licen[sc]e|copying|copyright|notice)([._-]|$)/i.test(x.name));
  chunks.push(`\n${'='.repeat(72)}\n${label}\nLicense: ${typeof license==='string'?license:JSON.stringify(license)}\n`);
  if(!files.length)missing.push(label);
  for(const f of files){const file=path.join(folder,f.name);if((await fs.stat(file)).size<200000)chunks.push(`\n--- ${f.name} ---\n`+await fs.readFile(file,'utf8'));}
  return true;
}
const lock=JSON.parse(await fs.readFile(path.join(root,'package-lock.json'),'utf8'));
for(const [location,pkg] of Object.entries(lock.packages)){if(!location||pkg.dev)continue;await collect(`npm: ${location.replace(/^node_modules\//,'')} @ ${pkg.version}`,path.join(root,location),pkg.license);}
const cargoHome=process.env.CARGO_HOME||path.join(os.homedir(),'.cargo');
const registry=path.join(cargoHome,'registry/src');
const registries=(await fs.readdir(registry)).map(x=>path.join(registry,x));
const cargo=await fs.readFile(path.join(root,'src-tauri/Cargo.lock'),'utf8');
for(const section of cargo.split('[[package]]').slice(1)){
  const name=/^name = "([^"]+)"/m.exec(section)?.[1],version=/^version = "([^"]+)"/m.exec(section)?.[1];
  if(!/^source = "registry/m.test(section))continue;
  for(const dir of registries){const folder=path.join(dir,`${name}-${version}`);let toml;try{toml=await fs.readFile(path.join(folder,'Cargo.toml'),'utf8');}catch{continue;}await collect(`Cargo: ${name} @ ${version}`,folder,/^license = "([^"]+)"/m.exec(toml)?.[1]);break;}
}
for(const file of await fs.readdir(path.join(root,'licenses')))chunks.push(`\n${'='.repeat(72)}\n${file}\n`+await fs.readFile(path.join(root,'licenses',file),'utf8'));
chunks.push('\n'+await fs.readFile(path.join(root,'public/map-data-license.txt'),'utf8'));
await fs.writeFile(path.join(root,'THIRD_PARTY_LICENSES.txt'),chunks.join('\n'));
console.log(`Collected installed dependency notices. ${missing.length} packages declare a license but contain no top-level license text.`);
if(missing.length)console.log(missing.join('\n'));
