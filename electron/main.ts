import { app, BrowserWindow, ipcMain, dialog } from "electron";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { promises as fs } from "fs";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.mjs
// │
process.env.APP_ROOT = path.join(__dirname, "..");

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
export const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
export const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, "public")
  : RENDERER_DIST;

let win: BrowserWindow | null;

function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, "electron-vite.svg"),
    webPreferences: {
      preload: path.join(__dirname, "preload.mjs"),
    },
  });

  // Test active push message to Renderer-process.
  win.webContents.on("did-finish-load", () => {
    win?.webContents.send("main-process-message", new Date().toLocaleString());
  });

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    // win.loadFile('dist/index.html')
    win.loadFile(path.join(RENDERER_DIST, "index.html"));
  }
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
    win = null;
  }
});

app.on("activate", () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.whenReady().then(createWindow);

ipcMain.handle("dialog:openDirectory", async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ["openDirectory"],
  });
  if (canceled) {
    return null;
  } else {
    return filePaths[0];
  }
});

ipcMain.handle(
  "fs:readDirectory",
  async (event, dirPath: string): Promise<string[]> => {
    const markdownFiles: string[] = [];
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const entryPath = path.join(dirPath, entry.name);
        if (entry.isFile() && entry.name.endsWith(".md")) {
          markdownFiles.push(entryPath);
        } else if (entry.isDirectory()) {
          const subDirFiles = await fs.readdir(entryPath, {
            withFileTypes: true,
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
  async (event, filePath: string): Promise<string | null> => {
    try {
      const content = await fs.readFile(filePath, "utf8");
      return content;
    } catch (error) {
      console.error("Failed to read file:", filePath, error);
      return null;
    }
  }
);

ipcMain.handle(
  "fs:writeFile",
  async (event, filePath: string, content: string): Promise<boolean> => {
    try {
      await fs.writeFile(filePath, content, "utf8");
      return true;
    } catch (error) {
      console.error("Failed to write filr:", filePath, error);
      return false;
    }
  }
);

ipcMain.handle(
  "fs:deleteFile",
  async (event, filePath: string): Promise<boolean> => {
    console.log("[Main Process] Attempting to delete file:", filePath); // Main Process log

    try {
      // Optional: Check if the file exists before attempting to delete
      // This check itself can sometimes fail due to permissions, so keep it in a try/catch
      try {
        await fs.access(filePath);
        console.log("[Main Process] File exists at:", filePath);
      } catch (checkError: any) {
        // Explicitly type checkError as 'any' for simpler error handling
        // If file doesn't exist, or inaccessible (e.g., deleted by other process), we treat it as already "deleted" from our perspective
        if (checkError.code === "ENOENT") {
          // File not found
          console.warn(
            "[Main Process] File not found when trying to delete:",
            filePath
          );
          return true; // Already gone, so consider it a success for deletion intent
        }
        console.error(
          "[Main Process] Failed to access file before deletion:",
          filePath,
          checkError
        );
        return false; // Indicate failure to delete (due to access issue)
      }

      await fs.unlink(filePath); // Perform the actual file deletion
      console.log("[Main Process] File deleted successfully:", filePath);
      return true; // Indicate success
    } catch (error: any) {
      // Catch any errors during unlink
      console.error(
        "[Main Process] Failed to delete file due to an error:",
        filePath,
        error
      );
      // Return false on failure, so the renderer knows it failed
      return false;
    }
  }
);

ipcMain.handle(
  "fs:renameFile",
  async (event, oldPath: string, newPath: string): Promise<boolean> => {
    console.log(
      "[Main Process] Attempting to rename file from:",
      oldPath,
      "to:",
      newPath
    );
    try {
      // Check if the old file exists
      try {
        await fs.access(oldPath);
      } catch (checkError: any) {
        console.error(
          "[Main Process] Old file does not exist or is inaccessible:",
          oldPath,
          checkError
        );
        return false; // Cannot rename a non-existent file
      }

      // Check if the new file path already exists (optional, but good practice to avoid overwriting)
      try {
        await fs.access(newPath);
        console.error("[Main Process] New file path already exists:", newPath);
        return false; // Prevent accidental overwrite
      } catch (checkError: any) {
        // If it doesn't exist (ENOENT), that's good, we can proceed.
        if (checkError.code !== "ENOENT") {
          console.error(
            "[Main Process] Unexpected error checking new file path:",
            newPath,
            checkError
          );
          return false;
        }
      }

      await fs.rename(oldPath, newPath);
      console.log(
        "[Main Process] File renamed successfully from:",
        oldPath,
        "to:",
        newPath
      );
      return true; // Indicate success
    } catch (error: any) {
      console.error(
        "[Main Process] Failed to rename file due to an error:",
        oldPath,
        newPath,
        error
      );
      return false; // Indicate failure
    }
  }
);
