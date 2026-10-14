import { router } from "expo-router";
import { useState, type PropsWithChildren } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type TextStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useApp } from "@/state/app";
export function Label({
  children,
  muted,
  style,
}: PropsWithChildren<{ muted?: boolean; style?: TextStyle }>) {
  const { colors } = useApp();
  return (
    <Text
      style={[
        { color: muted ? colors.muted : colors.text, fontSize: 16 },
        style,
      ]}
    >
      {children}
    </Text>
  );
}
export function Button({
  label,
  onPress,
  primary,
  danger,
  disabled,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  primary?: boolean;
  danger?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
}) {
  const { colors } = useApp();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 48,
        paddingHorizontal: 16,
        paddingVertical: 13,
        borderRadius: 8,
        justifyContent: "center",
        backgroundColor: primary ? colors.accent : "transparent",
        opacity: disabled ? 0.4 : pressed ? 0.65 : 1,
      })}
    >
      <Text
        style={{
          fontSize: 15,
          fontWeight: "600",
          color: primary
            ? colors.background
            : danger
              ? colors.danger
              : colors.text,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
export function Screen({ children }: PropsWithChildren) {
  const { colors } = useApp();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View
        style={{
          flex: 1,
          width: "100%",
          maxWidth: 760,
          alignSelf: "center",
          paddingHorizontal: 24,
        }}
      >
        {children}
      </View>
    </SafeAreaView>
  );
}
export function Header({
  title,
  back,
  action,
}: {
  title: string;
  back?: () => void;
  action?: React.ReactNode;
}) {
  const { colors } = useApp();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: 14,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderColor: colors.line,
      }}
    >
      {back ? (
        <Button label="‹ Back" onPress={back} />
      ) : (
        <Label muted style={{ fontSize: 12, letterSpacing: 3 }}>
          OFFDAY / NOTE
        </Label>
      )}
      <Label style={{ fontWeight: "600" }}>{title}</Label>
      {action ?? <View style={{ width: back ? 60 : 0 }} />}
    </View>
  );
}
export type MenuAction = { label: string; run: () => void; danger?: boolean };
export function Menu({
  actions,
  title = "Note actions",
}: {
  actions: MenuAction[];
  title?: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <>
      <Button
        label="•••"
        accessibilityLabel="More actions"
        onPress={() => setVisible(true)}
      />
      <Sheet visible={visible} close={() => setVisible(false)} title={title}>
        {actions.map((a) => (
          <Button
            key={a.label}
            label={a.label}
            danger={a.danger}
            onPress={() => {
              setVisible(false);
              a.run();
            }}
          />
        ))}
      </Sheet>
    </>
  );
}
export function Sheet({
  children,
  title,
  visible,
  close,
}: PropsWithChildren<{ title: string; visible: boolean; close: () => void }>) {
  const { colors } = useApp();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={close}
    >
      <View
        style={{
          flex: 1,
          justifyContent: "flex-end",
          backgroundColor: "#00000055",
        }}
      >
        <Pressable
          accessibilityLabel="Close menu"
          accessibilityRole="button"
          style={{ flex: 1 }}
          onPress={close}
        />
        <SafeAreaView
          edges={["bottom"]}
          style={{
            backgroundColor: colors.background,
            padding: 24,
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            maxHeight: "80%",
          }}
        >
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Label style={{ fontWeight: "600", fontSize: 20 }}>{title}</Label>
            <Button label="Close" onPress={close} />
          </View>
          <ScrollView
            showsVerticalScrollIndicator={false}
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="always"
          >
            {children}
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}
export function Message({ text, error }: { text: string; error?: boolean }) {
  const { colors } = useApp();
  return text ? (
    <Text
      accessibilityRole="alert"
      style={{
        paddingVertical: 14,
        lineHeight: 22,
        color: error ? colors.danger : colors.muted,
      }}
    >
      {text}
    </Text>
  ) : null;
}

export function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace("/");
}
