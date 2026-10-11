const { app, BrowserWindow, Menu, MenuItem, shell, session } = require('electron');
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
      'wayl.io',
      'ads.tiktok.com',
      'business-api.tiktok.com',
    ];
    return oauthHosts.some((h) => host === h || host.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

/** Keep Edit roles so Ctrl+C / Ctrl+V / Ctrl+X / Ctrl+A work on Windows. */
function installAppMenu() {
  const template = [
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'pasteAndMatchStyle' },
        { role: 'delete' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { type: 'separator' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Window',
      submenu: [{ role: 'minimize' }, { role: 'close' }],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function attachContextMenu(win) {
  win.webContents.on('context-menu', (_event, params) => {
    const menu = new Menu();
    const canEdit = params.isEditable;
    if (canEdit) {
      menu.append(new MenuItem({ role: 'undo', enabled: params.editFlags.canUndo }));
      menu.append(new MenuItem({ role: 'redo', enabled: params.editFlags.canRedo }));
      menu.append(new MenuItem({ type: 'separator' }));
      menu.append(new MenuItem({ role: 'cut', enabled: params.editFlags.canCut }));
      menu.append(new MenuItem({ role: 'copy', enabled: params.editFlags.canCopy }));
      menu.append(new MenuItem({ role: 'paste', enabled: params.editFlags.canPaste }));
      menu.append(new MenuItem({ role: 'delete', enabled: params.editFlags.canDelete }));
      menu.append(new MenuItem({ type: 'separator' }));
      menu.append(new MenuItem({ role: 'selectAll', enabled: params.editFlags.canSelectAll }));
    } else if (params.selectionText) {
      menu.append(new MenuItem({ role: 'copy' }));
    } else {
      return;
    }
    menu.popup({ window: win });
  });
}

/** Windows: autoHideMenuBar often breaks Edit accelerators — force clipboard shortcuts. */
function attachClipboardShortcuts(win) {
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    const ctrl = input.control || input.meta;
    if (!ctrl || input.alt) return;
    const key = String(input.key || '').toLowerCase();
    if (key === 'c') {
      win.webContents.copy();
      event.preventDefault();
    } else if (key === 'v') {
      win.webContents.paste();
      event.preventDefault();
    } else if (key === 'x') {
      win.webContents.cut();
      event.preventDefault();
    } else if (key === 'a') {
      win.webContents.selectAll();
      event.preventDefault();
    }
  });
}

/** Keep ChatLoora / OAuth navigations inside this window — never spawn a second shell. */
function attachSameWindowNavigation(win) {
  const openInAppOrExternal = (url) => {
    if (!url || url === 'about:blank') return;
    if (isAllowedNavigation(url)) {
      win.loadURL(url);
      return;
    }
    shell.openExternal(url);
  };

  win.webContents.setWindowOpenHandler(({ url }) => {
    openInAppOrExternal(url);
    return { action: 'deny' };
  });

  win.webContents.on('will-navigate', (event, url) => {
    if (isAllowedNavigation(url)) return;
    event.preventDefault();
    shell.openExternal(url);
  });

  win.webContents.on('will-redirect', (event, url) => {
    if (isAllowedNavigation(url)) return;
    event.preventDefault();
    shell.openExternal(url);
  });
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
  attachContextMenu(win);
  attachClipboardShortcuts(win);
  attachSameWindowNavigation(win);

  return win;
}

app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(true);
  });

  // Ensure every webContents (including future ones) stays in-app for allowed hosts.
  app.on('web-contents-created', (_event, contents) => {
    contents.setWindowOpenHandler(({ url }) => {
      const parent = BrowserWindow.fromWebContents(contents) || BrowserWindow.getFocusedWindow();
      if (parent && isAllowedNavigation(url)) {
        parent.loadURL(url);
        return { action: 'deny' };
      }
      if (url && url !== 'about:blank') shell.openExternal(url);
      return { action: 'deny' };
    });
  });

  installAppMenu();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
