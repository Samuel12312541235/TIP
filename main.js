'use strict';

const fsEarly = require('fs');
const pathEarly = require('path');
const osEarly = require('os');
const { spawn } = require('child_process');
const LOG = pathEarly.join(__dirname, 'boot.log');
try {
  fsEarly.writeFileSync(LOG, '');
} catch (_) {}
function trace(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  try {
    fsEarly.appendFileSync(LOG, line);
  } catch (_) {}
  try {
    fsEarly.appendFileSync(pathEarly.join(osEarly.tmpdir(), 'dayflow-boot.log'), line);
  } catch (_) {}
}
process.on('uncaughtException', (err) => {
  trace('UNCAUGHT ' + (err && err.stack ? err.stack : err));
  try {
    require('electron').dialog.showErrorBox('日序启动失败', String((err && err.stack) || err));
  } catch (_) {}
});
process.on('unhandledRejection', (err) => trace('REJECTION ' + (err && err.stack ? err.stack : err)));
trace('--- boot ---');

const {
  app,
  BrowserWindow,
  ipcMain,
  Tray,
  Menu,
  nativeImage,
  Notification,
  screen,
  shell,
  powerMonitor,
  globalShortcut,
  dialog,
} = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { Store, isoDate, dayDiff, parseDate } = require('./server/store');
const { startApi, parseCommand, applyOps } = require('./server/api');

const APP_ID = 'com.dayflow.schedule';
const isHiddenStart = process.argv.includes('--hidden');
const isDebug = process.argv.includes('--debug');

// ── 硬件适配：双显卡笔记本走独显，保持后台计时节流关闭 ─────────────────────────
app.commandLine.appendSwitch('force_high_performance_gpu');
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.disableDomainBlockingFor3DAPIs?.();

app.setAppUserModelId(APP_ID);

/* 便携式数据目录：优先放在应用目录下（绿色/可迁移），失败再退回系统目录 */
function resolveDataDir() {
  const override = process.env.DAYFLOW_DATA_DIR;
  const candidates = [];
  if (override) candidates.push(path.resolve(override));
  candidates.push(path.join(app.getAppPath(), 'data'));
  candidates.push(path.join(app.getPath('userData')));
  for (const dir of candidates) {
    try {
      fs.mkdirSync(dir, { recursive: true });
      const probe = path.join(dir, '.write-test');
      fs.writeFileSync(probe, 'ok', 'utf8');
      fs.unlinkSync(probe);
      return dir;
    } catch (_) {}
  }
  return app.getPath('userData');
}

let DATA_DIR = '';
try {
  DATA_DIR = resolveDataDir();
  app.setPath('userData', DATA_DIR);
} catch (_) {
  DATA_DIR = app.getPath('userData');
}
trace('data dir = ' + DATA_DIR);

let win = null;
let addWin = null;
let tray = null;
let store = null;
let api = null;
let hardware = { displays: [], gpu: [], cpu: {}, memGB: 0, profile: 'balanced', auto: { quality: 'balanced', compact: false, auto: true } };
let quitting = false;
let firstHideToastShown = false;

const userDataDir = app.getPath('userData');
const stateDir = path.join(userDataDir, 'profile');
const windowStateFile = path.join(userDataDir, 'window.json');

/* ──────────────────────────── 工具 ──────────────────────────── */

function readWindowState() {
  try {
    const raw = JSON.parse(fs.readFileSync(windowStateFile, 'utf8'));
    if (raw && raw.width > 800 && raw.height > 560) return raw;
  } catch (_) {}
  return null;
}

function saveWindowState() {
  if (!win || win.isDestroyed() || win.isMinimized()) return;
  try {
    const b = win.getNormalBounds();
    fs.writeFileSync(
      windowStateFile,
      JSON.stringify({ width: b.width, height: b.height, x: b.x, y: b.y, maximized: win.isMaximized() }, null, 2),
      'utf8'
    );
  } catch (_) {}
}

function initialBounds() {
  const saved = readWindowState();
  const wa = screen.getPrimaryDisplay().workAreaSize;
  if (saved) {
    const width = Math.min(saved.width, wa.width - 24);
    const height = Math.min(saved.height, wa.height - 24);
    return { width, height, x: Math.max(0, Math.min(saved.x, wa.width - width)), y: Math.max(0, Math.min(saved.y, wa.height - height)), maximized: !!saved.maximized };
  }
  const width = Math.min(1560, Math.max(Math.min(1100, wa.width - 24), wa.width - 90));
  const height = Math.min(960, Math.max(Math.min(700, wa.height - 24), wa.height - 60));
  return { width, height, x: Math.round((wa.width - width) / 2), y: Math.round((wa.height - height) / 2), maximized: false };
}

function maskState(state) {
  const clone = JSON.parse(JSON.stringify(state));
  const key = (clone.settings.llm || {}).apiKey || '';
  clone.settings.llm.apiKey = key ? `${key.slice(0, 3)}••••${key.slice(-4)}` : '';
  clone.settings.llm.hasKey = !!key;
  return clone;
}

function todayContext(state) {
  const today = isoDate();
  const first = parseDate(state.settings.semesterFirstMonday) || new Date();
  const d = parseDate(today) || new Date();
  const diffDays = Math.floor((d - first) / 86400000);
  return {
    today,
    week: Math.max(1, Math.floor(diffDays / 7) + 1),
    weekday: d.getDay(),
    daysToTermEnd: 126 - diffDays,
  };
}

function sanitizedPayload() {
  return {
    state: maskState(store.get()),
    today: todayContext(store.get()),
    hardware,
    api: { port: api ? api.port : 0, token: store.get().settings.api.token },
    autostart: !!(store.get().settings.autostart || readAutostart()),
    versions: {
      electron: process.versions.electron,
      chrome: process.versions.chrome,
      node: process.versions.node,
      app: app.getVersion(),
    },
    paths: { data: store.dir, userData: userDataDir, app: app.getAppPath() },
  };
}

function broadcast() {
  if (win && !win.isDestroyed()) win.webContents.send('state:changed', sanitizedPayload());
}
const broadcastSoon = debounce(() => broadcast(), 70);

/* 长辈模式：主窗口整体放大，配合 CSS 的对比度与字号调整 */
function applySeniorZoom() {
  try {
    const z = store && store.get().settings.senior ? 1.2 : 1;
    if (win && !win.isDestroyed()) win.webContents.setZoomFactor(z);
  } catch (_) {}
}

/* ──────────────────────────── 硬件探测 ──────────────────────────── */

async function detectHardware() {
  const displays = screen.getAllDisplays().map((d) => ({
    id: d.id,
    label: d.label || `显示器 ${d.id}`,
    width: d.size.width,
    height: d.size.height,
    physicalWidth: Math.round((d.size.width * d.scaleFactor) / 2) * 2,
    physicalHeight: Math.round((d.size.height * d.scaleFactor) / 2) * 2,
    workWidth: d.workAreaSize.width,
    workHeight: d.workAreaSize.height,
    scaleFactor: d.scaleFactor,
    frequency: d.displayFrequency,
    primary: d.id === screen.getPrimaryDisplay().id,
    rotation: d.rotation,
  }));
  let gpu = [];
  try {
    const info = await app.getGPUInfo('basic');
    gpu = (info.gpuDevice || []).map((g) => ({
      vendor: g.vendorString || '',
      device: g.deviceString || '',
      driver: g.driverVersion || '',
    }));
  } catch (_) {}
  const cpus = os.cpus();
  const maxHz = Math.max(60, ...displays.map((d) => d.frequency || 60));
  hardware = {
    displays,
    gpu,
    cpu: { model: (cpus[0] || {}).model || '', cores: cpus.length },
    memGB: Math.round((os.totalmem() / 1024 ** 3) * 10) / 10,
    os: `${os.type()} ${os.release()}`,
    maxHz,
    onBattery: powerMonitor.isOnBatteryPower(),
    profile: maxHz >= 120 ? 'full' : 'balanced',
  };
}

/* ──────────────────────────── 自动适配 ──────────────────────────── */

function computeAutoProfile() {
  const auto = !store || store.get().settings.autoAdapt !== false;
  if (!auto) return { quality: 'full', compact: false, auto: false };
  const d = screen.getPrimaryDisplay();
  const wa = d.workAreaSize;
  const gpuText = (hardware.gpu || []).map((g) => `${g.vendor || ''} ${g.device || ''}`).join(' ').toLowerCase();
  const discrete = /nvidia|geforce|rtx|radeon rx|arc a/.test(gpuText);
  const integrated = /intel|uhd|iris|radeon graphics|vega/.test(gpuText) && !discrete;
  let quality = 'full';
  if (hardware.memGB < 8 || (hardware.maxHz || 60) <= 60 || integrated) quality = 'lite';
  else if (hardware.memGB < 16 || (hardware.maxHz || 60) < 120) quality = 'balanced';
  return { quality, compact: wa.width < 1180 || wa.height < 720, auto: true, discrete };
}

function applyAutoProfile() {
  const auto = computeAutoProfile();
  hardware.auto = auto;
  hardware.profile = auto.quality;
}

function fitWindowToDisplay() {
  if (!win || win.isDestroyed()) return;
  try {
    const wa = screen.getPrimaryDisplay().workAreaSize;
    const [w, h] = win.getSize();
    if (w > wa.width - 16 || h > wa.height - 16) {
      win.setSize(Math.min(w, wa.width - 16), Math.min(h, wa.height - 16));
      win.center();
    }
  } catch (_) {}
}

/* ──────────────────────────── 自启动 ──────────────────────────── */

const RUN_VALUE = 'Dayflow';
let autostartCache = null;

function autostartTarget() {
  const args = [];
  if (!app.isPackaged) args.push(`"${app.getAppPath()}"`);
  args.push(`--user-data-dir="${DATA_DIR}"`, '--no-sandbox');
  return { path: process.execPath, args: args.join(' ') };
}

function readAutostart() {
  if (autostartCache !== null) return autostartCache;
  try {
    autostartCache = !!app.getLoginItemSettings(autostartTarget()).openAtLogin;
  } catch (_) {
    autostartCache = false;
  }
  return autostartCache;
}

function setAutostart(enabled) {
  let ok = false;
  try {
    const target = autostartTarget();
    app.setLoginItemSettings({
      openAtLogin: !!enabled,
      path: target.path,
      args: target.args,
      name: RUN_VALUE,
    });
    autostartCache = null;
    ok = readAutostart() === !!enabled;
    trace(`setLoginItemSettings ${enabled} -> ${ok}`);
  } catch (err) {
    trace('setAutostart failed ' + err.message);
    autostartCache = null;
  }
  store.updateSettings({ autostart: !!enabled });
  return { enabled: !!enabled, effective: readAutostart(), ok };
}

/* ──────────────────────────── 窗口 ──────────────────────────── */

function createWindow() {
  const b = initialBounds();
  win = new BrowserWindow({
    width: b.width,
    height: b.height,
    x: b.x,
    y: b.y,
    minWidth: Math.min(1080, screen.getPrimaryDisplay().workAreaSize.width - 16),
    minHeight: Math.min(680, screen.getPrimaryDisplay().workAreaSize.height - 16),
    show: false,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#F4F4F8',
    roundedCorners: true,
    autoHideMenuBar: true,
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: false,
      spellcheck: false,
      devTools: true,
      zoomFactor: 1,
    },
  });

  win.loadFile(path.join(__dirname, 'renderer', 'index.html'), { query: { v: app.getVersion() } });
  if (b.maximized) win.maximize();

  win.once('ready-to-show', () => {
    applySeniorZoom();
    if (!isHiddenStart) {
      win.show();
      win.focus();
    }
    if (isDebug) win.webContents.openDevTools({ mode: 'detach' });
  });

  win.on('maximize', () => win.webContents.send('win:state', { maximized: true }));
  win.on('unmaximize', () => win.webContents.send('win:state', { maximized: false }));
  win.on('resize', debounce(saveWindowState, 400));
  win.on('move', debounce(saveWindowState, 400));
  win.on('close', (e) => {
    saveWindowState();
    const keepAlive = store && store.get().settings.closeToTray !== false;
    if (!quitting && keepAlive) {
      e.preventDefault();
      win.hide();
      if (!firstHideToastShown) {
        firstHideToastShown = true;
        notify('日序已驻留托盘', '按 Ctrl + Alt + D 随时唤起；右键托盘图标可快速登记。');
      }
    } else if (!quitting) {
      quitting = true;
    }
  });
  win.on('closed', () => {
    win = null;
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
}

function debounce(fn, ms) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

function showWindow() {
  if (!win) return createWindow();
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

/* ──────────────────────────── 新建日程窗口（对话式） ──────────────────────────── */

function openAddWindow(payload = {}) {
  if (addWin && !addWin.isDestroyed()) {
    if (addWin.isMinimized()) addWin.restore();
    addWin.show();
    addWin.focus();
    addWin.webContents.send('add:reset', payload);
    return;
  }
  const point = screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint(point);
  const wa = display.workArea;
  const width = 620;
  const height = Math.min(820, Math.max(560, wa.height - 60));
  const x = Math.round(wa.x + (wa.width - width) / 2);
  const y = Math.round(wa.y + Math.max(16, (wa.height - height) * 0.22));

  addWin = new BrowserWindow({
    width,
    height,
    x,
    y,
    frame: false,
    backgroundColor: '#F3F4F8',
    roundedCorners: true,
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    show: false,
    hasShadow: true,
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: false,
    },
  });
  try {
    addWin.setAlwaysOnTop(true, 'floating');
  } catch (_) {}
  addWin.loadFile(path.join(__dirname, 'renderer', 'add.html'), { query: { date: payload.date || '', mode: payload.mode || '', t: Date.now() } });
  addWin.once('ready-to-show', () => {
    addWin.show();
    addWin.focus();
  });
  addWin.on('closed', () => {
    addWin = null;
  });
  addWin.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
}

function closeAddWindow() {
  if (addWin && !addWin.isDestroyed()) addWin.close();
}

function notify(title, body) {
  try {
    if (!Notification.isSupported()) return;
    const n = new Notification({ title, body, icon: path.join(__dirname, 'assets', 'icon.png'), silent: false });
    n.on('click', showWindow);
    n.show();
  } catch (_) {}
}

/* ──────────────────────────── 健康提醒 ──────────────────────────── */

const HEALTH_TIPS = [
  '已连续工作 30 分钟，建议起身活动并补充水分。',
  '建议远眺 20 秒，缓解视疲劳。',
  '请做几次肩颈放松，并调整坐姿。',
  '建议起身伸展，稍作休息。',
  '长时间伏案，请活动手腕与颈部。',
];
let healthTimer = null;
let healthIdx = 0;

function healthReminder(force = false) {
  if (!store) return null;
  if (!force && store.get().settings.health === false) return null;
  const hour = new Date().getHours();
  if (!force && (hour < 7 || hour >= 23)) return null;
  const tip = HEALTH_TIPS[healthIdx % HEALTH_TIPS.length];
  healthIdx += 1;
  if (win && !win.isDestroyed() && win.isFocused()) win.webContents.send('ui:health', { tip });
  else notify('健康提醒', tip);
  return tip;
}

function startHealthTimer() {
  if (healthTimer) clearInterval(healthTimer);
  healthTimer = null;
  if (!store || store.get().settings.health === false) return;
  healthTimer = setInterval(() => healthReminder(false), 30 * 60 * 1000);
}

/* ──────────────────────────── 托盘 ──────────────────────────── */

function buildTray() {
  const iconPath = path.join(__dirname, 'assets', 'tray.png');
  let img = nativeImage.createFromPath(iconPath);
  if (img.isEmpty()) img = nativeImage.createFromPath(path.join(__dirname, 'assets', 'icon.png'));
  tray = new Tray(img.resize({ width: 20, height: 20 }));
  tray.setToolTip('日序 Dayflow');
  refreshTray();
  tray.on('click', () => (win && win.isVisible() ? win.hide() : showWindow()));
  tray.on('double-click', showWindow);
}

function refreshTray() {
  if (!tray || !store) return;
  const state = store.get();
  const today = isoDate();
  const next = state.items
    .filter((x) => x.status !== 'done' && x.status !== 'dropped' && x.date >= today)
    .sort((a, b) => (a.date + (a.time || '99')).localeCompare(b.date + (b.time || '99')))[0];
  const overdue = state.items.filter((x) => x.status !== 'done' && x.date < today).length;
  tray.setToolTip(`日序 · 今日 ${store.briefing(today).dueToday.length} 项 · 逾期 ${overdue}`);

  const menu = Menu.buildFromTemplate([
    { label: '打开日序', click: showWindow },
    {
      label: next ? `下一项：${next.title.slice(0, 22)}` : '暂无待办',
      enabled: false,
    },
    { type: 'separator' },
    {
      label: '快速记录…',
      accelerator: 'CmdOrCtrl+Shift+N',
      click: () => openAddWindow({}),
    },
    {
      label: '今日简报',
      click: () => {
        const b = store.briefing(today);
        notify(
          `今日 ${b.dueToday.length} 项 · 逾期 ${b.overdue.length}`,
          [...b.dueToday, ...b.overdue].slice(0, 4).map((x) => `· ${x.title}`).join('\n') || '今日无到期事项'
        );
      },
    },
    { type: 'separator' },
    {
      label: '开机自启',
      type: 'checkbox',
      checked: readAutostart(),
      click: (item) => {
        setAutostart(item.checked);
        broadcast();
      },
    },
    { label: '开机自启设置…', click: () => { showWindow(); win?.webContents.send('ui:navigate', 'settings'); } },
    {
      label: '打开数据文件夹',
      click: () => shell.openPath(store.dir),
    },
    { type: 'separator' },
    { label: '退出日序', click: () => { quitting = true; app.quit(); } },
  ]);
  tray.setContextMenu(menu);
}

/* ──────────────────────────── 提醒 ──────────────────────────── */

let reminderTimer = null;
function startReminders() {
  const tick = () => {
    if (!store || !store.get().settings.notify) return;
    const state = store.get();
    const today = isoDate();
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    state.meta.notified = state.meta.notified || {};
    let changed = false;
    for (const item of state.items) {
      if (item.status === 'done' || item.status === 'dropped' || item.date !== today || !item.time) continue;
      const [h, m] = item.time.split(':').map(Number);
      const dueMin = h * 60 + m;
      const key = `${item.id}:${item.date}`;
      if (!state.meta.notified[key] && dueMin - nowMin >= 0 && dueMin - nowMin <= 25) {
        state.meta.notified[key] = now.toISOString();
        changed = true;
        notify(`25 分钟后 · ${item.title.slice(0, 26)}`, `${item.time} · ${item.notes || '请预留准备时间'}`);
      }
    }
    if (changed) store.save();
  };
  tick();
  reminderTimer = setInterval(tick, 60 * 1000);
}

/* ──────────────────────────── IPC ──────────────────────────── */

function registerIpc() {
  ipcMain.handle('app:bootstrap', () => sanitizedPayload());

  ipcMain.handle('add:open', (_e, payload) => {
    openAddWindow(payload || {});
    return true;
  });
  ipcMain.handle('add:context', () => {
    const s = store.get();
    return { domains: s.domains, today: isoDate(), week: todayContext(s).week, senior: !!s.settings.senior };
  });
  ipcMain.handle('add:save', (_e, payload = {}) => {
    const item = store.addItem(Object.assign({ source: 'user' }, payload));
    broadcast();
    refreshTray();
    return item;
  });
  ipcMain.handle('add:close', () => {
    closeAddWindow();
    return true;
  });

  ipcMain.handle('win:minimize', () => win?.minimize());
  ipcMain.handle('win:maximize', () => {
    if (!win) return false;
    if (win.isMaximized()) win.unmaximize();
    else win.maximize();
    return win.isMaximized();
  });
  ipcMain.handle('win:close', () => win?.close());
  ipcMain.handle('win:isMaximized', () => !!win?.isMaximized());

  ipcMain.handle('item:save', (_e, payload = {}) => {
    const exists = !!(payload.id && store.get().items.some((i) => i.id === payload.id));
    const item = exists ? store.updateItem(payload.id, payload) : store.addItem(payload);
    return item;
  });
  ipcMain.handle('item:delete', (_e, id) => {
    const ok = store.deleteItem(id, 'user');
    return ok;
  });
  ipcMain.handle('item:status', (_e, { id, status }) => {
    const item = store.setStatus(id, status, 'user');
    return item;
  });
  ipcMain.handle('checkin:toggle', (_e, { routineId, date }) => {
    const value = store.toggleCheckin(routineId, date);
    return value;
  });
  ipcMain.handle('track:update', (_e, { id, patch }) => {
    const track = store.updateTrack(id, patch);
    return track;
  });
  ipcMain.handle('track:delete', (_e, id) => store.deleteTrack(id, 'user'));
  ipcMain.handle('course:update', (_e, payload = {}) => store.updateCourse(payload.id, payload));
  ipcMain.handle('course:delete', (_e, id) => store.deleteCourse(id, 'user'));
  ipcMain.handle('track:add', (_e, payload) => {
    const track = store.addTrack(payload);
    return track;
  });
  ipcMain.handle('settings:update', (_e, patch = {}) => {
    if (patch.llm && typeof patch.llm.apiKey === 'string' && patch.llm.apiKey.includes('••••')) {
      delete patch.llm.apiKey;
    }
    const settings = store.updateSettings(patch);
    applySeniorZoom();
    if (patch.health !== undefined) startHealthTimer();
    if (patch.autoAdapt !== undefined) {
      applyAutoProfile();
      fitWindowToDisplay();
      broadcast();
    }
    return settings;
  });
  ipcMain.handle('agent:command', async (_e, { text, offline }) => {
    let result = null;
    if (!offline) {
      try {
        const { llmCommand } = require('./server/api');
        result = await llmCommand(store, text, store.get().settings);
      } catch (_) {}
    }
    const usedLlm = !!result;
    if (!result) result = parseCommand(store, text, {});
    const applied = applyOps(store, result.ops || [], 'agent');
    store.log({ actor: 'agent', action: 'command', detail: String(text).slice(0, 120) });
    store.changed('command');
    broadcast();
    refreshTray();
    return Object.assign({}, result, { applied, engine: usedLlm ? 'llm' : 'local' });
  });
  ipcMain.handle('agent:parse', (_e, { text }) => parseCommand(store, text, {}));
  ipcMain.handle('health:test', () => healthReminder(true));
  let voiceBusy = false;
  ipcMain.handle(
    'voice:listen',
    () =>
      new Promise((resolve) => {
        if (voiceBusy) {
          resolve({ error: 'busy' });
          return;
        }
        voiceBusy = true;
        const script = app.isPackaged ? path.join(process.resourcesPath, 'scripts', 'listen.ps1') : path.join(__dirname, 'scripts', 'listen.ps1');
        let proc;
        try {
          const psExe = path.join(process.env.SystemRoot || 'C:\\\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
          proc = spawn(psExe, ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script, '-Seconds', '8'], { windowsHide: true });
        } catch (err) {
          voiceBusy = false;
          resolve({ error: err.message });
          return;
        }
        let out = '';
        let errText = '';
        let done = false;
        const finish = (payload) => {
          if (done) return;
          done = true;
          voiceBusy = false;
          resolve(payload);
        };
        const timer = setTimeout(() => {
          try {
            proc.kill();
          } catch (_) {}
        }, 16000);
        proc.stdout.on('data', (d) => {
          out += d.toString('utf8');
        });
        proc.stderr.on('data', (d) => {
          errText += d.toString('utf8');
        });
        proc.on('error', (e) => {
          clearTimeout(timer);
          finish({ error: e.message });
        });
        proc.on('close', () => {
          clearTimeout(timer);
          finish({ text: out.trim(), error: errText.trim() });
        });
      })
  );
  ipcMain.handle('agent:log', () => store.get().log.slice(0, 80));
  ipcMain.handle('app:notify', (_e, { title, body }) => {
    notify(title || '日序', body || '');
    return true;
  });
  ipcMain.handle('app:autostart', (_e, { enabled }) => {
    const res = setAutostart(enabled);
    broadcast();
    return res;
  });
  ipcMain.handle('app:openDataDir', () => shell.openPath(store.dir));
  ipcMain.handle('app:openExternal', (_e, url) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
  });
  ipcMain.handle('app:export', async () => {
    const res = await dialog.showSaveDialog(win, {
      title: '导出日序数据',
      defaultPath: path.join(app.getPath('documents'), `dayflow-${isoDate()}.json`),
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    if (res.canceled || !res.filePath) return { canceled: true };
    fs.writeFileSync(res.filePath, JSON.stringify(store.get(), null, 2), 'utf8');
    return { path: res.filePath };
  });
  ipcMain.handle('app:copy', (_e, text) => {
    require('electron').clipboard.writeText(String(text || ''));
    return true;
  });
  ipcMain.handle('llm:test', async () => {
    const { llmCommand } = require('./server/api');
    const s = store.get().settings;
    if (!s.llm.apiKey) return { ok: false, error: '尚未填写 API Key' };
    const started = Date.now();
    const probe = await llmCommand(store, '今天有什么安排？', s);
    return probe
      ? { ok: true, ms: Date.now() - started, reply: probe.reply }
      : { ok: false, error: '调用失败：检查 Base URL / Key / 网络（也可先使用本地离线解析）' };
  });
  ipcMain.handle('api:info', () => ({ port: api ? api.port : 0, token: store.get().settings.api.token }));
  ipcMain.handle('app:quit', () => {
    quitting = true;
    app.quit();
  });
  ipcMain.handle('app:hardware', () => hardware);
  ipcMain.handle('app:reset', async () => {
    const res = await dialog.showMessageBox(win, {
      type: 'warning',
      buttons: ['取消', '重置为初始日程'],
      defaultId: 0,
      cancelId: 0,
      title: '重置数据',
      message: '将用初始的学期安排覆盖当前数据，确定吗？',
      detail: '当前数据会先备份到 backups 目录。',
    });
    if (res.response !== 1) return { ok: false };
    store.backup('before-reset');
    const { buildSeed } = require('./server/seed');
    const seed = buildSeed();
    const keep = store.get().settings;
    seed.settings = Object.assign({}, seed.settings, {
      api: keep.api,
      llm: keep.llm,
      autostart: keep.autostart,
      closeToTray: keep.closeToTray,
    });
    store.state = seed;
    store.saveNow();
    broadcast();
    refreshTray();
    return { ok: true };
  });
}

/* ──────────────────────────── 启动 ──────────────────────────── */

const singleLock = app.requestSingleInstanceLock();
if (!singleLock) {
  trace('another instance holds the lock, quitting');
  app.quit();
}
app.on('second-instance', () => {
  if (app.isReady()) showWindow();
});

app.whenReady().then(async () => {
  if (!singleLock) return;
  store = new Store(stateDir);
  store.load();
  if (!store.get().settings.api.token) {
    store.get().settings.api.token = require('crypto').randomBytes(12).toString('hex');
    store.saveNow();
  }
  store.on('change', () => {
    if (tray) refreshTray();
    broadcastSoon();
  });

  await detectHardware();
  applyAutoProfile();

  api = await startApi({ store });
  startHealthTimer();
  if (api && api.port) {
    const token = store.get().settings.api.token;
    const info = {
      app: 'dayflow',
      baseUrl: `http://127.0.0.1:${api.port}`,
      token,
      docs: `http://127.0.0.1:${api.port}/api/docs`,
      startedAt: new Date().toISOString(),
    };
    try {
      fs.writeFileSync(path.join(userDataDir, 'api-token.txt'), token, 'utf8');
      fs.writeFileSync(path.join(userDataDir, 'connection.json'), JSON.stringify(info, null, 2), 'utf8');
      const agentDir = path.join(__dirname, 'agent');
      fs.mkdirSync(agentDir, { recursive: true });
      fs.writeFileSync(path.join(agentDir, 'connection.json'), JSON.stringify(info, null, 2), 'utf8');
    } catch (_) {}
  }

  registerIpc();
  createWindow();
  buildTray();
  startReminders();
  setTimeout(refreshTray, 1500);

  try {
    globalShortcut.register('CommandOrControl+Alt+D', () => {
      if (win && win.isVisible() && win.isFocused()) win.hide();
      else showWindow();
    });
    globalShortcut.register('CommandOrControl+Alt+N', () => openAddWindow({}));
  } catch (_) {}

  powerMonitor.on('on-ac', () => {
    hardware.onBattery = false;
    broadcast();
  });
  powerMonitor.on('on-battery', () => {
    hardware.onBattery = true;
    broadcast();
  });
  screen.on('display-metrics-changed', debounce(async () => {
    await detectHardware();
    applyAutoProfile();
    fitWindowToDisplay();
    broadcast();
  }, 500));
});

app.on('before-quit', () => {
  quitting = true;
  if (store) store.saveNow();
  if (reminderTimer) clearInterval(reminderTimer);
  if (healthTimer) clearInterval(healthTimer);
  if (api && api.close) api.close();
  if (addWin && !addWin.isDestroyed()) addWin.destroy();
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  // 常驻托盘：窗口关闭时保持 API 可用
  if (process.platform !== 'darwin' && quitting) app.quit();
});
