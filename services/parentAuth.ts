// Parent-portal authentication over Convex (replaces Supabase Auth).
// Sessions are bearer tokens minted by convex/parents.ts and kept in localStorage,
// so the portal works the same in mobile browsers and installed PWAs.
import { ConvexClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { mapStudent } from "./backend";
import { Student } from "../types";

const CONVEX_URL =
  (import.meta.env.VITE_CONVEX_URL as string | undefined) ||
  "https://dependable-spoonbill-535.convex.cloud";

const TOKEN_KEY = "fnf_parent_session_token";

export interface ParentProfile {
  id: string;
  email: string;
  fullName: string;
  phone?: string;
}

class ParentAuthService {
  private client: ConvexClient;

  constructor() {
    this.client = new ConvexClient(CONVEX_URL);
  }

  private get token(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  }

  // Game-center service calls pass the session token to parent-scoped Convex
  // functions (check-in, messaging, visits, task submissions).
  public get sessionToken(): string | null {
    return this.token;
  }

  private setToken(token: string | null) {
    try {
      if (token) localStorage.setItem(TOKEN_KEY, token);
      else localStorage.removeItem(TOKEN_KEY);
    } catch {
      // localStorage unavailable (private mode) — session lasts for the page life
    }
  }

  public async signUp(args: {
    email: string;
    password: string;
    fullName: string;
    phone?: string;
  }): Promise<ParentProfile> {
    const { token, parent } = await this.client.action(api.parents.signUp, args);
    this.setToken(token);
    return parent;
  }

  // Admin-driven account creation (ParentManager): creates the account without
  // adopting its session token.
  public async createAccount(args: {
    email: string;
    password: string;
    fullName: string;
    phone?: string;
  }): Promise<ParentProfile> {
    const { parent } = await this.client.action(api.parents.signUp, args);
    return parent;
  }

  public async signIn(email: string, password: string): Promise<ParentProfile> {
    const { token, parent } = await this.client.action(api.parents.signIn, {
      email,
      password,
    });
    this.setToken(token);
    return parent;
  }

  public async getSession(): Promise<ParentProfile | null> {
    const token = this.token;
    if (!token) return null;
    try {
      const parent = await this.client.query(api.parents.me, { token });
      if (!parent) this.setToken(null);
      return parent;
    } catch {
      return null;
    }
  }

  public async signOut(): Promise<void> {
    const token = this.token;
    if (token) {
      try {
        await this.client.mutation(api.parents.signOut, { token });
      } catch {
        // Best-effort server-side invalidation
      }
    }
    this.setToken(null);
  }

  // ── Admin operations (ParentManager) ───────────────────────────────────────

  public async listParents(): Promise<
    Array<ParentProfile & { createdAt: string; linkedStudents: Student[] }>
  > {
    const rows = await this.client.query(api.parents.listAll, {});
    return (rows as any[]).map((p) => ({
      id: p.id,
      email: p.email,
      fullName: p.fullName,
      phone: p.phone,
      createdAt: p.createdAt,
      linkedStudents: (p.linkedStudents as any[]).map(mapStudent),
    }));
  }

  public async linkStudent(parentId: string, studentId: string): Promise<void> {
    await this.client.mutation(api.parents.link, {
      parentId: parentId as Id<"parents">,
      studentId: studentId as Id<"students">,
    });
  }

  public async unlinkStudent(parentId: string, studentId: string): Promise<void> {
    await this.client.mutation(api.parents.unlink, {
      parentId: parentId as Id<"parents">,
      studentId: studentId as Id<"students">,
    });
  }
}

export const parentAuth = new ParentAuthService();
