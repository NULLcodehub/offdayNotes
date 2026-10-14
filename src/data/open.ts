import { openDatabaseAsync } from "expo-sqlite";
import { Repository } from "./repository";
export async function openRepository() {
  const repo = new Repository(await openDatabaseAsync("offday-note.db"));
  await repo.initialize();
  return repo;
}
