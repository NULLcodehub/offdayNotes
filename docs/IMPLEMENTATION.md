# OFFDAY Note implementation

Preserve Expo 57, React Native 0.86 and Expo Router. Use native SQLite with WAL, foreign keys, FTS5 and transactional migration version 1. UI operations use a serialized repository; structured content is Tiptap JSON. All timestamps are UTC epoch milliseconds.

Editor evaluation: Pell uses HTML and lacks a complete table editing model. TenTap uses Tiptap inside WebView and supports custom extensions, but tables require a custom web build anyway. Use maintained Tiptap directly, with StarterKit, task lists and TableKit, bundled by esbuild into a local inline WebView document. Tiptap/ProseMirror owns selection, input rules, history, table navigation and structure; this app only supplies a command bridge and mobile toolbar. No CDN or remote resources. Device keyboard/cursor behavior must still be verified on Android and iOS.

Phases: database and theme → home/search/archive/editor/autosave → formatting/tables → local reminders → validated JSON backup → integration tests/typecheck/lint/exports.

Autosave writes after 350ms, serializes writes, retains dirty state on failure, and flushes on navigation/background. Every editor change transfers complete structured JSON. A failed save keeps the editor open and offers retry. Native back gestures are intercepted.

Reminders use deterministic OS identifiers and a pending SQLite record before scheduling. Launch reconciliation resolves interruptions, expired reminders and orphan notifications. Imported reminders preserve their original date but require explicit scheduling on this device. Imports skip existing IDs; they never overwrite existing notes.

No backend, sync, analytics, images or attachments. Release Android blocks INTERNET and disables Android backup; iOS disables file sharing. Development Metro requires internet permission; use a release build to verify offline behavior. SQLite is not encrypted; device security protects local storage. User-generated backup JSON is plaintext.

Browser verification found two Expo web limitations: Metro 57 development worker serialization fails, and the shipped SQLite WASM does not include FTS5. `npm run web` therefore serves a production export with COOP/COEP headers, and the browser repository uses escaped SQLite LIKE queries. Native Android/iOS retain indexed FTS5. Browser reminders explicitly require the mobile app; no fake browser scheduling.
