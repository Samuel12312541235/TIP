'use strict';

const { contextBridge, ipcRenderer } = require('electron');

const listeners = new Map();

function on(channel, cb) {
  const wrapped = (_event, payload) => cb(payload);
  ipcRenderer.on(channel, wrapped);
  listeners.set(cb, { channel, wrapped });
  return () => {
    const rec = listeners.get(cb);
    if (rec) ipcRenderer.removeListener(rec.channel, rec.wrapped);
    listeners.delete(cb);
  };
}

contextBridge.exposeInMainWorld('dayflow', {
  bootstrap: () => ipcRenderer.invoke('app:bootstrap'),
  openAdd: (payload) => ipcRenderer.invoke('add:open', payload || {}),
  addContext: () => ipcRenderer.invoke('add:context'),
  addSave: (item) => ipcRenderer.invoke('add:save', item),
  addClose: () => ipcRenderer.invoke('add:close'),
  onAddReset: (cb) => on('add:reset', cb),
  voiceListen: () => ipcRenderer.invoke('voice:listen'),
  healthTest: () => ipcRenderer.invoke('health:test'),
  onHealth: (cb) => on('ui:health', cb),
  hardware: () => ipcRenderer.invoke('app:hardware'),
  saveItem: (payload) => ipcRenderer.invoke('item:save', payload),
  deleteItem: (id) => ipcRenderer.invoke('item:delete', id),
  setStatus: (id, status) => ipcRenderer.invoke('item:status', { id, status }),
  toggleCheckin: (routineId, date) => ipcRenderer.invoke('checkin:toggle', { routineId, date }),
  updateTrack: (id, patch) => ipcRenderer.invoke('track:update', { id, patch }),
  deleteTrack: (id) => ipcRenderer.invoke('track:delete', id),
  updateCourse: (payload) => ipcRenderer.invoke('course:update', payload),
  deleteCourse: (id) => ipcRenderer.invoke('course:delete', id),
  addTrack: (payload) => ipcRenderer.invoke('track:add', payload),
  updateSettings: (patch) => ipcRenderer.invoke('settings:update', patch),
  command: (text, offline) => ipcRenderer.invoke('agent:command', { text, offline }),
  parse: (text) => ipcRenderer.invoke('agent:parse', { text }),
  getLog: () => ipcRenderer.invoke('agent:log'),
  apiInfo: () => ipcRenderer.invoke('api:info'),
  notify: (title, body) => ipcRenderer.invoke('app:notify', { title, body }),
  setAutostart: (enabled) => ipcRenderer.invoke('app:autostart', { enabled }),
  openDataDir: () => ipcRenderer.invoke('app:openDataDir'),
  openExternal: (url) => ipcRenderer.invoke('app:openExternal', url),
  exportData: () => ipcRenderer.invoke('app:export'),
  copy: (text) => ipcRenderer.invoke('app:copy', text),
  testLlm: () => ipcRenderer.invoke('llm:test'),
  resetData: () => ipcRenderer.invoke('app:reset'),
  quit: () => ipcRenderer.invoke('app:quit'),
  minimize: () => ipcRenderer.invoke('win:minimize'),
  maximize: () => ipcRenderer.invoke('win:maximize'),
  close: () => ipcRenderer.invoke('win:close'),
  isMaximized: () => ipcRenderer.invoke('win:isMaximized'),
  onState: (cb) => on('state:changed', cb),
  onWinState: (cb) => on('win:state', cb),
  onQuickAdd: (cb) => on('ui:quick-add', cb),
  onNavigate: (cb) => on('ui:navigate', cb),
});
