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

const nfc = new NFC();
let lastUid = null;
let lastTs = 0;

nfc.on("reader", (reader) => {
  log(`✅ Reader connected: ${reader.reader.name}`);
  log("   Tap a band/tag to send it to the app.");

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
  reader.on("end", () => log(`Reader disconnected: ${reader.reader.name}`));
});

nfc.on("error", (err) => {
  log(`PC/SC error: ${err.message}`);
  log("If this persists: unplug/replug the reader, or check that no other NFC software is holding it.");
});

process.on("SIGINT", () => {
  log("Agent stopped.");
  process.exit(0);
});
