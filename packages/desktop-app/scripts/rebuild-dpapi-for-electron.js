/*
 * Rebuilds @noovolari/dpapi-addon (a NAN-based native module, Windows DPAPI) against the
 * Electron ABI so it can be loaded inside the Electron runtime.
 *
 * This replaces `electron-rebuild -f -w @noovolari/dpapi-addon` and
 * `electron-builder install-app-deps`: both drive an old node-gyp (9.x) that can neither
 * detect Visual Studio 2026 (v18) nor run under Python 3.12+. keytar needs no rebuild —
 * it ships N-API prebuilds that work in both Node and Electron.
 *
 * On non-Windows platforms this script is a no-op: dpapi-addon is only used by the
 * Windows MSAL token-cache encryption path.
 */
const { spawnSync } = require("child_process");
const path = require("path");
const fs = require("fs");

if (process.platform !== "win32") {
  console.log("rebuild-dpapi-for-electron: not on Windows, skipping.");
  process.exit(0);
}

const electronVersion = require("electron/package.json").version;
const addonDir = path.dirname(require.resolve("@noovolari/dpapi-addon/package.json"));
const builtAddon = path.join(addonDir, "build", "Release", "dpapi.node");
const abiMarker = path.join(addonDir, "build", `.electron-${electronVersion}-${process.arch}`);

if (fs.existsSync(builtAddon) && fs.existsSync(abiMarker) && !process.argv.includes("--force")) {
  console.log(`rebuild-dpapi-for-electron: already built for Electron ${electronVersion} (${process.arch}), skipping.`);
  process.exit(0);
}

console.log(`rebuild-dpapi-for-electron: building @noovolari/dpapi-addon for Electron ${electronVersion} (${process.arch})...`);

const result = spawnSync(
  "npx",
  ["-y", "node-gyp@^13.0.1", "rebuild", `--target=${electronVersion}`, `--arch=${process.arch}`, "--dist-url=https://electronjs.org/headers"],
  { cwd: addonDir, stdio: "inherit", shell: true }
);

if (result.status !== 0) {
  console.error("rebuild-dpapi-for-electron: build FAILED. The app will still start, but the Azure integration will be unavailable.");
  process.exit(result.status ?? 1);
}

fs.writeFileSync(abiMarker, new Date().toISOString());
console.log("rebuild-dpapi-for-electron: done.");
