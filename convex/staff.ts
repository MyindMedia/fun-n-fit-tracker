import { action } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

// Staff / coach management through Clerk. Invitations carry
// publicMetadata.role = "admin", so the moment an invitee accepts and signs
// in, the app's AdminGuard and Admin nav recognize them — no manual step.
// Clerk's own invite email is suppressed (notify: false); we send the branded
// coach email via Resend with the Clerk invitation link inside. ?coach=1 on
// the redirect makes the sign-in gate route straight to the Admin Portal.
// Uses the Clerk Backend API with CLERK_SECRET_KEY from the deployment env.

const COACH_PORTAL_URL = "https://fnffinal.netlify.app/#/parent-login?coach=1";

function clerkHeaders() {
  const key = process.env.CLERK_SECRET_KEY;
  if (!key) throw new Error("Clerk is not configured on the server");
  return {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
}

export const invite = action({
  args: { email: v.string(), invitedBy: v.string() },
  handler: async (ctx, { email, invitedBy }) => {
    const cleanEmail = email.trim().toLowerCase();
    const res = await fetch("https://api.clerk.com/v1/invitations", {
      method: "POST",
      headers: clerkHeaders(),
      body: JSON.stringify({
        email_address: cleanEmail,
        public_metadata: { role: "admin", invitedBy },
        redirect_url: COACH_PORTAL_URL,
        notify: false, // Clerk's plain email is replaced by our branded one
        ignore_existing: true,
      }),
    });
    const body = (await res.json()) as any;
    if (!res.ok) {
      const msg = body?.errors?.[0]?.long_message ?? body?.errors?.[0]?.message;
      throw new Error(msg || "Could not send the invite — try again");
    }
    // Clerk returns the invitation link when it isn't sending its own email;
    // fall back to the coach sign-in gate if it ever doesn't.
    const inviteUrl = (body.url as string | undefined) || COACH_PORTAL_URL;
    await ctx.scheduler.runAfter(0, internal.email.sendCoachInvite, {
      email: cleanEmail,
      inviteUrl,
      invitedBy,
    });
    return {
      id: body.id as string,
      email: body.email_address as string,
      status: body.status as string,
      url: inviteUrl,
    };
  },
});

export const listInvitations = action({
  args: {},
  handler: async () => {
    const res = await fetch(
      "https://api.clerk.com/v1/invitations?limit=50&status=pending",
      { headers: clerkHeaders() }
    );
    if (!res.ok) throw new Error("Could not load invitations");
    const body = (await res.json()) as any;
    const rows = Array.isArray(body) ? body : body.data ?? [];
    return rows.map((i: any) => ({
      id: i.id as string,
      email: i.email_address as string,
      status: i.status as string,
      createdAt: (i.created_at as number) ?? 0,
    }));
  },
});

export const revokeInvitation = action({
  args: { invitationId: v.string() },
  handler: async (_ctx, { invitationId }) => {
    const res = await fetch(
      `https://api.clerk.com/v1/invitations/${invitationId}/revoke`,
      { method: "POST", headers: clerkHeaders() }
    );
    if (!res.ok) throw new Error("Could not revoke that invite");
    return { ok: true };
  },
});

// Current staff: every Clerk user whose publicMetadata.role is "admin".
export const listStaff = action({
  args: {},
  handler: async () => {
    const res = await fetch(
      "https://api.clerk.com/v1/users?limit=100&order_by=-created_at",
      { headers: clerkHeaders() }
    );
    if (!res.ok) throw new Error("Could not load staff");
    const users = (await res.json()) as any[];
    return users
      .filter((u) => u?.public_metadata?.role === "admin")
      .map((u) => ({
        id: u.id as string,
        name: [u.first_name, u.last_name].filter(Boolean).join(" "),
        email:
          u.email_addresses?.find((e: any) => e.id === u.primary_email_address_id)
            ?.email_address ?? u.email_addresses?.[0]?.email_address ?? "",
        imageUrl: (u.image_url as string) ?? "",
        lastActiveAt: (u.last_active_at as number) ?? null,
      }));
  },
});
