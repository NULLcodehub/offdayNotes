import { useState } from "react";
import { ScrollView } from "react-native";
import { useApp } from "@/state/app";
import { parseBackup, type Backup } from "@/data/model";
import { exportFile, importFile } from "@/data/backup-files";
import { goBack, Button, Header, Label, Message, Screen } from "@/ui/common";
export default function BackupScreen() {
  const { repo, refresh } = useApp();
  const [preview, setPreview] = useState<Backup | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [duplicates, setDuplicates] = useState(0);
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await action();
    } catch (e) {
      setError(
        (e as Error).message ||
          "The operation failed. Your existing notes are unchanged.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Screen>
      <Header title="Export & restore" back={() => goBack()} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingVertical: 32, gap: 18 }}
      >
        <Label style={{ fontSize: 30 }}>Your words. Yours to keep.</Label>
        <Label muted style={{ lineHeight: 25 }}>
          Save a complete copy of your notebook: formatting, checklists, tables,
          dates, pins, archive state and reminder metadata.
        </Label>
        <Button
          primary
          disabled={busy}
          label="Export notebook"
          onPress={() =>
            void run(async () => {
              const backup = await repo.export();
              await exportFile(JSON.stringify(backup, null, 2));
              setMessage(
                "Backup prepared. Keep the file you saved somewhere safe.",
              );
            })
          }
        />
        <Button
          disabled={busy}
          label="Choose backup to restore"
          onPress={() =>
            void run(async () => {
              setPreview(null);
              const raw = await importFile();
              if (raw === null) return;
              const backup = parseBackup(raw);
              const existing = new Set(
                (await repo.export()).notes.map((n) => n.id),
              );
              setDuplicates(
                backup.notes.filter((n) => existing.has(n.id)).length,
              );
              setPreview(backup);
            })
          }
        />
        {preview && (
          <>
            <Label style={{ fontSize: 22 }}>
              {preview.notes.length} notes in this backup
            </Label>
            <Label muted>
              {preview.notes.length - duplicates} new · {duplicates} existing
              IDs will be skipped. Existing notes will never be overwritten.
            </Label>
            <Label muted>
              Reminders retain their dates, but must be scheduled again on this
              device.
            </Label>
            <Button
              primary
              disabled={busy}
              label="Restore new notes"
              onPress={() =>
                void run(async () => {
                  const result = await repo.import(preview);
                  setPreview(null);
                  refresh();
                  setMessage(
                    `Restored ${result.imported} notes. Skipped ${result.skipped} existing notes.`,
                  );
                })
              }
            />
            <Button
              label="Cancel restore"
              disabled={busy}
              onPress={() => setPreview(null)}
            />
          </>
        )}
        <Message text={error} error />
        <Message text={message} />
        <Label muted style={{ fontSize: 13, lineHeight: 23 }}>
          Backups are readable JSON files. Store them privately. OFFDAY Note has
          no cloud sync; deleting the app may delete your notebook. Export
          regularly.
        </Label>
      </ScrollView>
    </Screen>
  );
}
