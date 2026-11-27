'use strict';

function createScene(container) {
  container.innerHTML = `
    <div class="scene" aria-hidden="true">
      <div class="workstation">
        <div class="desk-shadow"></div>
        <div class="avatar-core">
          <img class="part body" data-part="body" alt="">
        </div>
        <div class="avatar-core avatar-head">
          <img class="part head" data-part="head" alt="">
        </div>
        <div class="desk"></div>
        <div class="keyboard"></div>
        <div class="mouse-track"></div>
        <div class="mouse">
          <i class="mouse-left"></i><i class="mouse-right"></i><i class="mouse-wheel"></i>
        </div>
        <div class="arm keyboard-arm">
          <img class="part keyboard-hand" data-part="keyboard-hand" alt="">
        </div>
        <div class="arm mouse-arm">
          <img class="part mouse-hand" data-part="mouse-hand" alt="">
        </div>
      </div>
    </div>`;

  const scene = container.firstElementChild;
  createDeskKeyboard(scene.querySelector('.keyboard'));

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
    shift('look-x', mouseX * 1.8);
    shift('look-y', mouseY * 1.2);
    shift('mouse-x', mouseX * 4.5);
    shift('mouse-y', mouseY * 2.5);
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
      shift('hand-key', keys & 4 ? -2.5 : keys & 2 ? -1 : keys & 1 ? 1.5 : 0);
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

  const arms = [
    { element: scene.querySelector('.keyboard-arm'), contact: [309, 287] },
    { element: scene.querySelector('.mouse-arm'), contact: [45, 306] }
  ];
  const [centerX, centerY] = getComputedStyle(scene.querySelector('.avatar-core'))
    .transformOrigin.split(' ').map(parseFloat);

  function sizeCharacter(percent) {
    const scale = percent / 100;
    scene.style.setProperty('--character-scale', scale);

    // Move the shoulders with the torso and keep the fingertips over their devices.
    for (const { element, contact: [handX, handY] } of arms) {
      const [jointX, jointY] = getComputedStyle(element).transformOrigin.split(' ').map(parseFloat);
      const shoulderX = element.offsetLeft + jointX;
      const shoulderY = element.offsetTop + jointY;
      const offsetX = (shoulderX - centerX) * (scale - 1);
      const offsetY = (shoulderY - centerY) * (scale - 1);
      const reachX = handX - shoulderX;
      const reachY = handY - shoulderY;
      const newX = reachX - offsetX;
      const newY = reachY - offsetY;
      const angle = Math.atan2(newY, newX) - Math.atan2(reachY, reachX);
      const length = Math.hypot(newX, newY) / Math.hypot(reachX, reachY);
      element.style.setProperty('--shoulder-x', offsetX + 'px');
      element.style.setProperty('--shoulder-y', offsetY + 'px');
      element.style.setProperty('--shoulder-angle', angle + 'rad');
      element.style.setProperty('--reach', length);
    }
  }

  let version, characterSize;
  const resize = () => {
    const scale = Math.min(container.clientWidth / scene.offsetWidth, container.clientHeight / scene.offsetHeight);
    scene.style.transform = 'translate(-50%, -50%) scale(' + scale + ')';
  };
  new ResizeObserver(resize).observe(container);
  resize();

  return {
    animate,
    reset,
    appearance(state) {
      if (characterSize !== state.characterScale) {
        characterSize = state.characterScale;
        sizeCharacter(characterSize);
      }
      if (state.appearanceVersion === version) return;
      version = state.appearanceVersion;
      for (const part of scene.querySelectorAll('[data-part]')) {
        const name = part.dataset.part;
        part.classList.toggle('custom', state.custom.includes(name));
        part.src = 'pet-image://part/' + name + '?v=' + version;
      }
    }
  };
}
