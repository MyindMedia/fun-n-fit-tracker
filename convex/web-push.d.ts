// web-push ships no bundled types; the library is used only in pushNode.ts
// (node runtime). Declare it so the Convex typecheck doesn't fail on the import.
declare module "web-push";
