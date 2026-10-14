import { useEffect, useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import * as Crypto from "expo-crypto";
import { useApp } from "@/state/app";
import type { Tag } from "@/data/model";
import { Button, Label, Message, Sheet } from "./common";
const tagColors = [
  { name: "Olive", value: "#648A5A" },
  { name: "Blue", value: "#4E83C8" },
  { name: "Purple", value: "#9870BC" },
  { name: "Rose", value: "#CD7288" },
  { name: "Amber", value: "#B58A38" },
  { name: "Teal", value: "#388E86" },
];
export function TagChips({ tags }: { tags: Tag[] }) {
  const { colors } = useApp();
  return tags.length ? (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
      {tags.map((tag) => (
        <View
          key={tag.id}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            borderRadius: 14,
            paddingHorizontal: 10,
            paddingVertical: 5,
            backgroundColor: colors.surface,
          }}
        >
          <View
            style={{
              width: 7,
              height: 7,
              borderRadius: 4,
              backgroundColor: tag.color,
            }}
          />
          <Label style={{ fontSize: 12 }}>{tag.name}</Label>
        </View>
      ))}
    </View>
  ) : null;
}
export function TagSheet({
  noteId,
  close,
  onSaved,
}: {
  noteId: string;
  close: () => void;
  onSaved?: (tags: Tag[]) => void;
}) {
  const { repo, colors, refresh } = useApp();
  const [tags, setTags] = useState<Tag[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [color, setColor] = useState(tagColors[0].value);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    void Promise.all([repo.tags(), repo.tags(noteId)])
      .then(([all, assigned]) => {
        if (active) {
          setTags(all);
          setSelected(assigned.map((t) => t.id));
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) {
          setError("Tags could not load. Close and try again.");
        }
      });
    return () => {
      active = false;
    };
  }, [repo, noteId]);
  async function create() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const tag = await repo.createTag({
        id: Crypto.randomUUID(),
        name,
        color,
      });
      setTags(await repo.tags());
      setSelected((ids) => (ids.includes(tag.id) ? ids : [...ids, tag.id]));
      setName("");
    } catch {
      setError("The tag could not be created. Check its name and try again.");
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    if (busy || loading) return;
    setBusy(true);
    setError("");
    try {
      await repo.setNoteTags(noteId, selected);
      onSaved?.(tags.filter((t) => selected.includes(t.id)));
      refresh();
      close();
    } catch {
      setError("Tags could not be saved. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Sheet
      visible
      close={() => {
        if (!busy) close();
      }}
      title="Add tags"
    >
      <Label muted style={{ fontSize: 13, paddingVertical: 12 }}>
        Choose tags for this note.
      </Label>
      {loading ? (
        <Label muted>Loading tags…</Label>
      ) : !tags.length ? (
        <Label muted style={{ paddingVertical: 12 }}>
          Create your first tag below.
        </Label>
      ) : (
        tags.map((tag) => (
          <Pressable
            key={tag.id}
            disabled={busy}
            accessibilityRole="checkbox"
            accessibilityLabel={tag.name}
            accessibilityState={{
              checked: selected.includes(tag.id),
              disabled: busy,
            }}
            onPress={() =>
              setSelected((ids) =>
                ids.includes(tag.id)
                  ? ids.filter((id) => id !== tag.id)
                  : [...ids, tag.id],
              )
            }
            style={({ pressed }) => ({
              minHeight: 52,
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              borderBottomWidth: 0.5,
              borderColor: colors.line,
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <View
              style={{
                width: 12,
                height: 12,
                borderRadius: 6,
                backgroundColor: tag.color,
              }}
            />
            <Label style={{ flex: 1 }}>{tag.name}</Label>
            <Label style={{ color: colors.accent }}>
              {selected.includes(tag.id) ? "✓" : ""}
            </Label>
          </Pressable>
        ))
      )}
      <View style={{ marginTop: 24, gap: 12 }}>
        <Label muted style={{ fontSize: 11, letterSpacing: 1.5 }}>
          CREATE A TAG
        </Label>
        <TextInput
          editable={!busy && !loading}
          accessibilityLabel="New tag name"
          placeholder="Education, Meeting…"
          placeholderTextColor={colors.muted}
          value={name}
          maxLength={40}
          onChangeText={setName}
          returnKeyType="done"
          onSubmitEditing={() => {
            if (name.trim() && !loading) void create();
          }}
          style={{
            color: colors.text,
            backgroundColor: colors.surface,
            fontSize: 16,
            minHeight: 48,
            paddingHorizontal: 14,
            borderRadius: 10,
          }}
        />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {tagColors.map((option) => (
            <Pressable
              key={option.value}
              disabled={busy || loading}
              accessibilityRole="radio"
              accessibilityLabel={option.name + " tag color"}
              accessibilityState={{ checked: color === option.value }}
              onPress={() => setColor(option.value)}
              style={{
                width: 44,
                height: 44,
                justifyContent: "center",
                alignItems: "center",
                borderWidth: color === option.value ? 2 : 0,
                borderColor: colors.text,
                borderRadius: 24,
              }}
            >
              <View
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 15,
                  backgroundColor: option.value,
                }}
              />
            </Pressable>
          ))}
        </View>
        <Button
          label="Create tag"
          disabled={busy || loading || !name.trim()}
          onPress={() => void create()}
        />
      </View>
      <Message text={error} error />
      <View style={{ paddingTop: 16 }}>
        <Button
          primary
          label={busy ? "Saving…" : "Done"}
          disabled={busy || loading}
          onPress={() => void save()}
        />
      </View>
    </Sheet>
  );
}
