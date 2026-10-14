import {
  defaultPreferences,
  plainText,
  validateDoc,
  type Backup,
  type DocNode,
  type Note,
  type Preferences,
  type Reminder,
} from "./model";
export interface Database {
  execAsync(sql: string): Promise<void>;
  runAsync(
    sql: string,
    ...params: (string | number | null)[]
  ): Promise<unknown>;
  getFirstAsync<T>(
    sql: string,
    ...params: (string | number | null)[]
  ): Promise<T | null>;
  getAllAsync<T>(
    sql: string,
    ...params: (string | number | null)[]
  ): Promise<T[]>;
}
export const migration = `
CREATE TABLE notes (id TEXT PRIMARY KEY, title TEXT NOT NULL, content_json TEXT NOT NULL, body_text TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, is_pinned INTEGER NOT NULL DEFAULT 0, is_archived INTEGER NOT NULL DEFAULT 0);
CREATE INDEX notes_order ON notes(is_archived, is_pinned DESC, updated_at DESC);
CREATE VIRTUAL TABLE notes_fts USING fts5(title, body_text, content='notes', content_rowid='rowid', tokenize='unicode61');
CREATE TRIGGER notes_ai AFTER INSERT ON notes BEGIN INSERT INTO notes_fts(rowid,title,body_text) VALUES(new.rowid,new.title,new.body_text); END;
CREATE TRIGGER notes_ad AFTER DELETE ON notes BEGIN INSERT INTO notes_fts(notes_fts,rowid,title,body_text) VALUES('delete',old.rowid,old.title,old.body_text); END;
CREATE TRIGGER notes_au AFTER UPDATE ON notes BEGIN INSERT INTO notes_fts(notes_fts,rowid,title,body_text) VALUES('delete',old.rowid,old.title,old.body_text); INSERT INTO notes_fts(rowid,title,body_text) VALUES(new.rowid,new.title,new.body_text); END;
CREATE TABLE reminders (note_id TEXT PRIMARY KEY REFERENCES notes(id) ON DELETE CASCADE, scheduled_at INTEGER NOT NULL, status TEXT NOT NULL, notification_id TEXT);
CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
PRAGMA user_version = 1;`;
type Row = {
  id: string;
  title: string;
  content_json: string;
  created_at: number;
  updated_at: number;
  is_pinned: number;
  is_archived: number;
};
const decode = (r: Row): Note => {
  const content: DocNode = JSON.parse(r.content_json);
  validateDoc(content);
  return {
    id: r.id,
    title: r.title,
    content,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    pinned: !!r.is_pinned,
    archived: !!r.is_archived,
  };
};
export class Repository {
  private tail: Promise<unknown> = Promise.resolve();
  constructor(
    readonly db: Database,
    private useFTS = true,
  ) {}
  private serialize<T>(fn: () => Promise<T>): Promise<T> {
    const result = this.tail.then(fn);
    this.tail = result.catch(() => {});
    return result;
  }
  private async transaction<T>(fn: () => Promise<T>): Promise<T> {
    await this.db.execAsync("BEGIN IMMEDIATE");
    try {
      const result = await fn();
      await this.db.execAsync("COMMIT");
      return result;
    } catch (e) {
      await this.db.execAsync("ROLLBACK");
      throw e;
    }
  }
  initialize() {
    return this.serialize(async () => {
      await this.db.execAsync(
        "PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;",
      );
      const v = await this.db.getFirstAsync<{ user_version: number }>(
        "PRAGMA user_version",
      );
      if ((v?.user_version ?? 0) > 1)
        throw new Error(
          "This database requires a newer version of OFFDAY Note.",
        );
      if (!v?.user_version)
        await this.transaction(() =>
          this.db.execAsync(
            this.useFTS
              ? migration
              : migration.replace(
                  /CREATE VIRTUAL TABLE[\s\S]*?(?=CREATE TABLE reminders)/,
                  "",
                ),
          ),
        );
    });
  }
  list(archived = false, query = "") {
    return this.serialize(async () => {
      if (!this.useFTS && query.trim()) {
        const pattern = "%" + query.trim().replace(/[\\%_]/g, "\\$&") + "%";
        return (
          await this.db.getAllAsync<Row>(
            "SELECT * FROM notes WHERE is_archived=? AND (title LIKE ? ESCAPE '\\' OR body_text LIKE ? ESCAPE '\\') ORDER BY is_pinned DESC,updated_at DESC",
            +archived,
            pattern,
            pattern,
          )
        ).map(decode);
      }
      const words = query.match(/[\p{L}\p{N}]+/gu) ?? [];
      const rows = words.length
        ? await this.db.getAllAsync<Row>(
            `SELECT n.* FROM notes n JOIN notes_fts f ON f.rowid=n.rowid WHERE notes_fts MATCH ? AND n.is_archived=? ORDER BY n.is_pinned DESC,n.updated_at DESC`,
            words.map((w) => '"' + w + '"*').join(" AND "),
            +archived,
          )
        : await this.db.getAllAsync<Row>(
            "SELECT * FROM notes WHERE is_archived=? ORDER BY is_pinned DESC,updated_at DESC",
            +archived,
          );
      return query.trim() && !words.length ? [] : rows.map(decode);
    });
  }
  get(id: string) {
    return this.serialize(async () => {
      const r = await this.db.getFirstAsync<Row>(
        "SELECT * FROM notes WHERE id=?",
        id,
      );
      return r ? decode(r) : null;
    });
  }
  private insert(n: Note) {
    return this.db.runAsync(
      "INSERT INTO notes VALUES(?,?,?,?,?,?,?,?)",
      n.id,
      n.title,
      JSON.stringify(n.content),
      plainText(n.content),
      n.createdAt,
      n.updatedAt,
      +n.pinned,
      +n.archived,
    );
  }
  create(n: Note) {
    validateDoc(n.content);
    return this.serialize(() => this.insert(n));
  }
  save(id: string, title: string, content: DocNode) {
    validateDoc(content);
    return this.serialize(async () => {
      const result = (await this.db.runAsync(
        "UPDATE notes SET title=?,content_json=?,body_text=?,updated_at=MAX(updated_at,?) WHERE id=?",
        title,
        JSON.stringify(content),
        plainText(content),
        Date.now(),
        id,
      )) as { changes: number };
      if (result.changes === 0)
        throw new Error("This note is no longer available.");
    });
  }

  flag(id: string, key: "pinned" | "archived", value: boolean) {
    return this.serialize(() =>
      this.db.runAsync(
        `UPDATE notes SET ${key === "pinned" ? "is_pinned" : "is_archived"}=?,updated_at=MAX(updated_at,?) WHERE id=?`,
        +value,
        Date.now(),
        id,
      ),
    );
  }
  delete(id: string) {
    return this.serialize(() =>
      this.db.runAsync("DELETE FROM notes WHERE id=?", id),
    );
  }
  deleteAll() {
    return this.serialize(() =>
      this.transaction(() => this.db.execAsync("DELETE FROM notes;")),
    );
  }
  preferences() {
    return this.serialize(async () => {
      const row = await this.db.getFirstAsync<{ value: string }>(
        "SELECT value FROM settings WHERE key='preferences'",
      );
      if (!row) return defaultPreferences;
      try {
        const p = JSON.parse(row.value);
        return {
          theme: ["system", "light", "dark", "black"].includes(p.theme)
            ? p.theme
            : "system",
          spacing: ["comfortable", "compact"].includes(p.spacing)
            ? p.spacing
            : "comfortable",
          font: ["system", "sans", "serif", "book", "mono"].includes(p.font)
            ? p.font
            : "system",
        } as Preferences;
      } catch {
        return defaultPreferences;
      }
    });
  }
  setPreferences(p: Preferences) {
    return this.serialize(() =>
      this.db.runAsync(
        "INSERT INTO settings VALUES('preferences',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
        JSON.stringify(p),
      ),
    );
  }
  reminders() {
    return this.serialize(() =>
      this.db.getAllAsync<Reminder>(
        "SELECT note_id AS noteId,scheduled_at AS scheduledAt,status,notification_id AS notificationId FROM reminders",
      ),
    );
  }
  setReminder(r: Reminder) {
    return this.serialize(() =>
      this.db.runAsync(
        "INSERT INTO reminders VALUES(?,?,?,?) ON CONFLICT(note_id) DO UPDATE SET scheduled_at=excluded.scheduled_at,status=excluded.status,notification_id=excluded.notification_id",
        r.noteId,
        r.scheduledAt,
        r.status,
        r.notificationId,
      ),
    );
  }
  export() {
    return this.serialize(() =>
      this.transaction(
        async () =>
          ({
            format: "offday-note",
            version: 1,
            exportedAt: Date.now(),
            notes: (
              await this.db.getAllAsync<Row>(
                "SELECT * FROM notes ORDER BY created_at",
              )
            ).map(decode),
            reminders: await this.db.getAllAsync<Reminder>(
              "SELECT note_id AS noteId,scheduled_at AS scheduledAt,status,notification_id AS notificationId FROM reminders",
            ),
          }) as Backup,
      ),
    );
  }
  import(b: Backup) {
    return this.serialize(() =>
      this.transaction(async () => {
        let imported = 0;
        for (const n of b.notes) {
          if (
            await this.db.getFirstAsync("SELECT id FROM notes WHERE id=?", n.id)
          )
            continue;
          await this.insert(n);
          imported++;
          const r = b.reminders.find((r) => r.noteId === n.id);
          if (r)
            await this.db.runAsync(
              "INSERT INTO reminders VALUES(?,?,?,NULL)",
              r.noteId,
              r.scheduledAt,
              ["scheduled", "pending", "needsScheduling"].includes(r.status)
                ? "needsScheduling"
                : r.status,
            );
        }
        return { imported, skipped: b.notes.length - imported };
      }),
    );
  }
}
