# NFC Tags & Wristbands — Strategy

Written 2026-07-15. Goal: assign NFC tags/wristbands to students and use them for
check-in and in-game timing/tracking, driven by a USB NFC reader at the front desk.

## How the hardware works (and why this needs no drivers)

Consumer USB NFC readers used for attendance (ACR122U with HID firmware, generic
"NFC keyboard emulation" readers, ~$25–60) operate as **keyboard wedges**: tap a tag
and the reader *types* the tag's UID followed by Enter, exactly like a barcode gun.
The browser just sees fast keystrokes — no drivers, no WebUSB, works on any Mac /
PC / Chromebook the moment it's plugged in.

The app's **wedge listener** recognizes a reader by its typing signature (a burst of
4+ hex characters with <35 ms between keys, ending in Enter — humans can't type that
fast), so scans are captured even without a focused input, and normal typing is never
mistaken for a scan.

Second input path, no extra hardware: **Web NFC** (Android Chrome on phones/tablets)
reads tag UIDs directly — a coach's Android tablet doubles as a roaming reader for
games. iOS Safari has no Web NFC; iPhones use the QR paths instead.

> Buying guidance: any reader sold as "USB NFC reader keyboard emulation /
> 13.56 MHz Mifare" works. If the reader outputs nothing when tapped, it's a
> PC/SC-only model (like a stock ACR122U) — most can be flipped to HID/keyboard
> mode with the vendor tool, or exchanged for a keyboard-emulation model.
> Wristbands: 13.56 MHz NTAG213 / Mifare Classic silicone bands, any vendor.

## Data model

- `students.deviceId` (already in the schema, previously dormant) stores the tag UID,
  normalized (uppercase hex, no separators). One tag ↔ one student, enforced server-side.
- Every scan action runs through the existing transactional helpers, so NFC check-ins
  are identical to QR/manual ones on the board, Roll Call, and the points ledger.

## Convex surface (`convex/nfc.ts`)

- `assignTag { studentId, tagUid }` — binds a tag; rejects a UID already on another
  student (returns who has it); overwrites the student's previous tag.
- `unassignTag { studentId }`
- `resolveTag { tagUid }` — → student (or null); powers "scan first, then assign" and
  all scan modes.
- `checkInByTag { tagUid, adminName, localDate }` — full check-in ledger flow (board +
  Roll Call + daily bonus), returns student + OK/ALREADY/UNKNOWN_TAG so the UI can
  flash the result.
- `gameScanByTag { tagUid, adminName }` — timestamped scan event for timing/tracking:
  publishes the existing `lap_time` event bus kind + activity entry. Game modes build
  on this (lap splits are computed from consecutive scan timestamps per student).

## Admin UI — "NFC Tags" sub-page

1. **Reader status / test strip** — always listening while the page is open; shows the
   last scan (UID + who it resolved to) with a green flash. Plug in the reader, tap a
   tag, see it live: that's the "reader recognized" proof.
2. **Assign flows (both directions)**
   - *Scan-first:* tap an unknown tag → it appears with an "Assign to…" student picker.
   - *Student-first:* pick a student → "Assign Tag / Wristband" → next tap binds it.
3. **Tag roster** — who has a band (with UID), unassign / re-scan buttons.
4. **Check-In Mode** — big fullscreen-friendly toggle: every tap checks that student in
   (same +10 daily-bonus ledger), with a large name + avatar + house flash so the desk
   sees who just badged. Unknown tags flash amber with a one-tap assign shortcut.
5. **Game / Timing Mode** — every tap records a timestamped scan for the resolved
   student (lap counting, split times between consecutive taps shown live). Feeds the
   activity ticker; deeper per-game scoring hooks can attach to `gameScanByTag` later.

The parent-portal Android NFC check-in that already exists (Web NFC + kiosk secret)
stays unchanged; this adds the staff-side reader workflows.

## Rollout

1. Plug the reader into the front-desk machine, open Admin → NFC Tags, tap a band —
   the test strip shows the UID.
2. Assign bands during one session (scan-first flow is fastest: tap, pick kid, next).
3. Leave Check-In Mode on at the desk; parents/kids tap in on arrival.
4. For timed games, a coach opens Game Mode on any machine with the reader (or an
   Android tablet using its built-in NFC).
