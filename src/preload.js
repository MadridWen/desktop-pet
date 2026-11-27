'use strict';

const { contextBridge, ipcRenderer } = require('electron');
const listen = (channel, callback) => {
  ipcRenderer.on(channel, (_event, data) => callback(data));
};

contextBridge.exposeInMainWorld('deskPet', Object.freeze({
  getState: () => ipcRenderer.invoke('pet:get-state'),
  onState: (callback) => listen('pet:state', callback),
  onActivity: (callback) => listen('pet:activity', callback),
  onReset: (callback) => listen('pet:reset', callback),
  openSettings: () => ipcRenderer.invoke('pet:open-settings'),
  setOptions: (options) => ipcRenderer.invoke('pet:set-options', options),
  changeImage: (part) => ipcRenderer.invoke('pet:change-image', part),
  resetImage: (part) => ipcRenderer.invoke('pet:reset-image', part),
  permissionSettings: () => ipcRenderer.invoke('pet:permission-settings'),
  checkPermission: () => ipcRenderer.invoke('pet:check-permission'),
  showPet: () => ipcRenderer.invoke('pet:show'),
  resetPosition: () => ipcRenderer.invoke('pet:reset-position')
}));
