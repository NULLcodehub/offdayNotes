export type DocNode = {
  type: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
  content?: DocNode[];
};
export const emptyDoc: DocNode = {
  type: "doc",
  content: [{ type: "paragraph" }],
};
export type Note = {
  id: string;
  title: string;
  content: DocNode;
  createdAt: number;
  updatedAt: number;
  pinned: boolean;
  archived: boolean;
};
export type Tag = { id: string; name: string; color: string };
export type NoteTag = { noteId: string; tagId: string };
export function validateTag(tag: Tag) {
  if (
    !tag ||
    typeof tag.id !== "string" ||
    !tag.id ||
    tag.id.length > 200 ||
    typeof tag.name !== "string" ||
    !tag.name.trim() ||
    tag.name.trim().length > 40 ||
    /[\u0000-\u001f\u007f]/.test(tag.name) ||
    typeof tag.color !== "string" ||
    !/^#[\da-f]{6}$/i.test(tag.color)
  )
    throw new Error("Use a tag name of 1–40 characters and a valid color.");
}
export type Reminder = {
  noteId: string;
  scheduledAt: number;
  status:
    "pending" | "scheduled" | "completed" | "cancelled" | "needsScheduling";
  notificationId: string | null;
};
export type Preferences = {
  theme: "system" | "light" | "dark" | "black";
  spacing: "comfortable" | "compact";
  font: "system" | "sans" | "serif" | "book" | "mono";
};
export const defaultPreferences: Preferences = {
  theme: "system",
  spacing: "comfortable",
  font: "system",
};
export function plainText(node: DocNode): string {
  if (node.type === "text") return node.text ?? "";
  if (node.type === "hardBreak") return "\n";
  return (node.content ?? [])
    .map(plainText)
    .join(
      ["paragraph", "heading", "codeBlock"].includes(node.type) ? "" : "\n",
    );
}
export function displayTitle(note: Note): string {
  return (
    note.title.trim() ||
    plainText(note.content)
      .split("\n")
      .find((s) => s.trim())
      ?.trim()
      .slice(0, 90) ||
    "Untitled note"
  );
}
export function safeLink(value: string): boolean {
  return /^(https?:\/\/|mailto:)/i.test(value) && value.length < 2048;
}
const nodes = new Set([
  "doc",
  "paragraph",
  "text",
  "heading",
  "bulletList",
  "orderedList",
  "listItem",
  "taskList",
  "taskItem",
  "blockquote",
  "horizontalRule",
  "hardBreak",
  "table",
  "tableRow",
  "tableCell",
  "tableHeader",
  "codeBlock",
]);
const marks = new Set([
  "bold",
  "italic",
  "strike",
  "code",
  "link",
  "underline",
]);
export function validateDoc(
  value: unknown,
  depth = 0,
  budget = { remaining: 100000 },
): asserts value is DocNode {
  if (
    --budget.remaining < 0 ||
    depth > 50 ||
    !value ||
    typeof value !== "object"
  )
    throw new Error("Invalid or oversized note content.");
  const n = value as DocNode;
  if (
    !nodes.has(n.type) ||
    (depth === 0 && n.type !== "doc") ||
    (n.text !== undefined &&
      (typeof n.text !== "string" || !n.text.length || n.text.length > 1000000))
  )
    throw new Error("Unsupported note content.");
  if (
    n.attrs !== undefined &&
    (!n.attrs || typeof n.attrs !== "object" || Array.isArray(n.attrs))
  )
    throw new Error("Invalid note attributes.");
  if (
    n.type === "heading" &&
    ![1, 2, 3, 4, 5, 6].includes(Number(n.attrs?.level))
  )
    throw new Error("Invalid heading.");
  if (n.type === "taskItem" && typeof n.attrs?.checked !== "boolean")
    throw new Error("Invalid checklist.");
  if (n.type === "tableCell" || n.type === "tableHeader") {
    if ((n.attrs?.colspan ?? 1) !== 1 || (n.attrs?.rowspan ?? 1) !== 1)
      throw new Error("Merged cells are unsupported.");
  }
  if (n.marks !== undefined) {
    if (!Array.isArray(n.marks)) throw new Error("Invalid formatting.");
    for (const m of n.marks)
      if (
        !m ||
        !marks.has(m.type) ||
        (m.type === "link" && !safeLink(String(m.attrs?.href)))
      )
        throw new Error("Unsupported formatting or unsafe link.");
  }
  if (n.type === "text" && typeof n.text !== "string")
    throw new Error("Invalid text.");
  if (n.type !== "text" && n.text !== undefined)
    throw new Error("Text must be inside a text node.");
  if (!["text", "hardBreak"].includes(n.type) && n.marks?.length)
    throw new Error("Formatting must be applied to inline text.");
  if (
    n.attrs?.colwidth != null &&
    (!Array.isArray(n.attrs.colwidth) ||
      n.attrs.colwidth.some(
        (w) => !Number.isSafeInteger(w) || w < 1 || w > 10000,
      ))
  )
    throw new Error("Invalid table width.");
  const children = n.content ?? [];
  const inline = new Set(["text", "hardBreak"]);
  const block = new Set([
    "paragraph",
    "heading",
    "bulletList",
    "orderedList",
    "taskList",
    "blockquote",
    "horizontalRule",
    "table",
    "codeBlock",
  ]);
  const allowed: Record<string, Set<string>> = {
    doc: block,
    paragraph: inline,
    heading: inline,
    codeBlock: new Set(["text"]),
    bulletList: new Set(["listItem"]),
    orderedList: new Set(["listItem"]),
    listItem: block,
    taskList: new Set(["taskItem"]),
    taskItem: block,
    blockquote: block,
    table: new Set(["tableRow"]),
    tableRow: new Set(["tableCell", "tableHeader"]),
    tableCell: block,
    tableHeader: block,
  };
  if (n.content !== undefined && !Array.isArray(n.content))
    throw new Error("Invalid note blocks.");
  if (children.some((child) => !child || !allowed[n.type]?.has(child.type)))
    throw new Error("Invalid block structure.");
  if (
    [
      "doc",
      "listItem",
      "taskItem",
      "blockquote",
      "tableCell",
      "tableHeader",
      "table",
      "tableRow",
      "bulletList",
      "orderedList",
      "taskList",
    ].includes(n.type) &&
    !children.length
  )
    throw new Error("Required note blocks are missing.");
  if (
    ["listItem", "taskItem"].includes(n.type) &&
    children[0]?.type !== "paragraph"
  )
    throw new Error("A list item must begin with a paragraph.");
  if (
    n.type === "table" &&
    children.some((row) => row.content?.length !== children[0]?.content?.length)
  )
    throw new Error("Table rows must have matching cell counts.");
  if (
    n.type === "orderedList" &&
    n.attrs?.start !== undefined &&
    (!Number.isSafeInteger(n.attrs.start) || Number(n.attrs.start) < 1)
  )
    throw new Error("Invalid list numbering.");
  if (n.content !== undefined) {
    if (!Array.isArray(n.content)) throw new Error("Invalid note blocks.");
    for (const child of n.content) validateDoc(child, depth + 1, budget);
  }
}
export type Backup = {
  format: "offday-note";
  version: 1 | 2;
  exportedAt: number;
  notes: Note[];
  reminders: Reminder[];
  tags?: Tag[];
  noteTags?: NoteTag[];
};
export function parseBackup(raw: string): Backup {
  if (raw.length > 25000000) throw new Error("Backup exceeds the 25 MB limit.");
  let b: Backup;
  try {
    b = JSON.parse(raw);
  } catch {
    throw new Error("This file is not valid JSON.");
  }
  if (
    !b ||
    b.format !== "offday-note" ||
    ![1, 2].includes(b.version) ||
    !Number.isSafeInteger(b.exportedAt) ||
    b.exportedAt < 0 ||
    !Array.isArray(b.notes) ||
    !Array.isArray(b.reminders) ||
    b.notes.length > 20000
  )
    throw new Error("Unsupported backup format or version.");
  const ids = new Set<string>();
  for (const [i, n] of b.notes.entries()) {
    try {
      if (
        !n ||
        typeof n.id !== "string" ||
        !n.id ||
        n.id.length > 200 ||
        ids.has(n.id) ||
        typeof n.title !== "string" ||
        n.title.length > 10000 ||
        typeof n.pinned !== "boolean" ||
        typeof n.archived !== "boolean" ||
        !Number.isSafeInteger(n.createdAt) ||
        !Number.isSafeInteger(n.updatedAt) ||
        n.createdAt < 0 ||
        n.updatedAt < n.createdAt
      )
        throw new Error("Invalid metadata or duplicate ID.");
      validateDoc(n.content);
      ids.add(n.id);
    } catch (e) {
      throw new Error(`Note ${i + 1}: ${(e as Error).message}`);
    }
  }
  const reminderIds = new Set<string>();
  for (const r of b.reminders) {
    if (
      !r ||
      !ids.has(r.noteId) ||
      reminderIds.has(r.noteId) ||
      !Number.isSafeInteger(r.scheduledAt) ||
      r.scheduledAt < 0 ||
      ![
        "pending",
        "scheduled",
        "completed",
        "cancelled",
        "needsScheduling",
      ].includes(r.status) ||
      (r.notificationId !== null && typeof r.notificationId !== "string")
    )
      throw new Error("Invalid reminder record.");
    reminderIds.add(r.noteId);
  }
  if (b.version === 2 || b.tags !== undefined || b.noteTags !== undefined) {
    if (
      !Array.isArray(b.tags) ||
      !Array.isArray(b.noteTags) ||
      b.tags.length > 2000 ||
      b.noteTags.length > 200000
    )
      throw new Error("Invalid tag records.");
    const tagIds = new Set<string>();
    const names = new Set<string>();
    for (const tag of b.tags) {
      validateTag(tag);
      const name = tag.name
        .trim()
        .replace(/\s+/g, " ")
        .replace(/[A-Z]/g, (letter) => letter.toLowerCase());
      if (tagIds.has(tag.id) || names.has(name))
        throw new Error("Duplicate tag records.");
      tagIds.add(tag.id);
      names.add(name);
    }
    const links = new Set<string>();
    const counts = new Map<string, number>();
    for (const link of b.noteTags) {
      if (!link || !ids.has(link.noteId) || !tagIds.has(link.tagId))
        throw new Error("Invalid note tag.");
      const key = JSON.stringify([link.noteId, link.tagId]);
      const count = (counts.get(link.noteId) ?? 0) + 1;
      if (links.has(key) || count > 100)
        throw new Error("Duplicate or excessive note tags.");
      links.add(key);
      counts.set(link.noteId, count);
    }
  }
  return b;
}
