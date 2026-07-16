import { internalAction } from "./_generated/server";
import { v } from "convex/values";

// Transactional email via Resend. Env (Convex deployment): RESEND_API_KEY,
// EMAIL_FROM (verified sender, e.g. "Fun 'n Fit Academy <funnfit@myindsound.com>").
// No key configured → log and skip, never block sign-up.

const PORTAL_URL = "https://fnffinal.netlify.app/#/parent-login";
const LIVE_URL = "https://fnffinal.netlify.app/#/live";

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
