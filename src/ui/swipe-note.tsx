import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import { Animated, PanResponder, View } from "react-native";
import { router } from "expo-router";
import { displayTitle, type Note } from "@/data/model";
import { useApp } from "@/state/app";
import { Label } from "./common";
import { isNoteSwipe, noteSwipeAction } from "./swipe-gesture";

export function SwipeNote({
  note,
  onAction,
  onOptions,
  children,
}: PropsWithChildren<{
  note: Note;
  onOptions: () => void;
  onAction: (key: "pinned" | "archived") => Promise<void>;
}>) {
  const { colors } = useApp();
  const [offset] = useState(() => new Animated.Value(0));
  const pending = useRef(false);
  const [side, setSide] = useState<"left" | "right" | null>(null);
  const reset = useCallback(() => {
    Animated.spring(offset, {
      toValue: 0,
      useNativeDriver: true,
      tension: 90,
      friction: 14,
    }).start(() => setSide(null));
  }, [offset]);
  const act = useCallback(
    async (key: "pinned" | "archived") => {
      if (pending.current) return;
      pending.current = true;
      try {
        await onAction(key);
      } finally {
        pending.current = false;
      }
    },
    [onAction],
  );
  const responder = useMemo(
    () =>
      // PanResponder stores handlers; refs are read only when a gesture runs.
      // eslint-disable-next-line react-hooks/refs
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) =>
          !pending.current && isNoteSwipe(g.dx, g.dy),
        onPanResponderMove: (_, g) => {
          offset.setValue(Math.max(-120, Math.min(120, g.dx)));
          setSide(g.dx > 0 ? "right" : "left");
        },
        onPanResponderRelease: (_, g) => {
          const key = noteSwipeAction(g.dx, g.dy);
          reset();
          if (key) void act(key);
        },
        onPanResponderTerminate: reset,
        onPanResponderTerminationRequest: () => true,
      }),
    [offset, reset, act],
  );
  return (
    <View
      accessible
      accessibilityRole="button"
      accessibilityLabel={displayTitle(note)}
      accessibilityHint="Hold for note actions. Swipe right to pin, left to archive or restore"
      accessibilityActions={[
        { name: "activate", label: "Open note" },
        { name: "options", label: "More note actions" },
        { name: "pin", label: note.pinned ? "Unpin" : "Pin" },
        { name: "archive", label: note.archived ? "Restore" : "Archive" },
      ]}
      onAccessibilityAction={(e) => {
        const action = e.nativeEvent.actionName;
        if (action === "activate")
          router.push({ pathname: "/note/[id]", params: { id: note.id } });
        else if (action === "options") onOptions();
        else if (action === "pin" || action === "archive")
          void act(action === "pin" ? "pinned" : "archived");
      }}
      style={{ overflow: "hidden" }}
    >
      {side && (
        <View
          style={{
            position: "absolute",
            inset: 0,
            backgroundColor: colors.surface,
            justifyContent: "center",
            alignItems: side === "right" ? "flex-start" : "flex-end",
            paddingHorizontal: 14,
          }}
        >
          <Label style={{ color: colors.accent, fontSize: 13 }}>
            {side === "right"
              ? note.pinned
                ? "Unpin"
                : "Pin"
              : note.archived
                ? "Restore"
                : "Archive"}
          </Label>
        </View>
      )}
      <Animated.View
        {...responder.panHandlers}
        style={{
          backgroundColor: colors.background,
          transform: [{ translateX: offset }],
        }}
      >
        {children}
      </Animated.View>
    </View>
  );
}
