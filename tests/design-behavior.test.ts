import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeLink } from "../src/data/links";
import { isNoteSwipe, noteSwipeAction } from "../src/ui/swipe-gesture";

test("link entry preserves HTTP/HTTPS and adds HTTPS to bare domains", () => {
  for (const value of [
    "http://example.com/path",
    "https://example.com/path",
    "mailto:hello@example.com",
  ])
    assert.equal(normalizeLink(value), value);
  assert.equal(
    normalizeLink(" example.com/path?q=notes "),
    "https://example.com/path?q=notes",
  );
  assert.equal(normalizeLink("www.example.com"), "https://www.example.com");
  for (const value of [
    "javascript:alert(1)",
    "data:text/html,test",
    "file:///tmp/a",
    "ftp://example.com",
    "https://",
    "http://a b.com",
    "a word",
    "http://user:secret@example.com",
    "mailto:missing",
    "",
    "a".repeat(2048),
  ])
    assert.equal(normalizeLink(value), null, value);
});

test("note swipes ignore vertical scrolling, diagonals and short drags", () => {
  assert.equal(isNoteSwipe(4, 80), false);
  assert.equal(isNoteSwipe(50, 45), false);
  assert.equal(noteSwipeAction(79, 0), null);
  assert.equal(noteSwipeAction(-70, 0), null);
  assert.equal(noteSwipeAction(100, 90), null);
  assert.equal(noteSwipeAction(90, 10), "pinned");
  assert.equal(noteSwipeAction(-90, 10), "archived");
});
