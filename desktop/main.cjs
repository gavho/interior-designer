// Interior Designer desktop shell: runs the same web app in a native window, with native file dialogs,
// the 3D engine served from node_modules (works offline) and full-resolution image export.
const { app, BrowserWindow, dialog, ipcMain, protocol, net, shell } = require('electron');
const path = require('path');
const fs = require('fs/promises');

const WEB = app.isPackaged ? path.join(process.resourcesPath, 'web') : path.join(__dirname, '..');
const VENDOR = path.join(__dirname, 'node_modules');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.glb': 'model/gltf-binary', '.wasm': 'application/wasm' };
const serve = async file => new Response(await fs.readFile(file), { headers: { 'content-type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream' } });

protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } }]);

function createWindow() {
  const win = new BrowserWindow({
    width: 1480, height: 940, minWidth: 900, minHeight: 600, title: 'Interior Designer', backgroundColor: '#f3f4f6',
    icon: path.join(WEB, 'icons', 'icon-512.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, sandbox: false },
  });
  win.loadURL('app://local/index.html');
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) shell.openExternal(url); return { action: 'deny' }; }); // product links open in the browser
  return win;
}

app.whenReady().then(() => {
  // the app's own files
  protocol.handle('app', async req => {
    const p = decodeURIComponent(new URL(req.url).pathname), file = path.normalize(path.join(WEB, p === '/' ? 'index.html' : p));
    if (!file.startsWith(WEB)) return new Response('Forbidden', { status: 403 });
    try { return await serve(file); } catch { return new Response('Not found', { status: 404 }); }
  });
  // the web build loads three.js from the CDN; serve the same pinned versions from node_modules so it works offline
  protocol.handle('https', async req => {
    const u = new URL(req.url), m = u.hostname === 'cdn.jsdelivr.net' && u.pathname.match(/^\/npm\/((?:@[^/]+\/)?[^@/]+)@[^/]+\/(.*)$/);
    if (m) { const file = path.join(VENDOR, m[1], m[2]); try { return await serve(file); } catch {} }
    return net.fetch(req, { bypassCustomProtocolHandlers: true });
  });

  const filters = [{ name: 'Interior Designer project', extensions: ['json'] }];
  ipcMain.handle('open-file', async e => {
    const r = await dialog.showOpenDialog(BrowserWindow.fromWebContents(e.sender), { properties: ['openFile'], filters });
    if (r.canceled || !r.filePaths[0]) return null;
    const p = r.filePaths[0]; return { path: p, name: path.basename(p), text: await fs.readFile(p, 'utf8') };
  });
  ipcMain.handle('read-file', async (e, p) => ({ path: p, name: path.basename(p), text: await fs.readFile(p, 'utf8') }));
  ipcMain.handle('save-file', async (e, p, text) => { await fs.writeFile(p, text, 'utf8'); return { path: p, name: path.basename(p) }; });
  ipcMain.handle('save-file-as', async (e, name, text) => {
    const r = await dialog.showSaveDialog(BrowserWindow.fromWebContents(e.sender), { defaultPath: path.join(app.getPath('documents'), name), filters });
    if (r.canceled || !r.filePath) return null;
    await fs.writeFile(r.filePath, text, 'utf8'); return { path: r.filePath, name: path.basename(r.filePath) };
  });
  ipcMain.handle('save-image', async (e, name, dataUrl) => { // full-resolution PNG renders
    const r = await dialog.showSaveDialog(BrowserWindow.fromWebContents(e.sender), { defaultPath: path.join(app.getPath('pictures'), name), filters: [{ name: 'PNG image', extensions: ['png'] }] });
    if (r.canceled || !r.filePath) return null;
    await fs.writeFile(r.filePath, Buffer.from(dataUrl.split(',')[1], 'base64')); return { path: r.filePath, name: path.basename(r.filePath) };
  });

  createWindow();
  app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
