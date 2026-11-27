'use strict';

function createScene(container) {
  container.innerHTML = `
    <div class="scene" aria-hidden="true">
      <div class="desk-shadow"></div>
      <img class="part body" data-part="body" alt="">
      <img class="part head" data-part="head" alt="">
      <div class="desk"></div>
      <div class="keyboard"></div>
      <div class="mouse-track"></div>
      <div class="mouse">
        <i class="mouse-left"></i><i class="mouse-right"></i><i class="mouse-wheel"></i>
      </div>
      <img class="part keyboard-hand" data-part="keyboard-hand" alt="">
      <img class="part mouse-hand" data-part="mouse-hand" alt="">
    </div>`;

  const scene = container.firstElementChild;
  const keyboard = scene.querySelector('.keyboard');
  for (let rowIndex = 0; rowIndex < 4; rowIndex++) {
    const row = document.createElement('div');
    row.className = 'key-row';
    const zones = rowIndex === 3 ? [1, 1, 8, 4, 4] : [1, 1, 1, 2, 2, 2, 4, 4, 4, 4];
    for (const zone of zones) {
      const key = document.createElement('i');
      key.className = 'key zone-' + zone;
      row.append(key);
    }
    keyboard.append(row);
  }

  const zoneClasses = ['key-left', 'key-middle', 'key-right', 'key-space'];
  const clickClasses = ['click-primary', 'click-secondary', 'click-other'];
  const timers = new Map();

  function pulse(className, duration) {
    clearTimeout(timers.get(className));
    scene.classList.add(className);
    timers.set(className, setTimeout(() => {
      scene.classList.remove(className);
      timers.delete(className);
    }, duration));
  }

  function shift(name, amount) {
    scene.style.setProperty('--' + name, amount.toFixed(2) + 'px');
  }

  function point(mouseX, mouseY) {
    shift('look-x', mouseX * 5);
    shift('look-y', mouseY * 3);
    shift('mouse-x', mouseX * 10);
    shift('mouse-y', mouseY * 6);
  }

  function animate({ keys, clicks, scroll, moved, x, y }) {
    if (moved || clicks || scroll) point(x, y);
    zoneClasses.forEach((name, index) => {
      if (keys & (1 << index)) pulse(name, 145);
    });
    clickClasses.forEach((name, index) => {
      if (clicks & (1 << index)) pulse(name, 145);
    });
    if (keys) {
      shift('hand-key', keys & 4 ? 13 : keys & 2 ? 6 : keys & 1 ? -5 : 3);
      pulse('key-tap', 145);
      clearTimeout(timers.get('hand-key'));
      timers.set('hand-key', setTimeout(() => {
        shift('hand-key', 0);
        timers.delete('hand-key');
      }, 200));
    }
    if (scroll & 1) pulse('scroll-up', 130);
    if (scroll & 2) pulse('scroll-down', 130);
  }

  function reset() {
    for (const [name, timeout] of timers) {
      clearTimeout(timeout);
      scene.classList.remove(name);
    }
    timers.clear();
    point(0, 0);
    shift('hand-key', 0);
  }

  let version;
  const resize = () => {
    const scale = Math.min(container.clientWidth / 338, container.clientHeight / 312);
    scene.style.transform = 'translate(-50%, -50%) scale(' + scale + ')';
  };
  new ResizeObserver(resize).observe(container);
  resize();

  return {
    animate,
    reset,
    appearance(state) {
      if (state.appearanceVersion === version) return;
      version = state.appearanceVersion;
      for (const part of scene.querySelectorAll('[data-part]')) {
        part.src = 'pet-image://part/' + part.dataset.part + '?v=' + version;
      }
    }
  };
}
