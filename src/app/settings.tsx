import { useEffect, useState, type PropsWithChildren } from "react";
import { router } from "expo-router";
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from "react-native";
import { useApp } from "@/state/app";
import type { Preferences } from "@/data/model";
import { permissionLabel } from "@/data/notifications";
import {
  goBack,
  Button,
  Header,
  Label,
  Message,
  Screen,
  Sheet,
} from "@/ui/common";

const choices = {
  theme: {
    title: "Theme",
    options: [
      { value: "system", label: "System default" },
      { value: "light", label: "White" },
      { value: "dark", label: "Olive" },
      { value: "black", label: "Black" },
    ],
  },
  spacing: {
    title: "Note spacing",
    options: [
      { value: "comfortable", label: "Comfortable" },
      { value: "compact", label: "Compact" },
    ],
  },
  font: {
    title: "Editor font",
    options: [
      { value: "system", label: "System" },
      { value: "sans", label: "Sans" },
      { value: "serif", label: "Serif" },
      { value: "book", label: "Book" },
      { value: "mono", label: "Monospace" },
    ],
  },
} as const;
type PreferenceKey = keyof Preferences;

function Section({ title, children }: PropsWithChildren<{ title: string }>) {
  return (
    <View style={{ marginBottom: 30 }}>
      <Label
        muted
        style={{ fontSize: 11, letterSpacing: 1.8, marginBottom: 8 }}
      >
        {title.toUpperCase()}
      </Label>
      {children}
    </View>
  );
}
function SettingRow({
  title,
  value,
  detail,
  onPress,
  danger,
}: {
  title: string;
  value?: string;
  detail?: string;
  onPress?: () => void;
  danger?: boolean;
}) {
  const { colors } = useApp();
  const content = (
    <>
      <View style={{ flex: 1, gap: 5 }}>
        <Label
          style={{ fontSize: 16, color: danger ? colors.danger : colors.text }}
        >
          {title}
        </Label>
        {detail && (
          <Label muted style={{ fontSize: 13, lineHeight: 20 }}>
            {detail}
          </Label>
        )}
      </View>
      {value && (
        <Label muted style={{ fontSize: 14 }}>
          {value}
        </Label>
      )}
      {onPress && (
        <Label muted style={{ fontSize: 23, marginLeft: 4 }}>
          ›
        </Label>
      )}
    </>
  );
  const style = {
    minHeight: 64,
    paddingVertical: 16,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 12,
    borderBottomWidth: 0.5,
    borderColor: colors.line,
  };
  return onPress ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[title, value, detail].filter(Boolean).join(", ")}
      onPress={onPress}
      style={({ pressed }) => [style, { opacity: pressed ? 0.6 : 1 }]}
    >
      {content}
    </Pressable>
  ) : (
    <View style={style}>{content}</View>
  );
}
export default function Settings() {
  const { preferences, setPreferences, colors, repo, reminders, refresh } =
    useApp();
  const [error, setError] = useState("");
  const [permission, setPermission] = useState("Checking…");
  const [picker, setPicker] = useState<PreferenceKey | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [phrase, setPhrase] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void permissionLabel()
      .then(setPermission)
      .catch(() => setPermission("Unavailable"));
  }, []);
  async function update(key: PreferenceKey, value: string) {
    try {
      await setPreferences({ ...preferences, [key]: value } as Preferences);
      setError("");
      setPicker(null);
    } catch {
      setError("Your preference could not be saved. Please try again.");
    }
  }
  async function removeAll() {
    setBusy(true);
    try {
      for (const r of await repo.reminders()) await reminders.cancel(r.noteId);
      await repo.deleteAll();
      refresh();
      setConfirm(false);
      setPhrase("");
      Alert.alert(
        "Notebook cleared",
        "All notes were removed from this device.",
      );
    } catch {
      setError(
        "Deletion could not finish. Some reminders may have been cancelled. Your remaining notes are safe.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Screen>
      <Header title="Settings" back={goBack} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: 26, paddingBottom: 24 }}
      >
        <Section title="Appearance">
          {(Object.keys(choices) as PreferenceKey[]).map((key) => (
            <SettingRow
              key={key}
              title={choices[key].title}
              value={
                choices[key].options.find(
                  (option) => option.value === preferences[key],
                )?.label
              }
              onPress={() => {
                setError("");
                setPicker(key);
              }}
            />
          ))}
        </Section>
        <Section title="Reminders">
          <SettingRow
            title="Notifications"
            detail={permission}
            onPress={() =>
              void Linking.openSettings().catch(() =>
                setError("Open your device settings and choose Offday Note."),
              )
            }
          />
        </Section>
        <Section title="Your notebook">
          <SettingRow
            title="Archive"
            detail="Restore notes you have put away"
            onPress={() => router.push("/archive")}
          />
          <SettingRow
            title="Swipe shortcuts"
            detail="Right to pin or unpin. Left to archive; left again in Archive to restore."
          />
          <SettingRow
            title="Backup & restore"
            detail="Export a copy or restore your notes"
            onPress={() => router.push("/backup")}
          />
          <Label
            muted
            style={{ fontSize: 13, lineHeight: 21, paddingVertical: 14 }}
          >
            Notes stay on this device. No account or cloud sync.
          </Label>
          <SettingRow
            title="Delete all notes"
            danger
            onPress={() => {
              setPhrase("");
              setError("");
              setConfirm(true);
            }}
          />
        </Section>
        <Section title="About">
          <SettingRow title="Offday Note" value="1.0.0" />
        </Section>
        <Message text={error} error />
      </ScrollView>
      <Sheet
        visible={picker !== null}
        close={() => setPicker(null)}
        title={picker ? choices[picker].title : "Appearance"}
      >
        {picker &&
          choices[picker].options.map((option) => (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityState={{
                checked: preferences[picker] === option.value,
              }}
              onPress={() => void update(picker, option.value)}
              style={({ pressed }) => ({
                minHeight: 56,
                paddingVertical: 16,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                borderBottomWidth: 0.5,
                borderColor: colors.line,
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <Label>{option.label}</Label>
              <Label style={{ color: colors.accent }}>
                {preferences[picker] === option.value ? "✓" : ""}
              </Label>
            </Pressable>
          ))}
        <Message text={error} error />
      </Sheet>
      <Sheet
        visible={confirm}
        close={() => {
          if (!busy) setConfirm(false);
        }}
        title="Clear your notebook?"
      >
        <Label muted style={{ lineHeight: 24, marginVertical: 16 }}>
          All notes and reminders will be permanently removed. Export a backup
          first. Type DELETE to continue.
        </Label>
        <TextInput
          accessibilityLabel="Type DELETE to confirm"
          autoCapitalize="characters"
          value={phrase}
          onChangeText={setPhrase}
          style={{
            color: colors.text,
            borderColor: colors.line,
            borderWidth: 1,
            padding: 16,
            fontSize: 18,
          }}
        />
        <Button
          danger
          disabled={phrase !== "DELETE" || busy}
          label={busy ? "Deleting…" : "Permanently delete all notes"}
          onPress={() => void removeAll()}
        />
        <Message text={error} error />
      </Sheet>
    </Screen>
  );
}
