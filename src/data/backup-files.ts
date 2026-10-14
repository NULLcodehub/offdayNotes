import { File, Paths } from "expo-file-system";
import * as DocumentPicker from "expo-document-picker";
import * as Sharing from "expo-sharing";
export async function exportFile(raw: string) {
  const file = new File(
    Paths.cache,
    `offday-note-${new Date().toISOString().replaceAll(":", "-")}.json`,
  );
  try {
    file.create();
    file.write(raw);
    if (!(await Sharing.isAvailableAsync()))
      throw new Error("Sharing is unavailable on this device.");
    await Sharing.shareAsync(file.uri, {
      mimeType: "application/json",
      UTI: "public.json",
      dialogTitle: "Save your notebook backup",
    });
  } finally {
    if (file.exists) file.delete();
  }
}
export async function importFile(): Promise<string | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ["application/json", "text/plain"],
    copyToCacheDirectory: true,
  });
  if (result.canceled) return null;
  const asset = result.assets[0];
  if ((asset.size ?? 0) > 25000000)
    throw new Error("Backup exceeds the 25 MB limit.");
  const file = new File(asset.uri);
  try {
    if (file.size > 25000000)
      throw new Error("Backup exceeds the 25 MB limit.");
    return await file.text();
  } finally {
    if (file.exists && file.uri.startsWith(Paths.cache.uri)) file.delete();
  }
}
