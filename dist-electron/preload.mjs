"use strict";
const electron = require("electron");
console.log("Preload script is loading...");
electron.contextBridge.exposeInMainWorld("ipcRendererApi", {
  // Renamed to avoid conflicts and imply API surface
  on(...args) {
    const [channel, listener] = args;
    return electron.ipcRenderer.on(
      channel,
      (event, ...args2) => listener(event, ...args2)
    );
  },
  off(...args) {
    const [channel, ...omit] = args;
    return electron.ipcRenderer.off(channel, ...omit);
  },
  send(...args) {
    const [channel, ...omit] = args;
    return electron.ipcRenderer.send(channel, ...omit);
  },
  invoke(...args) {
    const [channel, ...omit] = args;
    return electron.ipcRenderer.invoke(channel, ...omit);
  }
});
electron.contextBridge.exposeInMainWorld("electron", {
  openDirectory: async () => {
    return electron.ipcRenderer.invoke("dialog:openDirectory");
  },
  readDirectory: async (dirPath) => {
    return electron.ipcRenderer.invoke("fs:readDirectory", dirPath);
  },
  readFile: async (filePath) => {
    return electron.ipcRenderer.invoke("fs:readFile", filePath);
  },
  writeFile: async (filePath, content) => {
    return electron.ipcRenderer.invoke("fs:writeFile", filePath, content);
  },
  deleteFile: async (filePath) => {
    console.log("[Preload] Invokin fs:deleteFile for:", filePath);
    return electron.ipcRenderer.invoke("fs:deleteFile", filePath);
  },
  renameFile: async (oldPath, newPath) => {
    console.log(
      "[Preload] Invoking fs:renameFile from:",
      oldPath,
      "to:",
      newPath
    );
    return electron.ipcRenderer.invoke("fs:renameFile", oldPath, newPath);
  }
});
console.log("Electron API exposed in preload script.");
