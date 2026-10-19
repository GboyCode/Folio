import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { delimiter, join } from 'node:path';
import { spawn } from 'node:child_process';

// Rustup is installed for the current user; do not require a global PATH change.
const cargoBin = join(homedir(), '.cargo', 'bin');
const environment = { ...process.env, PATH: cargoBin + delimiter + (process.env.PATH || process.env.Path || '') };
for (const key of Object.keys(environment)) if (key !== 'PATH' && key.toLowerCase() === 'path') delete environment[key];
const action = process.argv[2] || 'build';
const cli = join(import.meta.dirname, '..', 'node_modules', '@tauri-apps', 'cli', 'tauri.js');
if (!existsSync(cli)) throw new Error('请先运行 npm install。');
const command = action === 'test' ? join(cargoBin, process.platform === 'win32' ? 'cargo.exe' : 'cargo') : process.execPath;
const args = action === 'test' ? ['test', '--manifest-path', 'src-tauri/Cargo.toml', '--lib'] : [cli, action, ...(action === 'build' ? ['--bundles', 'nsis'] : []), ...process.argv.slice(3)];
const child = spawn(command, args, { stdio: 'inherit', env: environment });
child.on('error', error => { console.error(error.message); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 1; });
