# ChatLoora Desktop (Windows)

Electron wrapper that opens the live ChatLoora web app in a dedicated window with the ChatLoora icon.

## Build installer + website ZIP

From repository root (Windows, stable internet for first build):

```bash
pnpm desktop:pack
```

If `electron-builder` fails on symlinks, run the terminal **as Administrator** once, or set `CSC_IDENTITY_AUTO_DISCOVERY=false` (already configured in `package.json` via `signAndEditExecutable: false`).

Output:

- `apps/desktop/dist/ChatLoora-Setup-1.0.0.exe` — Windows installer (Next → choose folder → Install)
- `apps/web/public/downloads/ChatLoora-Windows.zip` — upload with the site (direct download link)

## Local run

```bash
cd apps/desktop
npm install
npm start
```

Optional: `CHATLOORA_WEB_URL=https://www.chatloora.com npm start`
