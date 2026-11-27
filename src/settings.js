'use strict';

const api = window.deskPet;
const { appearance, animate, reset } = createScene(document.querySelector('#preview'));
const get = (id) => document.getElementById(id);
const labels = [
  ['head', '头部'],
  ['body', '上半身'],
  ['keyboard-hand', '键盘手'],
  ['mouse-hand', '鼠标手']
];
const rows = new Map();
const statuses = {
  off: ['已关闭', '开启后，按键分区和鼠标动作仅用于本地动画。'],
  on: ['已开启', '鼠标移动、点击、滚动和按键会驱动桌宠动作。'],
  paused: ['已暂停', '桌宠隐藏或系统锁屏时，输入联动会暂停。'],
  permission: ['等待授权', '在「隐私与安全性 → 输入监控」允许花影桌宠，返回后重新检测。若系统提示退出，请重启应用。'],
  unavailable: ['联动不可用', '输入联动需要 Windows 或 macOS。可关闭后重试。']
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
  get('open-permission').hidden = state.status !== 'permission';
  get('check-permission').hidden = state.status !== 'permission' && state.status !== 'unavailable';
  get('scale').value = state.scale;
  get('click-through').checked = state.clickThrough;
}

get('show-pet').addEventListener('click', () => action(api.showPet));
get('scale').addEventListener('change', (event) => action(() => api.setOptions({ scale: Number(event.target.value) })));
get('click-through').addEventListener('change', (event) => action(() => api.setOptions({ clickThrough: event.target.checked })));
get('reset-position').addEventListener('click', () => action(api.resetPosition));
get('open-permission').addEventListener('click', () => action(api.permissionSettings));
get('check-permission').addEventListener('click', () => action(api.checkPermission));
get('toggle').addEventListener('click', () => action(() => api.setOptions({ enabled: !latest.enabled })));
api.onState(update);
api.onActivity(animate);
api.onReset(reset);
api.getState().then(update);
