// electron/preload.ts
console.log("Preload script is loading..."); // Keep this for debugging

import { ipcRenderer, contextBridge } from "electron";

// IMPORTANT: Combine ALL exposures for 'electron' into a single call.
// Also, correctly terminate the 'ipcRenderer' exposure with a semicolon.

// Expose ipcRenderer itself if you need raw ipcRenderer methods in the renderer.
// This is typically less secure than exposing specific functions like electron.openDirectory.
// If you only need invoke for specific functions, you might not need to expose ipcRenderer directly.
// For this project, let's keep it clean and only expose what's needed for 'electron'.
contextBridge.exposeInMainWorld("ipcRendererApi", {
  // Renamed to avoid conflicts and imply API surface
  on(...args: Parameters<typeof ipcRenderer.on>) {
    const [channel, listener] = args;
    return ipcRenderer.on(channel, (event, ...args) =>
      listener(event, ...args)
    );
  },
  off(...args: Parameters<typeof ipcRenderer.off>) {
    const [channel, ...omit] = args;
    return ipcRenderer.off(channel, ...omit);
  },
  send(...args: Parameters<typeof ipcRenderer.send>) {
    const [channel, ...omit] = args;
    return ipcRenderer.send(channel, ...omit);
  },
  invoke(...args: Parameters<typeof ipcRenderer.invoke>) {
    const [channel, ...omit] = args;
    return ipcRenderer.invoke(channel, ...omit);
  },
}); // <--- ENSURE THIS IS A SEMICOLON!

// Expose our specific Electron APIs under 'window.electron'
contextBridge.exposeInMainWorld("electron", {
  openDirectory: async (): Promise<string | null> => {
    return ipcRenderer.invoke("dialog:openDirectory");
  },
  readDirectory: async (dirPath: string): Promise<string[]> => {
    return ipcRenderer.invoke("fs:readDirectory", dirPath);
  },
  readFile: async (filePath: string): Promise<string | null> => {
    return ipcRenderer.invoke("fs:readFile", filePath);
  },
  writeFile: async (filePath: string, content: string): Promise<boolean> => {
    return ipcRenderer.invoke("fs:writeFile", filePath, content);
  },
  deleteFile: async (filePath: string): Promise<boolean> => {
    console.log("[Preload] Invokin fs:deleteFile for:", filePath);
    return ipcRenderer.invoke("fs:deleteFile", filePath);
  },
  renameFile: async (oldPath: string, newPath: string): Promise<boolean> => {
    console.log(
      "[Preload] Invoking fs:renameFile from:",
      oldPath,
      "to:",
      newPath
    );
    return ipcRenderer.invoke("fs:renameFile", oldPath, newPath);
  },
});

// Type definition for the exposed API
// IMPORTANT: Combine all declarations for 'window.electron' into one.
declare global {
  interface Window {
    ipcRendererApi: {
      // Updated type for ipcRendererApi if you keep it
      on: typeof ipcRenderer.on;
      off: typeof ipcRenderer.off;
      send: typeof ipcRenderer.send;
      invoke: typeof ipcRenderer.invoke;
    };
    electron: {
      openDirectory: () => Promise<string | null>;
      readDirectory: (dirPath: string) => Promise<string[]>;
      readFile: (filePath: string) => Promise<string | null>;
      writeFile: (filePath: string, content: string) => Promise<boolean>;
      deleteFile: (filePath: string) => Promise<boolean>;
      renameFile: (oldPath: string, newPath: string) => Promise<boolean>;
    };
  }
}

console.log("Electron API exposed in preload script."); // Keep this for debugging
