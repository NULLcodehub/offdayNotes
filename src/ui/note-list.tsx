import { useCallback, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { FlatList, Image, Pressable, TextInput, View } from "react-native";
import * as Crypto from "expo-crypto";
import { useApp } from "@/state/app";
import {
  displayTitle,
  emptyDoc,
  plainText,
  type Note,
  type Reminder,
  type Tag,
} from "@/data/model";
import { TagChips, TagSheet } from "./tags";
import { SwipeNote } from "./swipe-note";
import {
  goBack,
  Button,
  Header,
  Label,
  Message,
  Screen,
  Sheet,
} from "./common";
export function NoteList({
  archived = false,
  search = false,
}: {
  archived?: boolean;
  search?: boolean;
}) {
  const {
    repo,
    colors,
    preferences,
    revision,
    recovery,
    refresh,
    reminders: reminderService,
  } = useApp();
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [tagNote, setTagNote] = useState<Note | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Note | null>(null);
  const [tagsByNote, setTagsByNote] = useState<Record<string, Tag[]>>({});
  const [notes, setNotes] = useState<Note[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  useFocusEffect(
    useCallback(() => {
      let active = true;
      void revision;
      const timer = setTimeout(
        () => {
          void Promise.all([
            repo.list(archived, query),
            repo.reminders(),
            repo.noteTags(),
          ])
            .then(([n, r, links]) => {
              if (active) {
                const grouped: Record<string, Tag[]> = Object.create(null);
                for (const tag of links) (grouped[tag.noteId] ??= []).push(tag);
                setTagsByNote(grouped);
                setNotes(n);
                setReminders(r);
                setLoading(false);
                setError("");
              }
            })
            .catch(() => {
              if (active) {
                setLoading(false);
                setError(
                  "Notes could not load. Check storage, then try again.",
                );
              }
            });
        },
        query ? 120 : 0,
      );
      return () => {
        active = false;
        clearTimeout(timer);
      };
    }, [repo, archived, query, revision]),
  );
  async function create() {
    if (busy) return;
    setBusy(true);
    try {
      const id = Crypto.randomUUID();
      const now = Date.now();
      await repo.create({
        id,
        title: "",
        content: emptyDoc,
        createdAt: now,
        updatedAt: now,
        pinned: false,
        archived: false,
      });
      router.push({ pathname: "/note/[id]", params: { id, fresh: "1" } });
    } catch {
      setError("A note could not be created. Check storage and try again.");
    } finally {
      setBusy(false);
    }
  }
  async function flag(note: Note, key: "pinned" | "archived") {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await repo.flag(note.id, key, !note[key]);
      setSelectedNote(null);
      refresh();
    } catch {
      setError("The note could not be updated. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (!deleteTarget || busy) return;
    setBusy(true);
    setError("");
    try {
      await reminderService.cancel(deleteTarget.id);
      await repo.delete(deleteTarget.id);
      setNotes((items) => items.filter((note) => note.id !== deleteTarget.id));
      setDeleteTarget(null);
      refresh();
    } catch {
      setError("The note could not be deleted. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  const home = !archived && !search;
  const hasPinned = notes.some((note) => note.pinned);
  const newNoteButton = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="New note"
      disabled={busy}
      onPress={() => void create()}
      style={({ pressed }) => ({
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: colors.accent,
        alignItems: "center",
        justifyContent: "center",
        opacity: busy ? 0.4 : pressed ? 0.7 : 1,
      })}
    >
      <Label
        style={{
          color: colors.background,
          fontSize: 34,
          lineHeight: 40,
          fontWeight: "400",
        }}
      >
        ＋
      </Label>
    </Pressable>
  );
  return (
    <Screen>
      {home && (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            paddingTop: 12,
            paddingBottom: 2,
          }}
          accessible
          accessibilityLabel="OFFDAY Note"
        >
          <Image
            source={require("../../assets/images/offday-icon.png")}
            style={{ width: 28, height: 28, borderRadius: 6 }}
          />
          <Label
            style={{ fontSize: 13, fontWeight: "500", letterSpacing: 0.6 }}
          >
            OFFDAY Note
          </Label>
        </View>
      )}
      {home ? (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            paddingVertical: 12,
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Search notes"
            onPress={() => router.push("/search")}
            style={({ pressed }) => ({
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              minHeight: 48,
              paddingHorizontal: 16,
              borderRadius: 10,
              backgroundColor: colors.surface,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Label muted style={{ fontSize: 22 }}>
              ⌕
            </Label>
            <Label muted style={{ fontSize: 15 }}>
              Search notes
            </Label>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Settings"
            onPress={() => router.push("/settings")}
            style={({ pressed }) => ({
              width: 48,
              height: 48,
              justifyContent: "center",
              alignItems: "center",
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Label style={{ fontSize: 26 }}>⚙︎</Label>
          </Pressable>
        </View>
      ) : (
        <Header
          title={archived ? "Archive" : search ? "Search" : ""}
          back={goBack}
        />
      )}
      {search ? (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            borderBottomWidth: 1,
            borderColor: colors.line,
          }}
        >
          <TextInput
            autoFocus
            accessibilityLabel="Search notes"
            placeholder="Search your notebook…"
            placeholderTextColor={colors.muted}
            value={query}
            onChangeText={setQuery}
            style={{ flex: 1, height: 56, fontSize: 18, color: colors.text }}
          />
          <Button label="Clear" onPress={() => setQuery("")} />
        </View>
      ) : null}
      <Message text={error} error />
      <Message text={recovery ?? ""} />
      <FlatList
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        data={notes}
        keyExtractor={(n) => n.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingBottom: home && notes.length ? 100 : 24,
          flexGrow: 1,
        }}
        ListEmptyComponent={
          <View
            style={{
              flex: 1,
              justifyContent: "center",
              alignItems: "center",
              paddingVertical: 40,
            }}
          >
            {home && !loading && !error ? (
              newNoteButton
            ) : (
              <>
                <Label muted style={{ fontSize: 16, textAlign: "center" }}>
                  {loading
                    ? "Loading notes…"
                    : error
                      ? "Notes could not load."
                      : query
                        ? "No matching notes"
                        : archived
                          ? "No archived notes"
                          : "No notes"}
                </Label>
                {error && (
                  <Button
                    label="Try again"
                    onPress={() => setQuery((q) => q + " ")}
                  />
                )}
              </>
            )}
          </View>
        }
        renderItem={({ item: n, index }) => {
          const reminder = reminders.find(
            (r) =>
              r.noteId === n.id &&
              ["scheduled", "needsScheduling", "pending"].includes(r.status),
          );
          const section =
            hasPinned &&
            !search &&
            !archived &&
            (index === 0 || n.pinned !== notes[index - 1].pinned);
          return (
            <View>
              {section && (
                <Label
                  muted
                  style={{
                    fontSize: 11,
                    letterSpacing: 2,
                    marginTop: 18,
                    marginBottom: 8,
                  }}
                >
                  {n.pinned ? "PINNED" : "RECENT NOTES"}
                </Label>
              )}
              <SwipeNote
                note={n}
                onOptions={() => {
                  setError("");
                  setSelectedNote(n);
                }}
                onAction={(key) => flag(n, key)}
              >
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={"Open " + displayTitle(n)}
                  accessibilityHint="Hold for note actions"
                  onLongPress={() => {
                    setError("");
                    setSelectedNote(n);
                  }}
                  onPress={() =>
                    router.push({
                      pathname: "/note/[id]",
                      params: { id: n.id },
                    })
                  }
                  style={({ pressed }) => ({
                    paddingVertical:
                      preferences.spacing === "compact" ? 14 : 23,
                    borderBottomWidth: 0.5,
                    borderColor: colors.line,
                    opacity: pressed ? 0.6 : 1,
                  })}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      gap: 12,
                    }}
                  >
                    <Label style={{ fontSize: 20, fontWeight: "500", flex: 1 }}>
                      {displayTitle(n)}
                    </Label>
                    {n.pinned && (
                      <Label muted style={{ fontSize: 12 }}>
                        PIN
                      </Label>
                    )}
                  </View>
                  <Label
                    muted
                    style={{ marginTop: 8, lineHeight: 23, fontSize: 14 }}
                  >
                    {plainText(n.content).replace(/\s+/g, " ").slice(0, 135) ||
                      "An unwritten page."}
                  </Label>
                  {(tagsByNote[n.id]?.length ?? 0) > 0 && (
                    <View style={{ marginTop: 12 }}>
                      <TagChips tags={tagsByNote[n.id]} />
                    </View>
                  )}
                  <Label muted style={{ marginTop: 12, fontSize: 11 }}>
                    {new Date(n.updatedAt).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                    {reminder
                      ? "  ·  " +
                        (reminder.status === "scheduled"
                          ? "Reminder " +
                            new Date(reminder.scheduledAt).toLocaleString()
                          : "Reminder needs scheduling")
                      : ""}
                  </Label>
                </Pressable>
              </SwipeNote>
            </View>
          );
        }}
      />
      {home && notes.length > 0 && (
        <View style={{ position: "absolute", right: 24, bottom: 20 }}>
          {newNoteButton}
        </View>
      )}
      <Sheet
        visible={selectedNote !== null}
        close={() => {
          if (!busy) setSelectedNote(null);
        }}
        title="Note actions"
      >
        {selectedNote && (
          <>
            <Button
              label="Open note"
              disabled={busy}
              onPress={() => {
                const id = selectedNote.id;
                setSelectedNote(null);
                router.push({ pathname: "/note/[id]", params: { id } });
              }}
            />
            <Button
              label="Add tags"
              disabled={busy}
              onPress={() => {
                setTagNote(selectedNote);
                setSelectedNote(null);
              }}
            />
            <Button
              label="Set or edit reminder"
              disabled={busy}
              onPress={() => {
                const id = selectedNote.id;
                setSelectedNote(null);
                router.push({ pathname: "/reminder", params: { id } });
              }}
            />
            <Button
              label={selectedNote.pinned ? "Unpin note" : "Pin note"}
              disabled={busy}
              onPress={() => void flag(selectedNote, "pinned")}
            />
            <Button
              label={
                selectedNote.archived ? "Restore from archive" : "Archive note"
              }
              disabled={busy}
              onPress={() => void flag(selectedNote, "archived")}
            />
            <Button
              label="Delete note"
              danger
              disabled={busy}
              onPress={() => {
                setDeleteTarget(selectedNote);
                setSelectedNote(null);
              }}
            />
          </>
        )}
        <Message text={error} error />
      </Sheet>
      {tagNote && (
        <TagSheet noteId={tagNote.id} close={() => setTagNote(null)} />
      )}
      <Sheet
        visible={deleteTarget !== null}
        close={() => {
          if (!busy) setDeleteTarget(null);
        }}
        title="Delete this note?"
      >
        <Label muted style={{ paddingVertical: 16, lineHeight: 24 }}>
          This permanently removes the note and cancels its reminder.
        </Label>
        <Button
          label="Keep note"
          disabled={busy}
          onPress={() => setDeleteTarget(null)}
        />
        <Button
          label="Delete note permanently"
          danger
          disabled={busy}
          onPress={() => void remove()}
        />
        <Message text={error} error />
      </Sheet>
    </Screen>
  );
}
