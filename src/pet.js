'use strict';

const { appearance, animate, reset } = createScene(document.querySelector('#stage'));
window.deskPet.onState(appearance);
window.deskPet.getState().then(appearance);
window.deskPet.onActivity(animate);
window.deskPet.onReset(reset);
document.querySelector('#settings').addEventListener('click', () => window.deskPet.openSettings());
