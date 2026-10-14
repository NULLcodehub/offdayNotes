import { LaunchScreen } from "@/ui/launch-screen";
import * as SplashScreen from "expo-splash-screen";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type PropsWithChildren,
} from "react";
import { Platform, AppState, Text, View, useColorScheme } from "react-native";
import { openRepository } from "@/data/open";
import type { Repository } from "@/data/repository";
import { ReminderService } from "@/data/reminders";
import { notificationPort } from "@/data/notifications";
import { defaultPreferences, type Preferences } from "@/data/model";
const palettes = {
  light: {
    background: "#FFFFFF",
    text: "#242823",
    muted: "#656C60",
    line: "#E1E2D8",
    accent: "#536749",
    surface: "#EEEEE5",
    danger: "#A34332",
  },
  black: {
    background: "#000000",
    text: "#F2F2ED",
    muted: "#A6AAA1",
    line: "#2B2D29",
    accent: "#B2C5A4",
    surface: "#151714",
    danger: "#F2A293",
  },
  dark: {
    background: "#20231F",
    text: "#EDEEE6",
    muted: "#A1A89A",
    line: "#3A4036",
    accent: "#B2C5A4",
    surface: "#2B3028",
    danger: "#F2A293",
  },
};
type Context = {
  repo: Repository;
  reminders: ReminderService;
  preferences: Preferences;
  setPreferences: (p: Preferences) => Promise<void>;
  colors: typeof palettes.light;
  dark: boolean;
  revision: number;
  refresh: () => void;
  recovery: string | null;
};
const AppContext = createContext<Context | null>(null);
export function AppProvider({ children }: PropsWithChildren) {
  const [repo, setRepo] = useState<Repository>();
  const [reminders, setReminders] = useState<ReminderService>();
  const [preferences, setPrefs] = useState(defaultPreferences);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [revision, setRevision] = useState(0);
  const [recovery, setRecovery] = useState<string | null>(null);
  const scheme = useColorScheme();
  const dark =
    preferences.theme === "black" ||
    preferences.theme === "dark" ||
    (preferences.theme === "system" && scheme === "dark");
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const r = await openRepository();
        const p = await r.preferences();
        const service = new ReminderService(r, notificationPort);
        try {
          await service.reconcile();
        } catch {
          if (active)
            setRecovery(
              "Reminder status could not be checked. Open a reminder to review it.",
            );
        }
        if (active) {
          setRepo(r);
          setPrefs(p);
          setReminders(service);
        }
      } catch (e) {
        console.error("Notebook initialization failed:", e);
        if (active)
          setError(
            (e as Error).message.includes("newer")
              ? (e as Error).message
              : "Your notebook could not open. Check available storage and try again.",
          );
      }
    })();
    return () => {
      active = false;
    };
  }, [attempt]);
  useEffect(() => {
    if (!reminders) return;
    const s = AppState.addEventListener("change", (state) => {
      if (state === "active")
        void reminders
          .reconcile()
          .then(() => {
            setRecovery(null);
            setRevision((v) => v + 1);
          })
          .catch(() => setRecovery("Reminder status could not be checked."));
    });
    return () => s.remove();
  }, [reminders]);
  useEffect(() => {
    if (Platform.OS !== "web" && ((repo && reminders) || error))
      SplashScreen.hide();
  }, [repo, reminders, error]);
  if (!repo || !reminders) {
    if (!error) return <LaunchScreen />;
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: palettes.light.background,
          justifyContent: "center",
          alignItems: "center",
          padding: 32,
          gap: 20,
        }}
      >
        <Text>{error}</Text>
        <Text
          accessibilityRole="button"
          onPress={() => {
            setError("");
            setAttempt((value) => value + 1);
          }}
        >
          Try again
        </Text>
      </View>
    );
  }
  return (
    <AppContext.Provider
      value={{
        repo,
        reminders,
        preferences,
        setPreferences: async (p) => {
          await repo.setPreferences(p);
          setPrefs(p);
        },
        colors:
          preferences.theme === "black"
            ? palettes.black
            : dark
              ? palettes.dark
              : palettes.light,
        dark,
        revision,
        refresh: () => setRevision((v) => v + 1),
        recovery,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}
export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error("AppProvider missing");
  return context;
}
