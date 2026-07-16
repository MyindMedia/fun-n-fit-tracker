// The app's backend now runs on Convex (deployment: dependable-spoonbill-535).
// This module re-exports the Convex-backed service under the historical name so
// the ~30 components that import { supabaseService } keep working unchanged.
// See services/backend.ts for the implementation.
export { backendService as supabaseService } from "./backend";
