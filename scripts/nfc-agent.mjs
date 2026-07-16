#!/usr/bin/env node
// Fun 'n Fit NFC Agent — bridges PC/SC USB readers (ACR1252U, ACR122U, any
// CCID reader) to the app. Reads tag UIDs natively and pushes each tap to
// Convex; the open Admin → NFC Bands page picks them up live and applies the
// current mode (assign / check-in / points / timing).
//
//   Run on the front-desk machine:   npm run nfc-agent
//
// No config needed — uses the same production Convex deployment as the app.
import { NFC } from "nfc-pcsc";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";

const CONVEX_URL = process.env.VITE_CONVEX_URL || "https://dependable-spoonbill-535.convex.cloud";
const client = new ConvexHttpClient(CONVEX_URL);

const log = (msg) => console.log(`[${new Date().toLocaleTimeString()}] ${msg}`);

log(`Fun 'n Fit NFC Agent → ${CONVEX_URL}`);
log("Waiting for a USB NFC reader (plug in your ACR1252U)...");

let nfc = null;
let lastUid = null;
let lastTs = 0;
let heartbeatTimer = null;
let activeReaderName = null;
let reinitTimer = null;

// macOS stops the PC/SC service when the last reader unplugs, which kills the
// NFC session. Recreate it on a loop so unplug → replug just works.
const scheduleReinit = () => {
  if (reinitTimer) return;
  clearInterval(heartbeatTimer);
  if (activeReaderName) {
    void sendHeartbeat(false);
    activeReaderName = null;
  }
  reinitTimer = setTimeout(() => {
    reinitTimer = null;
    log("Re-opening PC/SC session (waiting for a reader)...");
    initNfc();
  }, 5000);
};

const sendHeartbeat = async (online = true) => {
  if (!activeReaderName) return;
  try {
    await client.mutation(api.nfc.pushHeartbeat, {
      readerId: activeReaderName,
      online,
    });
  } catch (e) {
    log(`Heartbeat failed: ${e.message}`);
  }
};

function initNfc() {
nfc = new NFC();
nfc.on("reader", (reader) => {
  // The ACR1252 exposes PICC (contactless) + SAM slots; track the PICC one.
  if (/SAM/i.test(reader.reader.name) && activeReaderName) return;
  log(`✅ Reader connected: ${reader.reader.name}`);
  log("   Tap a band/tag to send it to the app.");
  if (!/SAM/i.test(reader.reader.name)) {
    activeReaderName = reader.reader.name;
    void sendHeartbeat(true);
    clearInterval(heartbeatTimer);
    heartbeatTimer = setInterval(() => void sendHeartbeat(true), 20_000);
  }

  // UID-only mode; we don't need NDEF payloads.
  reader.autoProcessing = true;

  reader.on("card", async (card) => {
    const uid = (card.uid || "").replace(/[^0-9a-fA-F]/g, "").toUpperCase();
    if (!uid) {
      log("⚠️  Tag detected but no UID (unsupported tag type)");
      return;
    }
    // Debounce: readers fire repeatedly while a tag rests on the pad.
    const now = Date.now();
    if (uid === lastUid && now - lastTs < 2500) return;
    lastUid = uid;
    lastTs = now;

    try {
      await client.mutation(api.nfc.pushScan, {
        tagUid: uid,
        readerId: reader.reader.name,
      });
      log(`📡 Tap sent: …${uid.slice(-8)}`);
    } catch (e) {
      log(`❌ Failed to send tap: ${e.message}`);
    }
  });

  reader.on("error", (err) => log(`Reader error: ${err.message}`));
  reader.on("end", () => {
    log(`Reader disconnected: ${reader.reader.name}`);
    if (reader.reader.name === activeReaderName) {
      clearInterval(heartbeatTimer);
      void sendHeartbeat(false);
      activeReaderName = null;
    }
  });
});

nfc.on("error", (err) => {
  log(`PC/SC error: ${err.message}`);
  scheduleReinit();
});
}

initNfc();

process.on("SIGINT", async () => {
  clearInterval(heartbeatTimer);
  await sendHeartbeat(false).catch(() => {});
  log("Agent stopped.");
  process.exit(0);
});
