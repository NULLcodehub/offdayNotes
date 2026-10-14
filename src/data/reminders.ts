import type { Note, Reminder } from "./model";
import { displayTitle } from "./model";
import type { Repository } from "./repository";
export interface NotificationPort {
  permission(): Promise<boolean>;
  schedule(
    id: string,
    date: number,
    title: string,
    noteId: string,
  ): Promise<string>;
  cancel(id: string): Promise<void>;
  scheduled(): Promise<string[]>;
}
export class ReminderService {
  private tail: Promise<unknown> = Promise.resolve();
  constructor(
    private repo: Repository,
    private port: NotificationPort,
  ) {}
  private serial<T>(fn: () => Promise<T>) {
    const task = this.tail.then(fn);
    this.tail = task.catch(() => {});
    return task;
  }
  schedule(note: Note, date: number) {
    return this.serial(async () => {
      if (!Number.isFinite(date) || date <= Date.now())
        throw new Error("Choose a future date and time.");
      if (!(await this.port.permission()))
        throw new Error(
          "Notifications are disabled. Enable them in system settings, then try again.",
        );
      const prefix = "offday-" + encodeURIComponent(note.id) + ":";
      const id = prefix + date;
      const old = (await this.repo.reminders()).find(
        (r) => r.noteId === note.id,
      );
      const pending: Reminder = {
        noteId: note.id,
        scheduledAt: date,
        notificationId: id,
        status: "pending",
      };
      await this.repo.setReminder(pending);
      try {
        for (const scheduledId of await this.port.scheduled()) {
          if (
            scheduledId.startsWith(prefix) ||
            scheduledId === old?.notificationId
          )
            await this.port.cancel(scheduledId);
        }
        const notificationId = await this.port.schedule(
          id,
          date,
          displayTitle(note),
          note.id,
        );
        await this.repo.setReminder({
          ...pending,
          notificationId,
          status: "scheduled",
        });
      } catch (e) {
        // The pending record lets reconciliation resolve a crash after OS scheduling.
        try {
          await this.port.cancel(id);
          await this.repo.setReminder({
            ...pending,
            status: "needsScheduling",
            notificationId: null,
          });
        } catch {
          /* Keep pending metadata for launch recovery. */
        }
        if (old?.status === "scheduled")
          throw new Error(
            "The reminder could not be updated. Review it and try scheduling again.",
          );
        throw e;
      }
    });
  }
  cancel(noteId: string, completed = false) {
    return this.serial(async () => {
      const r = (await this.repo.reminders()).find((r) => r.noteId === noteId);
      if (!r) return;
      const prefix = "offday-" + encodeURIComponent(noteId) + ":";
      for (const id of await this.port.scheduled()) {
        if (id.startsWith(prefix) || id === r.notificationId)
          await this.port.cancel(id);
      }
      await this.repo.setReminder({
        ...r,
        status: completed ? "completed" : "cancelled",
        notificationId: null,
      });
    });
  }
  reconcile() {
    return this.serial(async () => {
      const scheduled = new Set(await this.port.scheduled());
      const records = await this.repo.reminders();
      const owned = new Set(
        records
          .filter((r) => ["pending", "scheduled"].includes(r.status))
          .map((r) => r.notificationId),
      );
      for (const id of scheduled)
        if (id.startsWith("offday-") && !owned.has(id))
          await this.port.cancel(id);
      for (const r of records) {
        if (!["pending", "scheduled"].includes(r.status)) continue;
        if (r.scheduledAt <= Date.now()) {
          await this.port.cancel(r.notificationId ?? "offday-" + r.noteId);
          await this.repo.setReminder({
            ...r,
            status: "completed",
            notificationId: null,
          });
        } else if (!r.notificationId || !scheduled.has(r.notificationId))
          await this.repo.setReminder({
            ...r,
            status: "needsScheduling",
            notificationId: null,
          });
        else if (r.status === "pending")
          await this.repo.setReminder({ ...r, status: "scheduled" });
      }
    });
  }
}

export function quickReminderDate(
  option: "today" | "tomorrow" | "weekend",
  now = new Date(),
): Date {
  const result = new Date(now);
  if (option === "today") {
    const end = new Date(now);
    end.setHours(23, 59, 0, 0);
    result.setTime(Math.min(now.getTime() + 3 * 3600000, end.getTime()));
    if (result <= now)
      throw new Error(
        "There is no time left today. Choose tomorrow or a custom time.",
      );
  } else {
    result.setHours(9, 0, 0, 0);
    result.setDate(
      result.getDate() +
        (option === "tomorrow" ? 1 : (6 - now.getDay() + 7) % 7),
    );
    if (result <= now) result.setDate(result.getDate() + 7);
  }
  return result;
}
