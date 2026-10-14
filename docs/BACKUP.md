# Backup format v1

UTF-8 JSON, maximum 25 MB, containing:

```json
{
  "format": "offday-note",
  "version": 1,
  "exportedAt": 1791964800000,
  "notes": [
    {
      "id": "stable-note-id",
      "title": "Optional title",
      "content": { "type": "doc", "content": [{ "type": "paragraph" }] },
      "createdAt": 1791964800000,
      "updatedAt": 1791964800000,
      "pinned": false,
      "archived": false
    }
  ],
  "reminders": [
    {
      "noteId": "stable-note-id",
      "scheduledAt": 1792051200000,
      "status": "scheduled",
      "notificationId": "device-specific-identifier"
    }
  ]
}
```

Dates are UTC epoch milliseconds, rendered in the device's local time zone. Content is Tiptap JSON: headings, text marks, list/checklist blocks, completion attributes, quotes, dividers and table rows/cells. No remote HTML or attachment references are imported.

Validation rejects unsupported versions, invalid timestamps, unknown blocks/marks, malformed structure, unsafe link protocols, merged/mismatched table cells, duplicate IDs inside a file, orphan/duplicate reminder records, over-deep content, more than 20,000 notes and files over 25 MB. A validation error identifies the failing note number where possible. Validation completes before any write. Import then runs in one SQLite transaction; write failure rolls back all new records.

Duplicates already present in the destination are skipped by ID, even if backup content differs. Existing edits are preserved. New IDs with identical text are separate notes. Preferences are device-local and do not change on restore.

Reminder metadata is retained, but OS identifiers are cleared. Previously active reminders become `needsScheduling`, including past dates; the user chooses a future date and explicitly schedules them on this device. Completed/cancelled status is retained. No permission is requested during import.
