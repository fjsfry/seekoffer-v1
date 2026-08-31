# SeekOffer Windows installer

The desktop installer deliberately keeps Tauri's audited NSIS template and
uses only its supported configuration, localization and lifecycle hooks.
Replacing the full template would duplicate roughly 900 lines of updater,
silent-mode, upgrade and uninstall logic and make future Tauri security fixes
harder to inherit.

## Product experience

- The installer follows the Windows system language automatically. Simplified
  Chinese is the fallback and English remains available on English systems.
- Installation is scoped to the current Windows user, so the normal path does
  not ask for administrator elevation.
- The standard Segoe UI / Microsoft YaHei UI mappings are retained instead of
  embedding a private font.
- Header and welcome/finish artwork use the same SeekOffer icon, `#0F6B61`
  brand green, semantic neutrals and 600-weight system typography as the app.
- Progress text describes user-meaningful phases only. Technical component
  details remain in the NSIS detail log.
- Interactive installation retains the familiar directory choice, desktop
  shortcut option and launch option. Passive in-app updates retain `/P`,
  `/UPDATE` and `/R` behaviour and do not show these pages.
- Uninstall keeps local data by default. The user must explicitly select
  “同时删除本机数据与偏好设置” to remove it.

## Assets

Tauri/NSIS requires uncompressed bitmap assets with these dimensions:

- `assets/installer-header.bmp`: 150 × 57, 24-bit RGB
- `assets/installer-sidebar.bmp`: 164 × 314, 24-bit RGB

Regenerate both deterministically from the rounded desktop icon:

~~~powershell
node src-tauri/windows/generate-installer-assets.mjs
~~~

## Verification

Run the static installer contracts:

~~~powershell
npx vitest run tests/desktop-installer-experience.test.ts tests/desktop-package-release.test.mjs
~~~

Compile an unsigned QA installer without changing updater signing behaviour:

~~~powershell
npx tauri bundle --bundles nsis --no-sign --ci --config '{"productName":"SeekOffer Installer QA","bundle":{"createUpdaterArtifacts":false}}'
~~~

Do not use the QA artifact for release. A real updater artifact still goes
through the existing signing, hash, candidate and production verification
workflow.
