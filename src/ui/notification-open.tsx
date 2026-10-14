import { useEffect } from "react";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { useApp } from "@/state/app";
export function NotificationOpen() {
  const { repo } = useApp();
  useEffect(() => {
    let active = true;
    const seen = new Set<string>();
    const open = async (response: Notifications.NotificationResponse) => {
      const identifier = response.notification.request.identifier;
      if (seen.has(identifier)) return;
      seen.add(identifier);
      const id = response.notification.request.content.data?.noteId;
      if (typeof id !== "string") return;
      try {
        const n = await repo.get(id);
        if (active && n)
          router.push({ pathname: "/note/[id]", params: { id } });
      } catch {
        /* Launch remains usable if the target note cannot open. */
      }
    };
    void Notifications.getLastNotificationResponseAsync()
      .then(async (response) => {
        if (response) {
          await open(response);
          await Notifications.clearLastNotificationResponseAsync();
        }
      })
      .catch(() => {});
    const sub = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        void open(response).finally(() => {
          void Notifications.clearLastNotificationResponseAsync().catch(
            () => {},
          );
        });
      },
    );
    return () => {
      active = false;
      sub.remove();
    };
  }, [repo]);
  return null;
}
