import { internalAction } from "./_generated/server";
import { v } from "convex/values";

// Transactional email via Resend. Env (Convex deployment): RESEND_API_KEY,
// EMAIL_FROM (verified sender, e.g. "Fun 'n Fit Academy <funnfit@myindsound.com>").
// No key configured → log and skip, never block sign-up.

const PORTAL_URL = "https://fnffinal.netlify.app/#/parent-login";
const LIVE_URL = "https://fnffinal.netlify.app/#/live";
const LOGO_URL = "https://fnffinal.netlify.app/fnfa-logo.png";

// Academy logo on a white tile (matches the app nav treatment; the mark is
// drawn for light backgrounds).
const LOGO_BLOCK = `
  <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:0 auto 12px">
    <tr><td style="background:#ffffff;border-radius:10px;padding:7px;line-height:0">
      <img src="${LOGO_URL}" width="54" height="54" alt="Fun 'n Fit Academy" style="display:block"/>
    </td></tr>
  </table>`;

function welcomeHtml(firstName: string): string {
  const step = (n: string, title: string, body: string) => `
    <tr><td style="padding:10px 0;vertical-align:top;width:44px">
      <div style="width:32px;height:32px;background:#CBFE1C;color:#0B0E13;font-weight:700;
        text-align:center;line-height:32px;font-family:Arial,sans-serif">${n}</div></td>
    <td style="padding:10px 0 10px 12px">
      <div style="color:#ffffff;font-weight:700;font-family:Arial,sans-serif;font-size:15px">${title}</div>
      <div style="color:#ABABAB;font-family:Arial,sans-serif;font-size:14px;line-height:1.5;margin-top:2px">${body}</div>
    </td></tr>`;

  return `<!doctype html><html><body style="margin:0;padding:0;background:#0B0E13">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0B0E13">
    <tr><td align="center" style="padding:32px 16px">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%">
        <tr><td style="padding-bottom:24px;text-align:center">
          ${LOGO_BLOCK}
          <div style="color:#CBFE1C;font-family:Arial,sans-serif;font-size:12px;letter-spacing:4px;text-transform:uppercase">// Fun 'n Fit Academy</div>
          <div style="color:#ffffff;font-family:Arial,sans-serif;font-weight:800;font-size:26px;margin-top:6px;text-transform:uppercase">Welcome to the Academy${firstName ? ", " + firstName : ""}!</div>
        </td></tr>
        <tr><td style="background:#12161F;border:1px solid rgba(255,255,255,0.08);padding:24px">
          <div style="color:#ABABAB;font-family:Arial,sans-serif;font-size:15px;line-height:1.6">
            Your parent account is ready. Here's how the Fun 'n Fit portal works — everything happens
            from your phone:
          </div>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px">
            ${step("1", "Add your kids", "Open the portal and tap “Enroll Another Student.” Each kid joins one of our four houses — Valor, Sage, Spark, or Unity.")}
            ${step("2", "Check in at the front desk", "On arrival, open the portal's Check In tab and scan the QR code on the front-desk screen — or show your kid's pass and we'll scan it for you. They pop onto the big board and earn a daily bonus.")}
            ${step("3", "Earn points around town", "Visit our partner businesses in Upland and scan their QR from the Earn tab. Kids also earn points for special at-home tasks you submit for coach approval.")}
            ${step("4", "Spend points on perks", "Kids redeem points in the Perk Shop — real rewards at the academy and avatar skins for the leaderboard.")}
            ${step("5", "Message the team", "The Messages tab reaches our staff directly — schedules, questions, anything.")}
          </table>
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px auto 4px" align="center">
            <tr>
              <td style="background:#CBFE1C;padding:12px 22px">
                <a href="${PORTAL_URL}" style="color:#0B0E13;font-family:Arial,sans-serif;font-weight:700;font-size:14px;text-decoration:none;text-transform:uppercase;letter-spacing:1px">Open the Portal</a>
              </td>
              <td style="width:12px"></td>
              <td style="border:1px solid rgba(255,255,255,0.25);padding:12px 22px">
                <a href="${LIVE_URL}" style="color:#ffffff;font-family:Arial,sans-serif;font-weight:700;font-size:14px;text-decoration:none;text-transform:uppercase;letter-spacing:1px">Live Board</a>
              </td>
            </tr>
          </table>
        </td></tr>
        <tr><td style="padding:20px 8px;text-align:center">
          <div style="color:#6b7280;font-family:Arial,sans-serif;font-size:12px;line-height:1.6">
            Fun 'n Fit Academy · 167 S Third Ave, Upland, CA 91786 · (951) 612-8233<br/>
            Where Fitness Meets Fun and Leadership
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table></body></html>`;
}

function inviteHtml(firstName: string, kidLine: string, inviteUrl: string): string {
  return `<!doctype html><html><body style="margin:0;padding:0;background:#0B0E13">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0B0E13">
    <tr><td align="center" style="padding:32px 16px">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%">
        <tr><td style="padding-bottom:24px;text-align:center">
          ${LOGO_BLOCK}
          <div style="color:#CBFE1C;font-family:Arial,sans-serif;font-size:12px;letter-spacing:4px;text-transform:uppercase">// Fun 'n Fit Academy</div>
          <div style="color:#ffffff;font-family:Arial,sans-serif;font-weight:800;font-size:26px;margin-top:6px;text-transform:uppercase">You're invited${firstName ? ", " + firstName : ""}!</div>
        </td></tr>
        <tr><td style="background:#12161F;border:1px solid rgba(255,255,255,0.08);padding:24px">
          <div style="color:#ABABAB;font-family:Arial,sans-serif;font-size:15px;line-height:1.6">
            Your Fun 'n Fit <b style="color:#ffffff">Parent Portal</b> is ready${kidLine}.
            Track points and levels live, check in from your phone, message the coaches,
            and let your kid build their player avatar — all free with enrollment.
          </div>
          <div style="color:#ABABAB;font-family:Arial,sans-serif;font-size:15px;line-height:1.6;margin-top:12px">
            Tap the button and sign in with <b style="color:#ffffff">this email address</b>
            (or Google) — your account is already set up and your athlete is already linked.
          </div>
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px auto 4px" align="center">
            <tr><td style="background:#CBFE1C;padding:14px 26px">
              <a href="${inviteUrl}" style="color:#0B0E13;font-family:Arial,sans-serif;font-weight:700;font-size:14px;text-decoration:none;text-transform:uppercase;letter-spacing:1px">Activate My Portal</a>
            </td></tr>
          </table>
          <div style="color:#6b7280;font-family:Arial,sans-serif;font-size:12px;text-align:center;margin-top:14px">
            Curious first? See everything the portal does: <a href="https://fnffinal.netlify.app/#/parents" style="color:#CBFE1C;text-decoration:none">the parent guide</a>.
          </div>
        </td></tr>
        <tr><td style="padding:20px 8px;text-align:center">
          <div style="color:#6b7280;font-family:Arial,sans-serif;font-size:12px;line-height:1.6">
            Fun 'n Fit Academy · 167 S Third Ave, Upland, CA 91786 · (951) 612-8233<br/>
            Where Fitness Meets Fun and Leadership
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table></body></html>`;
}

function coachInviteHtml(inviteUrl: string, invitedBy: string): string {
  return `<!doctype html><html><body style="margin:0;padding:0;background:#0B0E13">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0B0E13">
    <tr><td align="center" style="padding:32px 16px">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%">
        <tr><td style="padding-bottom:24px;text-align:center">
          ${LOGO_BLOCK}
          <div style="color:#CBFE1C;font-family:Arial,sans-serif;font-size:12px;letter-spacing:4px;text-transform:uppercase">// Fun 'n Fit Academy</div>
          <div style="color:#ffffff;font-family:Arial,sans-serif;font-weight:800;font-size:26px;margin-top:6px;text-transform:uppercase">Welcome to the coaching staff</div>
        </td></tr>
        <tr><td style="background:#12161F;border:1px solid rgba(255,255,255,0.08);padding:24px">
          <div style="color:#ABABAB;font-family:Arial,sans-serif;font-size:15px;line-height:1.6">
            ${invitedBy ? `<b style="color:#ffffff">${invitedBy}</b> has` : "You've been"} invited you to coach at
            Fun 'n Fit Academy. Your <b style="color:#ffffff">Coach account</b> unlocks the Admin Portal:
            roster and roll call, launching games, awarding points and Session Legend medals,
            NFC wristbands, parent messaging, and the live board.
          </div>
          <div style="color:#ABABAB;font-family:Arial,sans-serif;font-size:15px;line-height:1.6;margin-top:12px">
            Tap the button and create your account with <b style="color:#ffffff">this email address</b>
            (or sign in with Google on it) — coach access is attached to it and you'll land straight
            in the Admin Portal.
          </div>
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px auto 4px" align="center">
            <tr><td style="background:#CBFE1C;padding:14px 26px">
              <a href="${inviteUrl}" style="color:#0B0E13;font-family:Arial,sans-serif;font-weight:700;font-size:14px;text-decoration:none;text-transform:uppercase;letter-spacing:1px">Activate Coach Access</a>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:20px 8px;text-align:center">
          <div style="color:#6b7280;font-family:Arial,sans-serif;font-size:12px;line-height:1.6">
            Fun 'n Fit Academy · 167 S Third Ave, Upland, CA 91786 · (951) 612-8233<br/>
            Where Fitness Meets Fun and Leadership
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table></body></html>`;
}

export const sendCoachInvite = internalAction({
  args: { email: v.string(), inviteUrl: v.string(), invitedBy: v.string() },
  handler: async (_ctx, { email, inviteUrl, invitedBy }) => {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.EMAIL_FROM;
    if (!apiKey || !from) {
      console.log("RESEND_API_KEY/EMAIL_FROM not set — skipping coach invite to", email);
      return { sent: false };
    }
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [email],
        subject: "You're invited to coach at Fun 'n Fit Academy",
        html: coachInviteHtml(inviteUrl, invitedBy),
      }),
    });
    if (!res.ok) {
      console.error("Coach invite email failed:", res.status, await res.text());
      return { sent: false };
    }
    return { sent: true };
  },
});

export const sendParentInvite = internalAction({
  args: {
    email: v.string(),
    fullName: v.string(),
    inviteUrl: v.string(),
    kidNames: v.array(v.string()),
  },
  handler: async (_ctx, { email, fullName, inviteUrl, kidNames }) => {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.EMAIL_FROM;
    if (!apiKey || !from) {
      console.log("RESEND_API_KEY/EMAIL_FROM not set — skipping invite email to", email);
      return { sent: false };
    }
    const firstName = fullName.split(" ")[0] ?? "";
    const kidLine =
      kidNames.length > 0
        ? ` — ${kidNames.join(" and ")} ${kidNames.length > 1 ? "are" : "is"} already linked and waiting`
        : "";
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [email],
        subject: kidNames.length > 0
          ? `${kidNames.join(" and ")}'s Fun 'n Fit portal is ready for you`
          : "Your Fun 'n Fit Parent Portal is ready",
        html: inviteHtml(firstName, kidLine, inviteUrl),
      }),
    });
    if (!res.ok) {
      console.error("Invite email failed:", res.status, await res.text());
      return { sent: false };
    }
    return { sent: true };
  },
});

export const sendParentWelcome = internalAction({
  args: { email: v.string(), fullName: v.string() },
  handler: async (_ctx, { email, fullName }) => {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.EMAIL_FROM;
    if (!apiKey || !from) {
      console.log("RESEND_API_KEY/EMAIL_FROM not set — skipping welcome email to", email);
      return { sent: false };
    }
    const firstName = fullName.split(" ")[0] ?? "";
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [email],
        subject: "Welcome to Fun 'n Fit Academy — here's how the portal works 🎮",
        html: welcomeHtml(firstName),
      }),
    });
    if (!res.ok) {
      console.error("Welcome email failed:", res.status, await res.text());
      return { sent: false };
    }
    return { sent: true };
  },
});
