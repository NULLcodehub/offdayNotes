import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import type { NotificationPort } from "./reminders";
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});
export const notificationPort: NotificationPort = {
  async permission() {
    if (Platform.OS === "android")
      await Notifications.setNotificationChannelAsync("notes", {
        name: "Note reminders",
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    let p = await Notifications.getPermissionsAsync();
    if (!p.granted && p.canAskAgain)
      p = await Notifications.requestPermissionsAsync();
    return (
      p.granted ||
      p.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
    );
  },
  schedule: (identifier, date, title, noteId) =>
    Notifications.scheduleNotificationAsync({
      identifier,
      content: {
        title,
        body: "A quiet reminder from Offday Note.",
        data: { noteId },
        sound: "default",
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(date),
        channelId: "notes",
      },
    }),
  cancel: (id) => Notifications.cancelScheduledNotificationAsync(id),
  scheduled: async () =>
    (await Notifications.getAllScheduledNotificationsAsync()).map(
      (n) => n.identifier,
    ),
};
export async function permissionLabel() {
  const p = await Notifications.getPermissionsAsync();
  return p.granted ? "Enabled" : "Not enabled";
}
