# OFFDAY Note

A quiet, offline notebook for Android and iOS, built with Expo 57, React Native and TypeScript. No accounts, backend, analytics, remote editor assets or cloud sync. All note data lives in local SQLite.

## Run

Use Node 24 or newer (the test suite uses Node's SQLite implementation).

```sh
npm ci
npm run check
npm start
```

Open the project with an SDK 57-compatible Expo Go to try the UI. Notifications and platform configuration must also be tested in a standalone app. Expo Go and Metro are development tools and use networking; the release app blocks Android INTERNET permission.

```sh
# Generate native projects from app.json; never hand-edit them.
npx expo prebuild --platform android --no-install
npm run android   # release build; requires Android SDK, JDK and connected device

# On a Mac with full Xcode, CocoaPods and signing configured:
npx expo prebuild --platform ios
npm run ios       # Release configuration
```

For an APK without a connected device:

```sh
npm run build:editor
cd android
NODE_ENV=production ./gradlew :app:assembleRelease
```

Expo's generated local release uses the debug signing key for testing. Configure your own signing / EAS credentials before store distribution. This repository does not contain publishing credentials. Native directories and build artifacts are ignored by Git.

`npm run web` builds and serves a browser preview at http://localhost:8084. This preview uses actual browser SQLite storage and the same editor. It is an additional testing surface, not a replacement for the mobile apps. Local notifications require Android/iOS. Browser storage is separate from mobile storage and can be cleared by the browser. Keep backups. The preview server sets COOP/COEP headers needed by SQLite WASM.

## Features

- Notes with an optional title; untitled notes derive their display title from body content.
- Reliable debounced autosave, serialized writes, flush on navigation/background, visible save failure and retry.
- Pinned/recent lists, archive/restore, live local search and confirmed deletion.
- Structured paragraphs, three heading levels, bold/italic, lists, interactive checklists, links, quotes and dividers.
- Editable tables: insert 2 × 2, add/delete rows and columns, navigate cells, horizontal scrolling, multiline cells. Select a cell to show contextual table actions.
- Undo/redo for the current editing session. `H` cycles H1/H2/H3; More → Paragraph restores ordinary text.
- One-time local reminders, permission on first scheduling attempt, custom system date/time pickers, replacement/cancellation/completion and restart reconciliation. Tapping a notification opens its note.
- White/Olive/Black/system appearance, comfortable/compact spacing, and System/Sans/Serif/Book/Monospace editor fonts. Preferences persist in SQLite.
- Versioned JSON backup through native share/document facilities; validated preview and transactional restore. Existing IDs are skipped, never overwritten.
- Strong confirmation for clearing the entire notebook.

## Architecture

- `src/data/repository.ts`: independent data-access layer, transactions, foreign keys, transactional migrations to `user_version=2`, indexes, native FTS5 and a serialized operation queue.
- `src/data/model.ts`: structured content, plain-text extraction, title derivation and import validation with size/depth/count limits.
- `src/data/autosave.ts`: 350ms debounce, serialized in-flight writes, latest-revision handling and retained dirty state on failure.
- `src/data/reminders.ts`: testable notification service. Pending records are written before OS scheduling; unique identifiers distinguish old and new schedules across interruptions. Launch/foreground reconciliation detects expired, missing and orphan schedules.
- `src/data/notifications.ts`: Expo local notifications adapter; never registers a remote push token.
- `src/editor/engine.ts`: maintained Tiptap/ProseMirror editor with StarterKit, task-list and table extensions. `npm run build:editor` bundles everything into a local inline HTML document. No CDN, fonts, image loading, network requests or remote resources are needed. CSP blocks network access.
- `src/editor/canvas.tsx`: WebView command/message bridge with acknowledged snapshots before navigation. Browser preview uses a sandboxed iframe.
- `src/state/app.tsx`: SQLite-backed preferences and theme tokens.
- `src/app/`: Expo Router screens; secondary actions use sheets rather than a bottom tab bar.

See [implementation decisions](docs/IMPLEMENTATION.md) and [backup format](docs/BACKUP.md).

Native FTS5 searches word prefixes across titles and all structured text, including checklists and table cells. The Expo SQLite web WASM build lacks FTS5, so the preview uses escaped `LIKE` queries. Expo 57's development worker serializer also has an [upstream issue](https://github.com/expo/expo/issues/50153); the web command serves a production export to avoid that path.

## Data safety and limitations

SQLite uses WAL and transactionally applies migrations and restores. A failed import preserves existing notes. Autosave waits 350ms after changes and flushes when leaving/backgrounding; force-killing the process or losing power before a write completes can still lose the latest keystrokes. Save failures retain the editor's dirty content for retry while it remains open.

Imports preserve reminder dates but clear device-specific notification identifiers. Imported active reminders say “needs scheduling”; schedule them explicitly on the receiving device. Exporting does not automatically store the backup anywhere: finish the operating system's save/share flow.

Notes and JSON backups are not encrypted by this app. Device access controls protect the database; protect exported files yourself. Android application backup is disabled. System-level iOS/device backups follow operating system settings. Uninstalling the app may remove local data.

Android release configuration removes INTERNET, network-state, overlay, microphone and broad storage permissions. File access is user-initiated through the document picker. Native notifications require user permission; Android battery policies may delay delivery. Reminders are one-time, anchored to the selected absolute instant. Repeating reminders, attachments, images, merged cells, spreadsheets and cross-session undo history are intentionally outside V1.

Before store release, verify screen readers, keyboard placement, selection/IME behavior, system picker/share flows, notification delivery after process termination/reboot, and airplane-mode behavior on real Android and iOS devices. Bundling and automated tests do not establish those device behaviors.

## Verification

```sh
npm run check                         # rebuild editor, typecheck, lint, tests
npx expo-doctor                       # Expo configuration/dependency checks
npx expo export --platform all        # Android/iOS Hermes bundles + browser export
```

Tests run the same repository SQL against real SQLite, including disk reopen, formatted-content persistence, retries, FTS title/body search, pin/archive/delete, preference persistence, schema failure rollback, 10,000-note search, notification permission/failure/recovery, valid/invalid/duplicate backups and atomic import rollback. The bundled editor is executed in JSDOM to verify checklist and table commands. Notification tests use a deterministic OS adapter; they do not claim real delivery.

Browser checks exercised creation, autosave/reopen, table cell editing and 3 × 3 structure, searching table text, checklist Enter continuation/completion persistence, and light-theme persistence. No sample notes are inserted into new mobile installations.

Native build and verification results are recorded in [verification notes](docs/VERIFICATION.md).

### Latest design update

White, Olive and Black themes; hidden scrollbars; direct Settings access beside search; swipe right to pin and left to archive/restore; compact save-status icons; simplified reminders; HTTP/HTTPS and bare-domain links; and System, Sans, Serif, Book and Monospace editor font choices. Fonts use offline platform fallbacks. The ON app icon is retained. See [run instructions](docs/RUN.md) for the commands to build locally; this revision was source-checked without building or committing the app.

### Colored tags and note actions

Hold a note to open actions for tags, reminders, pinning, archive/restore and confirmed deletion. Choose Add tags to select multiple tags or create a name and choose one of six colors. Tap Tags below the title while writing a new or existing note for the same sheet. Tap Save tags to save assignments. Tag creation opens separately through ＋ Create tag, with Create & select returning to the selection view. Small colored chips appear in the editor and note list. Tags persist offline and are included in version 2 backups; version 1 backups remain supported.
