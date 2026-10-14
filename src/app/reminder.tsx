import { useEffect, useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { Linking, Platform, Pressable, ScrollView, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { quickReminderDate } from "@/data/reminders";
import { displayTitle, type Note, type Reminder } from "@/data/model";
import { useApp } from "@/state/app";
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
export default function ReminderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { repo, reminders, refresh, colors, dark } = useApp();
  const [note, setNote] = useState<Note | null>(null);
  const [existing, setExisting] = useState<Reminder>();
  const [date, setDate] = useState(() => new Date(Date.now() + 3600000));
  const [picker, setPicker] = useState<"date" | "time" | null>(null);
  const [preset, setPreset] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    void Promise.all([repo.get(id), repo.reminders()])
      .then(([n, rs]) => {
        setNote(n);
        const r = rs.find((r) => r.noteId === id);
        setExisting(r);
        if (r && r.scheduledAt > Date.now()) setDate(new Date(r.scheduledAt));
        if (!n) setError("This note is no longer available.");
      })
      .catch(() => setError("The reminder could not load."));
  }, [repo, id]);
  function quick(kind: "today" | "tomorrow" | "weekend") {
    try {
      setDate(quickReminderDate(kind));
      setPreset(kind);
      setMessage("");
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function run(fn: () => Promise<void>, success: string) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await fn();
      const r = (await repo.reminders()).find((r) => r.noteId === id);
      setExisting(r);
      refresh();
      setMessage(success);
    } catch (e) {
      setError(
        (e as Error).message ||
          "The reminder could not be updated. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  const active =
    existing && !["cancelled", "completed"].includes(existing.status);
  const datePicker = picker && (
    <DateTimePicker
      value={date}
      mode={picker}
      display={Platform.OS === "ios" ? "spinner" : "default"}
      themeVariant={dark ? "dark" : "light"}
      minimumDate={picker === "date" ? new Date() : undefined}
      onChange={(event, value) => {
        if (Platform.OS === "android") setPicker(null);
        if (event.type !== "dismissed" && value) {
          const next = new Date(date);
          if (picker === "date")
            next.setFullYear(
              value.getFullYear(),
              value.getMonth(),
              value.getDate(),
            );
          else next.setHours(value.getHours(), value.getMinutes(), 0, 0);
          setDate(next);
          setPreset(null);
          setMessage("");
        }
      }}
    />
  );
  return (
    <Screen>
      <Header
        title="Reminder"
        back={goBack}
        action={
          active ? (
            <Menu
              title="Reminder actions"
              actions={[
                {
                  label: "Cancel reminder",
                  run: () => {
                    if (!busy)
                      void run(
                        () => reminders.cancel(id),
                        "Reminder cancelled.",
                      );
                  },
                },
                {
                  label: "Mark completed",
                  run: () => {
                    if (!busy)
                      void run(
                        () => reminders.cancel(id, true),
                        "Reminder completed.",
                      );
                  },
                },
              ]}
            />
          ) : undefined
        }
      />
      <ScrollView
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: 24, paddingBottom: 24, gap: 24 }}
      >
        <View style={{ gap: 8 }}>
          <Label style={{ fontSize: 20, fontWeight: "500" }}>
            {note ? displayTitle(note) : "Your note"}
          </Label>
          <Label muted style={{ fontSize: 14, lineHeight: 22 }}>
            Choose when to come back to it.
          </Label>
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {(
            [
              { key: "today", label: "Later today" },
              { key: "tomorrow", label: "Tomorrow" },
              { key: "weekend", label: "Weekend" },
            ] as const
          ).map((item) => (
            <Pressable
              key={item.key}
              disabled={busy}
              accessibilityRole="button"
              accessibilityState={{
                selected: preset === item.key,
                disabled: busy,
              }}
              onPress={() => quick(item.key)}
              style={({ pressed }) => ({
                minHeight: 48,
                paddingHorizontal: 14,
                justifyContent: "center",
                borderRadius: 24,
                backgroundColor:
                  preset === item.key ? colors.accent : colors.surface,
                opacity: pressed || busy ? 0.6 : 1,
              })}
            >
              <Label
                style={{
                  fontSize: 14,
                  color: preset === item.key ? colors.background : colors.text,
                }}
              >
                {item.label}
              </Label>
            </Pressable>
          ))}
        </View>
        <View
          style={{
            borderRadius: 14,
            backgroundColor: colors.surface,
            paddingHorizontal: 18,
          }}
        >
          {(["date", "time"] as const).map((kind) => (
            <Pressable
              key={kind}
              accessibilityRole="button"
              accessibilityLabel={"Choose " + kind}
              accessibilityValue={{
                text:
                  kind === "date"
                    ? date.toLocaleDateString()
                    : date.toLocaleTimeString(undefined, {
                        hour: "numeric",
                        minute: "2-digit",
                      }),
              }}
              disabled={busy || Platform.OS === "web"}
              onPress={() => setPicker(kind)}
              style={({ pressed }) => ({
                minHeight: 68,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                borderBottomWidth: kind === "date" ? 0.5 : 0,
                borderColor: colors.line,
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <Label muted style={{ fontSize: 14 }}>
                {kind === "date" ? "Date" : "Time"}
              </Label>
              <Label style={{ fontSize: 15 }}>
                {kind === "date"
                  ? date.toLocaleDateString(undefined, {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })
                  : date.toLocaleTimeString(undefined, {
                      hour: "numeric",
                      minute: "2-digit",
                    })}{" "}
                ›
              </Label>
            </Pressable>
          ))}
        </View>
        {existing && (
          <Label muted style={{ fontSize: 13 }}>
            {existing.status === "scheduled"
              ? "Scheduled on this device"
              : existing.status === "needsScheduling" ||
                  existing.status === "pending"
                ? "Needs scheduling on this device"
                : existing.status === "completed"
                  ? "Reminder completed"
                  : "Reminder cancelled"}
          </Label>
        )}
        {Platform.OS === "web" && (
          <Label muted style={{ fontSize: 14, lineHeight: 22 }}>
            Use the Android or iOS app to schedule reminders.
          </Label>
        )}
        {(error || message) && (
          <View>
            <Message text={error} error />
            <Message text={message} />
            {error && Platform.OS !== "web" && (
              <Button
                label="Notification settings"
                onPress={() =>
                  void Linking.openSettings().catch(() =>
                    setError("Open device settings and select OFFDAY Note."),
                  )
                }
              />
            )}
          </View>
        )}
        <Label muted style={{ fontSize: 12, lineHeight: 20 }}>
          Reminders use this device’s local time. Battery restrictions may delay
          delivery.
        </Label>
      </ScrollView>
      <View
        style={{
          paddingVertical: 16,
          borderTopWidth: 0.5,
          borderColor: colors.line,
        }}
      >
        <Button
          primary
          disabled={busy || !note || Platform.OS === "web"}
          label={
            busy
              ? "Saving…"
              : existing?.status === "scheduled"
                ? "Update reminder"
                : "Set reminder"
          }
          onPress={() => {
            if (note)
              void run(
                () => reminders.schedule(note, date.getTime()),
                "Reminder scheduled on this device.",
              );
          }}
        />
      </View>
      {Platform.OS === "android" && datePicker}
      {Platform.OS === "ios" && (
        <Sheet
          visible={picker !== null}
          close={() => setPicker(null)}
          title={picker === "date" ? "Choose date" : "Choose time"}
        >
          {datePicker}
          <Button primary label="Done" onPress={() => setPicker(null)} />
        </Sheet>
      )}
    </Screen>
  );
}
