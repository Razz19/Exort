# Managed OpenCode v2

Exort ships **OpenCode 2.0.14** as its default managed runtime. The desktop client and plugin type contracts are pinned to `@opencode/client@2.0.14` and `@opencode/plugin@2.0.14`. Arduino CLI and the website are unchanged.

## Installation and updates

Settings → Requirements shows the installed and latest OpenCode versions and installation progress. Clicking **Check for updates** checks for a newer version and automatically installs it when available, without a separate Update button. The check button is hidden during installation. Packaged builds check after requirements initialization and every 24 hours while open. Development builds support manual checks. Background checks notify without installing: an available version produces an **OpenCode update available — vX.Y.Z** toast with **Update**. Dismissing it suppresses that version for the current app session. Background network errors remain quiet; manual failures include a route to Requirements.

First-run requirements setup automatically installs the shipped OpenCode 2.0.14 runtime alongside the other missing requirements. Upgrades to existing runtimes are user initiated, including migration from v1. Exort checks the [official npm CLI feed](https://opencode.ai/update/api/latest/cli/npm), accepts only stable, active 2.x releases, and never downgrades an installed version. Prereleases and future major versions are rejected. OpenCode's own updater is disabled with `update: "disable"` in Exort's isolated global configuration.

The installer downloads official `@opencode/cli-<target>` npm tarballs; it does not use global npm or the v1 GitHub release feed. `opencodeReleaseAssets.json` commits npm package names, URLs and SHA-512 integrity for 2.0.14. Later versions resolve metadata from the npm registry. Bytes must match integrity before extracting `package/bin/opencode` (`opencode.exe` on Windows), and an isolated, bounded binary probe must report the exact requested version. macOS arm64/x64, Windows x64, and Linux arm64/x64 are supported, including existing baseline CPU and musl selections.

Each download is staged separately. `openCodeUpdater.ts` serializes installation and restart operations. It waits for turns, API calls, permissions, forms and pending provider sign-in to finish, then acquires the runtime maintenance lock. New operations receive a retryable message during activation. The sidecar stops, isolated data is snapshotted, the candidate is published, and startup checks authenticated server identity, history migration and the Exort plugin. Only then does `active-version.json` commit the version. A newer active version survives an Exort upgrade or restart; persisted values are validated before constructing paths. Renderer requests never supply versions, download URLs, or filesystem paths.

An explicit `EXORT_OPENCODE_BINARY` with `EXORT_ALLOW_SYSTEM_OPENCODE=1` remains externally managed. It must report a stable 2.x version. Exort displays an explanation and does not replace it.

## Data safety and v1 migration

Existing 1.x binaries are recognized without execution and require an upgrade action. Before the first v2 start, `backups/before-v2` preserves Exort's isolated runtime config, credentials and data. It is not overwritten on retry. Chat stays unavailable until the authenticated `/api/experimental/migration/v1` endpoint reports completion. Migration errors remain retryable; session lookups do not silently substitute new empty history.

Every activation also takes a timestamped snapshot and records `activation.json` before publishing the candidate. Failed later 2.x activations restore the preceding binary, data, active version and migration marker, then try to restart the previous v2 runtime. Initial migration failure preserves the v1 backup and does not run v1 through the v2 client. Startup recovers an interrupted activation from the journal; a transaction ID distinguishes an already committed activation from a partially applied one. Backups are retained for recovery rather than pruned automatically.

Exort's own workspace/session associations and selected/hidden model preferences retain their existing persistence format. OpenCode performs the upstream history and provider-credential migration. Runtime rollback operates on Exort-owned runtime files only.

## Sidecar, plugins and adapter

`openCodeSidecar.ts` launches an Exort-owned foreground server on `127.0.0.1` with an ephemeral port and random password. Main holds the Basic authentication header; it is never added to preload state or logs. Readiness uses authenticated `/api/info`, not an open TCP port. Raw subprocess output is drained rather than forwarded because it can contain config or credential details.

OpenCode uses private XDG config/data/state/cache paths (AppData/LocalAppData plus explicit XDG overrides on Windows). Exort writes its global `opencode.json` inside those paths, with the v2 agent configuration, updater disabled, and an explicit local plugin path. Version probes also use disposable isolated paths.

`v2Adapter.ts` keeps the established renderer event and history contract while translating v2 sessions, model/agent switching, prompts, URI attachments, token usage, diffs, cancellation, permissions, forms and integration-based provider auth. Provider credential mutations refresh upstream registries without restarting other conversations. Location initialization is asynchronous: `v2Readiness.ts` waits for the Exort plugin before using a new location's model catalog or sending prompts.

Subscriptions connect before submitting prompts. v2 execution completion becomes the existing done event. On disconnection, the adapter reconnects and reads history back to the pre-turn boundary, plus pending permissions/forms and active-session state. During recovery, text uses authoritative snapshots instead of replaying ambiguous queued deltas. Part IDs and tool-result IDs prevent duplication; resolved interrupts are cleared. Recovery is bounded and surfaces an error if it cannot continue, so streaming indicators can settle.

`plugins/exort/index.ts` registers `arduinoCompile` and `platformioCompile` with the v2 plugin API. Both call the same execution modules used by toolbar actions. Electron Vite copies plugin and tool source to `out/main/opencode-config`; Electron Builder unpacks that directory from ASAR. The plugin imports `@opencode/plugin` for types only, so its executable source and Node built-ins require no global dependency install.

## Main/preload interfaces

Shared state is defined in `src/shared/openCodeUpdater.ts`. Main owns selection and activation. Preload exposes:

- `getOpenCodeUpdateState()` → `opencode-updater:get-state`
- `checkOpenCodeUpdate(background?)` → `opencode-updater:check`
- `installOpenCodeUpdate()` → `opencode-updater:install`
- `onOpenCodeUpdateState(listener)` / `offOpenCodeUpdateState(listener)` → `opencode-updater:state`

State includes current/latest versions, automatic-check eligibility, status, download percentage, check time, message and error. Status covers checking, available, downloading, waiting for idle, installing, updated, up to date, error and external management. Renderer listeners and timers are removed on teardown. Successful activation refreshes requirements and the active workspace's provider/model catalog without restarting Exort.

## Validation

From the repository root:

```sh
npm run typecheck --workspace @exort/desktop
npm run requirements:test --workspace @exort/desktop
npm run opencode:test --workspace @exort/desktop
npm run build --workspace @exort/desktop
npm run opencode:smoke --workspace @exort/desktop
npm run opencode:smoke --workspace @exort/desktop -- --prompt
npm run opencode:migration-smoke --workspace @exort/desktop -- /path/to/verified-v1.15.7 /path/to/verified-v2.0.14
```

Unit tests cover stable release filtering, target selection, integrity, wrong binary versions, offline checks, persistence, concurrency, idle activation, failed migration, rollback, crash recovery, v2 events, reconnects, attachments, permissions/forms, cancellation and provider authentication mapping. Integration smoke commands create and remove temporary runtimes; no real provider credential is needed. `--prompt` explicitly sends a fixed free-tier prompt. The migration smoke seeds real v1 history and a fake provider key, then checks the preserved session ID, history, provider connection and backup.

Release jobs run the packaged-asset smoke check on Windows, macOS and Linux after building. This checks real binary startup and plugin loading; compile-tool entrypoint checks exercise structured missing-input responses. Successful hardware-specific compilation still requires an installed board core or PlatformIO environment and belongs in platform release qualification. Free-tier service availability and real browser OAuth are external integration checks, not deterministic unit tests.

### Release packaging

The smoke test converts the packaged plugin path with `pathToFileURL` before importing it. This is required for Windows drive-letter paths and also escapes spaces and URL-special characters correctly.

Desktop packaging scripts invoke the installed `electron-builder` directly. `electron-builder.yml` passes `--include=dev` to dependency installation so a production install during `install-app-deps` cannot prune the locked build tools from the hoisted npm workspace. Missing tools fail the build rather than letting `npm exec` download a different builder version.

Both macOS CI jobs use `scripts/macos-signing-keychain.sh` to import `MAC_CSC_LINK` into a temporary keychain. `MAC_CSC_KEY_PASSWORD` decrypts the certificate; a separate random, masked password unlocks the keychain and sets its key partition permissions. The existing builder's automatic import incorrectly uses the certificate password for both operations. CI supplies only `CSC_KEYCHAIN` to packaging, requires signing for the macOS jobs, and removes the temporary keychain, certificate, and App Store Connect key even after a failure. Windows/Linux retain their existing unsigned packaging behavior. Signing, notarization, stapling, and Gatekeeper validation remain required on macOS.

The temporary keychain is added to the user's search list, preserving the original entries; cleanup restores that list. An explicit `codesign --keychain` argument alone is insufficient for identity lookup. Before packaging, CI requires a valid **Developer ID Application** identity and signs and verifies a disposable executable with it. This catches missing private keys, unsuitable certificates, and keychain access problems before the full app build reaches signing.

CI also checks `notarytool history` with the App Store Connect credentials before packaging. Authentication or team-access failures are reported directly, rather than being obscured by the older notarization library's JSON parser. A successful signing preflight does not validate these separate notarization credentials; the `.p8` key, key ID, and issuer must belong together and have access to the developer team. The private key enters the shell through environment variables and is written with owner-only permissions.
