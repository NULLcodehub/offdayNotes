export function isNoteSwipe(dx: number, dy: number) {
  return Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.5;
}
export function noteSwipeAction(
  dx: number,
  dy: number,
): "pinned" | "archived" | null {
  if (!isNoteSwipe(dx, dy) || Math.abs(dx) < 80) return null;
  return dx > 0 ? "pinned" : "archived";
}
