import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Repository, type Database } from "../src/data/repository";
import { Autosave } from "../src/data/autosave";
import {
  ReminderService,
  quickReminderDate,
  type NotificationPort,
} from "../src/data/reminders";
import {
  defaultPreferences,
  displayTitle,
  emptyDoc,
  parseBackup,
  plainText,
  type DocNode,
  type Note,
} from "../src/data/model";
function adapter(db: DatabaseSync): Database {
  return {
    execAsync: async (sql) => {
      db.exec(sql);
    },
    runAsync: async (sql, ...p) => db.prepare(sql).run(...p),
    getFirstAsync: async <T>(sql: string, ...p: (string | number | null)[]) =>
      (db.prepare(sql).get(...p) as T) ?? null,
    getAllAsync: async <T>(sql: string, ...p: (string | number | null)[]) =>
      db.prepare(sql).all(...p) as T[],
  };
}
async function setup() {
  const db = new DatabaseSync(":memory:");
  const repo = new Repository(adapter(db));
  await repo.initialize();
  return { db, repo };
}
const text = (s: string): DocNode => ({
  type: "paragraph",
  content: [{ type: "text", text: s }],
});
const structured: DocNode = {
  type: "doc",
  content: [
    {
      type: "heading",
      attrs: { level: 2 },
      content: [
        {
          type: "text",
          text: "Weekend",
          marks: [{ type: "bold" }, { type: "italic" }],
        },
      ],
    },
    {
      type: "bulletList",
      content: [{ type: "listItem", content: [text("Apples")] }],
    },
    {
      type: "orderedList",
      attrs: { start: 1 },
      content: [{ type: "listItem", content: [text("First")] }],
    },
    {
      type: "taskList",
      content: [
        {
          type: "taskItem",
          attrs: { checked: true },
          content: [text("Finished")],
        },
      ],
    },
    {
      type: "table",
      content: [
        {
          type: "tableRow",
          content: [
            {
              type: "tableCell",
              attrs: { colspan: 1, rowspan: 1, colwidth: null },
              content: [text("Cell text")],
            },
            { type: "tableCell", content: [{ type: "paragraph" }] },
          ],
        },
      ],
    },
    { type: "blockquote", content: [text("A quote")] },
    { type: "horizontalRule" },
  ],
};
function note(id = "n1", content = structured): Note {
  return {
    id,
    title: "",
    content,
    pinned: false,
    archived: false,
    createdAt: 100,
    updatedAt: 100,
  };
}
test("migration, create, edit, pin, archive, restore, delete and empty states", async () => {
  const { db, repo } = await setup();
  await repo.initialize();
  assert.equal(db.prepare("PRAGMA user_version").get()?.user_version, 2);
  assert.deepEqual(await repo.list(), []);
  await repo.create(note());
  await repo.save("n1", "A title", structured);
  assert.equal((await repo.get("n1"))?.title, "A title");
  assert.deepEqual((await repo.get("n1"))?.content, structured);
  await repo.flag("n1", "pinned", true);
  assert.equal((await repo.list())[0].pinned, true);
  await repo.flag("n1", "pinned", false);
  await repo.flag("n1", "archived", true);
  assert.equal((await repo.list()).length, 0);
  assert.equal((await repo.list(true))[0].archived, true);
  await repo.flag("n1", "archived", false);
  await repo.delete("n1");
  assert.equal(await repo.get("n1"), null);
  assert.deepEqual(await repo.list(false, "Weekend"), []);
  db.close();
});
test("autosave persists every structured feature across actual database reopen", async () => {
  const dir = mkdtempSync(join(tmpdir(), "offday-"));
  const path = join(dir, "notes.db");
  let db = new DatabaseSync(path);
  let repo = new Repository(adapter(db));
  await repo.initialize();
  await repo.create(note("n1", emptyDoc));
  const statuses: string[] = [];
  const save = new Autosave<DocNode>(
    (doc) => repo.save("n1", "", doc),
    (s) => statuses.push(s),
    1,
  );
  save.change(structured);
  await save.flush();
  db.close();
  db = new DatabaseSync(path);
  repo = new Repository(adapter(db));
  await repo.initialize();
  assert.deepEqual((await repo.get("n1"))?.content, structured);
  assert.equal(statuses.at(-1), "saved");
  db.close();
  rmSync(dir, { recursive: true });
});
test("autosave retains failed writes and serializes rapid changes", async () => {
  let fail = true;
  const writes: number[] = [];
  const statuses: string[] = [];
  const save = new Autosave<number>(
    async (value) => {
      if (fail) throw new Error("Disk full");
      await new Promise((r) => setTimeout(r, 5));
      writes.push(value);
    },
    (s) => statuses.push(s),
    10000,
  );
  save.change(1);
  await assert.rejects(save.flush());
  assert.equal(statuses.at(-1), "error");
  fail = false;
  const first = save.flush();
  save.change(2);
  save.change(3);
  await Promise.all([first, save.flush()]);
  assert.deepEqual(writes, [1, 3]);
  assert.equal(statuses.at(-1), "saved");
});
test("FTS searches title, checklist and table content, respects archive and handles query syntax", async () => {
  const { repo, db } = await setup();
  await repo.create(note());
  await repo.save("n1", "Pocket notebook", structured);
  for (const query of [
    "Pocket",
    "Finished",
    "Cell",
    "Week",
    '"Weekend" OR *',
  ]) {
    const rows = await repo.list(false, query);
    if (query.includes("OR")) assert.equal(rows.length, 0);
    else assert.equal(rows.length, 1);
  }
  assert.equal((await repo.list(false, "*")).length, 0);
  await repo.flag("n1", "archived", true);
  assert.equal((await repo.list(false, "Pocket")).length, 0);
  assert.equal((await repo.list(true, "Pocket")).length, 1);
  db.close();
});
test("theme, spacing and font preferences survive reopening repository", async () => {
  const { repo, db } = await setup();
  await repo.setPreferences({
    theme: "dark",
    spacing: "compact",
    font: "serif",
  });
  const second = new Repository(adapter(db));
  await second.initialize();
  assert.deepEqual(await second.preferences(), {
    theme: "dark",
    spacing: "compact",
    font: "serif",
  });
  db.close();
});
test("versioned export/import preserves data, skips duplicates and preserves reminder metadata without scheduling", async () => {
  const a = await setup();
  const b = await setup();
  await a.repo.create(note());
  await a.repo.setReminder({
    noteId: "n1",
    scheduledAt: Date.now() + 100000,
    status: "scheduled",
    notificationId: "device-a",
  });
  const backup = parseBackup(JSON.stringify(await a.repo.export()));
  assert.deepEqual(await b.repo.import(backup), { imported: 1, skipped: 0 });
  assert.deepEqual((await b.repo.get("n1"))?.content, structured);
  assert.equal((await b.repo.reminders())[0].status, "needsScheduling");
  assert.equal((await b.repo.reminders())[0].notificationId, null);
  await b.repo.save("n1", "Keep my edit", emptyDoc);
  assert.deepEqual(await b.repo.import(backup), { imported: 0, skipped: 1 });
  assert.equal((await b.repo.get("n1"))?.title, "Keep my edit");
  a.db.close();
  b.db.close();
});
test("invalid backups are rejected without changing existing notes", async () => {
  const { repo, db } = await setup();
  await repo.create(note());
  const before = await repo.export();
  for (const raw of [
    "invalid",
    "{}",
    JSON.stringify({ ...before, version: 99 }),
    JSON.stringify({ ...before, notes: [note(), note()] }),
    JSON.stringify({
      ...before,
      notes: [
        {
          ...note(),
          content: { type: "image", attrs: { src: "https://example.com" } },
        },
      ],
    }),
    JSON.stringify({
      ...before,
      notes: [
        {
          ...note(),
          content: {
            type: "doc",
            content: [
              {
                type: "paragraph",
                content: [
                  {
                    type: "text",
                    text: "Unsafe",
                    marks: [
                      { type: "link", attrs: { href: "javascript:alert(1)" } },
                    ],
                  },
                ],
              },
            ],
          },
        },
      ],
    }),
  ])
    assert.throws(() => parseBackup(raw));
  assert.deepEqual((await repo.export()).notes, before.notes);
  db.close();
});
test("import rolls back every inserted note if SQLite fails mid-transaction", async () => {
  const { repo, db } = await setup();
  await repo.create(note("existing"));
  db.exec(
    "CREATE TRIGGER reject_bad BEFORE INSERT ON notes WHEN NEW.id='bad' BEGIN SELECT RAISE(ABORT,'disk full'); END;",
  );
  await assert.rejects(
    repo.import({
      format: "offday-note",
      version: 1,
      exportedAt: 0,
      notes: [note("good"), note("bad")],
      reminders: [],
    }),
  );
  assert.deepEqual(
    (await repo.list()).map((n) => n.id),
    ["existing"],
  );
  db.close();
});
function port(allowed = true) {
  const entries = new Map<string, number>();
  const p: NotificationPort = {
    permission: async () => allowed,
    schedule: async (id, date) => {
      entries.set(id, date);
      return id;
    },
    cancel: async (id) => {
      entries.delete(id);
    },
    scheduled: async () => [...entries.keys()],
  };
  return { p, entries };
}
test("reminder schedule, replace without duplicates, cancel and complete", async () => {
  const { repo, db } = await setup();
  const n = note();
  await repo.create(n);
  const { p, entries } = port();
  const service = new ReminderService(repo, p);
  const date = Date.now() + 100000;
  await service.schedule(n, date);
  await service.schedule(n, date + 1000);
  assert.equal(entries.size, 1);
  assert.equal((await repo.reminders())[0].scheduledAt, date + 1000);
  await service.cancel(n.id);
  assert.equal(entries.size, 0);
  assert.equal((await repo.reminders())[0].status, "cancelled");
  await service.schedule(n, date);
  await service.cancel(n.id, true);
  assert.equal((await repo.reminders())[0].status, "completed");
  db.close();
});
test("permission denial and invalid times never report scheduling success", async () => {
  const { repo, db } = await setup();
  const n = note();
  await repo.create(n);
  const { p, entries } = port(false);
  const service = new ReminderService(repo, p);
  await assert.rejects(service.schedule(n, Date.now() + 10000), /disabled/);
  await assert.rejects(service.schedule(n, Date.now() - 1000), /future/);
  assert.equal(entries.size, 0);
  assert.equal((await repo.reminders()).length, 0);
  db.close();
});
test("OS scheduling failure leaves reminder needing explicit scheduling", async () => {
  const { repo, db } = await setup();
  const n = note();
  await repo.create(n);
  const { p } = port();
  p.schedule = async () => {
    throw new Error("OS rejected");
  };
  await assert.rejects(
    new ReminderService(repo, p).schedule(n, Date.now() + 10000),
  );
  assert.equal((await repo.reminders())[0].status, "needsScheduling");
  db.close();
});
test("launch reconciles interrupted schedules, lost OS notifications, expirations and orphan notifications", async () => {
  const { repo, db } = await setup();
  const { p, entries } = port();
  const service = new ReminderService(repo, p);
  for (const id of ["a", "b", "c"]) await repo.create(note(id));
  await repo.setReminder({
    noteId: "a",
    scheduledAt: Date.now() + 100000,
    status: "pending",
    notificationId: "offday-a",
  });
  entries.set("offday-a", Date.now() + 100000);
  entries.set("offday-orphan", 0);
  await repo.setReminder({
    noteId: "b",
    scheduledAt: Date.now() + 100000,
    status: "scheduled",
    notificationId: "offday-b",
  });
  await repo.setReminder({
    noteId: "c",
    scheduledAt: 0,
    status: "scheduled",
    notificationId: "offday-c",
  });
  await service.reconcile();
  const rs = await repo.reminders();
  assert.equal(rs.find((r) => r.noteId === "a")?.status, "scheduled");
  assert.equal(rs.find((r) => r.noteId === "b")?.status, "needsScheduling");
  assert.equal(rs.find((r) => r.noteId === "c")?.status, "completed");
  assert.equal(entries.has("offday-orphan"), false);
  db.close();
});
test("foreign keys prevent orphan reminders and delete cascades", async () => {
  const { repo, db } = await setup();
  await assert.rejects(
    repo.setReminder({
      noteId: "missing",
      scheduledAt: 0,
      status: "cancelled",
      notificationId: null,
    }),
  );
  await repo.create(note());
  await repo.setReminder({
    noteId: "n1",
    scheduledAt: 0,
    status: "cancelled",
    notificationId: null,
  });
  await repo.deleteAll();
  assert.equal((await repo.reminders()).length, 0);
  assert.deepEqual(await repo.preferences(), defaultPreferences);
  db.close();
});
test("future schema rejected without modifying database", async () => {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA user_version=99");
  await assert.rejects(new Repository(adapter(db)).initialize(), /newer/);
  assert.equal(db.prepare("PRAGMA user_version").get()?.user_version, 99);
  db.close();
});
test("migration failure rolls back partial schema", async () => {
  const db = new DatabaseSync(":memory:");
  const base = adapter(db);
  const wrapped: Database = {
    ...base,
    execAsync: async (sql) => {
      if (sql.includes("CREATE VIRTUAL TABLE")) {
        db.exec("CREATE TABLE partial(id TEXT)");
        throw new Error("FTS unavailable");
      }
      await base.execAsync(sql);
    },
  };
  await assert.rejects(new Repository(wrapped).initialize());
  assert.equal(
    db.prepare("SELECT name FROM sqlite_master WHERE name='partial'").get(),
    undefined,
  );
  db.close();
});
test("10,000-note indexed search remains responsive with networking unavailable", async () => {
  const { repo, db } = await setup();
  const original = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error("Offline");
  };
  try {
    await repo.import({
      format: "offday-note",
      version: 1,
      exportedAt: 0,
      notes: Array.from({ length: 10000 }, (_, i) =>
        note(String(i), {
          type: "doc",
          content: [text(i === 5000 ? "needle unique" : "An ordinary thought")],
        }),
      ),
      reminders: [],
    });
    const start = performance.now();
    assert.equal((await repo.list(false, "needle")).length, 1);
    assert.ok(performance.now() - start < 500, "FTS search exceeded 500ms");
    await repo.setPreferences(defaultPreferences);
    assert.equal((await repo.export()).notes.length, 10000);
  } finally {
    globalThis.fetch = original;
    db.close();
  }
});
test("title derivation includes structured text and handles empty notes", () => {
  assert.equal(displayTitle(note()), "Weekend");
  assert.equal(displayTitle(note("x", emptyDoc)), "Untitled note");
  assert.match(plainText(structured), /Cell text/);
});
test("web SQLite fallback searches safely when WASM lacks FTS5", async () => {
  const db = new DatabaseSync(":memory:");
  const repo = new Repository(adapter(db), false);
  await repo.initialize();
  await repo.create(note());
  await repo.save("n1", "100% ready", structured);
  assert.equal((await repo.list(false, "100%")).length, 1);
  assert.equal((await repo.list(false, "%")).length, 1);
  assert.equal((await repo.list(false, "Cell text")).length, 1);
  assert.equal((await repo.list(false, "' OR 1=1 --")).length, 0);
  db.close();
});
test("missing notes cannot falsely report a successful save", async () => {
  const { repo, db } = await setup();
  await assert.rejects(repo.save("missing", "", emptyDoc), /no longer/);
  db.close();
});
test("corrupt preference data does not prevent access to notes", async () => {
  const { repo, db } = await setup();
  await repo.create(note());
  db.exec("INSERT INTO settings VALUES('preferences','invalid JSON')");
  assert.deepEqual(await repo.preferences(), defaultPreferences);
  assert.equal((await repo.list()).length, 1);
  db.close();
});
test("interrupted replacement cannot mistake an old schedule for a new one", async () => {
  const { repo, db } = await setup();
  const { p, entries } = port();
  const n = note();
  await repo.create(n);
  const service = new ReminderService(repo, p);
  await service.schedule(n, Date.now() + 100000);
  const old = (await repo.reminders())[0];
  await repo.setReminder({
    ...old,
    status: "pending",
    notificationId: "offday-n1:new-date",
    scheduledAt: Date.now() + 200000,
  });
  await service.reconcile();
  assert.equal(entries.size, 0);
  assert.equal((await repo.reminders())[0].status, "needsScheduling");
  db.close();
});

test("quick reminder choices use local dates and keep later-today within today", () => {
  const late = new Date(2026, 9, 14, 23, 30);
  assert.equal(quickReminderDate("today", late).getDate(), late.getDate());
  assert.equal(quickReminderDate("today", late).getHours(), 23);
  assert.throws(
    () => quickReminderDate("today", new Date(2026, 9, 14, 23, 59, 30)),
    /no time/,
  );
  const tomorrow = quickReminderDate("tomorrow", late);
  assert.equal(tomorrow.getDate(), 15);
  assert.equal(tomorrow.getHours(), 9);
  const saturday = quickReminderDate("weekend", late);
  assert.equal(saturday.getDay(), 6);
  assert.equal(saturday.getHours(), 9);
  assert.ok(saturday > late);
});

test("soft line breaks remain searchable as separate words and derive the first line", async () => {
  const content: DocNode = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          { type: "text", text: "First thought" },
          { type: "hardBreak" },
          { type: "text", text: "Second thought" },
        ],
      },
    ],
  };
  assert.equal(plainText(content), "First thought\nSecond thought");
  assert.equal(displayTitle(note("soft", content)), "First thought");
  const { repo, db } = await setup();
  await repo.create(note("soft", content));
  assert.equal((await repo.list(false, "Second")).length, 1);
  db.close();
});

test("Black and every editor font persist without changing the existing Olive preference", async () => {
  const { db, repo } = await setup();
  for (const font of ["system", "sans", "serif", "book", "mono"] as const) {
    await repo.setPreferences({ theme: "black", spacing: "compact", font });
    const reopened = new Repository(adapter(db));
    assert.deepEqual(await reopened.preferences(), {
      theme: "black",
      spacing: "compact",
      font,
    });
  }
  await repo.setPreferences({
    theme: "dark",
    spacing: "comfortable",
    font: "serif",
  });
  assert.equal((await new Repository(adapter(db)).preferences()).theme, "dark");
  db.close();
});

test("discarding autosave cancels queued edits and ignores late editor messages after deletion", async () => {
  const { db, repo } = await setup();
  await repo.create(note());
  const statuses: string[] = [];
  let writes = 0;
  const saver = new Autosave<DocNode>(
    async (doc) => {
      writes++;
      await repo.save("n1", "", doc);
    },
    (s) => statuses.push(s),
    5,
  );
  saver.change(structured);
  await repo.delete("n1");
  saver.discard();
  saver.change(structured);
  await saver.flush();
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(writes, 0);
  assert.equal(await repo.get("n1"), null);
  assert.deepEqual(await repo.list(), []);
  assert.deepEqual(await repo.list(false, "Weekend"), []);
  assert.deepEqual(statuses, ["saving"]);
  db.close();
});

test("tag migration preserves version-one notes, reminders and preferences", async () => {
  const db = new DatabaseSync(":memory:");
  const { migration } = await import("../src/data/repository");
  db.exec(migration);
  const old = new Repository(adapter(db));
  await old.create(note());
  await old.setPreferences({
    theme: "black",
    spacing: "compact",
    font: "mono",
  });
  await old.setReminder({
    noteId: "n1",
    scheduledAt: 100,
    status: "completed",
    notificationId: null,
  });
  const upgraded = new Repository(adapter(db));
  await upgraded.initialize();
  await upgraded.initialize();
  assert.equal(db.prepare("PRAGMA user_version").get()?.user_version, 2);
  assert.deepEqual((await upgraded.get("n1"))?.content, structured);
  assert.equal((await upgraded.preferences()).theme, "black");
  assert.equal((await upgraded.reminders())[0].status, "completed");
  assert.deepEqual(await upgraded.tags(), []);
  db.close();
});

test("colored tags persist, deduplicate names, assign multiple tags and roll back invalid assignment", async () => {
  const { db, repo } = await setup();
  await repo.create(note());
  const education = await repo.createTag({
    id: "education",
    name: "  Education  ",
    color: "#648A5A",
  });
  const meeting = await repo.createTag({
    id: "meeting",
    name: "Meeting",
    color: "#4E83C8",
  });
  assert.deepEqual(
    await repo.createTag({
      id: "duplicate",
      name: "education",
      color: "#CD7288",
    }),
    education,
  );
  assert.equal((await repo.tags()).length, 2);
  await repo.setNoteTags("n1", [meeting.id, education.id, meeting.id]);
  const reopened = new Repository(adapter(db));
  assert.deepEqual(await reopened.tags("n1"), [education, meeting]);
  await assert.rejects(repo.setNoteTags("n1", ["education", "missing"]));
  assert.deepEqual(await repo.tags("n1"), [education, meeting]);
  await assert.rejects(repo.setNoteTags("missing-note", [education.id]));
  await repo.flag("n1", "archived", true);
  assert.deepEqual(await repo.tags("n1"), [education, meeting]);
  await repo.setNoteTags("n1", [meeting.id]);
  assert.deepEqual(await repo.tags("n1"), [meeting]);
  for (const invalid of [
    { id: "x", name: " ", color: "#648A5A" },
    { id: "x", name: "x".repeat(41), color: "#648A5A" },
    { id: "x", name: "Okay", color: "red" },
  ])
    assert.throws(() => repo.createTag(invalid));
  await repo.delete("n1");
  assert.deepEqual(await repo.noteTags(), []);
  assert.equal((await repo.tags()).length, 2); // Reusable tags survive note deletion.
  db.close();
});

test("tagged backups restore colors, merge names safely, remap ID collisions and skip existing note assignments", async () => {
  const a = await setup(),
    b = await setup();
  await a.repo.create(note());
  await a.repo.createTag({
    id: "same-id",
    name: "Education",
    color: "#648A5A",
  });
  await a.repo.createTag({ id: "meeting", name: "Meeting", color: "#4E83C8" });
  await a.repo.setNoteTags("n1", ["same-id", "meeting"]);
  const backup = parseBackup(JSON.stringify(await a.repo.export()));
  assert.equal(backup.version, 2);
  await b.repo.createTag({
    id: "local-edu",
    name: "education",
    color: "#CD7288",
  });
  await b.repo.createTag({ id: "meeting", name: "Private", color: "#B58A38" });
  await b.repo.import(backup);
  const assigned = await b.repo.tags("n1");
  assert.equal(assigned.length, 2);
  assert.equal(assigned.find((t) => t.name === "education")?.color, "#CD7288");
  assert.equal(assigned.find((t) => t.name === "Meeting")?.color, "#4E83C8");
  assert.notEqual(assigned.find((t) => t.name === "Meeting")?.id, "meeting");
  await b.repo.setNoteTags("n1", []);
  await b.repo.import(backup);
  assert.deepEqual(await b.repo.tags("n1"), []);
  const legacy = { ...backup, version: 1 as const };
  delete legacy.tags;
  delete legacy.noteTags;
  assert.equal(parseBackup(JSON.stringify(legacy)).version, 1);
  for (const invalid of [
    { ...backup, tags: [{ ...backup.tags![0], color: "not-a-color" }] },
    { ...backup, tags: [backup.tags![0], backup.tags![0]] },
    { ...backup, noteTags: [{ noteId: "missing", tagId: "same-id" }] },
    { ...backup, noteTags: [backup.noteTags![0], backup.noteTags![0]] },
    { ...backup, tags: undefined },
  ])
    assert.throws(() => parseBackup(JSON.stringify(invalid)));
  a.db.close();
  b.db.close();
});

test("tag import failure rolls back tag definitions and notes together", async () => {
  const { db, repo } = await setup();
  db.exec(
    "CREATE TRIGGER reject_import BEFORE INSERT ON note_tags BEGIN SELECT RAISE(ABORT,'disk full'); END;",
  );
  await assert.rejects(
    repo.import({
      format: "offday-note",
      version: 2,
      exportedAt: 0,
      notes: [note()],
      reminders: [],
      tags: [{ id: "tag", name: "Meeting", color: "#4E83C8" }],
      noteTags: [{ noteId: "n1", tagId: "tag" }],
    }),
  );
  assert.deepEqual(await repo.tags(), []);
  assert.deepEqual(await repo.list(), []);
  db.close();
});
