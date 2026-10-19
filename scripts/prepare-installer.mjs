import { readFile, writeFile } from 'node:fs/promises';
import sharp from 'sharp';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Pinned Tauri NSIS backend; only replace the presentation pages.
const directory = new URL('../src-tauri/installer/', import.meta.url);
if (process.platform === 'win32') execFileSync('cmd.exe', ['/d', '/c', 'scripts\\build-installer-controls.cmd'], { stdio: 'inherit' });
let template = await readFile(new URL('upstream.nsi', directory), 'utf8');
function replace(before, after) {
  if (!template.includes(before)) throw new Error(`NSIS template changed: ${before}`);
  template = template.replace(before, after);
}
replace('Var OldMainBinaryName', `Var OldMainBinaryName
!define MUI_BGCOLOR FFFFFF
!define MUI_TEXTCOLOR 242426
!define MUI_INSTFILESPAGE_COLORS "242426 FFFFFF"
!define MUI_CUSTOMFUNCTION_GUIINIT FolioGuiInit
!define MUI_CUSTOMFUNCTION_ABORT FolioAbort`);
replace('!define MUI_PAGE_CUSTOMFUNCTION_PRE SkipIfPassive\n!insertmacro MUI_PAGE_WELCOME', 'Page custom FolioWelcome FolioWelcomeLeave');
replace('Page custom PageReinstall PageLeaveReinstall', '; Existing NSIS installations are updated in place.');
replace('!define MUI_PAGE_CUSTOMFUNCTION_PRE SkipIfPassive\n!insertmacro MUI_PAGE_DIRECTORY', '; The installation directory is edited on the welcome page.');
replace('!insertmacro MUI_PAGE_INSTFILES', '!define MUI_PAGE_CUSTOMFUNCTION_SHOW FolioProgressShow\n!insertmacro MUI_PAGE_INSTFILES');
const finishStart = template.indexOf('; 8. Finish page');
const finishEnd = template.indexOf('Function RunMainBinary', finishStart);
if (finishStart < 0 || finishEnd < 0) throw new Error('NSIS finish page anchor changed');
template = template.slice(0, finishStart) + 'Page custom FolioFinish\n\n' + template.slice(finishEnd);
replace('Function .onInit\n', '!include "${FOLIO_UI_DIR}\\folio-ui.nsh"\n\nFunction .onInit\n  StrCpy $FolioExpanded 0\n');
await writeFile(new URL('installer.nsi', directory), template);

const { data, info } = await sharp(fileURLToPath(new URL('../src/assets/folio-icon.svg', import.meta.url)))
  .resize(256, 256).flatten({ background: '#ffffff' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const stride = (info.width * 3 + 3) & ~3;
const bmp = Buffer.alloc(54 + stride * info.height);
bmp.write('BM'); bmp.writeUInt32LE(bmp.length, 2); bmp.writeUInt32LE(54, 10); bmp.writeUInt32LE(40, 14);
bmp.writeInt32LE(info.width, 18); bmp.writeInt32LE(info.height, 22); bmp.writeUInt16LE(1, 26); bmp.writeUInt16LE(24, 28);
for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
  const from = (y * info.width + x) * 3, to = 54 + (info.height - 1 - y) * stride + x * 3;
  bmp[to] = data[from + 2]; bmp[to + 1] = data[from + 1]; bmp[to + 2] = data[from];
}
await writeFile(new URL('logo.bmp', directory), bmp);
console.log('Prepared Folio installer UI.');
