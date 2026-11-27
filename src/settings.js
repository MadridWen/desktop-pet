'use strict';

const api = window.deskPet;
const { appearance, animate, reset } = createScene(document.querySelector('#preview'));
const get = (id) => document.getElementById(id);
const labels = [
  ['head', '头部'],
  ['body', '上半身'],
  ['keyboard-hand', '键盘左手'],
  ['keyboard-right-hand', '键盘右手'],
  ['mouse-hand', '鼠标右手']
];
const rows = new Map();
const statuses = {
  off: ['已关闭', '开启后，物理键位和鼠标动作仅用于本地动画。'],
  on: ['已开启', '鼠标移动、点击、滚动和按键会驱动桌宠动作。'],
  paused: ['已暂停', '桌宠隐藏或系统锁屏时，输入联动会暂停。'],
  permission: ['等待授权', '在「系统设置 → 隐私与安全性 → 输入监控」启用 Blossom Desk Pet，退出并重开应用后重新检测。'],
  'module-error': ['组件加载失败', '请检查安装包是否与电脑架构匹配。Mac 版请拖入「应用程序」后打开。'],
  'listener-error': ['监听启动失败', '请点「重新检测」。Mac 用户可以先检查系统的输入监控授权。'],
  unavailable: ['联动不可用', '输入联动需要 Windows 或 macOS。']
};

let latest;
let importing = false;

function report(error) {
  get('feedback').textContent = error || '';
}

async function action(job) {
  try {
    report('');
    const result = await job();
    if (result?.error) report(result.error);
  } catch (error) {
    console.error(error);
    report('操作未完成，请重试。');
  }
}

async function changeImage(part) {
  if (importing) return;
  importing = true;
  renderParts();
  await action(() => api.changeImage(part));
  importing = false;
  renderParts();
}

for (const [part, label] of labels) {
  const row = document.createElement('div');
  row.className = 'part-row';
  row.innerHTML = `
    <img class="thumb" alt="">
    <div class="part-info"><strong></strong><small></small></div>
    <button type="button" class="quiet replace">替换</button>
    <button type="button" class="quiet restore">恢复</button>`;
  row.querySelector('strong').textContent = label;
  const replace = row.querySelector('.replace');
  const restore = row.querySelector('.restore');
  replace.setAttribute('aria-label', '替换' + label);
  restore.setAttribute('aria-label', '恢复默认' + label);
  replace.addEventListener('click', () => changeImage(part));
  restore.addEventListener('click', () => action(() => api.resetImage(part)));
  rows.set(part, { image: row.querySelector('img'), detail: row.querySelector('small'), replace, restore });
  get('parts').append(row);
}

function renderParts() {
  if (!latest) return;
  for (const [part, row] of rows) {
    const custom = latest.custom.includes(part);
    const url = 'pet-image://part/' + part + '?v=' + latest.appearanceVersion;
    if (row.image.src !== url) row.image.src = url;
    row.detail.textContent = custom ? '自定义图片' : '默认素材';
    row.image.classList.toggle('mirror-thumb', part === 'mouse-hand' || (part === 'keyboard-hand' && custom));
    row.replace.disabled = importing;
    row.restore.hidden = !custom;
    row.restore.disabled = importing;
  }
}

function update(state) {
  latest = state;
  appearance(state);
  renderParts();
  const [label, detail] = statuses[state.status];
  get('status').dataset.status = state.status;
  get('status').textContent = label;
  get('input-detail').textContent = detail;
  get('toggle').textContent = state.enabled ? '暂停输入联动' : '开启输入联动';
  get('toggle').disabled = state.platform !== 'win32' && state.platform !== 'darwin';
  const retry = state.status === 'permission' || state.status === 'listener-error';
  get('open-permission').hidden = state.platform !== 'darwin' || !retry;
  get('check-permission').hidden = !retry;
  get('scale').value = state.scale;
  get('character-scale').value = state.characterScale;
  get('click-through').checked = state.clickThrough;
}

get('show-pet').addEventListener('click', () => action(api.showPet));
get('scale').addEventListener('change', (event) => action(() => api.setOptions({ scale: Number(event.target.value) })));
get('character-scale').addEventListener('change', (event) =>
  action(() => api.setOptions({ characterScale: Number(event.target.value) })));
get('click-through').addEventListener('change', (event) => action(() => api.setOptions({ clickThrough: event.target.checked })));
get('reset-position').addEventListener('click', () => action(api.resetPosition));
get('open-permission').addEventListener('click', () => action(api.permissionSettings));
get('check-permission').addEventListener('click', () => action(api.checkPermission));
get('toggle').addEventListener('click', () => action(() => api.setOptions({ enabled: !latest.enabled })));
api.onState(update);
api.onActivity(animate);
api.onReset(reset);
api.getState().then(update).catch(error => {
  console.error('Could not read settings:', error);
  get('status').textContent = '设置读取失败';
  get('input-detail').textContent = '无法读取应用状态，请退出桌宠后重新打开。';
});
