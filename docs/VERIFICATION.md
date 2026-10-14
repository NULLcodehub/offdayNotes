# Verification — 14 October 2026

Executed successfully:

- TypeScript strict typecheck and Expo ESLint.
- 26 automated tests against the actual repository SQL using Node SQLite, including reopen from disk, autosave error/retry and rapid edits, rich document round-trip, search, pin/archive/delete, themes, backup validation and transaction rollback, notification scheduling/cancellation/denial/failure/recovery, migrations and a 10,000-note search.
- Bundled Tiptap executed in JSDOM: offline startup, checked state round-trip/toggle, table insertion and row/column addition/deletion.
- Expo Doctor: 21/21 checks.
- Expo exports for Android, iOS and web, including Hermes bytecode for mobile.
- Browser smoke checks on real SQLite WASM storage (including pinning and archive removal from the main list): create, edit, flush navigation, reopen after page reload; editable table changed from 2 × 2 to 3 × 3 and retained cell text; search found table-cell text; Enter continued a checklist; checked state survived reopening; theme persisted after reload.
- Native SQLite compilation flags include `SQLITE_ENABLE_FTS5=1`.

Native Android release APK built successfully (`:app:assembleRelease`). The Expo-generated splash image and autolinking configuration were corrected through app configuration / regeneration. The final incremental build also passed (22 seconds), updating the APK to the final source. No generated native code is edited manually. The APK is for local testing and uses the Expo-generated debug signing key, not store signing credentials.

Not executed: native runtime checks. `adb devices` returned no connected devices, the Android emulator package is absent, and full Xcode/simctl is unavailable (the selected developer directory is CommandLineTools). iOS binary compilation, actual notification delivery/reboot recovery, native share/picker flows, mobile keyboard/IME selection, VoiceOver/TalkBack and real airplane-mode launch remain device acceptance checks. Mock notification adapters verify service logic, not OS delivery.

The browser preview deliberately uses the production export. Expo 57 development bundling fails on SQLite workers; disabling lazy bundling avoids serialization but breaks worker resolution. SQLite's browser WASM also lacks FTS5; the browser uses escaped LIKE queries and native SQLite keeps FTS5. These paths are tested separately.

## Dependency audit

`npm audit` reports 31 dependency entries (19 high, 12 moderate; zero critical) in the current Expo/React Native dependency tree. Root advisories include braces pattern nesting, node-forge signature verification, uuid buffer bounds and decode-uri-component decoding. Many reported “fixes” downgrade Expo to SDK 44 or React Native to 0.72, or mix SDK 58 packages into SDK 57; these are incompatible with this project. No force downgrade or unverified override was applied. Review compatible upstream patches before store distribution. Core app code neither signs certificates, accepts arbitrary glob patterns, requests push tokens nor processes user-provided v3/v5 UUID buffers, but this does not establish that every transitive advisory is irrelevant.

Release networking: Android configuration blocks INTERNET, ACCESS_NETWORK_STATE, overlay, broad storage and microphone permissions; inspection with Android aapt2 confirms all of those permissions are absent from the packaged APK. The packaged manifest also has allowBackup=false. Native dependency inspection confirms push registration in Expo Notifications is initiated by explicit token APIs, which the app never calls. Expo Notifications contains FCM support as a shared dependency, but this app has no Firebase configuration, remote push registration or backend. The editor embeds all code locally and has a network-blocking CSP. No remote images/fonts/analytics are used. Actual iOS network capture is a remaining device check.

Code is uncommitted, as requested. Store signing and publishing have not been performed.

## Android test artifact

`android/app/build/outputs/apk/release/app-release.apk` (101 MB; universal ABIs)

SHA-256: `886b6501189e27274670630be91e39368d9d4cf97badc6590646bf9338224a6f`

The packaged notification dependency also declares boot, wake-lock, badge and Google messaging receiver permissions. They are library capabilities; the app uses one-time local notifications, no badge counts or remote messaging. No INTERNET permission is present. Installing the APK on a device remains a user/device acceptance step.

## Minimal design revision — source checks only

The home headline, empty-state copy and note-count footer were removed. Search is at the top. The new-note + is centered in an empty notebook and floats at the bottom right when notes exist. Settings now uses grouped rows and option sheets. The editor adapts to keyboard/visual-viewport changes and preserves focus for touch toolbar controls.

Typecheck, lint and 27 tests pass for this revision. The viewport regression test simulates a keyboard changing the visual viewport height; it does not establish behavior on a physical keyboard/device combination.

At the user's request, no app build, native regeneration or Expo export was run for this revision. The APK/hash and browser screenshots above describe the preceding version. Use [the updated run instructions](RUN.md) to build the redesigned app.

## ON icon and splash revision — no app build

The supplied PNG is preserved as `assets/brand/on-source.png`. The generated launcher icon is opaque 1024 × 1024; adaptive foreground and monochrome mask have transparent padding within the circular safe zone. The splash has separate transparent black and off-white marks for the app's light/dark backgrounds. The icon and light/dark splash composition were visually inspected. The asset preparation script checks dimensions, transparent source-border preservation and adaptive safe-zone bounds.

Native splash visibility is held until SQLite initialization finishes; initialization errors also dismiss the splash so they remain visible. A brief native fade is configured, with no fixed startup delay.

No prebuild, app export or Android/iOS build was run for this revision. [RUN.md](RUN.md) now includes native regeneration because icon/splash resources require it. The preceding APK/hash and app screenshots remain from the earlier build.

## Additional design polish — source checks only

White/Olive/Black themes, hidden scroll indicators, Settings shortcut, reversible note swipes, compact save-status icons, redesigned reminder controls, safe link normalization and five editor font stacks are implemented. The original ON icon is unchanged. Typecheck and Expo lint passed; all 31 tests passed, including preference persistence, swipe gating and live bundled-editor HTTP/bare-link application. The editor HTML asset was regenerated. No app build, native regeneration, APK or Expo export was run for this revision, and no commit was made. Existing app artifacts remain stale. Native gestures, font appearance, keyboard layout and reminder picker layout need device verification after the user builds.
