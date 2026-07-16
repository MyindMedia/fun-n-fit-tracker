// Simulates the exact client avatar-upload flow against production Convex.
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";

const client = new ConvexHttpClient("https://dependable-spoonbill-535.convex.cloud");
const STUDENT_ID = "md779kw08111ev7vczcsvha0fx89r0ec"; // UI Test Athlete

// 1x1 red PNG
const pngB64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const bytes = Buffer.from(pngB64, "base64");

const before = (await client.query(api.students.list, {})).find((s) => s._id === STUDENT_ID);
console.log("before avatarUrl:", before.avatarUrl?.slice(0, 60));

const uploadUrl = await client.mutation(api.files.generateUploadUrl, {});
console.log("got upload url:", uploadUrl.slice(0, 60), "...");

const res = await fetch(uploadUrl, {
  method: "POST",
  headers: { "Content-Type": "image/png" },
  body: bytes,
});
console.log("upload POST status:", res.status);
const { storageId } = await res.json();
console.log("storageId:", storageId);

const publicUrl = await client.query(api.files.fileUrl, { storageId });
console.log("public url:", publicUrl?.slice(0, 70));

await client.mutation(api.students.update, { id: STUDENT_ID, avatarUrl: publicUrl });
const after = (await client.query(api.students.list, {})).find((s) => s._id === STUDENT_ID);
console.log("after avatarUrl:", after.avatarUrl?.slice(0, 70));
console.log("PERSISTED:", after.avatarUrl === publicUrl);

// restore original avatar
await client.mutation(api.students.update, { id: STUDENT_ID, avatarUrl: before.avatarUrl });
console.log("restored original avatar");
