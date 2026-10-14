import { test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { editorDocument } from "../src/editor/generated/document";
import { validateDoc, type DocNode } from "../src/data/model";
const doc: DocNode = {
  type: "doc",
  content: [
    {
      type: "heading",
      attrs: { level: 2 },
      content: [
        {
          type: "text",
          text: "Thought",
          marks: [{ type: "bold" }, { type: "italic" }],
        },
      ],
    },
    {
      type: "taskList",
      content: [
        {
          type: "taskItem",
          attrs: { checked: true },
          content: [
            { type: "paragraph", content: [{ type: "text", text: "Done" }] },
          ],
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
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Cell" }],
                },
              ],
            },
            {
              type: "tableCell",
              attrs: { colspan: 1, rowspan: 1, colwidth: null },
              content: [{ type: "paragraph" }],
            },
          ],
        },
      ],
    },
  ],
};
const pause = () => new Promise((r) => setTimeout(r, 30));
test("bundled editor loads offline, preserves structured JSON and toggles checklist completion", async () => {
  const messages: any[] = [];
  const errors: unknown[] = [];
  const html = editorDocument.replace(
    "__CONFIG__",
    JSON.stringify({
      content: doc,
      background: "#fff",
      text: "#111",
      muted: "#666",
      line: "#ddd",
      accent: "#456",
      font: "system",
      focus: false,
    }),
  );
  const dom = new JSDOM(html, {
    runScripts: "dangerously",
    pretendToBeVisual: true,
    beforeParse(w) {
      (w as any).ReactNativeWebView = {
        postMessage: (raw: string) => messages.push(JSON.parse(raw)),
      };
      w.addEventListener("error", (e) => errors.push(e.error));
    },
  });
  await pause();
  assert.deepEqual(errors, []);
  assert.ok(messages.some((m) => m.type === "ready"));
  (dom.window as any).offdayCommand({ type: "snapshot", request: "test" });
  let snapshot = messages.find((m) => m.type === "snapshot");
  validateDoc(snapshot.content);
  assert.equal(snapshot.content.content[0].content[0].text, "Thought");
  assert.equal(snapshot.content.content[1].content[0].attrs.checked, true);
  assert.equal(
    snapshot.content.content[2].content[0].content[0].content[0].content[0]
      .text,
    "Cell",
  );
  (
    dom.window.document.querySelector(
      "input[type=checkbox]",
    ) as HTMLInputElement
  ).click();
  await pause();
  (dom.window as any).offdayCommand({ type: "snapshot", request: "toggle" });
  snapshot = messages.find((m) => m.request === "toggle");
  assert.equal(snapshot.content.content[1].content[0].attrs.checked, false);
  assert.ok(messages.some((m) => m.type === "change"));
  assert.equal(
    dom.window.document.querySelectorAll("#toolbar button").length,
    10,
  );
  assert.equal(dom.window.document.querySelector("script[src]"), null);
  assert.equal(dom.window.document.querySelector("img"), null);
  dom.window.close();
});
test("malformed structure, unsafe links and inconsistent tables rejected", () => {
  for (const content of [
    { type: "doc", content: [{ type: "text", text: "Invalid block" }] },
    {
      type: "doc",
      content: [
        { type: "table", content: [{ type: "tableRow", content: [] }] },
      ],
    },
    {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "x",
              marks: [{ type: "link", attrs: { href: "file:///secret" } }],
            },
          ],
        },
      ],
    },
  ])
    assert.throws(() => validateDoc(content));
});
test("bundled table commands insert and change editable rows and columns", async () => {
  const messages: any[] = [];
  const html = editorDocument.replace(
    "__CONFIG__",
    JSON.stringify({
      content: { type: "doc", content: [{ type: "paragraph" }] },
      background: "#fff",
      text: "#111",
      muted: "#666",
      line: "#ddd",
      accent: "#456",
      font: "system",
      focus: false,
    }),
  );
  const dom = new JSDOM(html, {
    runScripts: "dangerously",
    pretendToBeVisual: true,
    beforeParse(w) {
      (w as any).ReactNativeWebView = {
        postMessage: (s: string) => messages.push(JSON.parse(s)),
      };
      w.Range.prototype.getClientRects = () => [] as any;
      w.Range.prototype.getBoundingClientRect = () =>
        ({ top: 0, bottom: 0, left: 0, right: 0 }) as DOMRect;
    },
  });
  await pause();
  const click = (label: string) =>
    (
      dom.window.document.querySelector(
        `button[aria-label="${label}"]`,
      ) as HTMLButtonElement
    ).click();
  click("More formatting");
  click("Insert table");
  await pause();
  click("Add row");
  click("Add column");
  await pause();
  (dom.window as any).offdayCommand({ type: "snapshot", request: "table" });
  const snapshot = messages.find((m) => m.request === "table");
  validateDoc(snapshot.content);
  const table = snapshot.content.content.find(
    (n: DocNode) => n.type === "table",
  );
  assert.equal(table.content.length, 3);
  assert.equal(table.content[0].content.length, 3);
  click("Delete row");
  click("Delete column");
  await pause();
  (dom.window as any).offdayCommand({ type: "snapshot", request: "smaller" });
  const smaller = messages
    .find((m) => m.request === "smaller")
    .content.content.find((n: DocNode) => n.type === "table");
  assert.equal(smaller.content.length, 2);
  assert.equal(smaller.content[0].content.length, 2);
  dom.window.close();
});

test("keyboard viewport resize keeps the toolbar inside the visible editor and touch buttons keep focus", async () => {
  const viewport = new EventTarget() as EventTarget & { height: number };
  viewport.height = 700;
  const html = editorDocument.replace(
    "__CONFIG__",
    JSON.stringify({
      content: doc,
      background: "#fff",
      text: "#111",
      muted: "#666",
      line: "#ddd",
      accent: "#456",
      font: "system",
      focus: false,
    }),
  );
  const dom = new JSDOM(html, {
    runScripts: "dangerously",
    pretendToBeVisual: true,
    beforeParse(w) {
      Object.defineProperty(w, "visualViewport", { value: viewport });
      (w as any).ReactNativeWebView = { postMessage: () => {} };
    },
  });
  await pause();
  const root = dom.window.document.documentElement;
  assert.equal(root.style.getPropertyValue("--editor-height"), "700px");
  viewport.height = 280;
  viewport.dispatchEvent(new Event("resize"));
  assert.equal(root.style.getPropertyValue("--editor-height"), "280px");
  const more = dom.window.document.querySelector(
    'button[aria-label="More formatting"]',
  )!;
  const touch = new dom.window.Event("pointerdown", { cancelable: true });
  Object.defineProperty(touch, "pointerType", { value: "touch" });
  more.dispatchEvent(touch);
  assert.equal(touch.defaultPrevented, true);
  viewport.height = 700;
  viewport.dispatchEvent(new Event("resize"));
  assert.equal(root.style.getPropertyValue("--editor-height"), "700px");
  dom.window.close();
});

test("editor applies bare and HTTP links, rejects unsafe input and keeps Black theme with monospace", async () => {
  const messages: any[] = [];
  const dom = new JSDOM(
    editorDocument.replace(
      "__CONFIG__",
      JSON.stringify({
        content: {
          type: "doc",
          content: [
            { type: "paragraph", content: [{ type: "text", text: "Website" }] },
          ],
        },
        background: "#000000",
        text: "#F2F2ED",
        muted: "#A6AAA1",
        line: "#2B2D29",
        accent: "#B2C5A4",
        font: "mono",
        focus: false,
      }),
    ),
    {
      runScripts: "dangerously",
      pretendToBeVisual: true,
      beforeParse(w) {
        w.Range.prototype.getClientRects = () => [] as any;
        w.Range.prototype.getBoundingClientRect = () =>
          ({ top: 0, bottom: 0, left: 0, right: 0 }) as DOMRect;
        (w as any).ReactNativeWebView = {
          postMessage: (raw: string) => messages.push(JSON.parse(raw)),
        };
      },
    },
  );
  await pause();
  const d = dom.window.document;
  assert.equal(d.documentElement.style.colorScheme, "dark");
  assert.ok(d.body.style.fontFamily.includes("monospace"));
  (d.querySelector(".tiptap") as HTMLElement).focus();
  const text = d.querySelector(".tiptap p")!.firstChild!;
  const range = d.createRange();
  range.selectNodeContents(text);
  dom.window.getSelection()!.removeAllRanges();
  dom.window.getSelection()!.addRange(range);
  d.dispatchEvent(new dom.window.Event("selectionchange"));
  await pause();
  const click = (label: string) =>
    (
      d.querySelector(`button[aria-label="${label}"]`) as HTMLButtonElement
    ).click();
  click("Link");
  const input = d.getElementById("link-url") as HTMLInputElement;
  input.value = "javascript:alert(1)";
  click("Apply link");
  assert.equal(d.getElementById("link-dialog")!.hidden, false);
  assert.ok(d.getElementById("link-error")!.textContent);
  input.value = "example.com";
  click("Apply link");
  assert.equal(
    d.querySelector(".tiptap a")?.getAttribute("href"),
    "https://example.com",
  );
  click("Link");
  input.value = "http://example.com";
  click("Apply link");
  assert.equal(
    d.querySelector(".tiptap a")?.getAttribute("href"),
    "http://example.com",
  );
  (dom.window as any).offdayCommand({ type: "snapshot", request: "links" });
  validateDoc(messages.find((m) => m.request === "links").content);
  dom.window.close();
});
