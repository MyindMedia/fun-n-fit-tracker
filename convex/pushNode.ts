"use node";
import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import webpush from "web-push";

// Web push delivery (node runtime for the web-push library). Fan-out to every
// stored subscription; dead endpoints (404/410) get pruned afterwards.

export const deliver = internalAction({
  args: {
    title: v.string(),
    body: v.string(),
    url: v.optional(v.string()),
    tag: v.optional(v.string()),
  },
  handler: async (ctx, { title, body, url, tag }) => {
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const subject = process.env.VAPID_SUBJECT || "mailto:funnfit@myindsound.com";
    if (!publicKey || !privateKey) {
      console.warn("Push skipped: VAPID keys are not configured");
      return { sent: 0, failed: 0 };
    }
    webpush.setVapidDetails(subject, publicKey, privateKey);

    const subs = await ctx.runQuery(api.push.allSubscriptions, {});
    const payload = JSON.stringify({ title, body, url: url ?? "/", tag });
    const dead: string[] = [];
    let sent = 0;

    await Promise.all(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification(JSON.parse(s.subscription), payload);
          sent++;
        } catch (err: unknown) {
          const status = (err as { statusCode?: number })?.statusCode;
          if (status === 404 || status === 410) dead.push(s.endpoint);
        }
      })
    );

    if (dead.length > 0) {
      await ctx.runMutation(internal.push.pruneDead, { endpoints: dead });
    }
    return { sent, failed: subs.length - sent, pruned: dead.length };
  },
});
