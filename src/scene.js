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
          <div class="head-frame">
            <img class="part head" data-part="head" alt="">
            <img class="part eye-blink" src="../assets/eye-blink.png" alt="">
          </div>
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
  const mouse = scene.querySelector('.mouse');
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

  function toDeskPoint(x, y) {
    const area = desk.getBoundingClientRect();
    return {
      x: (x - area.x) * desk.offsetWidth / area.width,
      y: (y - area.y) * desk.offsetHeight / area.height
    };
  }

  const leftRest = { x: 254, y: 297 };
  const rightRest = { x: 211, y: 297 };
  const leftHand = { ...armAt('.keyboard-arm', 244, 301), point: leftRest, rest: leftRest };
  const rightHand = { ...armAt('.keyboard-right-arm', 177, 301), point: rightRest, rest: rightRest };
  const typingHands = [leftHand, rightHand];
  const mouseHand = armAt('.mouse-arm', 45, 306);
  const mouseBounds = mouse.getBoundingClientRect();
  const mouseRest = toDeskPoint(mouseBounds.x + mouseBounds.width / 2, mouseBounds.bottom);
  mouseRest.y -= 14;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

  const keyReachTime = 86;
  const keyHoldTime = 85;
  const mouseTravelTime = 250;
  let keyTimer, idleTimer, poseFrame, activeKey, activeHand, mouseTravel;
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
    placeArm(leftHand, leftHand.point.x, leftHand.point.y);

    // Both right-hand poses share one shoulder and travel along one wrist path.
    const p = mouseProgress;
    const arm = p < .55 ? rightHand : mouseHand;
    const x = rightHand.point.x + (mouseRest.x + mouseX - rightHand.point.x) * p;
    const y = rightHand.point.y + (mouseRest.y + mouseY - rightHand.point.y) * p
      - Math.sin(Math.PI * p) * 24;
    placeArm(arm, x, y);
    rightHand.element.classList.toggle('pose-inactive', arm !== rightHand);
    mouseHand.element.classList.toggle('pose-inactive', arm !== mouseHand);
  }

  function easeProgress(motion, now) {
    const t = Math.min(1, Math.max(0, (now - motion.start) / motion.duration));
    return t * t * (3 - 2 * t);
  }

  function requestPoseFrame() {
    if (poseFrame == null) poseFrame = requestAnimationFrame(advancePose);
  }

  function advancePose(now) {
    poseFrame = null;
    for (const hand of typingHands) {
      const motion = hand.motion;
      if (!motion) continue;
      const p = easeProgress(motion, now);
      hand.point = {
        x: motion.from.x + (motion.to.x - motion.from.x) * p,
        y: motion.from.y + (motion.to.y - motion.from.y) * p - Math.sin(Math.PI * p) * motion.lift
      };
      if (p === 1) hand.motion = null;
    }
    if (mouseTravel) {
      const p = easeProgress(mouseTravel, now);
      mouseProgress = mouseTravel.from + (mouseTravel.to - mouseTravel.from) * p;
      if (p === 1) mouseTravel = null;
    }
    poseHands();
    if (mouseTravel || typingHands.some(hand => hand.motion)) requestPoseFrame();
  }

  function moveTypingHand(hand, point, duration) {
    if (hand.motion?.to.x === point.x && hand.motion?.to.y === point.y) return;
    const distance = Math.hypot(point.x - hand.point.x, point.y - hand.point.y);
    if (reducedMotion.matches || distance === 0) {
      hand.motion = null;
      hand.point = point;
      return;
    }
    hand.motion = {
      from: hand.point, to: point, start: performance.now(), duration,
      lift: Math.min(6, distance * .12)
    };
    requestPoseFrame();
  }

  function setMouseEngaged(value) {
    if (mouseEngaged === value) return;
    mouseEngaged = value;
    const target = value ? 1 : 0;
    if (reducedMotion.matches || mouseProgress === target) {
      mouseProgress = target;
      mouseTravel = null;
      poseHands();
      return;
    }
    mouseTravel = {
      from: mouseProgress, to: target, start: performance.now(),
      duration: mouseTravelTime * Math.abs(target - mouseProgress)
    };
    requestPoseFrame();
  }

  function clearKey() {
    clearTimeout(keyTimer);
    activeKey?.classList.remove('is-pressed');
    activeKey = null;
    activeHand = null;
  }

  function lightKey(key) {
    const previousHand = activeHand;
    clearKey();
    activeKey = key;
    key.classList.add('is-pressed');
    const bounds = key.getBoundingClientRect();
    const point = toDeskPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
    activeHand = mouseEngaged || point.x >= (leftRest.x + rightRest.x) / 2 ? leftHand : rightHand;
    if (previousHand && previousHand !== activeHand) moveTypingHand(previousHand, previousHand.rest, 125);
    const hand = activeHand;
    moveTypingHand(hand, point, keyReachTime);

    // Leave the key lit while the right hand is returning from the mouse.
    const reachTime = hand === rightHand ? Math.max(keyReachTime, mouseProgress * mouseTravelTime) : keyReachTime;
    keyTimer = setTimeout(() => {
      clearKey();
      moveTypingHand(hand, hand.rest, 125);
      poseHands();
    }, reachTime + keyHoldTime);
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
    cancelAnimationFrame(poseFrame);
    poseFrame = mouseTravel = null;
    for (const hand of typingHands) {
      hand.motion = null;
      hand.point = hand.rest;
    }
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
