import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

// HTTP endpoints (served from https://dependable-spoonbill-535.convex.site).
//
// POST /parent-invite — called by the GoHighLevel workflow after an
// enrollment purchase. Pre-creates the parent + athlete link and emails the
// branded invite. Guarded by a shared secret header.
//
//   Header: x-invite-secret: <INVITE_WEBHOOK_SECRET env value>
//   Body:   { "email": "...", "fullName": "...", "studentName": "..." }
//           (or "studentNames": ["...", "..."] for multiple kids)

const http = httpRouter();

http.route({
  path: "/parent-invite",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const secret = process.env.INVITE_WEBHOOK_SECRET;
    if (!secret || req.headers.get("x-invite-secret") !== secret) {
      return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    let body: any;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ ok: false, error: "invalid JSON" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const email = typeof body?.email === "string" ? body.email : "";
    const fullName = typeof body?.fullName === "string" ? body.fullName : "";
    const studentNames: string[] = Array.isArray(body?.studentNames)
      ? body.studentNames.filter((n: unknown) => typeof n === "string")
      : typeof body?.studentName === "string" && body.studentName.trim()
        ? [body.studentName]
        : [];

    if (!email) {
      return new Response(JSON.stringify({ ok: false, error: "email is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    try {
      const result = await ctx.runMutation(internal.invites.createFromWebhook, {
        email,
        fullName,
        studentNames,
      });
      return new Response(JSON.stringify({ ok: true, ...result }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (err: any) {
      return new Response(
        JSON.stringify({ ok: false, error: err?.message ?? "invite failed" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
  }),
});

export default http;
