#!/usr/bin/env node
/**
 * Builds ChatLoora Windows installer and publishes the Setup EXE for direct website download.
 * Output: apps/web/public/downloads/ChatLoora-Setup.exe
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const desktopDir = path.join(root, 'apps/desktop');
const distDir = path.join(desktopDir, 'dist');
const outDir = path.join(root, 'apps/web/public/downloads');
const outExe = path.join(outDir, 'ChatLoora-Setup.exe');
const outReadme = path.join(outDir, 'README.txt');

function electronEnv() {
  return {
    ...process.env,
    CSC_IDENTITY_AUTO_DISCOVERY: 'false',
    ELECTRON_MIRROR: process.env.ELECTRON_MIRROR || 'https://npmmirror.com/mirrors/electron/',
    ELECTRON_BUILDER_BINARIES_MIRROR:
      process.env.ELECTRON_BUILDER_BINARIES_MIRROR || 'https://npmmirror.com/mirrors/electron-builder-binaries/',
  };
}

function run(cmd, cwd) {
  console.log('>', cmd);
  execSync(cmd, { cwd, stdio: 'inherit', env: electronEnv() });
}

function main() {
  if (!fs.existsSync(path.join(desktopDir, 'package.json'))) {
    console.error('apps/desktop not found');
    process.exit(1);
  }

  const electronBin = path.join(desktopDir, 'node_modules', 'electron', 'dist', 'electron.exe');
  if (!fs.existsSync(electronBin)) {
    run('npm install', desktopDir);
  } else {
    console.log('> skip npm install (electron already present)');
  }

  run('npm run dist', desktopDir);

  const setups = fs
    .readdirSync(distDir)
    .filter((f) => /^ChatLoora-Setup-.*\.exe$/i.test(f))
    .map((f) => ({ name: f, mtime: fs.statSync(path.join(distDir, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);
  const setup = setups[0]?.name;
  if (!setup) {
    console.error('Installer not found in', distDir);
    process.exit(1);
  }
  console.log('Using installer', setup);

  fs.mkdirSync(outDir, { recursive: true });
  fs.copyFileSync(path.join(distDir, setup), outExe);

  fs.writeFileSync(
    outReadme,
    [
      'ChatLoora — Windows',
      '',
      'Direct download: ChatLoora-Setup.exe',
      '1. Run ChatLoora-Setup.exe',
      '2. Follow the installation wizard.',
      '3. Open ChatLoora from the desktop shortcut or Start menu.',
      '',
      'Arabic:',
      '1. شغّل ChatLoora-Setup.exe',
      '2. أكمل خطوات التثبيت.',
      '3. افتح ChatLoora من سطح المكتب أو قائمة ابدأ.',
      '',
      'Note: Windows SmartScreen may warn about unsigned apps.',
      'A trusted Code Signing certificate removes that warning.',
      '',
    ].join('\r\n'),
    'utf8',
  );

  // Remove legacy zip if present so customers are not offered the compressed package.
  const legacyZip = path.join(outDir, 'ChatLoora-Windows.zip');
  if (fs.existsSync(legacyZip)) fs.unlinkSync(legacyZip);

  const stat = fs.statSync(outExe);
  console.log(`Published ${outExe} (${Math.round(stat.size / 1024)} KB)`);
}

main();
