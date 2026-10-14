import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { transform } from "esbuild";
import { JSDOM } from "jsdom";
import React, { act } from "react";
import type { Tag } from "../src/data/model";
const require = createRequire(import.meta.url);
const { createRoot } = require("react-dom/client") as {
  createRoot: (el: Element) => {
    render: (node: React.ReactNode) => void;
    unmount: () => void;
  };
};

test("tag sheet creates a colored tag, selects several tags and retains choices after a failed save", async () => {
  const code = await transform(await readFile("src/ui/tags.tsx", "utf8"), {
    loader: "tsx",
    jsx: "automatic",
    format: "cjs",
  });
  const dom = new JSDOM('<div id="root"></div>', { url: "http://localhost" });
  const previous = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  const definitions: Tag[] = [
    { id: "meeting", name: "Meeting", color: "#4E83C8" },
  ];
  let inputProps: any,
    closed = 0,
    refreshes = 0,
    failSave = true;
  let assigned: string[] = [],
    shown: Tag[] = [];
  const repo = {
    tags: async (id?: string) => (id ? [] : [...definitions]),
    createTag: async (tag: Tag) => {
      definitions.push(tag);
      return tag;
    },
    setNoteTags: async (_: string, ids: string[]) => {
      if (failSave) throw new Error("Storage full");
      assigned = ids;
    },
  };
  const View = ({ children, style }: any) =>
    React.createElement("div", { style }, children);
  const Pressable = ({
    children,
    onPress,
    accessibilityLabel,
    accessibilityState,
    disabled,
  }: any) =>
    React.createElement(
      "button",
      {
        onClick: onPress,
        "aria-label": accessibilityLabel,
        "aria-checked": accessibilityState?.checked,
        disabled,
      },
      children,
    );
  const Button = ({ label, onPress, disabled }: any) =>
    React.createElement("button", { onClick: onPress, disabled }, label);
  const mocks: Record<string, any> = {
    "react-native": {
      View,
      Pressable,
      TextInput: (props: any) => {
        inputProps = props;
        return React.createElement("input", {
          value: props.value,
          readOnly: true,
        });
      },
    },
    "expo-crypto": { randomUUID: () => "education" },
    "@/state/app": {
      useApp: () => ({
        repo,
        refresh: () => {
          refreshes++;
        },
        colors: { text: "#111", surface: "#eee", line: "#ddd", accent: "#456" },
      }),
    },
    "./common": {
      Label: View,
      Button,
      Message: ({ text }: any) =>
        text ? React.createElement("p", null, text) : null,
      Sheet: ({ children }: any) => View({ children }),
    },
  };
  const module = { exports: {} as any };
  new Function("require", "module", "exports", code.code)(
    (id: string) => mocks[id] ?? require(id),
    module,
    module.exports,
  );
  const root = createRoot(dom.window.document.getElementById("root")!);
  const click = async (label: string) => {
    const button = [...dom.window.document.querySelectorAll("button")].find(
      (b) => b.getAttribute("aria-label") === label || b.textContent === label,
    )!;
    assert.ok(button, label);
    assert.equal(button.disabled, false);
    await act(async () => button.click());
  };
  try {
    await act(async () =>
      root.render(
        React.createElement(module.exports.TagSheet, {
          noteId: "n1",
          close: () => {
            closed++;
          },
          onSaved: (tags: Tag[]) => {
            shown = tags;
          },
        }),
      ),
    );
    await click("Meeting");
    assert.equal(dom.window.document.querySelector("input"), null);
    await click("＋ Create tag");
    assert.ok(dom.window.document.querySelector("input"));
    assert.ok(!dom.window.document.body.textContent!.includes("Save tags"));
    await act(async () => inputProps.onChangeText("Education"));
    await click("Purple tag color");
    await click("Create & select");
    assert.equal(
      definitions.find((t) => t.name === "Education")?.color,
      "#9870BC",
    );
    assert.equal(
      dom.window.document
        .querySelector('button[aria-label="Education"]')
        ?.getAttribute("aria-checked"),
      "true",
    );
    assert.deepEqual(assigned, []); // Creation does not silently save the draft assignment.
    await click("Save tags");
    assert.equal(closed, 0);
    assert.ok(
      dom.window.document.body.textContent!.includes("Tags could not be saved"),
    );
    failSave = false;
    await click("Save tags");
    assert.deepEqual(assigned, ["meeting", "education"]);
    assert.deepEqual(
      shown.map((t) => t.name),
      ["Meeting", "Education"],
    );
    assert.equal(closed, 1);
    assert.equal(refreshes, 1);
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
    Object.assign(globalThis, previous);
  }
});

test("holding a note opens actions, Add tags targets that note, and confirmed list deletion removes it", async () => {
  const code = await transform(await readFile("src/ui/note-list.tsx", "utf8"), {
    loader: "tsx",
    jsx: "automatic",
    format: "cjs",
  });
  const dom = new JSDOM('<div id="root"></div>', { url: "http://localhost" });
  const previous = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  const note = {
    id: "held-note",
    title: "Meeting notes",
    content: { type: "doc", content: [{ type: "paragraph" }] },
    pinned: false,
    archived: false,
    createdAt: 1,
    updatedAt: 1,
  };
  let rowProps: any,
    refreshes = 0,
    cancellations = 0;
  const deleted: string[] = [];
  const wrapper = ({ children }: any) =>
    React.createElement("div", null, children);
  const Button = ({ label, onPress, disabled }: any) =>
    React.createElement("button", { onClick: onPress, disabled }, label);
  const repo = {
    list: async () => [note],
    reminders: async () => [],
    noteTags: async () => [],
    delete: async (id: string) => {
      deleted.push(id);
    },
  };
  const model = await import("../src/data/model");
  const mocks: Record<string, any> = {
    "expo-router": {
      router: { push() {} },
      useFocusEffect: (cb: any) => React.useEffect(cb, [cb]),
    },
    "expo-crypto": { randomUUID: () => "new-note" },
    "react-native": {
      View: wrapper,
      Image: () => null,
      Platform: {
        select: (options: any) => options.android ?? options.default,
      },
      TextInput: () => null,
      Pressable: (props: any) => {
        if (props.onLongPress) rowProps = props;
        return React.createElement(
          "button",
          { onClick: props.onPress },
          props.children,
        );
      },
      FlatList: ({ data, renderItem, ListEmptyComponent }: any) =>
        wrapper({
          children: data.length
            ? data.map((item: any, index: number) =>
                React.createElement(
                  "div",
                  { key: item.id },
                  renderItem({ item, index }),
                ),
              )
            : ListEmptyComponent,
        }),
    },
    "@/state/app": {
      useApp: () => ({
        repo,
        reminders: {
          cancel: async () => {
            cancellations++;
          },
        },
        preferences: { spacing: "compact" },
        colors: {},
        revision: 0,
        recovery: null,
        refresh: () => {
          refreshes++;
        },
      }),
    },
    "@/data/model": model,
    "./swipe-note": { SwipeNote: wrapper },
    "./tags": {
      TagChips: () => null,
      TagSheet: ({ noteId, close }: any) =>
        wrapper({
          children: [
            React.createElement("p", { key: "id" }, "Tags for " + noteId),
            React.createElement(Button, {
              key: "close",
              label: "Close tags",
              onPress: close,
            }),
          ],
        }),
    },
    "./common": {
      Screen: wrapper,
      Label: wrapper,
      Header: () => null,
      Button,
      Message: () => null,
      Sheet: ({ visible, children }: any) =>
        visible ? wrapper({ children }) : null,
      goBack() {},
    },
    "../../assets/images/offday-icon.png": 1,
  };
  const module = { exports: {} as any };
  new Function("require", "module", "exports", code.code)(
    (id: string) => mocks[id] ?? require(id),
    module,
    module.exports,
  );
  const root = createRoot(dom.window.document.getElementById("root")!);
  const click = async (label: string) => {
    const button = [...dom.window.document.querySelectorAll("button")].find(
      (b) => b.textContent === label,
    )!;
    assert.ok(button, label);
    await act(async () => button.click());
  };
  try {
    await act(async () =>
      root.render(React.createElement(module.exports.NoteList)),
    );
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    await act(async () => rowProps.onLongPress());
    for (const option of [
      "Open note",
      "Add tags",
      "Set or edit reminder",
      "Pin note",
      "Archive note",
      "Delete note",
    ])
      assert.ok(
        [...dom.window.document.querySelectorAll("button")].some(
          (b) => b.textContent === option,
        ),
        option,
      );
    await click("Add tags");
    assert.ok(
      dom.window.document.body.textContent!.includes("Tags for held-note"),
    );
    await click("Close tags");
    await act(async () => rowProps.onLongPress());
    await click("Delete note");
    assert.deepEqual(deleted, []);
    await click("Delete note permanently");
    assert.deepEqual(deleted, ["held-note"]);
    assert.equal(cancellations, 1);
    assert.equal(refreshes, 1);
    assert.equal(
      dom.window.document.body.textContent!.includes("Meeting notes"),
      false,
    );
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
    Object.assign(globalThis, previous);
  }
});
