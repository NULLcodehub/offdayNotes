import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { transform } from "esbuild";
import { JSDOM } from "jsdom";
import React, { act } from "react";
const { createRoot } = createRequire(import.meta.url)("react-dom/client") as {
  createRoot: (container: Element) => {
    render: (node: React.ReactNode) => void;
    unmount: () => void;
  };
};
import { Autosave } from "../src/data/autosave";
import { emptyDoc } from "../src/data/model";

// Exercise the actual screen with platform boundaries replaced; no app bundle is built.
test("confirmed deletion discards unsaved edits without requesting an editor snapshot and clears the screen", async () => {
  const code = await transform(
    await readFile("src/app/note/[id].tsx", "utf8"),
    { loader: "tsx", jsx: "automatic", format: "cjs" },
  );
  const require = createRequire(import.meta.url);
  for (const failure of [false, true]) {
    const dom = new JSDOM('<div id="root"></div>', { url: "http://localhost" });
    const previous = {
      window: globalThis.window,
      document: globalThis.document,
    };
    Object.assign(globalThis, {
      window: dom.window,
      document: dom.window.document,
      IS_REACT_ACT_ENVIRONMENT: true,
    });
    const stored = {
      id: "delete-me",
      title: "Discard this note",
      content: emptyDoc,
      createdAt: 1,
      updatedAt: 1,
      pinned: false,
      archived: false,
    };
    let exists = true,
      snapshotCalls = 0,
      refreshes = 0;
    let guard = true;
    const destinations: string[] = [];
    let canvasProps: any;
    const repo = {
      get: async () => (exists ? stored : null),
      reminders: async () => [],
      tags: async () => [],
      save: async () => {
        if (!exists) throw new Error("Deleted");
      },
      delete: async () => {
        if (failure) throw new Error("Storage failure");
        exists = false;
      },
    };
    const wrapper = ({ children }: any) =>
      React.createElement("div", null, children);
    const Button = ({ label, onPress, disabled }: any) =>
      React.createElement("button", { onClick: onPress, disabled }, label);
    const Canvas = React.forwardRef((props: any, ref) => {
      canvasProps = props;
      React.useImperativeHandle(ref, () => ({
        snapshot: async () => {
          snapshotCalls++;
          throw new Error("Editor unavailable");
        },
      }));
      return React.createElement(
        "div",
        { "data-editor": true },
        "Editor content",
      );
    });
    const mocks: Record<string, any> = {
      "expo-router": {
        router: {
          dismissTo: (path: string) => {
            assert.equal(guard, false);
            destinations.push(path);
          },
          push: () => {},
        },
        useLocalSearchParams: () => ({ id: stored.id }),
        useFocusEffect: (cb: any) => React.useEffect(cb, [cb]),
      },
      "expo-router/react-navigation": {
        usePreventRemove: (value: boolean) => {
          guard = value;
        },
      },
      "react-native-safe-area-context": {
        useSafeAreaInsets: () => ({ top: 0 }),
      },
      "react-native": {
        AppState: { addEventListener: () => ({ remove() {} }) },
        KeyboardAvoidingView: wrapper,
        View: wrapper,
        Pressable: wrapper,
        Platform: { OS: "android" },
        TextInput: ({ value }: any) =>
          React.createElement("input", { readOnly: true, value }),
      },
      "@/state/app": {
        useApp: () => ({
          repo,
          reminders: { cancel: async () => {} },
          refresh: () => {
            refreshes++;
          },
          colors: {},
          preferences: { font: "system" },
        }),
      },
      "@/data/autosave": { Autosave },
      "@/editor/canvas": { Canvas },
      "@/ui/tags": { TagChips: () => null, TagSheet: () => null },
      "@/ui/common": {
        Screen: wrapper,
        Header: ({ action }: any) => action ?? null,
        Label: wrapper,
        Button,
        Message: ({ text }: any) =>
          text ? React.createElement("p", null, text) : null,
        Sheet: ({ visible, children }: any) =>
          visible ? wrapper({ children }) : null,
        Menu: ({ actions }: any) =>
          wrapper({
            children: actions.map((a: any) =>
              React.createElement(Button, {
                key: a.label,
                label: a.label,
                onPress: a.run,
              }),
            ),
          }),
        goBack: () => {},
      },
    };
    const module = { exports: {} as any };
    new Function("require", "module", "exports", code.code)(
      (id: string) => mocks[id] ?? require(id),
      module,
      module.exports,
    );
    const root = createRoot(dom.window.document.getElementById("root")!);
    try {
      await act(async () =>
        root.render(React.createElement(module.exports.default)),
      );
      await act(async () =>
        canvasProps.onChange({
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Unsaved edit" }],
            },
          ],
        }),
      );
      const click = async (label: string) => {
        const button = [...dom.window.document.querySelectorAll("button")].find(
          (b) => b.textContent === label,
        )!;
        assert.ok(button, label);
        await act(async () => button.click());
      };
      await click("Delete note");
      await click("Delete note permanently");
      assert.equal(snapshotCalls, 0);
      assert.equal(exists, failure);
      if (failure) {
        assert.ok(dom.window.document.querySelector("[data-editor]"));
        assert.ok(
          dom.window.document.body.textContent!.includes(
            "could not be deleted",
          ),
        );
        assert.deepEqual(destinations, []);
      } else {
        assert.equal(dom.window.document.querySelector("[data-editor]"), null);
        assert.equal(dom.window.document.querySelector("input"), null);
        assert.deepEqual(destinations, ["/"]);
        assert.equal(refreshes, 1);
      }
    } finally {
      await act(async () => root.unmount());
      dom.window.close();
      Object.assign(globalThis, previous);
    }
  }
});
