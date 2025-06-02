import { app, BrowserWindow, ipcMain, dialog } from "electron";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { promises } from "fs";
createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
process.env.APP_ROOT = path.join(__dirname, "..");
const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, "public") : RENDERER_DIST;
let win;
function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, "electron-vite.svg"),
    webPreferences: {
      preload: path.join(__dirname, "preload.mjs")
    }
  });
  win.webContents.on("did-finish-load", () => {
    win == null ? void 0 : win.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  });
  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(RENDERER_DIST, "index.html"));
  }
}
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
    win = null;
  }
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
app.whenReady().then(createWindow);
ipcMain.handle("dialog:openDirectory", async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ["openDirectory"]
  });
  if (canceled) {
    return null;
  } else {
    return filePaths[0];
  }
});
ipcMain.handle(
  "fs:readDirectory",
  async (event, dirPath) => {
    const markdownFiles = [];
    try {
      const entries = await promises.readdir(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        const entryPath = path.join(dirPath, entry.name);
        if (entry.isFile() && entry.name.endsWith(".md")) {
          markdownFiles.push(entryPath);
        } else if (entry.isDirectory()) {
          const subDirFiles = await promises.readdir(entryPath, {
            withFileTypes: true
          });
          for (const subEntry of subDirFiles) {
            if (subEntry.isFile() && subEntry.name.endsWith(".md")) {
              markdownFiles.push(path.join(entryPath, subEntry.name));
            }
          }
        }
      }
    } catch (error) {
      console.error("Failed to read directory:", dirPath, error);
      return [];
    }
    return markdownFiles;
  }
);
ipcMain.handle(
  "fs:readFile",
  async (event, filePath) => {
    try {
      const content = await promises.readFile(filePath, "utf8");
      return content;
    } catch (error) {
      console.error("Failed to read file:", filePath, error);
      return null;
    }
  }
);
export {
  MAIN_DIST,
  RENDERER_DIST,
  VITE_DEV_SERVER_URL
};
