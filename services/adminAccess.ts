// Who counts as an academy admin. A Clerk user is an admin when their
// publicMetadata.role is "admin", or their email is in the VITE_ADMIN_EMAILS
// allowlist (comma-separated; lets the first admin in before any metadata is
// configured in the Clerk dashboard).
type ClerkUserLike = {
  publicMetadata?: Record<string, unknown>;
  emailAddresses: Array<{ emailAddress: string }>;
};

const DEFAULT_ADMIN_EMAILS = "lawrenceberment@gmail.com,info@myindmedia.org";

const adminEmails = (
  (import.meta.env.VITE_ADMIN_EMAILS as string | undefined) || DEFAULT_ADMIN_EMAILS
)
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export function isAdminUser(user: ClerkUserLike | null | undefined): boolean {
  if (!user) return false;
  if (user.publicMetadata?.role === "admin") {
    return true;
  }
  return user.emailAddresses.some((e) =>
    adminEmails.includes(e.emailAddress.toLowerCase())
  );
}
