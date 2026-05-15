# Desktop App v2 React Checklist

## Scope

UI rewrite only.

Product decisions already taken for v2 frontend:

- App-level authentication is removed from scope.
- Pro and Team plan management is removed from scope.
- Billing, subscription, workspace unlock, and related settings surfaces are removed from scope.
- Cloud-provider authentication needed for actual session and integration flows stays in scope.

Out of scope for the initial v2 track:

- Replacing the current Electron shell.
- Reworking the native security boundary with preload or IPC redesign.
- Refactoring `@noovolari/leapp-core` unless a small adapter is strictly required by the new UI.
- General technical debt cleanup outside the section currently in progress.
- Reintroducing app login, app lock, billing, or Pro/Team management into the frontend.

## Working Rules

- This file is the source of truth for the v2 rollout.
- We complete one section at a time.
- Before starting the next section, we run the section check and record the result here.
- We only widen scope when the current section is checked and closed.
- Every implementation change updates this checklist status first.

## Status Legend

- `[ ]` not started
- `[-]` in progress
- `[x]` completed
- `[!]` blocked

## Rollout Status

- Current status: `section 2 completed`
- Current section: `2. Runtime Adapters`
- Last completed section check: `2. Runtime Adapters passed on 2026-05-15`

## 0. Scaffolding

Goal: create a parallel v2 package without disturbing the current desktop app.

- [x] Create `packages/desktop-app-v2` as a new package.
- [x] Add a dedicated `package.json` for the v2 app.
- [x] Reuse the current Electron packaging shape and release metadata where possible.
- [x] Keep renderer output compatible with the existing Electron load path expectations.
- [x] Add root-level scripts for bootstrap, build, run, and release of v2.
- [x] Document the local dev entrypoint for v2 in this file or companion docs.

Local dev entrypoint:

- Root command: `npm run run-desktop-v2`
- Package command: `cd packages/desktop-app-v2 && npm run build-and-run-dev`

Check before section 1:

- [x] Install succeeds for the new package.
- [x] A minimal renderer build completes.
- [x] Electron starts against the v2 package with a blank or placeholder UI.
- [x] Check result recorded in the update log.

## 1. React Renderer Foundation

Goal: establish the React application shell and replace Angular bootstrap with a React entrypoint.

- [x] Add React, React DOM, TypeScript, and the chosen renderer build tool.
- [x] Create the renderer entrypoint and app shell.
- [x] Add routing for the initial top-level flows.
- [x] Add a base layout for `dashboard` and `lock` routes.
- [x] Define the initial UI state strategy for renderer-only concerns.
- [x] Port the global theme and shared style tokens needed for a first usable shell.

Section 1 check:

- [x] The React app renders inside Electron.
- [x] `dashboard` and `lock` routes resolve correctly.
- [x] The app starts with no Angular runtime in the v2 renderer.
- [x] Check result recorded in the update log.

## 1.1 Frontend Simplification

Goal: remove app-level authentication, lock flow, and Pro/Team management from the v2 frontend scope before building runtime adapters.

- [x] Remove the `lock` route and related placeholder UI from the v2 renderer.
- [x] Make `dashboard` the only startup route for the current frontend foundation.
- [x] Remove app-auth wording and assumptions from the v2 shell and copy.
- [x] Exclude Pro, Team, billing, subscription, workspace unlock, and related controls from the frontend settings scope.
- [x] Record the distinction between removed app auth and retained cloud-provider auth flows.
- [x] Update later sections so they do not reintroduce removed auth or Pro/Team surfaces.

Check before section 2:

- [x] The v2 renderer boots without any app-auth or lock route.
- [x] The dashboard is the only top-level entry route currently planned in the renderer.
- [x] No later section still treats Pro, Team, billing, or app-auth settings as required scope.
- [x] Check result recorded in the update log.

## 2. Runtime Adapters

Goal: reuse the existing domain and native integrations through a React-friendly adapter layer.

- [x] Extract or recreate a framework-agnostic runtime adapter for `@noovolari/leapp-core` usage.
- [x] Replace Angular DI assumptions from the current desktop app with explicit construction or provider modules.
- [x] Add a React-facing API layer for app services currently mediated by Angular services.
- [x] Keep the current Electron shell integration model for v2 unless a thin adapter is unavoidable.
- [x] Isolate the minimum set of native APIs the React renderer consumes.
- [x] Define the ownership boundary between renderer UI code and reusable runtime code.

Check before section 3:

- [x] The v2 renderer can read workspace and session state through the new adapters.
- [x] At least one action path from UI to core completes successfully.
- [x] No React feature depends on Angular service classes at runtime.
- [x] Check result recorded in the update log.

## 3. Session Dashboard And Actions

Goal: restore the primary daily workflow for browsing and operating sessions.

- [ ] Build the sessions list screen.
- [ ] Port filtering, ordering, and search behavior.
- [ ] Port session selection state and active session visuals.
- [ ] Port contextual actions for start, stop, and refresh flows.
- [ ] Port command bar and sidebar behavior needed by the main dashboard.
- [ ] Reach feature parity for the core session lifecycle smoke paths.

Check before section 4:

- [ ] Users can view sessions and integrations in the v2 dashboard.
- [ ] Start and stop actions work on representative session types.
- [ ] Filtering and selection behave correctly on smoke scenarios.
- [ ] Check result recorded in the update log.

## 4. Integrations And Cloud Authentication Flows

Goal: restore the setup and cloud-provider authentication workflows that make the dashboard operational.

- [ ] Port integrations list and edit flows.
- [ ] Port AWS authentication flows.
- [ ] Port Azure authentication flows.
- [ ] Port MFA prompt flows.
- [ ] Port verification windows and related UI entrypoints.
- [ ] Port plugin and deep-link UI entrypoints required by the current shell behavior.

Check before section 5:

- [ ] A representative AWS auth flow completes.
- [ ] A representative Azure auth flow completes.
- [ ] MFA and verification prompts render and return values correctly.
- [ ] Check result recorded in the update log.

## 5. Settings, Dialogs, Notifications, And Update Surfaces

Goal: restore the secondary but necessary UI surfaces around the main workflows.

- [ ] Port settings and options screens.
- [ ] Keep app-auth, Pro, Team, billing, and subscription settings out of scope.
- [ ] Port common dialogs.
- [ ] Port toast and snackbar style notifications.
- [ ] Port update notification and release notes UI.
- [ ] Do not port lock, unlock, or workspace sign-in supporting flows.

Check before section 6:

- [ ] Core settings flows work in the v2 renderer.
- [ ] Main dialogs and notifications behave correctly.
- [ ] Update surfaces render with current release data.
- [ ] Check result recorded in the update log.

## 6. Tray And Secondary Windows

Goal: restore UI parity for tray and secondary window workflows while keeping the existing Electron shell.

- [ ] Port tray menu UI.
- [ ] Port compact mode or tray-specific layouts.
- [ ] Port secondary browser window flows used by auth or utility actions.
- [ ] Port renderer reactions to window resize and shell-driven events.
- [ ] Validate behavior for popup and tray paths against the existing shell.

Check before section 7:

- [ ] Tray UI works with the current Electron shell.
- [ ] Secondary window flows open and close correctly.
- [ ] Compact mode or equivalent shell-driven UI states are functional.
- [ ] Check result recorded in the update log.

## 7. Packaging, Release, And Cutover

Goal: make v2 shippable and define the cutover path from the Angular desktop app.

- [ ] Finalize build scripts for v2.
- [ ] Finalize release and nightly scripts for v2.
- [ ] Validate packaging on the target operating systems.
- [ ] Define the production switch from v1 to v2.
- [ ] Freeze or archive the old Angular renderer path once cutover is approved.
- [ ] Record any v1-only gaps that remain intentionally deferred.

Check before completion:

- [ ] v2 builds release artifacts successfully.
- [ ] Smoke validation passes on target platforms.
- [ ] Cutover decision is documented.
- [ ] Final result recorded in the update log.

## Update Log

- `2026-05-15` Created initial checklist. Scope fixed to UI rewrite only. No implementation started yet.
- `2026-05-15` Section 0 completed. Added `packages/desktop-app-v2` with a React + Vite placeholder renderer, a minimal Electron entrypoint, and root scripts for bootstrap, build, run, and release.
- `2026-05-15` Section 0 check passed with: `cd packages/desktop-app-v2 && npm install`, `npm run build-dev`, and `cd packages/desktop-app-v2 && npm run run-local`.
- `2026-05-15` Root wiring check passed with: `npm run build-desktop-v2` from the repository root.
- `2026-05-15` Validation notes: install completed with engine warnings on transitive packages and existing high vulnerabilities from Electron packaging dependencies, but the package scaffold, build, and local Electron run all succeeded.
- `2026-05-15` Section 1 completed. Added HashRouter-based top-level routing, dashboard and lock route shells, a renderer-only UI state provider, and a shared theme foundation for the React renderer.
- `2026-05-15` Section 1 check passed with: `cd packages/desktop-app-v2 && npm install && npm run build-dev`, `npm --prefix /Users/nico/Projects/beSharp/leapp/packages/desktop-app-v2 run run-local`, and `npm run build-desktop-v2` from the repository root.
- `2026-05-15` Renderer-only validation: `grep -RIn "@angular/" src dist/leapp-client || true` returned no matches inside `packages/desktop-app-v2`, confirming the v2 renderer currently boots without Angular imports.
- `2026-05-15` Validation notes: the section 1 build passed cleanly; `npm install` increased the package audit count due to `react-router-dom`, and Vite still reports the known CJS Node API deprecation warning during build.
- `2026-05-15` Product scope update: app-level authentication, lock flow, Pro/Team management, billing, and subscription settings are removed from the v2 frontend scope. Added section `1.1 Frontend Simplification` to eliminate these surfaces before runtime adapter work starts.
- `2026-05-15` Section 1.1 completed. Removed the `lock` route, deleted its placeholder UI, and simplified the renderer so the dashboard is the only frontend entrypoint currently planned.
- `2026-05-15` Section 1.1 check passed with: `grep` on `packages/desktop-app-v2/src` returning no matches for `lock`, `team`, `pro`, `billing`, `subscription`, `login`, or app-auth patterns; `cd packages/desktop-app-v2 && npm run build-dev`; `npm --prefix /Users/nico/Projects/beSharp/leapp/packages/desktop-app-v2 run run-local`; and `npm run build-desktop-v2` from the repository root.
- `2026-05-15` Scope note: the distinction between removed app/account surfaces and retained cloud session setup is now tracked in this checklist and no longer represented as a frontend route or placeholder page.
- `2026-05-15` Section 2 completed. Added a framework-agnostic runtime adapter in the v2 renderer that constructs `FileService`, `WorkspaceConsistencyService`, `Repository`, `WorkspaceService`, and `BehaviouralSubjectService` without Angular DI.
- `2026-05-15` Section 2 check passed with: `cd packages/desktop-app-v2 && npm install && npm run build-dev`, `npm --prefix /Users/nico/Projects/beSharp/leapp/packages/desktop-app-v2 run run-local`, `npm run build-desktop-v2`, and a grep on `packages/desktop-app-v2/src` returning no matches for Angular service classes or imports.
- `2026-05-15` Action-path note: the dashboard now triggers `refreshWorkspaceSnapshot()` on mount and exposes selection actions through the runtime adapter, so the renderer executes a real UI -> adapter -> core path during local boot.
- `2026-05-15` Build note: importing core source directly required local module-resolution aliases in the v2 package so core-source bare imports resolve to `packages/desktop-app-v2/node_modules` during Vite and TypeScript builds.