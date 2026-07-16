#!/usr/bin/env node
// Bulk-import students into Convex from a CSV or JSON file.
//
//   node scripts/import-students.mjs roster.csv
//   node scripts/import-students.mjs roster.json
//
// CSV: first row is a header. Recognized columns (case/spacing-insensitive):
//   fullName (or name, full_name)  — required
//   houseId (or house)             — UNITY | SAGE | SPARK | VALOR
//   gender                         — Male | Female
//   points, totalXp (or total_xp, xp)
//   gamerTag (or gamer_tag), avatarUrl (or avatar_url), bio
// Unknown columns are ignored. Already-existing names are skipped (idempotent).
import { readFileSync } from "node:fs";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";

const CONVEX_URL = process.env.VITE_CONVEX_URL || "https://dependable-spoonbill-535.convex.cloud";
const HOUSES = ["UNITY", "SAGE", "SPARK", "VALOR"];

const file = process.argv[2];
if (!file) {
  console.error("Usage: node scripts/import-students.mjs <roster.csv|roster.json>");
  process.exit(1);
}

const norm = (s) => s.toLowerCase().replace(/[^a-z]/g, "");
const COLUMN_ALIASES = {
  fullname: "fullName", name: "fullName", studentname: "fullName", student: "fullName",
  houseid: "houseId", house: "houseId", team: "houseId",
  gender: "gender",
  points: "points", pts: "points",
  totalxp: "totalXp", xp: "totalXp",
  gamertag: "gamerTag",
  avatarurl: "avatarUrl", avatar: "avatarUrl",
  bio: "bio",
};

// Minimal CSV parser with quoted-field support
function parseCsv(text) {
  const rows = [];
  let row = [], field = "", inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((f) => f.trim() !== "")) rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== "" || row.length) { row.push(field); if (row.some((f) => f.trim() !== "")) rows.push(row); }
  return rows;
}

function loadStudents(path) {
  const text = readFileSync(path, "utf8");
  if (path.endsWith(".json")) {
    const data = JSON.parse(text);
    return Array.isArray(data) ? data : data.students;
  }
  const [header, ...rows] = parseCsv(text);
  const keys = header.map((h) => COLUMN_ALIASES[norm(h)] ?? null);
  return rows.map((cells) => {
    const s = {};
    keys.forEach((key, i) => {
      if (!key || cells[i] === undefined || cells[i].trim() === "") return;
      s[key] = cells[i].trim();
    });
    return s;
  });
}

function clean(raw) {
  const s = { fullName: String(raw.fullName ?? raw.full_name ?? "").trim() };
  if (!s.fullName) return null;
  const house = String(raw.houseId ?? raw.house_id ?? "").trim().toUpperCase();
  if (HOUSES.includes(house)) s.houseId = house;
  const gender = String(raw.gender ?? "").trim();
  if (/^m/i.test(gender)) s.gender = "Male";
  else if (/^f/i.test(gender)) s.gender = "Female";
  if (raw.points !== undefined && !Number.isNaN(Number(raw.points))) s.points = Number(raw.points);
  const xp = raw.totalXp ?? raw.total_xp;
  if (xp !== undefined && !Number.isNaN(Number(xp))) s.totalXp = Number(xp);
  if (raw.gamerTag ?? raw.gamer_tag) s.gamerTag = String(raw.gamerTag ?? raw.gamer_tag);
  const avatar = raw.avatarUrl ?? raw.avatar_url;
  if (avatar && /^https?:\/\//.test(avatar)) s.avatarUrl = String(avatar);
  if (raw.bio) s.bio = String(raw.bio);
  if (Array.isArray(raw.badges)) s.badges = raw.badges;
  if (Array.isArray(raw.inventory)) s.inventory = raw.inventory;
  return s;
}

const students = loadStudents(file).map(clean).filter(Boolean);
if (students.length === 0) {
  console.error("No usable rows found — need at least a fullName/name column.");
  process.exit(1);
}
console.log(`Importing ${students.length} students into ${CONVEX_URL} ...`);

const client = new ConvexHttpClient(CONVEX_URL);
let imported = 0;
const skipped = [];
for (let i = 0; i < students.length; i += 50) {
  const batch = students.slice(i, i + 50);
  const result = await client.mutation(api.migration.importStudents, { students: batch });
  imported += result.imported;
  skipped.push(...result.skipped);
}
console.log(`✅ Imported ${imported}. Skipped ${skipped.length} already-existing:${skipped.length ? "\n  - " + skipped.join("\n  - ") : " (none)"}`);
