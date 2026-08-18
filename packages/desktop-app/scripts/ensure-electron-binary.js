/*
 * Makes sure the Electron binary actually exists after install.
 *
 * On Node >= 23 the electron package's own installer silently fails: its extract-zip/yauzl
 * dependency hangs mid-extraction and the process exits 0 leaving an empty dist folder.
 * This script verifies dist/<binary> exists; if not it retries the official installer and,
 * on Windows, falls back to downloading the zip and extracting it with PowerShell.
 */
const { spawnSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const electronDir = path.dirname(require.resolve("electron/package.json"));
const electronVersion = require("electron/package.json").version;
const exeRelative = process.platform === "win32" ? "electron.exe" : process.platform === "darwin" ? "Electron.app/Contents/MacOS/Electron" : "electron";
const exePath = path.join(electronDir, "dist", exeRelative);

function ok() {
  console.log(`ensure-electron-binary: Electron ${electronVersion} binary present.`);
  process.exit(0);
}

if (fs.existsSync(exePath)) ok();

console.log("ensure-electron-binary: Electron binary missing, running the official installer...");
spawnSync(process.execPath, ["install.js"], { cwd: electronDir, stdio: "inherit" });
if (fs.existsSync(exePath)) ok();

if (process.platform !== "win32") {
  console.error("ensure-electron-binary: installer failed and no fallback for this platform; delete node_modules/electron and reinstall.");
  process.exit(1);
}

const zipName = `electron-v${electronVersion}-win32-${process.arch}.zip`;
const url = `https://github.com/electron/electron/releases/download/v${electronVersion}/${zipName}`;
const zipPath = path.join(require("os").tmpdir(), zipName);
const distPath = path.join(electronDir, "dist");

console.log(`ensure-electron-binary: falling back to direct download of ${url}`);

(async () => {
  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok) throw new Error(`Download failed: HTTP ${response.status}`);
  fs.writeFileSync(zipPath, Buffer.from(await response.arrayBuffer()));

  fs.rmSync(distPath, { recursive: true, force: true });
  const extract = spawnSync(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-Command", `Expand-Archive -Path '${zipPath}' -DestinationPath '${distPath}' -Force`],
    { stdio: "inherit" }
  );
  if (extract.status !== 0) throw new Error("Expand-Archive failed");

  fs.writeFileSync(path.join(electronDir, "path.txt"), exeRelative);
  if (!fs.existsSync(exePath)) throw new Error("electron.exe still missing after extraction");
  ok();
})().catch((error) => {
  console.error("ensure-electron-binary: FAILED -", error.message);
  process.exit(1);
});
