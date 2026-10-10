/**
 * Embed ChatLoora icon into ChatLoora.exe so desktop / taskbar shortcuts show the brand logo.
 * Needed because signAndEditExecutable may be disabled on machines without symlink privileges.
 */
const path = require('path');
const fs = require('fs');

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'win32') return;

  const exeName = `${context.packager.appInfo.productFilename}.exe`;
  const exePath = path.join(context.appOutDir, exeName);
  const icoPath = path.join(context.packager.projectDir, 'build', 'icon.ico');

  if (!fs.existsSync(exePath)) {
    console.warn('afterPack: exe not found', exePath);
    return;
  }
  if (!fs.existsSync(icoPath)) {
    console.warn('afterPack: icon.ico not found', icoPath);
    return;
  }

  let rcedit;
  try {
    rcedit = require('rcedit');
  } catch {
    console.warn('afterPack: rcedit not available; skipping icon embed');
    return;
  }

  const edit = typeof rcedit === 'function' ? rcedit : rcedit.rcedit || rcedit.default;
  if (typeof edit !== 'function') {
    console.warn('afterPack: unexpected rcedit export');
    return;
  }

  await edit(exePath, {
    icon: icoPath,
    'version-string': {
      CompanyName: 'ChatLoora',
      FileDescription: 'ChatLoora',
      ProductName: 'ChatLoora',
      LegalCopyright: 'Copyright © ChatLoora',
    },
    'product-version': context.packager.appInfo.version,
    'file-version': context.packager.appInfo.version,
  });
  console.log('afterPack: embedded ChatLoora icon into', exeName);
};
