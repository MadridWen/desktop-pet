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
        <div class="arm keyboard-right-arm">
          <img class="part keyboard-right-hand" data-part="keyboard-right-hand" alt="">
        </div>
        <div class="arm mouse-arm pose-inactive">
          <img class="part mouse-hand" data-part="mouse-hand" alt="">
        </div>
      </div>
    </div>`;

  const scene = container.firstElementChild;
  const desk = scene.querySelector('.workstation');
  const keys = createDeskKeyboard(scene.querySelector('.keyboard'));
  const clickClasses = ['click-primary', 'click-secondary', 'click-other'];
  const mousePulses = new Map();
  const [centerX, centerY] = getComputedStyle(scene.querySelector('.avatar-core'))
    .transformOrigin.split(' ').map(parseFloat);

  function armAt(selector, x, y) {
    const element = scene.querySelector(selector);
    const [pivotX, pivotY] = getComputedStyle(element).transformOrigin.split(' ').map(parseFloat);
    return {
      element, x, y,
      shoulderX: element.offsetLeft + pivotX,
      shoulderY: element.offsetTop + pivotY
    };
  }

  const leftHand = armAt('.keyboard-arm', 244, 301);
  const rightHand = armAt('.keyboard-right-arm', 177, 301);
  const mouseHand = armAt('.mouse-arm', 45, 306);
  const leftRest = { x: 254, y: 297 };
  const rightRest = { x: 211, y: 297 };
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

  let keyTimer, idleTimer, travelFrame, activeKey, tap;
  let mouseEngaged = false, mouseProgress = 0, mouseX = 0, mouseY = 0;
  let figureScale = 1, version;

  function placeArm(arm, handX, handY) {
    const { element, shoulderX, shoulderY } = arm;
    const offsetX = (shoulderX - centerX) * (figureScale - 1);
    const offsetY = (shoulderY - centerY) * (figureScale - 1);
    const reachX = arm.x - shoulderX;
    const reachY = arm.y - shoulderY;
    const targetX = handX - shoulderX - offsetX;
    const targetY = handY - shoulderY - offsetY;
    const angle = Math.atan2(targetY, targetX) - Math.atan2(reachY, reachX);
    const length = Math.hypot(targetX, targetY) / Math.hypot(reachX, reachY);
    element.style.transform = `translate(${offsetX}px, ${offsetY}px) rotate(${angle}rad) scale(${length})`;
  }

  function poseHands() {
    placeArm(leftHand, leftRest.x + (tap?.arm === leftHand ? tap.dx : 0),
      leftRest.y + (tap?.arm === leftHand ? 3 : 0));

    // Both right-hand poses share one shoulder and travel along one wrist path.
    const p = mouseProgress;
    const arm = p < .55 ? rightHand : mouseHand;
    const dx = tap?.arm === rightHand ? tap.dx * (1 - p) : 0;
    const press = tap?.arm === rightHand ? 3 * (1 - p) : 0;
    const x = rightRest.x + (mouseHand.x + mouseX - rightRest.x) * p + dx;
    const y = rightRest.y + (mouseHand.y + mouseY - rightRest.y) * p
      - Math.sin(Math.PI * p) * 24 + press;
    placeArm(arm, x, y);
    rightHand.element.classList.toggle('pose-inactive', arm !== rightHand);
    mouseHand.element.classList.toggle('pose-inactive', arm !== mouseHand);
  }

  function setMouseEngaged(value) {
    if (mouseEngaged === value) return;
    mouseEngaged = value;
    cancelAnimationFrame(travelFrame);
    const target = value ? 1 : 0;
    if (reducedMotion.matches) {
      mouseProgress = target;
      poseHands();
      return;
    }
    const from = mouseProgress;
    const start = performance.now();
    const duration = 250 * Math.abs(target - from);
    const step = (now) => {
      const ratio = Math.min(1, (now - start) / Math.max(duration, 1));
      const ease = ratio * ratio * (3 - 2 * ratio);
      mouseProgress = from + (target - from) * ease;
      poseHands();
      if (ratio < 1) travelFrame = requestAnimationFrame(step);
    };
    travelFrame = requestAnimationFrame(step);
  }

  function clearKey() {
    clearTimeout(keyTimer);
    activeKey?.classList.remove('is-pressed');
    activeKey = null;
    tap = null;
  }

  function lightKey(key) {
    clearKey();
    activeKey = key;
    key.classList.add('is-pressed');
    const area = desk.getBoundingClientRect();
    const bounds = key.getBoundingClientRect();
    const x = (bounds.x + bounds.width / 2 - area.x) * desk.offsetWidth / area.width;
    const arm = mouseEngaged || x >= (leftRest.x + rightRest.x) / 2 ? leftHand : rightHand;
    const rest = arm === leftHand ? leftRest : rightRest;
    tap = { arm, dx: Math.max(-8, Math.min(8, (x - rest.x) * .45)) };
    keyTimer = setTimeout(() => {
      clearKey();
      poseHands();
    }, 115);
  }

  function pulseMouse(className, duration) {
    clearTimeout(mousePulses.get(className));
    scene.classList.add(className);
    mousePulses.set(className, setTimeout(() => {
      scene.classList.remove(className);
      mousePulses.delete(className);
    }, duration));
  }

  function animate({ key, clicks, scroll, moved, x, y }) {
    const pointerUsed = moved || clicks || scroll;
    if (pointerUsed) {
      mouseX = x * 4.5;
      mouseY = y * 2.5;
      scene.style.setProperty('--look-x', x * 1.8 + 'px');
      scene.style.setProperty('--look-y', y * 1.2 + 'px');
      scene.style.setProperty('--mouse-x', mouseX + 'px');
      scene.style.setProperty('--mouse-y', mouseY + 'px');
      setMouseEngaged(true);
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => setMouseEngaged(false), 720);
    } else if (key) {
      clearTimeout(idleTimer);
      setMouseEngaged(false);
    }

    const keycap = keys.get(key);
    if (keycap) lightKey(keycap);
    const mousePulseDuration = mouseProgress < .55 ? 360 : 145;
    clickClasses.forEach((name, index) => {
      if (clicks & (1 << index)) pulseMouse(name, mousePulseDuration);
    });
    if (scroll & 1) pulseMouse('scroll-up', 130);
    if (scroll & 2) pulseMouse('scroll-down', 130);
    poseHands();
  }

  function reset() {
    clearKey();
    clearTimeout(idleTimer);
    cancelAnimationFrame(travelFrame);
    mouseEngaged = false;
    mouseProgress = mouseX = mouseY = 0;
    for (const [name, timeout] of mousePulses) {
      clearTimeout(timeout);
      scene.classList.remove(name);
    }
    mousePulses.clear();
    for (const dimension of ['look-x', 'look-y', 'mouse-x', 'mouse-y']) {
      scene.style.removeProperty('--' + dimension);
    }
    poseHands();
  }

  const resize = () => {
    const scale = Math.min(container.clientWidth / scene.offsetWidth, container.clientHeight / scene.offsetHeight);
    scene.style.transform = 'translate(-50%, -50%) scale(' + scale + ')';
  };
  new ResizeObserver(resize).observe(container);
  resize();
  poseHands();

  return {
    animate,
    reset,
    appearance(state) {
      const scale = state.characterScale / 100;
      if (figureScale !== scale) {
        figureScale = scale;
        scene.style.setProperty('--character-scale', figureScale);
        poseHands();
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
