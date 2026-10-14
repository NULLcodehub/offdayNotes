import * as SplashScreen from "expo-splash-screen";
import { Platform } from "react-native";
import { NotificationOpen } from "@/ui/notification-open";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AppProvider, useApp } from "@/state/app";
if (Platform.OS !== "web") {
  void SplashScreen.preventAutoHideAsync().catch(() => {});
  SplashScreen.setOptions({ duration: 180, fade: true });
}

function Navigation() {
  const { dark, colors } = useApp();
  return (
    <>
      <NotificationOpen />
      <StatusBar style={dark ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      />
    </>
  );
}
export default function Layout() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <Navigation />
      </AppProvider>
    </SafeAreaProvider>
  );
}
