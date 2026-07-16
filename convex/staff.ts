import { action } from "./_generated/server";
import { v } from "convex/values";

// Staff / coach management through Clerk. Invitations carry
// publicMetadata.role = "admin", so the moment an invitee accepts and signs
// in, the app's AdminGuard and Admin nav recognize them — no manual step.
// Uses the Clerk Backend API with CLERK_SECRET_KEY from the deployment env.

const PORTAL_URL = "https://fnffinal.netlify.app/#/parent-login";

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
  handler: async (_ctx, { email, invitedBy }) => {
    const res = await fetch("https://api.clerk.com/v1/invitations", {
      method: "POST",
      headers: clerkHeaders(),
      body: JSON.stringify({
        email_address: email.trim().toLowerCase(),
        public_metadata: { role: "admin", invitedBy },
        redirect_url: PORTAL_URL,
        notify: true,
        ignore_existing: true,
      }),
    });
    const body = (await res.json()) as any;
    if (!res.ok) {
      const msg = body?.errors?.[0]?.long_message ?? body?.errors?.[0]?.message;
      throw new Error(msg || "Could not send the invite — try again");
    }
    return {
      id: body.id as string,
      email: body.email_address as string,
      status: body.status as string,
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
