import { Repository } from "./repository";
export async function openRepository() {
  // Delay WASM/worker initialization until the client has mounted; SSR has no browser worker.
  const { openDatabaseAsync } = await import("expo-sqlite");
  const repo = new Repository(await openDatabaseAsync("offday-note.db"), false);
  await repo.initialize();
  return repo;
}
