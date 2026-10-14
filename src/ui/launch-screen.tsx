import { Image, Platform, Text, View, useColorScheme } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as SplashScreen from "expo-splash-screen";
export function LaunchScreen() {
  const dark = useColorScheme() === "dark";
  const insets = useSafeAreaInsets();
  return (
    <View
      onLayout={() => {
        if (Platform.OS !== "web") SplashScreen.hide();
      }}
      style={{
        flex: 1,
        backgroundColor: dark ? "#20231F" : "#F8F6F0",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <Image
        source={
          dark
            ? require("../../assets/images/offday-splash-dark.png")
            : require("../../assets/images/offday-splash.png")
        }
        style={{ width: 180, height: 180 }}
        resizeMode="contain"
        accessibilityLabel="ON"
      />
      <Text
        style={{
          position: "absolute",
          bottom: insets.bottom + 32,
          color: dark ? "#EDEEE6" : "#242823",
          fontSize: 20,
          fontWeight: "300",
          letterSpacing: 1.2,
        }}
      >
        Offday Note
      </Text>
    </View>
  );
}
