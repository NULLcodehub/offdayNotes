import { useCallback, useEffect, useRef, useState } from "react";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { usePreventRemove } from "expo-router/react-navigation";
import {
  AppState,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  TextInput,
  View,
} from "react-native";
import { useApp } from "@/state/app";
import { Autosave } from "@/data/autosave";
import type { DocNode, Note, Tag } from "@/data/model";
import { TagChips, TagSheet } from "@/ui/tags";
import { Canvas } from "@/editor/canvas";
import type { EditorHandle } from "@/editor/bridge";
import {
  goBack,
  Button,
  Header,
  Label,
  Menu,
  Message,
  Screen,
  Sheet,
} from "@/ui/common";
export default function NoteEditor() {
  const insets = useSafeAreaInsets();
  const { id, fresh } = useLocalSearchParams<{ id: string; fresh?: string }>();
  const { repo, reminders, colors, preferences, refresh } = useApp();
  const [tagPicker, setTagPicker] = useState(false);
  const [tags, setTags] = useState<Tag[]>([]);
  const [note, setNote] = useState<Note | null>(null);
  const [status, setStatus] = useState<"saving" | "saved" | "error">("saved");
  const [error, setError] = useState("");
  const [leaving, setLeaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [reminderLabel, setReminderLabel] = useState("");
  const current = useRef<Note | null>(null);
  const canvas = useRef<EditorHandle>(null);
  const [initial, setInitial] = useState<DocNode | null>(null);
  const next = useRef<(() => void) | null>(null);
  const saver = useRef<Autosave<{ title: string; content: DocNode }> | null>(
    null,
  );
  useEffect(() => {
    let active = true;
    void repo
      .get(id)
      .then((n) => {
        if (!active) return;
        if (!n) {
          setError("This note is no longer available.");
          return;
        }
        setInitial(n.content);
        current.current = n;
        setNote(n);
        saver.current = new Autosave(
          (v) => repo.save(id, v.title, v.content),
          (s) => {
            if (active) setStatus(s);
          },
        );
      })
      .catch(() => {
        if (active) setError("The note could not open. Please try again.");
      });
    return () => {
      active = false;
      void saver.current?.flush().catch(() => {});
    };
  }, [id, repo]);
  useFocusEffect(
    useCallback(() => {
      setLeaving(false);
      void Promise.all([repo.reminders(), repo.tags(id)])
        .then(([rs, assigned]) => {
          setTags(assigned);
          const r = rs.find((r) => r.noteId === id);
          setReminderLabel(
            r?.status === "scheduled"
              ? "Reminder · " + new Date(r.scheduledAt).toLocaleString()
              : r?.status === "needsScheduling"
                ? "Reminder needs scheduling"
                : "",
          );
        })
        .catch(() => {});
    }, [id, repo]),
  );
  const save = useCallback(async () => {
    if (!current.current || !canvas.current)
      throw new Error("The note is still opening.");
    const content = await canvas.current.snapshot();
    if (JSON.stringify(content) !== JSON.stringify(current.current.content)) {
      current.current = { ...current.current, content };
      saver.current?.change({ title: current.current.title, content });
    }
    await saver.current?.flush();
    refresh();
  }, [refresh]);
  const leave = useCallback(
    async (action: () => void) => {
      if (busy) return;
      setBusy(true);
      try {
        await save();
        next.current = action;
        setLeaving(true);
      } catch {
        setError(
          "Your latest changes could not be saved. Check storage and tap Retry save before leaving.",
        );
      } finally {
        setBusy(false);
      }
    },
    [busy, save],
  );
  usePreventRemove(!leaving && !!note, () => {
    void leave(() => goBack());
  });
  useEffect(() => {
    if (leaving) {
      const action = next.current;
      next.current = null;
      action?.();
    }
  }, [leaving]);
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active")
        void saver.current
          ?.flush()
          .catch(() => setError("Changes are not saved yet. Tap Retry save."));
    });
    return () => sub.remove();
  }, []);
  function change(content: DocNode) {
    if (!current.current) return;
    current.current = { ...current.current, content };
    saver.current?.change({ title: current.current.title, content });
  }
  async function action(run: () => Promise<unknown>) {
    if (busy) return;
    setBusy(true);
    try {
      await save();
      await run();
      refresh();
    } catch {
      setError(
        "This action could not finish. Your note is still here. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function flag(key: "pinned" | "archived") {
    if (!current.current) return;
    const value = !current.current[key];
    await action(async () => {
      await repo.flag(id, key, value);
      current.current = { ...current.current!, [key]: value };
      setNote(current.current);
    });
  }
  function deleteNote() {
    setConfirmDelete(true);
  }
  async function confirmDeletion() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      // Deleting intentionally discards edits; an unavailable editor must not block it.
      await reminders.cancel(id);
      await repo.delete(id);
      saver.current?.discard();
      saver.current = null;
      current.current = null;
      setNote(null);
      setInitial(null);
      setConfirmDelete(false);
      refresh();
      next.current = () => router.dismissTo("/");
      setLeaving(true);
    } catch {
      setError(
        "The note could not be deleted. It is still here. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={insets.top}
      >
        <Header
          title=""
          back={() => {
            if (note) void leave(() => goBack());
            else goBack();
          }}
          action={
            note ? (
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <View
                  accessible
                  accessibilityLabel={
                    status === "error"
                      ? "Save failed"
                      : status === "saving"
                        ? "Saving"
                        : "Saved on device"
                  }
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: 16,
                    backgroundColor: colors.surface,
                  }}
                >
                  <View
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: 3,
                      borderWidth: status === "saving" ? 1 : 0,
                      borderColor: colors.muted,
                      backgroundColor:
                        status === "saving"
                          ? "transparent"
                          : status === "error"
                            ? colors.danger
                            : colors.accent,
                    }}
                  />
                  <Label
                    style={{
                      fontSize: 11,
                      fontWeight: "500",
                      letterSpacing: 0.2,
                      color: status === "error" ? colors.danger : colors.muted,
                    }}
                  >
                    {status === "error"
                      ? "Not saved"
                      : status === "saving"
                        ? "Saving"
                        : "Saved"}
                  </Label>
                </View>
                <Menu
                  actions={[
                    { label: "Add tags", run: () => setTagPicker(true) },
                    {
                      label: note.pinned ? "Unpin note" : "Pin note",
                      run: () => void flag("pinned"),
                    },
                    {
                      label: note.archived
                        ? "Restore from archive"
                        : "Archive note",
                      run: () => void flag("archived"),
                    },
                    {
                      label: "Set or edit reminder",
                      run: () =>
                        void leave(() =>
                          router.push({
                            pathname: "/reminder",
                            params: { id },
                          }),
                        ),
                    },
                    { label: "Delete note", danger: true, run: deleteNote },
                  ]}
                />
              </View>
            ) : undefined
          }
        />
        <Message text={error} error />
        {status === "error" && (
          <Message
            text="Your changes have not been saved. Check available storage and retry."
            error
          />
        )}
        {(error || status === "error") && note && (
          <Button
            label="Retry save"
            onPress={() => {
              void save()
                .then(() => setError(""))
                .catch(() =>
                  setError("Saving failed. Free some storage and retry."),
                );
            }}
          />
        )}
        {note && initial ? (
          <>
            <TextInput
              accessibilityLabel="Optional note title"
              placeholder="Title (optional)"
              placeholderTextColor={colors.muted}
              value={note.title}
              onChangeText={(title) => {
                setNote((n) => (n ? { ...n, title } : n));
                current.current = { ...current.current!, title };
                saver.current?.change({
                  title,
                  content: current.current.content,
                });
              }}
              style={{
                color: colors.text,
                fontSize: 26,
                fontWeight: "500",
                paddingTop: 18,
                paddingBottom: 14,
              }}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add or change note tags"
              disabled={busy}
              onPress={() => setTagPicker(true)}
              style={({ pressed }) => ({
                minHeight: 44,
                justifyContent: "center",
                paddingBottom: 8,
                opacity: pressed ? 0.6 : 1,
              })}
            >
              {tags.length ? (
                <TagChips tags={tags} />
              ) : (
                <Label muted style={{ fontSize: 13 }}>
                  ＋ Tags
                </Label>
              )}
            </Pressable>
            {reminderLabel ? (
              <Label muted style={{ paddingVertical: 10, fontSize: 12 }}>
                {reminderLabel}
              </Label>
            ) : null}
            <Canvas
              key={id}
              ref={canvas}
              content={initial}
              colors={colors}
              font={preferences.font}
              focus={fresh === "1"}
              onChange={change}
              onError={() =>
                setError(
                  "The editor encountered a problem. Stay on this page and retry saving.",
                )
              }
            />
          </>
        ) : (
          !error &&
          !leaving && (
            <View style={{ paddingTop: 40 }}>
              <Label muted>Opening your page…</Label>
            </View>
          )
        )}
      </KeyboardAvoidingView>
      {tagPicker && note && (
        <TagSheet
          noteId={id}
          close={() => setTagPicker(false)}
          onSaved={setTags}
        />
      )}
      <Sheet
        visible={confirmDelete}
        close={() => {
          if (!busy) setConfirmDelete(false);
        }}
        title="Delete this note?"
      >
        <Label muted style={{ paddingVertical: 16, lineHeight: 24 }}>
          This permanently removes the note and cancels its reminder.
        </Label>
        <Button
          label="Keep note"
          onPress={() => setConfirmDelete(false)}
          disabled={busy}
        />
        <Button
          label="Delete note permanently"
          danger
          disabled={busy}
          onPress={() => void confirmDeletion()}
        />
        <Message text={error} error />
      </Sheet>
    </Screen>
  );
}
