const { app, BrowserWindow, Menu, shell, session } = require('electron');
const path = require('path');

const START_URL = (process.env.CHATLOORA_WEB_URL || 'https://www.chatloora.com').replace(/\/$/, '');

const ALLOWED_HOSTS = new Set([
  'chatloora.com',
  'www.chatloora.com',
  'localhost',
  '127.0.0.1',
]);

function resolveAppIcon() {
  const ico = path.join(__dirname, '../build/icon.ico');
  const png = path.join(__dirname, '../build/icon.png');
  try {
    const fs = require('fs');
    if (fs.existsSync(ico)) return ico;
    if (fs.existsSync(png)) return png;
  } catch {
    /* ignore */
  }
  return undefined;
}

function isAllowedNavigation(urlString) {
  try {
    const u = new URL(urlString);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
    const host = u.hostname.toLowerCase();
    if (ALLOWED_HOSTS.has(host)) return true;
    if (host.endsWith('.chatloora.com')) return true;
    const oauthHosts = [
      'tiktok.com',
      'facebook.com',
      'instagram.com',
      'google.com',
      'accounts.google.com',
      'wayl.com',
    ];
    return oauthHosts.some((h) => host === h || host.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    title: 'ChatLoora',
    icon: resolveAppIcon(),
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, 'preload.js'),
      spellcheck: true,
    },
  });

  win.loadURL(`${START_URL}/login`);

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedNavigation(url)) {
      return { action: 'allow' };
    }
    shell.openExternal(url);
    return { action: 'deny' };
  });

  win.webContents.on('will-navigate', (event, url) => {
    if (!isAllowedNavigation(url)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  return win;
}

app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(true);
  });

  Menu.setApplicationMenu(null);
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
