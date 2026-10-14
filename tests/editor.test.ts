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
  const checkbox = dom.window.document.querySelector("input[type=checkbox]")!;
  const item = checkbox.closest("li")!;
  assert.equal(item.dataset.type, "taskItem");
  assert.equal(dom.window.getComputedStyle(item).display, "flex");
  assert.equal(dom.window.getComputedStyle(item).flexDirection, "row");
  assert.equal(item.children[0].tagName, "LABEL");
  assert.equal(item.children[1].tagName, "DIV");
  assert.equal(
    dom.window.getComputedStyle(item.querySelector("p")!).marginBottom,
    "0px",
  );
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

function blankEditor() {
  const messages: any[] = [];
  const dom = new JSDOM(
    editorDocument.replace(
      "__CONFIG__",
      JSON.stringify({
        content: { type: "doc", content: [{ type: "paragraph" }] },
        background: "#FFFFFF",
        text: "#242823",
        muted: "#656C60",
        line: "#E1E2D8",
        accent: "#536749",
        font: "system",
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
  const d = dom.window.document;
  const button = (label: string) =>
    d.querySelector(`button[aria-label="${label}"]`) as HTMLButtonElement;
  const snapshot = () => {
    (dom.window as any).offdayCommand({
      type: "snapshot",
      request: String(messages.length),
    });
    return messages.at(-1).content as DocNode;
  };
  return { dom, d, button, snapshot };
}

test("blank editor shows the writing cue and Bold/Italic activate immediately before typing", async () => {
  const { dom, d, button, snapshot } = blankEditor();
  await pause();
  assert.equal(
    (d.querySelector(".tiptap") as HTMLElement).dataset.empty,
    "true",
  );
  assert.ok(d.querySelector(".tiptap p br")); // ProseMirror's trailing BR no longer hides the cue.
  for (const label of ["Bold", "Italic"]) {
    assert.equal(button(label).getAttribute("aria-pressed"), "false");
    button(label).click();
    assert.equal(button(label).getAttribute("aria-pressed"), "true");
    assert.equal(snapshot().content![0].content, undefined);
    button(label).click();
    assert.equal(button(label).getAttribute("aria-pressed"), "false");
  }
  dom.window.close();
});

test("heading chooser supports H1–H6 and the toolbar superscript follows the selected level", async () => {
  const { dom, d, button, snapshot } = blankEditor();
  await pause();
  for (const level of [1, 2, 3, 4, 5, 6]) {
    button("Heading").dispatchEvent(
      new dom.window.MouseEvent("contextmenu", {
        bubbles: true,
        cancelable: true,
      }),
    );
    assert.equal(d.getElementById("heading-levels")!.hidden, false);
    button(`Heading ${level}`).click();
    assert.equal(d.getElementById("heading-levels")!.hidden, true);
    assert.equal(
      button("Heading").querySelector("sup")?.textContent,
      String(level),
    );
    const content = snapshot();
    validateDoc(content);
    assert.equal(content.content![0].attrs?.level, level);
  }
  button("Heading").dispatchEvent(
    new dom.window.MouseEvent("contextmenu", {
      bubbles: true,
      cancelable: true,
    }),
  );
  button("Paragraph style").click();
  assert.equal(button("Heading").querySelector("sup"), null);
  assert.equal(snapshot().content![0].type, "paragraph");
  dom.window.close();
});

test("adding a link at an empty cursor inserts visible text and editing inside it updates the existing link", async () => {
  const { dom, d, button, snapshot } = blankEditor();
  await pause();
  button("Link").click();
  const input = d.getElementById("link-url") as HTMLInputElement;
  input.value = "example.com";
  button("Apply link").click();
  const anchor = d.querySelector(".tiptap a")!;
  assert.equal(anchor.textContent, "https://example.com");
  assert.equal(anchor.getAttribute("href"), "https://example.com");
  assert.equal(
    (d.querySelector(".tiptap") as HTMLElement).dataset.empty,
    "false",
  );
  validateDoc(snapshot());
  (d.querySelector(".tiptap") as HTMLElement).focus();
  const range = d.createRange();
  range.setStart(anchor.firstChild!, 4);
  range.collapse(true);
  dom.window.getSelection()!.removeAllRanges();
  dom.window.getSelection()!.addRange(range);
  d.dispatchEvent(new dom.window.Event("selectionchange"));
  await pause();
  button("Link").click();
  assert.equal(input.value, "https://example.com");
  input.value = "http://example.org";
  button("Apply link").click();
  assert.equal(d.querySelectorAll(".tiptap a").length, 1);
  assert.equal(
    d.querySelector(".tiptap a")!.getAttribute("href"),
    "http://example.org",
  );
  assert.equal(
    d.querySelector(".tiptap a")!.textContent,
    "https://example.com",
  );
  validateDoc(snapshot());
  dom.window.close();
});

test("heading taps cycle downward, holding opens choices and toolbar drags cancel the hold", async () => {
  const { dom, d, button, snapshot } = blankEditor();
  await pause();
  for (const level of [6, 5, 4, 3, 2, 1, 6]) {
    button("Heading").click();
    assert.equal(snapshot().content![0].attrs?.level, level);
    assert.equal(d.getElementById("heading-levels")!.hidden, true);
  }
  const heading = button("Heading");
  heading.dispatchEvent(
    new dom.window.MouseEvent("pointerdown", {
      clientX: 0,
      clientY: 0,
      cancelable: true,
    }),
  );
  await new Promise((resolve) => setTimeout(resolve, 480));
  heading.dispatchEvent(new dom.window.MouseEvent("pointerup"));
  heading.click();
  assert.equal(d.getElementById("heading-levels")!.hidden, false);
  assert.equal(snapshot().content![0].attrs?.level, 6);
  button("Heading 4").click();
  heading.dispatchEvent(
    new dom.window.MouseEvent("pointerdown", {
      clientX: 0,
      clientY: 0,
      cancelable: true,
    }),
  );
  heading.dispatchEvent(
    new dom.window.MouseEvent("pointermove", { clientX: 40, clientY: 0 }),
  );
  await new Promise((resolve) => setTimeout(resolve, 480));
  heading.dispatchEvent(new dom.window.MouseEvent("pointerup"));
  assert.equal(d.getElementById("heading-levels")!.hidden, true);
  assert.equal(snapshot().content![0].attrs?.level, 4);
  dom.window.close();
});

test("fixed undo and redo controls restore editor changes and reflect history availability", async () => {
  const { dom, d, button, snapshot } = blankEditor();
  await pause();
  assert.equal(button("Undo").parentElement!.id, "history");
  assert.equal(button("Redo").parentElement!.id, "history");
  assert.equal(d.querySelector('#toolbar button[aria-label="Undo"]'), null);
  assert.equal(button("Undo").disabled, true);
  button("Heading").click();
  assert.equal(button("Undo").disabled, false);
  button("Undo").click();
  assert.equal(snapshot().content![0].type, "paragraph");
  assert.equal(button("Redo").disabled, false);
  button("Redo").click();
  assert.equal(snapshot().content![0].attrs?.level, 6);
  dom.window.close();
});
