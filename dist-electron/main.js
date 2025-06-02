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
ipcMain.handle(
  "fs:writeFile",
  async (event, filePath, content) => {
    try {
      await promises.writeFile(filePath, content, "utf8");
      return true;
    } catch (error) {
      console.error("Failed to write filr:", filePath, error);
      return false;
    }
  }
);
ipcMain.handle(
  "fs:deleteFile",
  async (event, filePath) => {
    console.log("[Main Process] Attempting to delete file:", filePath);
    try {
      try {
        await promises.access(filePath);
        console.log("[Main Process] File exists at:", filePath);
      } catch (checkError) {
        if (checkError.code === "ENOENT") {
          console.warn(
            "[Main Process] File not found when trying to delete:",
            filePath
          );
          return true;
        }
        console.error(
          "[Main Process] Failed to access file before deletion:",
          filePath,
          checkError
        );
        return false;
      }
      await promises.unlink(filePath);
      console.log("[Main Process] File deleted successfully:", filePath);
      return true;
    } catch (error) {
      console.error(
        "[Main Process] Failed to delete file due to an error:",
        filePath,
        error
      );
      return false;
    }
  }
);
ipcMain.handle(
  "fs:renameFile",
  async (event, oldPath, newPath) => {
    console.log(
      "[Main Process] Attempting to rename file from:",
      oldPath,
      "to:",
      newPath
    );
    try {
      try {
        await promises.access(oldPath);
      } catch (checkError) {
        console.error(
          "[Main Process] Old file does not exist or is inaccessible:",
          oldPath,
          checkError
        );
        return false;
      }
      try {
        await promises.access(newPath);
        console.error("[Main Process] New file path already exists:", newPath);
        return false;
      } catch (checkError) {
        if (checkError.code !== "ENOENT") {
          console.error(
            "[Main Process] Unexpected error checking new file path:",
            newPath,
            checkError
          );
          return false;
        }
      }
      await promises.rename(oldPath, newPath);
      console.log(
        "[Main Process] File renamed successfully from:",
        oldPath,
        "to:",
        newPath
      );
      return true;
    } catch (error) {
      console.error(
        "[Main Process] Failed to rename file due to an error:",
        oldPath,
        newPath,
        error
      );
      return false;
    }
  }
);
export {
  MAIN_DIST,
  RENDERER_DIST,
  VITE_DEV_SERVER_URL
};
