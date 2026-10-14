import { useCallback, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { FlatList, Pressable, TextInput, View } from "react-native";
import * as Crypto from "expo-crypto";
import { useApp } from "@/state/app";
import {
  displayTitle,
  emptyDoc,
  plainText,
  type Note,
  type Reminder,
} from "@/data/model";
import { SwipeNote } from "./swipe-note";
import { goBack, Button, Header, Label, Message, Screen } from "./common";
export function NoteList({
  archived = false,
  search = false,
}: {
  archived?: boolean;
  search?: boolean;
}) {
  const { repo, colors, preferences, revision, recovery, refresh } = useApp();
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
          void Promise.all([repo.list(archived, query), repo.reminders()])
            .then(([n, r]) => {
              if (active) {
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
                onAction={async (key) => {
                  try {
                    await repo.flag(n.id, key, !n[key]);
                    refresh();
                  } catch {
                    setError(
                      "The note could not be updated. Please try again.",
                    );
                  }
                }}
              >
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={"Open " + displayTitle(n)}
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
    </Screen>
  );
}
