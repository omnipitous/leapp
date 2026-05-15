**Dependency Update Plan — packages/core**

- **Summary**: 42 outdated packages detected. Vulnerabilities from latest audit: **14 low**, **9 moderate**, **16 high**, **1 critical** (total **40**). See the raw scan artifacts in `ci-runs/2026-05-15T19-51-29Z_packages-core/packages/core/` for full details.

- **Goal**: Apply safe non-major (patch/minor) updates automatically, isolate major-version upgrades for manual review, and ensure tests/build pass before opening a PR.

**Automatable (safe to apply: same major)**:
- The following packages have the same major in `current` and `latest` and are safe to update automatically (patch/minor):

- @aws-sdk/client-ec2 -> 3.1048.0
- @aws-sdk/client-ssm -> 3.1048.0
- @aws-sdk/client-sso -> 3.1048.0
- @aws-sdk/client-sso-oidc -> 3.1048.0
- @aws-sdk/client-sts -> 3.1048.0
- @aws-sdk/types -> 3.973.8
- @aws-sdk/util-retry -> 3.370.0
- @types/babel__core -> 7.20.5
- @types/babel__traverse -> 7.28.0
- @types/node-ipc -> 9.2.3
- assert -> 2.1.0
- aws-cdk -> 2.1122.0
- axios -> 1.16.1
- class-transformer -> 0.5.1
- follow-redirects -> 1.16.0
- gushio -> 0.7.5
- reflect-metadata -> 0.2.2
- semver -> 7.8.0

Automated install commands (run from `packages/core`):

npm install @aws-sdk/client-ec2@3.1048.0
npm install @aws-sdk/client-ssm@3.1048.0
npm install @aws-sdk/client-sso@3.1048.0
npm install @aws-sdk/client-sso-oidc@3.1048.0
npm install @aws-sdk/client-sts@3.1048.0
npm install @aws-sdk/types@3.973.8
npm install @aws-sdk/util-retry@3.370.0
npm install @types/babel__core@7.20.5
npm install @types/babel__traverse@7.28.0
npm install @types/node-ipc@9.2.3
npm install assert@2.1.0
npm install aws-cdk@2.1122.0
npm install axios@1.16.1
npm install class-transformer@0.5.1
npm install follow-redirects@1.16.0
npm install gushio@0.7.5
npm install reflect-metadata@0.2.2
npm install semver@7.8.0

**Manual review required (major bump / potentially breaking / audit-sensitive)**:
- The following packages require manual review before upgrading (major version changes or high-risk):

- @azure/msal-node
- @commitlint/cli
- @commitlint/config-conventional
- @smithy/fetch-http-handler
- @types/jest
- @types/node
- @types/uuid
- aws-sdk-client-mock
- compare-versions
- date-fns
- fs-extra
- http-proxy-agent
- https-proxy-agent
- ini
- jest
- jwt-decode
- node-ipc
- rimraf
- rxjs
- tar
- tsoa
- typescript
- uuid
- wait-on

Notes:
- The audit shows a **critical** issue originating from `fast-xml-parser` (indirect). Several high vulnerabilities (e.g., `axios`, `tar`, packages in the npm toolchain) are present — these should be prioritized.
- Major bumps (e.g., `typescript`, `tar`, `node-ipc`, `jest`) are likely to require code/test changes; handle them in separate PRs.

Recommended procedure to apply automatable updates:

1. Create a branch: `git checkout -b dep-update/packages-core-automated-<timestamp>`
2. From `packages/core`, run the listed `npm install ...@<version>` commands.
3. Run `npm run build` and `npm test` (or the repo's `standard-ci` step for this package).
4. If build/tests pass, commit `package.json` and `package-lock.json` changes and push the branch.
5. Open a PR and run CI; verify vulnerability counts decreased (re-run `scripts/dep_scan_and_record.sh`).

For manual-review packages:
- Create separate branches/PRs per logical group (tooling e.g., `jest`/`@types/*`, language `typescript`, runtime `tar/node-ipc`) and evaluate breaking changes, run tests, and update code as needed.

If you want, I can:
- apply the automatable updates in a branch, run the package `build`+`test`, and open a PR draft; or
- generate separate PR plans for the manual-review groups and list the likely breaking-change follow-ups.

Artifacts:
- Raw scan JSON and human report: `ci-runs/2026-05-15T19-51-29Z_packages-core/packages/core/outdated-2026-05-15T19-51-29Z.json`, `ci-runs/2026-05-15T19-51-29Z_packages-core/packages/core/audit-2026-05-15T19-51-29Z.json`, and `ci-runs/2026-05-15T19-51-29Z_packages-core/packages/core/dependency-scan-2026-05-15T19-51-29Z.md`.
