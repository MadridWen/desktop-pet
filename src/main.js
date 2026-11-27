'use strict';

const { app, BrowserWindow, Menu, Tray, dialog, ipcMain, nativeImage, powerMonitor, protocol, screen, shell } =
  require('electron');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');

const parts = ['head', 'body', 'keyboard-hand', 'keyboard-right-hand', 'mouse-hand'];
const baseSize = [338, 388];
const scales = [75, 100, 125, 150];
const characterScales = [80, 90, 100, 110, 120];
const entry = (file) => path.join(__dirname, file);
const asset = (name) => path.join(__dirname, '..', 'assets', name + '.png');
const nativePath = app.isPackaged
  ? path.join(process.resourcesPath, 'input.node')
  : path.join(__dirname, '..', 'native', 'build', 'Release', 'input.node');

let pet, settings, tray, dataDir, config, input, timer, moveTimer, lastPoint;
let choosing = false;
let quitting = false;
let locked = false;
let status = 'off';
let appearanceVersion = Date.now();

app.setName('Blossom Desk Pet');
protocol.registerSchemesAsPrivileged([
  { scheme: 'pet-image', privileges: { standard: true, secure: true } }
]);

function loadConfig() {
  let saved;
  try {
    saved = JSON.parse(fs.readFileSync(path.join(dataDir, 'settings.json'), 'utf8'));
  } catch {
    saved = {};
  }
  const position = saved?.position;
  return {
    onboarded: saved?.onboarded === true,
    enabled: saved?.enabled === true,
    clickThrough: saved?.clickThrough === true,
    scale: scales.includes(saved?.scale) ? saved.scale : 100,
    characterScale: characterScales.includes(saved?.characterScale) ? saved.characterScale : 100,
    position: Number.isInteger(position?.x) && Number.isInteger(position?.y) ? position : null
  };
}

function saveConfig() {
  const file = path.join(dataDir, 'settings.json');
  try {
    fs.writeFileSync(file + '.tmp', JSON.stringify(config, null, 2));
    fs.renameSync(file + '.tmp', file);
  } catch (error) {
    console.error('Could not save settings:', error.message);
  }
}

function partFile(part) {
  return path.join(dataDir, part + '.png');
}

function state() {
  return {
    enabled: config.enabled,
    clickThrough: config.clickThrough,
    scale: config.scale,
    characterScale: config.characterScale,
    status,
    platform: process.platform,
    custom: parts.filter((part) => fs.existsSync(partFile(part))),
    appearanceVersion
  };
}

function send(window, channel, value) {
  if (window && !window.isDestroyed()) window.webContents.send(channel, value);
}

function syncWindows() {
  const snapshot = state();
  send(pet, 'pet:state', snapshot);
  send(settings, 'pet:state', snapshot);
  refreshTray();
}

function poll() {
  const activity = input.takeActivity();
  const point = screen.getCursorScreenPoint();
  const area = screen.getDisplayNearestPoint(point).bounds;
  const moved = lastPoint && (point.x !== lastPoint.x || point.y !== lastPoint.y);
  lastPoint = point;

  if (!activity.active) {
    stopListening();
    status = process.platform === 'darwin' && !input.hasPermission() ? 'permission' : 'listener-error';
    syncWindows();
    return;
  }

  if (moved || activity.key || activity.clicks || activity.scroll) {
    const normalize = (value, span) => Math.max(-1, Math.min(1, (2 * value / span) - 1));
    const packet = {
      key: activity.key,
      clicks: activity.clicks,
      scroll: activity.scroll,
      moved: Boolean(moved),
      x: normalize(point.x - area.x, area.width),
      y: normalize(point.y - area.y, area.height)
    };
    send(pet, 'pet:activity', packet);
    send(settings, 'pet:activity', packet);
  }
}

function stopListening() {
  if (timer) clearInterval(timer);
  timer = null;
  lastPoint = null;
  input?.stop();
  send(pet, 'pet:reset');
  send(settings, 'pet:reset');
}

function updateListening(request = false) {
  if (!config.enabled || locked || !pet?.isVisible()) {
    stopListening();
    status = config.enabled ? 'paused' : 'off';
  } else if (!['win32', 'darwin'].includes(process.platform)) {
    status = 'unavailable';
  } else if (!input) {
    status = 'module-error';
  } else {
    if (request && !input.hasPermission()) input.requestPermission();
    if (!input.hasPermission()) {
      stopListening();
      status = 'permission';
    } else if (timer || input.start()) {
      status = 'on';
      if (!timer) {
        lastPoint = screen.getCursorScreenPoint();
        timer = setInterval(poll, 16);
      }
    } else {
      status = 'listener-error';
    }
  }
  syncWindows();
}

function petBounds() {
  const [width, height] = baseSize.map((size) => Math.round(size * config.scale / 100));
  const box = config.position;
  const display = box
    ? screen.getDisplayMatching({ ...box, width, height })
    : screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  const area = display.workArea;
  return {
    x: Math.max(area.x, Math.min(box?.x ?? area.x + area.width - width - 22, area.x + area.width - width)),
    y: Math.max(area.y, Math.min(box?.y ?? area.y + area.height - height - 18, area.y + area.height - height)),
    width,
    height
  };
}

function rememberPosition() {
  if (quitting || !pet || pet.isDestroyed()) return;
  const { x, y } = pet.getBounds();
  config.position = { x, y };
  saveConfig();
}

function commonOptions() {
  return {
    title: '花影桌宠',
    icon: asset('icon'),
    show: false,
    webPreferences: {
      preload: entry('preload.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false
    }
  };
}

function lockNavigation(window) {
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event) => event.preventDefault());
}

function updateSettingsLayer() {
  if (!settings || settings.isDestroyed() || quitting) return;
  const settingsVisible = settings.isVisible() && !settings.isMinimized();
  let needsFloating = settingsVisible && choosing;
  if (settingsVisible && pet && !pet.isDestroyed() && pet.isVisible()) {
    const a = settings.getBounds();
    const b = pet.getBounds();
    const overlaps = a.x < b.x + b.width && b.x < a.x + a.width &&
      a.y < b.y + b.height && b.y < a.y + a.height;
    needsFloating ||= overlaps;
  }

  if (settings.isAlwaysOnTop() === needsFloating) return;
  // Keep the pet floating. Raise the settings window separately when it needs to be reachable.
  settings.setAlwaysOnTop(needsFloating, 'floating', 1);
  if (needsFloating) settings.moveTop();
}

function createPet() {
  pet = new BrowserWindow({
    ...commonOptions(),
    ...petBounds(),
    frame: false,
    transparent: true,
    hasShadow: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    roundedCorners: false
  });
  lockNavigation(pet);
  pet.setAlwaysOnTop(true, 'floating');
  if (process.platform === 'darwin') {
    pet.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true, skipTransformProcessType: true });
  }
  pet.setIgnoreMouseEvents(config.clickThrough);
  pet.on('move', () => {
    clearTimeout(moveTimer);
    moveTimer = setTimeout(rememberPosition, 250);
    updateSettingsLayer();
  });
  pet.on('resize', updateSettingsLayer);
  pet.on('close', (event) => {
    if (quitting) return;
    event.preventDefault();
    pet.hide();
  });
  for (const event of ['hide', 'show']) {
    pet.on(event, () => {
      updateSettingsLayer();
      updateListening();
    });
  }
  pet.once('ready-to-show', () => {
    pet.showInactive();
    if (!config.onboarded) showSettings();
  });
  pet.loadFile(entry('pet.html'));
}

function showSettings() {
  if (settings && !settings.isDestroyed()) {
    settings.show();
    settings.focus();
    return;
  }
  settings = new BrowserWindow({
    ...commonOptions(),
    width: 760,
    height: 688,
    minWidth: 580,
    minHeight: 580,
    maximizable: false,
    autoHideMenuBar: true,
    backgroundColor: '#171018'
  });
  lockNavigation(settings);
  settings.once('ready-to-show', () => settings?.show());
  for (const event of ['show', 'hide', 'move', 'resize', 'minimize', 'restore']) {
    settings.on(event, updateSettingsLayer);
  }
  settings.on('focus', () => {
    if (status === 'permission') updateListening();
  });
  settings.on('closed', () => {
    settings = null;
    if (!config.onboarded) {
      config.onboarded = true;
      saveConfig();
    }
  });
  settings.loadFile(entry('settings.html'));
}

function refreshTray() {
  if (!tray || quitting) return;
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '桌宠设置', click: showSettings },
    { label: pet?.isVisible() ? '隐藏桌宠' : '显示桌宠', click: () => {
      if (pet.isVisible()) pet.hide();
      else pet.showInactive();
    } },
    { label: config.enabled ? '暂停输入联动' : '开启输入联动', click: () => {
      changeOptions({ enabled: !config.enabled }, true);
      if (config.enabled && status !== 'on') showSettings();
    } },
    { label: '鼠标穿透', type: 'checkbox', checked: config.clickThrough, click: (item) =>
      changeOptions({ clickThrough: item.checked }) },
    { type: 'separator' },
    { label: '退出花影桌宠', click: () => app.quit() }
  ]));
}

function changeOptions(options, requestPermission = false) {
  const { enabled, clickThrough, scale, characterScale } = options || {};
  if (typeof enabled === 'boolean') config.enabled = enabled;
  if (typeof clickThrough === 'boolean') {
    config.clickThrough = clickThrough;
    pet?.setIgnoreMouseEvents(clickThrough);
  }
  if (scales.includes(scale) && scale !== config.scale) {
    config.scale = scale;
    config.position = pet?.getBounds() ?? config.position;
    pet?.setBounds(petBounds());
    rememberPosition();
  }
  if (characterScales.includes(characterScale)) config.characterScale = characterScale;
  config.onboarded = true;
  saveConfig();
  if (typeof enabled === 'boolean') updateListening(requestPermission && enabled);
  else syncWindows();
  return state();
}

async function selectImage(part) {
  if (choosing) return { error: '已有图片选择窗口打开。' };
  choosing = true;
  try {
    updateSettingsLayer();
    const result = await dialog.showOpenDialog(settings, {
      title: '选择桌宠部件图片',
      properties: ['openFile'],
      filters: [{ name: 'PNG / JPEG', extensions: ['png', 'jpg', 'jpeg'] }]
    });
    if (result.canceled) return {};
    const [file] = result.filePaths;
    if ((await fsp.stat(file)).size > 12 * 1024 * 1024) {
      return { error: '图片需小于 12 MB。' };
    }
    const buffer = await fsp.readFile(file);
    const png = buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    const jpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    if (!png && !jpeg) return { error: '请选择有效的 PNG 或 JPEG 图片。' };

    const image = nativeImage.createFromBuffer(buffer);
    if (image.isEmpty()) return { error: '无法读取这张图片。' };
    const { width, height } = image.getSize();
    const reduced = Math.max(width, height) > 1024
      ? image.resize(width >= height ? { width: 1024 } : { height: 1024 })
      : image;
    const destination = partFile(part);
    await fsp.writeFile(destination + '.tmp', reduced.toPNG());
    await fsp.rename(destination + '.tmp', destination);
    appearanceVersion++;
    syncWindows();
    return {};
  } catch (error) {
    console.error('Could not import image:', error.message);
    return { error: '图片保存失败，请重试。' };
  } finally {
    choosing = false;
    updateSettingsLayer();
  }
}

function route(channel, windows, callback) {
  ipcMain.handle(channel, (event, ...args) => {
    if (!windows().some((window) => window?.webContents === event.sender) ||
        event.senderFrame !== event.sender.mainFrame) throw new Error('Unknown window');
    return callback(...args);
  });
}

function startApp() {
  if (process.platform === 'darwin') app.setActivationPolicy('accessory');
  dataDir = path.join(app.getPath('userData'), 'appearance');
  fs.mkdirSync(dataDir, { recursive: true });
  config = loadConfig();
  try {
    input = require(nativePath);
  } catch (error) {
    console.error('Native input unavailable:', error.message);
  }

  protocol.handle('pet-image', async (request) => {
    const url = new URL(request.url);
    const part = url.pathname.slice(1);
    if (url.hostname !== 'part' || !parts.includes(part)) return new Response(null, { status: 404 });
    const file = partFile(part);
    const data = await fsp.readFile(file).catch((error) => {
      if (error.code !== 'ENOENT') console.error('Could not read appearance:', error.message);
      return fsp.readFile(asset(part));
    });
    return new Response(data, { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' } });
  });

  Menu.setApplicationMenu(null);
  const trayImage = nativeImage.createFromPath(asset(process.platform === 'darwin' ? 'tray' : 'tray-win')).resize({ width: 20, height: 20 });
  if (process.platform === 'darwin') trayImage.setTemplateImage(true);
  tray = new Tray(trayImage);
  tray.setToolTip('花影桌宠');
  tray.on('double-click', showSettings);
  createPet();
  refreshTray();

  route('pet:get-state', () => [pet, settings], state);
  route('pet:open-settings', () => [pet], showSettings);
  route('pet:set-options', () => [settings], (options) => changeOptions(options, true));
  route('pet:change-image', () => [settings], (part) => parts.includes(part) ? selectImage(part) : {});
  route('pet:reset-image', () => [settings], async (part) => {
    if (!parts.includes(part)) return {};
    try {
      await fsp.rm(partFile(part), { force: true });
      appearanceVersion++;
      syncWindows();
      return {};
    } catch {
      return { error: '无法恢复默认图片，请重试。' };
    }
  });
  route('pet:permission-settings', () => [settings], () => {
    if (process.platform === 'darwin') {
      return shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_ListenEvent');
    }
  });
  route('pet:check-permission', () => [settings], () => updateListening());
  route('pet:show', () => [settings], () => pet.showInactive());
  route('pet:reset-position', () => [settings], () => {
    config.position = null;
    pet.setBounds(petBounds());
    rememberPosition();
    pet.showInactive();
  });

  const setLocked = (value) => {
    locked = value;
    updateListening();
  };
  powerMonitor.on('lock-screen', () => setLocked(true));
  powerMonitor.on('unlock-screen', () => setLocked(false));
  powerMonitor.on('suspend', () => setLocked(true));
  powerMonitor.on('resume', () => setLocked(false));
  screen.on('display-removed', () => pet?.setBounds(petBounds()));
  screen.on('display-metrics-changed', (_event, _display, metrics) => {
    if (metrics.includes('workArea') || metrics.includes('bounds')) pet?.setBounds(petBounds());
  });
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (tray) showSettings();
  });
  app.on('activate', () => {
    if (tray) showSettings();
  });
  app.on('window-all-closed', () => {});
  app.on('before-quit', () => {
    clearTimeout(moveTimer);
    rememberPosition();
    quitting = true;
    stopListening();
  });
  app.whenReady().then(startApp).catch((error) => {
    console.error(error);
    app.quit();
  });
}
