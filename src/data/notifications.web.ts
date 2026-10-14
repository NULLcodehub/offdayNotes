import type { NotificationPort } from "./reminders";
export const notificationPort: NotificationPort = {
  permission: async () => {
    throw new Error("Local reminders require the Android or iOS app.");
  },
  schedule: async () => {
    throw new Error("Local reminders require the Android or iOS app.");
  },
  cancel: async () => {},
  scheduled: async () => [],
};
export async function permissionLabel() {
  return "Available in the mobile app";
}
