# HANDOFF — SPS fork of Leapp

**Fork owner:** Nate Anderson (nwanderson@spscommerce.com / github: omnipitous)
**Upstream:** [Noovolari/leapp](https://github.com/Noovolari/leapp) — **discontinued by the vendor**; this fork exists because the final official release could no longer sync AWS SSO sessions and the upstream will never fix it.
**Branch:** `feature/nwa-leapp` (all changes described below)

## TL;DR for a new maintainer

```bash
# Requirements: Node 26.x (.nvmrc), pnpm 10.x, VS Build Tools 2026, Python 3.13+
pnpm run bootstrap                      # install everything + build core
cd packages/desktop-app
pnpm run build-and-run-dev              # build and launch the app
```

Core tests: `cd packages/core && pnpm test` (724 tests, all green as of this handoff).

## Why this fork exists — the AWS SSO sync failures

The final official Leapp silently failed to sync AWS SSO sessions for large organizations
and for tokens that AWS invalidates server-side. Root causes, all fixed in
`packages/core/src/services/integration/aws-sso-integration-service.ts`:

1. **Unhandled rejection in account pagination** — `listAccounts` had no error handling, so
   any AWS error (throttling, revoked token, network) left the sync promise unsettled
   *forever*: no error, no toast, nothing. Rewritten as plain async pagination loops that
   propagate errors and tolerate response pages with missing `accountList`/`roleList`.
2. **`forceRefresh` was ignored** — AWS can invalidate an SSO token before its local
   clock expiry (e.g. an admin shortens session duration). Leapp only compared timestamps,
   so it replayed dead tokens forever. `getAccessToken` now honors `forceRefresh`, and the
   sync automatically re-logins once on an authentication error (`isAuthenticationError`).
3. **Partial results could delete sessions** — the sync diffs online vs persisted sessions;
   if some accounts failed, their sessions vanished from the "online" set and got deleted
   locally. `getSessions` now uses `Promise.allSettled` and throws an aggregated error if
   *any* account fails, rather than returning a partial list.
4. **Destructive error handling in the UI** — the desktop app used to log you out (destroying
   a valid token) on *any* sync error, including a transient 429. It now only logs out on
   real authentication errors (`integration-bar.component.ts`).
5. **Throttling** — page size raised to the AWS max (100, `constants.ssoPortalListMaxResults`),
   retry backoff has a 1s floor with jitter (it could previously be 0ms), and
   `ThrottleService` sleeps until its estimated slot instead of busy-polling every 1ms.
6. **`setOnline(integration, false)` couldn't force offline** (`forcedState || isOnline` bug)
   and logout re-persisted the expiration it had just cleared. Both fixed.

## UX changes

- **Sync progress pill** (bottom-center, non-blocking): core emits phase messages
  ("retrieving account list", "found N accounts", "fetched X of N", "applying session
  changes X/Y") through `behaviouralNotifier.setFetchingIntegrations`; the app renders them
  in `app.component.html`. Upstream emitted these events but never rendered them anywhere.
- **Leapp Pro/Team widget removed** from the sidebar: the paid cloud service it reported on
  no longer exists, so it permanently displayed "Not active" like an error. Restore
  `<app-sync-pro-widget>` in `side-bar.component.html` if it's ever relevant again.
- **Tray menu hardened** (`tray-menu.component.ts`): a missing icon file or any rebuild
  failure logs a warning and keeps the previous menu instead of surfacing an Electron
  "conversion failure" toast.
- **dpapi-addon load is non-fatal** (`app-native.service.ts`): it's only used by the Azure
  integration's MSAL cache encryption; if the binary is missing, the app boots and only
  Azure is unavailable.

## Toolchain migration: pnpm workspace + Node 26

The repo was npm-per-package + Node 16. It is now a **pnpm workspace** (`pnpm-workspace.yaml`)
on **Node 26**. Landmines that were solved — do not regress these:

| Problem | Fix |
|---|---|
| node-gyp 9 can't detect VS Build Tools 2026 (v18) or run under Python 3.12+ | pnpm override `node-gyp: ^13` (pnpm-workspace.yaml) |
| `@noovolari/dpapi-addon`'s install script builds for the local Node ABI — useless (app runs in Electron) and its NAN source doesn't compile against Node 26 headers | script ignored via `ignoredBuiltDependencies`; `packages/desktop-app/scripts/rebuild-dpapi-for-electron.js` builds it against Electron headers instead (postinstall + gushio build) |
| `electron`'s installer **silently fails on Node ≥ 23** (extract-zip/yauzl hangs, exits 0 with an empty `dist`) | `packages/desktop-app/scripts/ensure-electron-binary.js` self-heals: retries the installer, then falls back to direct download + PowerShell extraction |
| pnpm's default symlink layout breaks electron-builder's `node_modules/**` packaging globs and legacy resolution | `.npmrc`: `node-linker=hoisted` (npm-like flat layout) |
| Hoisted-layout paths | `angular.json` / `tsconfig.json` / `electron/tsconfig.json` reference `../../node_modules` (workspace root) |
| Vendored `electron/context-menu.ts` requires `slice-ansi` without declaring it; hoisting can serve an ESM-only copy that crashes Electron main | `slice-ansi@4.0.0` (CJS) declared as a real dependency of desktop-app |
| jest broke with "onExit is not a function" | stale nested `signal-exit@4` under `write-file-atomic@3`; override pins v3. **General rule:** an aborted pnpm install can leave stale wrong-version nested dirs — if you see bizarre ESM/export errors, wipe `node_modules` and reinstall before debugging |

The legacy `package-lock.json` files were **removed**: besides being dead
(`pnpm-lock.yaml` is authoritative), their presence made electron-builder pick its npm
dependency collector, which cannot read a pnpm-installed tree and fails packaging with
"dependency path is undefined". Never run `npm install` here and never reintroduce them.

## Windows packaging (NSIS installer) — works, but know the landmines

`cd packages/desktop-app && pnpm exec electron-builder build --win --x64 --publish never`
(after a `configuration production` gushio build). Things that were required to make it work:

- **`npmRebuild: false`** in the build config: electron-builder's own native rebuild uses an
  old node-gyp that fails on VS 2026; our postinstall script already builds dpapi correctly.
- **Root package.json must declare `"workspaces": ["packages/*"]`** and must NOT share a
  name with the desktop-app package (root is `leapp-monorepo`): electron-builder's
  dependency collector shells out to `npm ls`, which needs the workspaces declaration to
  parse `workspace:*` specs — and a root/child name collision makes npm silently collapse
  the child, yielding an app packaged with ZERO node_modules that dies at startup.
- **Root depends on `"Leapp": "workspace:*"`** so pnpm materializes the
  `node_modules/Leapp` symlink npm ls needs to see the desktop-app subtree.
- **`patches/app-builder-lib@26.0.12.patch`** fixes upstream's package-manager detection
  (its lockfile probe returned "npm" instead of null, making the monorepo walk-up dead code).
- **winCodeSign extraction fails on Windows** without Developer Mode (the archive contains
  macOS symlinks; 7z exits 2). If a fresh machine hits "cannot execute exit status 2" around
  winCodeSign: extract the failed numbered directory in
  `%LOCALAPPDATA%\electron-builder\Cache\winCodeSign\` and rename it to `winCodeSign-2.6.0`
  (the Windows tools inside extract fine; only darwin symlinks fail).
- Never run packaging while a dev instance of the app is running: it locks dpapi.node.

## Known gaps / untested

- **Azure integration** is untested end-to-end (dpapi builds and loads, but no Azure tenant
  was exercised).
- Dev-build habit: **close the running app before `build-dev`** — the build wipes
  `dist/leapp-client` and the running instance reads tray icons from that folder on every
  session state change.

## Repo conventions

- Conventional-commit style messages (`fix:`, `feat:`, `chore:`).
- `gushio` scripts drive builds (`packages/*/gushio/*.js`); they now shell out to pnpm.
- The `dpapi-addon/` folder at the repo root is the addon's *source* (also published as
  `@noovolari/dpapi-addon`); the desktop app consumes the npm package, not this folder.
