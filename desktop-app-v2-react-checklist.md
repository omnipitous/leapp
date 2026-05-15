# Desktop App v2 React Checklist

## Scope

UI rewrite only.

Product decisions already taken for v2 frontend:

- App-level authentication is removed from scope.
- Pro and Team plan management is removed from scope.
- Billing, subscription, workspace unlock, and related settings surfaces are removed from scope.
- Cloud-provider authentication needed for actual session and integration flows stays in scope.
- The active migration target is AWS. LocalStack is excluded from the current v2 target and Azure is deferred until the AWS path is working end to end.

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

- Current status: `section 4 remains open, section 5.4 visual parity slice landed and awaits smoke validation`
- Current section: `5. Dashboard Architecture, Refactor, And Componentization`
- Last completed section check: `3. Session Dashboard And Actions re-confirmed on 2026-05-15`

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

Goal: restore the primary daily workflow for browsing and operating AWS sessions first.

- [x] Build the sessions list screen.
- [x] Port filtering, ordering, and search behavior.
- [x] Port session selection state and active session visuals.
- [x] Port contextual actions for start, stop, and refresh flows.
- [x] Port command bar and sidebar behavior needed by the main dashboard.
- [x] Move the section 3 AWS lifecycle path away from `credential_process` and back to in-app credential-file generation for supported AWS session types.
- [x] Reach feature parity for the core session lifecycle smoke paths.

Check before section 4:

- [x] Users can view AWS sessions and AWS integrations in the v2 dashboard.
- [x] Start and stop actions work on representative AWS session types.
- [x] Filtering and selection behave correctly on AWS smoke scenarios.
- [x] Check result recorded in the update log.

## 4. Integrations And Cloud Authentication Flows

Goal: restore the setup and cloud-provider authentication workflows that make the dashboard operational.

- [ ] Port integrations list and edit flows.
- [ ] Restore create, edit, and delete flows for AWS integrations.
- [x] Restore the remaining AWS authentication flows, with AWS federated auth as the first target.
- [x] Port the dedicated auth-window flow still required by AWS federated sessions.
- [ ] Decide whether AWS SSO should stay on the current external-browser path or regain an in-app verification surface in v2.
- [ ] Port MFA prompt flows that still need richer UI than the current renderer prompt fallback.
- [ ] Port verification-window and secondary auth UI entrypoints still missing outside the section 3 path.
- [ ] Port plugin and deep-link UI entrypoints required by the current shell behavior.

Section 4 working target:

- Close AWS federated authentication first.
- Do not regress IAM user or AWS Identity Center flows already validated in section 3.
- Keep Azure deferred until the AWS federated path is working end to end.

Check before section 5:

- [x] A representative AWS federated auth flow completes.
- [ ] The previously validated AWS IAM user, chained, and AWS Identity Center flows still work after section 4 changes.
- [ ] The AWS integrations and authentication flows still in scope work end to end in the v2 dashboard.
- [ ] MFA and verification prompts render and return values correctly for the AWS target in scope.
- [ ] Check result recorded in the update log.

## 5. Dashboard Architecture, Refactor, And Componentization

Goal: restore the old dashboard logic and UI in React for the in-scope operator workflow, while giving that parity target a structure solid enough for later visual work.

Execution note:

- Section 4 stays open.
- Section 5 runs before further section 4 UI expansion because the current dashboard needs a stronger structural base first.
- The old desktop app dashboard is now the reference for logic, information hierarchy, and operator workflow on the surfaces still in scope.
- The goal is not to reopen core runtime work, but to rebuild the legacy dashboard behavior on top of the already validated session state and action contract.
- We port the legacy workflow and UI structure, not the Angular-specific global state patterns, DOM manipulation, or service-locator coupling used by the old renderer.
- Section 5 executes in two internal passes: `parity` first, `evolution` after.
- `Parity` means restoring the old dashboard workflow and the in-scope interaction model in React.
- `Evolution` means simplifying, cleaning up, and preparing the dashboard for later graphic work after parity is stable.

- [x] Freeze the parity target for the legacy dashboard surfaces that still matter in v2.
- [x] Build the dashboard orchestration layer on top of the current runtime snapshot and actions contract.
- [-] Recreate the legacy operator workspace skeleton in React.
- [ ] Port the session workspace surfaces to parity.
- [ ] Port the selected-session and contextual action surfaces to parity.
- [ ] Reintroduce the in-scope integration context into the dashboard workflow.
- [ ] Run the evolution cleanup needed to make the dashboard structurally solid for later graphic changes.
- [ ] Keep the current read and lifecycle behaviors stable while the dashboard is decomposed and rebuilt.

Section 5 operational plan:

- [x] 5.1 Parity target and scope freeze: extract the legacy dashboard surfaces that will be used as the React parity target.
- [x] 5.1 Parity target and scope freeze: map legacy `command bar`, `sessions workspace`, `session row`, `bottom bar`, `contextual menu`, `integration bar`, and the relevant `sidebar` behaviors to React target surfaces.
- [x] 5.1 Parity target and scope freeze: mark each legacy surface as `keep`, `simplify`, or `defer` according to current product scope.
- [x] 5.1 Parity target and scope freeze: define the non-goals for this pass so the work does not drift into new cloud flows, Electron boundary changes, core-service rewrites, or removed app-auth and Pro or Team surfaces.

5.1 assessment result:

- Runtime layer kept: `desktop-runtime` remains the only dashboard-to-core boundary, with snapshot reading, selection ownership, busy-state ownership, error ownership, workspace reload, and session actions staying outside the page-level React components.
- Dashboard coordinator target: dashboard-specific derived state moves above presentational components, including filters, ordering, selected-session facts, session metrics, integration summaries, capability messaging, and empty-state selection logic.
- Legacy to React mapping: `CommandBarComponent` -> `DashboardCommandBar`. `keep`: search, filters, ordering, workspace-level refresh. `simplify`: compact-mode wiring and any sync affordance tied to the in-scope AWS path. `defer`: create-session modal entry, notifications, settings entry, and native window controls.
- Legacy to React mapping: `SessionsComponent` -> `SessionWorkspace`. `keep`: main sessions workspace, ordering, empty states, selection coupling, and the operator-facing session overview. `simplify`: column chooser and viewport virtualization until proven necessary in v2.
- Legacy to React mapping: `SessionCardComponent` -> `SessionRow` or `SessionTableRow`. `keep`: visible metadata, provider identity, profile and region visibility, status display, selection, and fast lifecycle entrypoints. `simplify`: double-click semantics and DOM-class-driven row behavior.
- Legacy to React mapping: `BottomBarComponent` -> `SelectedSessionActionsBar`. `keep`: selected-session action strip and action grouping. `simplify`: first port only the in-scope AWS actions backed by the current runtime. `defer`: actions still blocked by incomplete section 4 UI or later surfaces.
- Legacy to React mapping: `ContextualMenuComponent` -> `SessionContextMenu`. `keep`: contextual action entrypoint for the in-scope operator workflow, including chained-session creation, change-region, change-profile, web-console entry, copy actions, pin or unpin, edit, and delete where still allowed. `defer`: plugin actions and any menu items tied to out-of-scope or not-yet-ported flows.
- Legacy to React mapping: `IntegrationBarComponent` -> `IntegrationContextPanel`. `keep`: AWS integration visibility and selection-as-filter behavior inside the workspace flow. `simplify`: reduce the surface to the AWS integrations still in scope. `defer`: full integration CRUD, login modals, and Azure parity until section 4 closes those flows.
- Legacy to React mapping: relevant `SideBarComponent` behaviors -> `WorkspaceRail` or equivalent dashboard rail. `keep`: minimal dashboard navigation and the `All Sessions` or `Pinned` operator affordances if they are needed by the parity layout. `defer`: workspace selector, remote workspace actions, lock flow, team-only surfaces, and saved segments until they are explicitly reintroduced.
- Non-goals fixed for section 5.1: no Angular renderer globals via `BehaviorSubject`, no direct DOM class toggling, no service-locator recreation in React, no core-service rewrites, no Electron boundary redesign, no Azure or LocalStack parity, and no removed app-auth, Pro, Team, billing, or workspace-lock surfaces.
- [x] 5.2 Orchestration layer: map what stays in the runtime layer, what becomes dashboard-specific derived state, and what belongs to presentational components.
- [x] 5.2 Orchestration layer: move filters, ordering, selection-derived facts, empty states, integration summaries, and action availability presentation out of the route body.
- [x] 5.2 Orchestration layer: keep the existing runtime snapshot and actions contract stable unless a tiny adapter is strictly required.
- [x] 5.2 Orchestration layer: define the top-level dashboard coordinator so action handlers and busy or error wiring stay thin and explicit.
- [x] 5.3 Workspace skeleton parity: recreate the dashboard structure around the legacy operator workflow instead of the current placeholder-card layout.
- [x] 5.3 Workspace skeleton parity: restore a React equivalent of the old `command bar` + `sessions workspace` + `selected session actions` + `integration context` composition.
- [x] 5.3 Workspace skeleton parity: decide where the old left-rail responsibilities belong in v2, including which sidebar functions stay, which move, and which remain deferred.

5.3 workspace skeleton component inventory for keep or remove decisions:

- `DashboardWorkspaceView`: pure composition root for the dashboard workspace layout. This stays as the renderer-level assembly point and should not contain runtime derivation logic.
- `WorkspaceRail`: left rail or sidebar shell for minimal navigation and optional `All Sessions` or `Pinned` affordances. This stays as an explicit parity component in 5.3.
- `DashboardCommandBar`: top command strip with search, filters, ordering, and workspace-level refresh. This is part of the parity skeleton and is already in the current composition.
- `WorkspaceStatusStrip`: compact summary area for metrics, busy state, workspace status, and top-level action feedback. This stays separate during the parity pass and can only be revisited later in `5.7 Evolution cleanup`.
- `SessionWorkspace`: central operator area that hosts the session collection, selection coupling, and workspace empty states. This is a core parity component and should stay.
- `SessionRow` or `SessionTableRow`: the row-level unit inside the session workspace. This belongs to 5.4 implementation detail, but its container slot is already part of the 5.3 skeleton.
- `SessionSelectionPanel`: selected-session detail surface shown beside the session workspace. This is part of the parity skeleton and should stay, even if its contents remain simplified.
- `SelectedSessionActionsBar`: explicit action strip derived from the old bottom bar. This stays as a dedicated parity component and is not merged into the selected-session panel during 5.3.
- `IntegrationContextPanel`: AWS integration visibility and selection-as-filter surface. This is part of the parity skeleton, but limited to in-scope AWS integration context rather than full CRUD.
- `SessionContextMenuAnchor`: structural entrypoint for row-level contextual actions. This does not need to block 5.3 closure, but the skeleton should leave room for it instead of baking a layout that makes it awkward later.
- `WorkspaceEmptyStateSurface`: reusable surface for `no matching sessions`, `no integrations`, `no selected session`, and `last action error` states. This should stay, even if implemented as shared primitives rather than a visibly separate panel.

5.3 decision buckets:

- Keep as first-class skeleton components for the parity pass: `DashboardCommandBar`, `WorkspaceStatusStrip`, `WorkspaceRail`, `SessionWorkspace`, `SessionSelectionPanel`, `SelectedSessionActionsBar`, `IntegrationContextPanel`, and `WorkspaceEmptyStateSurface`.
- Structural note for the parity pass: no component merges are planned inside the workspace skeleton. We keep the legacy composition explicit first, then decide later in `5.7 Evolution cleanup` whether any of these surfaces should collapse into a leaner structure.
- Explicitly out of the 5.3 skeleton decision: modal launchers, create-session entrypoints, settings entry, notifications, native window controls, plugin actions, Azure surfaces, LocalStack surfaces, and full integration CRUD.
- [x] 5.4 Session workspace parity: port search, filters, ordering, visible session metadata, empty states, and selection behavior toward the old dashboard workflow.
- [x] 5.4 Session workspace parity: decide whether the React equivalent should stay row-based or table-based, using parity and maintainability as the decision rule.
- [x] 5.4 Session workspace parity: preserve current start, stop, and refresh wiring while the session workspace is rebuilt.
- [ ] 5.5 Selected-session and contextual actions parity: port the old bottom-bar workflow for the selected session on the in-scope actions.
- [ ] 5.5 Selected-session and contextual actions parity: port the contextual-menu action set for the in-scope actions, including chained-session creation, change-region, change-profile, web console, copy actions, pin or unpin, edit, and delete where still allowed.
- [ ] 5.5 Selected-session and contextual actions parity: keep out-of-scope or not-yet-ported legacy actions explicitly deferred instead of silently dropping them.
- [ ] 5.6 Integration context parity: reintroduce the integration visibility and selection-as-filter behavior that belonged to the old workspace flow, limited to the integrations currently in scope.
- [ ] 5.6 Integration context parity: keep the integration surface consistent with section 4 remaining open, so parity does not imply full integration CRUD closure yet.
- [ ] 5.7 Evolution cleanup: simplify the parity result where legacy structure is too Angular-shaped, while preserving the operator workflow now reestablished in React.
- [ ] 5.7 Evolution cleanup: improve hierarchy, spacing, grouping, and readability so the dashboard no longer feels like a placeholder shell.
- [ ] 5.7 Evolution cleanup: leave the resulting structure ready for later graphic redesign without forcing another rewrite of state ownership.

Check before section 6:

- [ ] The dashboard route is no longer the single implementation surface for the main workspace UI.
- [ ] The primary dashboard surfaces render through extracted components with clear ownership.
- [ ] The v2 dashboard clearly reflects the old operator workflow on the in-scope surfaces, without depending on the old Angular implementation model.
- [ ] Representative read, filter, select, start, stop, and refresh flows still work after the parity rebuild.
- [ ] The selected-session and contextual action surfaces behave correctly for the in-scope actions.
- [ ] The dashboard baseline is solid enough to support later graphic work without reworking the state model.
- [ ] Check result recorded in the update log.

## 6. Settings, Dialogs, Notifications, And Update Surfaces

Goal: restore the secondary but necessary UI surfaces around the main workflows.

- [ ] Port settings and options screens.
- [ ] Keep app-auth, Pro, Team, billing, and subscription settings out of scope.
- [ ] Port common dialogs.
- [ ] Port toast and snackbar style notifications.
- [ ] Port update notification and release notes UI.
- [ ] Do not port lock, unlock, or workspace sign-in supporting flows.

Check before section 7:

- [ ] Core settings flows work in the v2 renderer.
- [ ] Main dialogs and notifications behave correctly.
- [ ] Update surfaces render with current release data.
- [ ] Check result recorded in the update log.

## 7. Tray And Secondary Windows

Goal: restore UI parity for tray and secondary window workflows while keeping the existing Electron shell.

- [ ] Port tray menu UI.
- [ ] Port compact mode or tray-specific layouts.
- [ ] Port secondary browser window flows used by auth or utility actions.
- [ ] Port renderer reactions to window resize and shell-driven events.
- [ ] Validate behavior for popup and tray paths against the existing shell.

Check before section 8:

- [ ] Tray UI works with the current Electron shell.
- [ ] Secondary window flows open and close correctly.
- [ ] Compact mode or equivalent shell-driven UI states are functional.
- [ ] Check result recorded in the update log.

## 8. Packaging, Release, And Cutover

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
- `2026-05-15` Action-path note: the dashboard exposes selection and runtime actions directly from the React session workspace, so the renderer now executes real UI -> adapter -> core paths from list and sidebar interactions.
- `2026-05-15` Build note: importing core source directly required local module-resolution aliases in the v2 package so core-source bare imports resolve to `packages/desktop-app-v2/node_modules` during Vite and TypeScript builds.
- `2026-05-15` Section 3 implementation started. Replaced the placeholder dashboard with a real session workspace in React, including command-bar search/filter/order controls, selection sidebar, integration visibility, and action buttons wired to the v2 runtime adapter.
- `2026-05-15` Section 3 validation in progress with: `cd packages/desktop-app-v2 && npm run build-dev` and `npm --prefix /Users/nico/Projects/beSharp/leapp/packages/desktop-app-v2 run run-local`. The section gate is still open until representative start/stop smoke checks are completed on a real workspace.
- `2026-05-15` Scope update: LocalStack is removed from the active v2 migration target. Section 3 now focuses on AWS sessions and AWS integrations, while Azure remains deferred until the AWS path is closed.
- `2026-05-15` Build/runtime stabilization: the v2 package now prefers `.ts` over adjacent legacy `.js` files from `packages/core/src` during renderer resolution, and the temporary main-process RPC bridge was removed again because the current section is no longer using CLI or `credential_process` as a dependency.
- `2026-05-15` AWS lifecycle scope update: section 3 now uses in-app credential-file generation for AWS IAM user sessions, chained sessions with an IAM user parent, and AWS SSO role sessions. AWS federated start/refresh still remain deferred to section 4 because they still need the dedicated auth-window flow.
- `2026-05-15` AWS SSO runtime update: the v2 dashboard now opens the AWS SSO verification URL in the external browser and completes OIDC polling in-renderer, so `awsSsoRole` start and refresh no longer stay pre-emptively disabled in section 3.
- `2026-05-15` Section 3 validation continued with: `cd packages/desktop-app-v2 && npm run build-dev` and `npm --prefix /Users/nico/Projects/beSharp/leapp/packages/desktop-app-v2 run run-local`. The v2 build is green again and the Electron shell boots without the removed RPC bridge, but the representative AWS lifecycle smoke gate is still open until start/stop are exercised on a real workspace.
- `2026-05-15` Section 3 check passed. User-confirmed smoke validation now covers IAM user and AWS Identity Center flows in the v2 dashboard, with filtering/list/selection already verified earlier in the session. Section 4 is now unlocked, while AWS federated remains explicitly deferred there.
- `2026-05-15` Section 3 closure re-confirmed. User-confirmed smoke validation now also covers the chained AWS path in the v2 dashboard, so section 3 stays closed and section 4 remains the next gate to open formally.
- `2026-05-15` Section 4 federated slice completed. Enabled `@electron/remote` in the v2 Electron shell, added the in-renderer AWS federated auth-window delegate, and wired `awsIamRoleFederated` to the credential-file lifecycle path.
- `2026-05-15` Section 4 federated validation passed with: `cd packages/desktop-app-v2 && npm install '@electron/remote@^2.0.1'`, `npm run build-dev`, `npm --prefix /Users/nico/Projects/beSharp/leapp/packages/desktop-app-v2 run run-local`, and user-confirmed end-to-end AWS federated execution.
- `2026-05-15` Section 4 chained-parent expansion completed. The v2 support matrix now allows `awsIamRoleChained` sessions to run with IAM user, AWS federated, and AWS Identity Center parent sessions, instead of blocking everything outside IAM user.
- `2026-05-15` Section 4 chained-parent validation passed with: `npm --prefix /Users/nico/Projects/beSharp/leapp/packages/desktop-app-v2 run build-dev`. Runtime enablement is in place; end-to-end smoke validation on chained sessions still needs a real workspace check.
- `2026-05-15` Plan update: inserted a new section `5. Dashboard Architecture, Refactor, And Componentization` before the secondary UI surfaces. The new step explicitly covers dashboard architecture assessment, refactor, component breakdown, component extraction, and baseline dashboard cleanup before later graphic work. Later sections were shifted by +1.
- `2026-05-15` Sequencing update: section 4 remains open, but section 5 is now the next operational step before further section 4 UI expansion. This pass is explicitly a dashboard hardening prerequisite, not a reopening of the runtime slice already validated in sections 3 and the first part of 4.
- `2026-05-15` Legacy parity update: section 5 now explicitly uses the old desktop dashboard as the reference for the in-scope operator workflow. The target is to rebuild that logic and UI structure in React on top of the new runtime boundary, not to preserve the old Angular implementation patterns.
- `2026-05-15` Section 5 operational-plan update: rewrote the dashboard hardening step into a concrete execution sequence with `parity` first and `evolution` after. The plan now explicitly covers legacy surface extraction, orchestration-layer refactor, workspace skeleton parity, session-workspace parity, selected-session and contextual-action parity, integration-context parity, and final cleanup before later graphic work.
- `2026-05-15` Section 5.1 completed. Froze the legacy parity target, mapped the old dashboard surfaces to React target surfaces, fixed `keep`/`simplify`/`defer` decisions for the first parity pass, and locked the non-goals so section 5.2 can refactor the dashboard without reopening runtime or removed product surfaces.
- `2026-05-15` Section 5.2 completed. Added a dedicated dashboard orchestration hook over the existing runtime contract and moved filters, ordering, selection-derived state, integration summaries, empty-state logic, and action availability out of `DashboardRoute`. Validation passed with `npm --prefix /Users/nico/Projects/beSharp/leapp/packages/desktop-app-v2 run build-dev`.
- `2026-05-15` Section 5.3 browser-preview slice landed. Extracted a pure `DashboardWorkspaceView`, added a browser-safe `DashboardPreviewRoute` and mock dashboard workspace, kept the real Electron runtime route intact, and added `npm --prefix /Users/nico/Projects/beSharp/leapp/packages/desktop-app-v2 run dev:web` for dashboard iteration outside Electron. Validation passed with `npm --prefix /Users/nico/Projects/beSharp/leapp/packages/desktop-app-v2 run build-dev` and a browser-preview smoke start on `npm --prefix /Users/nico/Projects/beSharp/leapp/packages/desktop-app-v2 run dev:web -- --host 127.0.0.1 --strictPort --port 4173`.
- `2026-05-15` Section 5.3 planning update: expanded the workspace skeleton parity step with an explicit component inventory and decision buckets, so keep, merge, and remove choices can be made against concrete React surfaces instead of a generic layout label.
- `2026-05-15` Section 5.3 decision update: keep the full workspace skeleton explicit for the parity pass. `WorkspaceRail`, `WorkspaceStatusStrip`, and `SelectedSessionActionsBar` stay as first-class components instead of being merged away at this stage. Any simplification of that structure moves to `5.7 Evolution cleanup`.
- `2026-05-15` Section 5.3 extraction update: split the dashboard workspace skeleton into explicit React components for header, metrics, command bar, status strip, session workspace, session row, selected-session actions, selection panel, integration context, empty states, and workspace rail. Validation passed with `npm --prefix /Users/nico/Projects/beSharp/leapp/packages/desktop-app-v2 run build-dev`.
- `2026-05-15` Section 5.4 implementation landed. Rebuilt the sessions workspace into a legacy-oriented table grid with explicit columns, richer session metadata, differentiated empty states, profile sorting, and row-wide selection while preserving the existing start, stop, and refresh action wiring. Validation passed with `npm --prefix /Users/nico/Projects/beSharp/leapp/packages/desktop-app-v2 run build-dev`. Runtime smoke validation is still pending before the broader section check is closed.
- `2026-05-15` Legacy visual port slice landed on the React dashboard workspace. The v2 command bar and session workspace now use the legacy icon language, historical empty-state artwork, provider imagery, and styling closer to the Angular dashboard while keeping the current React state and action wiring intact. Validation passed with `npm --prefix /Users/nico/Projects/beSharp/leapp/packages/desktop-app-v2 run build-dev`.
