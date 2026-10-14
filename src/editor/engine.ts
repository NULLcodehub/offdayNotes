import { normalizeLink } from "../data/links";
import { editorFonts } from "./fonts";
import { Editor } from "@tiptap/core";
import { StarterKit } from "@tiptap/starter-kit";
import { TaskList } from "@tiptap/extension-task-list";
import { TaskItem } from "@tiptap/extension-task-item";
import { TableKit } from "@tiptap/extension-table";
const config = (window as any).__OFFDAY_CONFIG__;
const send = (data: unknown) => {
  const message = JSON.stringify(data);
  if ((window as any).ReactNativeWebView)
    (window as any).ReactNativeWebView.postMessage(message);
  else window.parent.postMessage(message, "*");
};
function theme(c: any) {
  document.documentElement.style.colorScheme = ["#20231F", "#000000"].includes(
    c.background,
  )
    ? "dark"
    : "light";
  document.documentElement.style.setProperty("--bg", c.background);
  document.documentElement.style.setProperty("--text", c.text);
  document.documentElement.style.setProperty("--muted", c.muted);
  document.documentElement.style.setProperty("--line", c.line);
  document.documentElement.style.setProperty("--accent", c.accent);
  document.body.style.fontFamily = editorFonts[c.font] ?? editorFonts.system;
}
theme(config);
let buttons: HTMLButtonElement[] | undefined;
const editor = new Editor({
  element: document.getElementById("editor")!,
  extensions: [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      link: {
        openOnClick: false,
        autolink: false,
        protocols: ["http", "https", "mailto"],
      },
    }),
    TaskList,
    TaskItem.configure({ nested: false }),
    TableKit.configure({
      table: { resizable: false, allowTableNodeSelection: true },
    }),
  ],
  content: config.content,
  autofocus: config.focus ? "end" : false,
  editorProps: {
    attributes: {
      "aria-label": "Note content",
      role: "textbox",
      "aria-multiline": "true",
    },
  },
  onUpdate: ({ editor }) => {
    send({ type: "change", content: editor.getJSON() });
    state();
  },
  onSelectionUpdate: () => state(),
});
// Mobile keyboards can shrink the visual viewport without resizing the WebView.
function resizeEditorViewport() {
  const height = Math.min(
    window.innerHeight,
    window.visualViewport?.height ?? window.innerHeight,
  );
  document.documentElement.style.setProperty("--editor-height", `${height}px`);
  if (editor.isFocused)
    window.requestAnimationFrame(() => editor.commands.scrollIntoView());
}
window.visualViewport?.addEventListener("resize", resizeEditorViewport);
window.addEventListener("resize", resizeEditorViewport);
resizeEditorViewport();

const tools: [string, string, () => void, string?][] = [
  [
    "H",
    "Heading",
    () =>
      editor
        .chain()
        .focus()
        .toggleHeading({
          level: editor.isActive("heading", { level: 1 })
            ? 2
            : editor.isActive("heading", { level: 2 })
              ? 3
              : 1,
        })
        .run(),
    "heading",
  ],
  ["B", "Bold", () => editor.chain().focus().toggleBold().run(), "bold"],
  ["I", "Italic", () => editor.chain().focus().toggleItalic().run(), "italic"],
  [
    "☑",
    "Checklist",
    () => editor.chain().focus().toggleTaskList().run(),
    "taskList",
  ],
  [
    "•",
    "Bulleted list",
    () => editor.chain().focus().toggleBulletList().run(),
    "bulletList",
  ],
  [
    "1.",
    "Numbered list",
    () => editor.chain().focus().toggleOrderedList().run(),
    "orderedList",
  ],
  ["↗", "Link", () => openLink(), "link"],
  [
    "❝",
    "Quote",
    () => editor.chain().focus().toggleBlockquote().run(),
    "blockquote",
  ],
  ["―", "Divider", () => editor.chain().focus().setHorizontalRule().run()],
  [
    "＋",
    "More formatting",
    () => {
      document.getElementById("more")!.hidden =
        !document.getElementById("more")!.hidden;
    },
  ],
];
function makeButton(
  label: string,
  title: string,
  run: () => void,
  parent: HTMLElement,
) {
  const b = document.createElement("button");
  b.textContent = label;
  b.title = title;
  b.setAttribute("aria-label", title);
  b.addEventListener("mousedown", (e) => e.preventDefault());
  // Keep the editor focused on touch devices without blocking toolbar swipes.
  b.addEventListener("pointerdown", (e) => {
    if (e.pointerType !== "mouse") e.preventDefault();
  });
  b.onclick = run;
  parent.appendChild(b);
  return b;
}
buttons = tools.map(([label, title, run]) =>
  makeButton(label, title, run, document.getElementById("toolbar")!),
);
const more = document.getElementById("more")!;
makeButton(
  "Paragraph",
  "Plain paragraph",
  () => editor.chain().focus().setParagraph().run(),
  more,
);
makeButton(
  "Insert 2 × 2 table",
  "Insert table",
  () => {
    editor
      .chain()
      .focus()
      .insertTable({ rows: 2, cols: 2, withHeaderRow: false })
      .run();
    more.hidden = true;
  },
  more,
);
makeButton("Undo", "Undo", () => editor.chain().focus().undo().run(), more);
makeButton("Redo", "Redo", () => editor.chain().focus().redo().run(), more);
const table = document.getElementById("table-actions")!;
makeButton(
  "+ Row",
  "Add row",
  () => editor.chain().focus().addRowAfter().run(),
  table,
);
makeButton(
  "− Row",
  "Delete row",
  () => editor.chain().focus().deleteRow().run(),
  table,
);
makeButton(
  "+ Column",
  "Add column",
  () => editor.chain().focus().addColumnAfter().run(),
  table,
);
makeButton(
  "− Column",
  "Delete column",
  () => editor.chain().focus().deleteColumn().run(),
  table,
);
makeButton(
  "Next cell",
  "Next cell",
  () => editor.chain().focus().goToNextCell().run(),
  table,
);
makeButton(
  "Delete table",
  "Delete table",
  () => editor.chain().focus().deleteTable().run(),
  table,
);
let selection = { from: 0, to: 0 };
function openLink() {
  selection = {
    from: editor.state.selection.from,
    to: editor.state.selection.to,
  };
  const input = document.getElementById("link-url") as HTMLInputElement;
  input.value = editor.getAttributes("link").href || "";
  document.getElementById("link-error")!.textContent = "";
  document.getElementById("link-dialog")!.hidden = false;
  input.focus();
}
makeButton(
  "Apply",
  "Apply link",
  () => {
    const input = document.getElementById("link-url") as HTMLInputElement;
    const href = normalizeLink(input.value);
    if (!href) {
      document.getElementById("link-error")!.textContent =
        "Enter a website, http://, https:// or mailto: address.";
      return;
    }
    editor.chain().focus().setTextSelection(selection).setLink({ href }).run();
    document.getElementById("link-dialog")!.hidden = true;
  },
  document.getElementById("link-buttons")!,
);
makeButton(
  "Remove",
  "Remove link",
  () => {
    editor.chain().focus().setTextSelection(selection).unsetLink().run();
    document.getElementById("link-dialog")!.hidden = true;
  },
  document.getElementById("link-buttons")!,
);
makeButton(
  "Cancel",
  "Cancel link",
  () => {
    document.getElementById("link-dialog")!.hidden = true;
    editor.chain().focus().setTextSelection(selection).run();
  },
  document.getElementById("link-buttons")!,
);
function state() {
  if (!buttons) return;
  tools.forEach((t, i) => {
    const active = !!t[3] && editor.isActive(t[3]!);
    if (t[3]) buttons![i].setAttribute("aria-pressed", String(active));
  });
  table.hidden = !editor.isActive("table");
}
(window as any).offdayCommand = (c: any) => {
  if (c.type === "theme") theme(c);
  if (c.type === "snapshot")
    send({ type: "snapshot", request: c.request, content: editor.getJSON() });
};
window.addEventListener("message", (e) => {
  if (e.source === window.parent && typeof e.data === "string") {
    try {
      (window as any).offdayCommand(JSON.parse(e.data));
    } catch {
      /* Ignore unrelated messages. */
    }
  }
});
window.addEventListener("error", () => send({ type: "error" }));
state();
send({ type: "ready" });
