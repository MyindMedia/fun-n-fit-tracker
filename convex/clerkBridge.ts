import { action, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { randomToken } from "./helpers";

// Bridges Clerk authentication to the app's existing parent-session system.
// The client sends its Clerk session JWT; we verify the signature against the
// instance JWKS, load the user's email through the Clerk Backend API, then
// get-or-create the parent row and mint a regular parentSessions token — so
// every existing parent-scoped function keeps working unchanged.

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // match parents.ts

function b64urlToBytes(s: string): Uint8Array {
  const pad = s.length % 4 === 2 ? "==" : s.length % 4 === 3 ? "=" : "";
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function decodeJwtPart(part: string): any {
  return JSON.parse(new TextDecoder().decode(b64urlToBytes(part)));
}

async function verifyClerkJwt(token: string, expectedIssuer: string) {
  const [headerB64, payloadB64, sigB64] = token.split(".");
  if (!headerB64 || !payloadB64 || !sigB64) throw new Error("Malformed token");
  const header = decodeJwtPart(headerB64);
  const payload = decodeJwtPart(payloadB64);

  if (payload.iss !== expectedIssuer) throw new Error("Unexpected token issuer");
  const nowSec = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== "number" || payload.exp < nowSec - 30) {
    throw new Error("Session token expired — refresh and try again");
  }
  if (typeof payload.nbf === "number" && payload.nbf > nowSec + 30) {
    throw new Error("Token not yet valid");
  }

  const jwksRes = await fetch(`${expectedIssuer}/.well-known/jwks.json`);
  if (!jwksRes.ok) throw new Error("Could not load signing keys");
  const jwks = (await jwksRes.json()) as { keys: Array<any> };
  const jwk = jwks.keys.find((k) => k.kid === header.kid) ?? jwks.keys[0];
  if (!jwk) throw new Error("No matching signing key");

  const key = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"]
  );
  const valid = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key,
    b64urlToBytes(sigB64) as unknown as ArrayBuffer,
    new TextEncoder().encode(`${headerB64}.${payloadB64}`)
  );
  if (!valid) throw new Error("Invalid token signature");
  return payload as { sub: string };
}

export const signIn = action({
  args: { clerkToken: v.string() },
  handler: async (ctx, { clerkToken }) => {
    const issuer = process.env.CLERK_JWT_ISSUER;
    const secretKey = process.env.CLERK_SECRET_KEY;
    if (!issuer || !secretKey) {
      throw new Error("Clerk is not configured on the server");
    }

    const { sub } = await verifyClerkJwt(clerkToken, issuer);

    const userRes = await fetch(`https://api.clerk.com/v1/users/${sub}`, {
      headers: { Authorization: `Bearer ${secretKey}` },
    });
    if (!userRes.ok) throw new Error("Could not load your account — try again");
    const user = (await userRes.json()) as {
      id: string;
      first_name?: string | null;
      last_name?: string | null;
      primary_email_address_id?: string | null;
      email_addresses?: Array<{ id: string; email_address: string }>;
      public_metadata?: Record<string, unknown>;
    };
    const email = (
      user.email_addresses?.find((e) => e.id === user.primary_email_address_id)
        ?.email_address ?? user.email_addresses?.[0]?.email_address
    )?.toLowerCase();
    if (!email) throw new Error("Your account has no email address");
    const fullName =
      [user.first_name, user.last_name].filter(Boolean).join(" ").trim() ||
      email.split("@")[0];

    return await ctx.runMutation(internal.clerkBridge.upsertParentSession, {
      email,
      fullName,
    });
  },
});

export const upsertParentSession = internalMutation({
  args: { email: v.string(), fullName: v.string() },
  handler: async (ctx, { email, fullName }) => {
    let parent = await ctx.db
      .query("parents")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();
    if (!parent) {
      // Clerk owns the credential; local password fields hold random filler.
      const parentId = await ctx.db.insert("parents", {
        email,
        fullName,
        phone: null,
        passwordHash: randomToken(32),
        salt: randomToken(16),
        createdAt: Date.now(),
      });
      parent = (await ctx.db.get(parentId))!;
      // First sign-up: send the how-it-works welcome email (fire and forget).
      await ctx.scheduler.runAfter(0, internal.email.sendParentWelcome, {
        email,
        fullName,
      });
    } else if (parent.fullName !== fullName && fullName) {
      await ctx.db.patch(parent._id, { fullName });
      parent = (await ctx.db.get(parent._id))!;
    }

    const token = randomToken(32);
    await ctx.db.insert("parentSessions", {
      parentId: parent._id,
      token,
      createdAt: Date.now(),
      expiresAt: Date.now() + SESSION_TTL_MS,
    });
    return {
      token,
      parent: {
        id: parent._id,
        email: parent.email,
        fullName: parent.fullName,
        phone: parent.phone ?? undefined,
      },
    };
  },
});
