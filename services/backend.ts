// Convex-backed implementation of the app's backend service.
// Exposes the exact same public API (methods + event emitter) that the old
// SupabaseService exposed, so components don't need to change.
import { ConvexClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { HOUSES, GAME_LIBRARY } from "../constants";
import {
  GameResult,
  GameSession,
  House,
  HouseId,
  NotificationEvent,
  Student,
  TimeRange,
  Transaction,
  AppSettings,
  GameDefinition,
  Badge,
  Reward,
  Rank,
  Trophy,
  Season,
  Wearable,
  AvatarConfig,
  Tournament,
  TournamentParticipant,
  TournamentMatch,
  TournamentType,
  BlogPost,
} from "../types";
import type { Celebration } from "../components/CelebrationOverlay";

const CONVEX_URL =
  (import.meta.env.VITE_CONVEX_URL as string | undefined) ||
  "https://dependable-spoonbill-535.convex.cloud";

type EventCallback = (data: unknown) => void;

class UserFacingError extends Error {
  constructor(public userMessage: string, public technicalMessage: string) {
    super(technicalMessage);
    this.name = "UserFacingError";
  }
}

// ── Doc → app-shape mappers ──────────────────────────────────────────────────

type StudentDoc = {
  _id: string;
  fullName: string;
  houseId: HouseId;
  gender: "Male" | "Female";
  points: number;
  hasWearable: boolean;
  deviceId?: string | null;
  isPresent: boolean;
  avatarUrl?: string;
  rankId: string;
  badges: string[];
  inventory: string[];
  gamerTag?: string;
  displayPreference?: "FULL_NAME" | "GAMER_TAG" | "INITIALS";
  bio?: string;
  friendIds?: string[];
  totalXp?: number;
  avatarMode?: "PHOTO" | "AVATAR";
  avatarLook?: Student["avatarLook"];
  gearEquipped?: string | null;
  fitTokens?: number;
};

export const mapStudent = (s: StudentDoc): Student => ({
  id: s._id,
  houseId: s.houseId,
  fullName: s.fullName,
  gender: s.gender,
  points: s.points || 0,
  hasWearable: s.hasWearable ?? false,
  deviceId: s.deviceId ?? undefined,
  isPresent: s.isPresent ?? true,
  avatarUrl: s.avatarUrl || "",
  rankId: s.rankId || "r_noob",
  badges: s.badges || [],
  inventory: s.inventory || [],
  gamerTag: s.gamerTag,
  displayPreference: s.displayPreference,
  bio: s.bio,
  friendIds: s.friendIds || [],
  totalXp: s.totalXp ?? 0,
  avatarMode: s.avatarMode,
  avatarLook: s.avatarLook,
  gearEquipped: s.gearEquipped,
  fitTokens: s.fitTokens ?? 0,
});

type SessionDoc = {
  _id: string;
  gameKey: string;
  title: string;
  startTime: number;
  endTime: number;
  isActive: boolean;
  startedBy?: string;
  roster: string[];
  pausedAt?: number | null;
  pausedMs?: number;
  results?: {
    winningHouseId?: HouseId | null;
    winningHouseScore?: number;
    mvpStudentId?: string | null;
    mvpStudentScore?: number;
    outs?: Record<string, boolean>;
  };
};

const mapSession = (s: SessionDoc): GameSession => ({
  id: s._id,
  gameKey: s.gameKey || "",
  title: s.title,
  startTime: Number(s.startTime),
  endTime: Number(s.endTime),
  isActive: s.isActive ?? false,
  startedBy: s.startedBy || "",
  roster: s.roster || [],
  pausedAt: s.pausedAt ?? null,
  pausedMs: s.pausedMs ?? 0,
  results: s.results
    ? {
        winningHouseId: (s.results.winningHouseId as HouseId) ?? null,
        winningHouseScore: s.results.winningHouseScore ?? 0,
        mvpStudentId: s.results.mvpStudentId ?? null,
        mvpStudentScore: s.results.mvpStudentScore ?? 0,
        outs: s.results.outs || {},
      }
    : undefined,
});

type NotificationDoc = {
  _id: string;
  type: string;
  studentId?: string | null;
  studentName?: string | null;
  avatarUrl?: string | null;
  houseId?: HouseId | null;
  message: string;
  amount?: number | null;
  timestamp: number;
  adminName?: string | null;
};

const mapNotification = (n: NotificationDoc): NotificationEvent => ({
  id: n._id,
  type: n.type as NotificationEvent["type"],
  studentId: n.studentId ?? undefined,
  studentName: n.studentName ?? undefined,
  avatarUrl: n.avatarUrl ?? undefined,
  houseId: (n.houseId as HouseId) ?? undefined,
  message: n.message,
  amount: n.amount ?? undefined,
  timestamp: n.timestamp,
  adminName: n.adminName ?? undefined,
});

interface AwardResult {
  studentId: string;
  fullName: string;
  avatarUrl?: string;
  amount: number;
  finalPoints: number;
  didRankUp: boolean;
  newRank: Rank;
}

// ── Service ──────────────────────────────────────────────────────────────────

class ConvexBackendService {
  private client: ConvexClient;
  private listeners: Record<string, EventCallback[]> = {};
  private clientId: string;
  private startTs: number;

  // Subscription diff state
  private studentsSnapshot: Map<string, string> | null = null;
  private seenNotificationIds: Set<string> | null = null;
  private seenTransactionIds: Set<string> | null = null;
  private activeGameIds: Set<string> | null = null;
  private finishedGameIds: Set<string> | null = null;
  private seenEventIds = new Set<string>();

  private ranksCache: Rank[] | null = null;

  constructor() {
    this.client = new ConvexClient(CONVEX_URL);
    this.clientId = Math.random().toString(36).slice(2) + Date.now().toString(36);
    this.startTs = Date.now();
    this.setupSubscriptions();
  }

  // ── Event emitter (unchanged public contract) ─────────────────────────────

  public on(event: string, callback: EventCallback) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(callback);
    return () => {
      this.listeners[event] = this.listeners[event].filter((cb) => cb !== callback);
    };
  }

  private emit(event: string, data: unknown) {
    if (this.listeners[event]) this.listeners[event].forEach((cb) => cb(data));
  }

  private handleError(context: string, error: unknown): never {
    const message = error instanceof Error ? error.message : JSON.stringify(error);
    console.error(`Convex error in ${context}:`, message);
    throw new Error(`${context}: ${message}`);
  }

  // ── Realtime: Convex subscriptions replace Supabase realtime/broadcast ────

  private setupSubscriptions() {
    try {
      // Students → per-row 'points_update' (parity with postgres_changes on students)
      this.client.onUpdate(api.students.list, {}, (docs) => {
        const next = new Map<string, string>();
        for (const doc of docs as unknown as StudentDoc[]) {
          next.set(doc._id, JSON.stringify(doc));
        }
        if (this.studentsSnapshot !== null) {
          for (const doc of docs as unknown as StudentDoc[]) {
            const prev = this.studentsSnapshot.get(doc._id);
            if (prev !== next.get(doc._id)) {
              this.emit("points_update", mapStudent(doc));
            }
          }
        }
        this.studentsSnapshot = next;
      });

      // Notifications → 'notification' for new rows
      this.client.onUpdate(api.activity.recent, { limit: 20 }, (docs) => {
        const rows = docs as unknown as NotificationDoc[];
        if (this.seenNotificationIds !== null) {
          for (const n of rows) {
            if (!this.seenNotificationIds.has(n._id)) {
              this.emit("notification", mapNotification(n));
            }
          }
        }
        this.seenNotificationIds = new Set(rows.map((n) => n._id));
      });

      // Transactions → 'transaction' bubbles
      this.client.onUpdate(api.points.latest, { limit: 20 }, (docs) => {
        const rows = docs as unknown as Array<{
          _id: string;
          studentId: string;
          amount: number;
          description?: string;
          createdAt: number;
        }>;
        if (this.seenTransactionIds !== null) {
          for (const t of rows) {
            if (!this.seenTransactionIds.has(t._id)) {
              this.emit("transaction", {
                studentId: t.studentId,
                amount: t.amount,
                description: t.description ?? "",
                createdAt: new Date(t.createdAt).toISOString(),
              });
            }
          }
        }
        this.seenTransactionIds = new Set(rows.map((t) => t._id));
      });

      // Active games → 'active_games_update' + 'game_start'
      this.client.onUpdate(api.games.active, {}, (docs) => {
        const rows = (docs as unknown as SessionDoc[]).map(mapSession);
        if (this.activeGameIds !== null) {
          for (const session of rows) {
            if (!this.activeGameIds.has(session.id)) {
              this.emit("game_start", session);
            }
          }
        }
        this.activeGameIds = new Set(rows.map((s) => s.id));
        this.emit("active_games_update", rows);
      });

      // Recently finished games → 'game_end' (parity with UPDATE isActive=false)
      this.client.onUpdate(api.games.recentFinished, {}, (docs) => {
        const rows = (docs as unknown as SessionDoc[]).map(mapSession);
        if (this.finishedGameIds !== null) {
          for (const session of rows) {
            if (!this.finishedGameIds.has(session.id)) {
              this.emit("game_end", { game: session, results: session.results });
            }
          }
        }
        this.finishedGameIds = new Set(rows.map((s) => s.id));
      });

      // Broadcast bus → celebration/status events from other clients
      this.client.onUpdate(api.events.latest, { sinceTs: this.startTs }, (docs) => {
        const rows = docs as unknown as Array<{
          _id: string;
          kind: string;
          payload: any;
          source?: string;
          ts: number;
        }>;
        for (const evt of rows) {
          if (this.seenEventIds.has(evt._id)) continue;
          this.seenEventIds.add(evt._id);
          if (evt.source && evt.source === this.clientId) continue; // sender already emitted locally
          switch (evt.kind) {
            case "rank_up":
              this.emit("rank_up_broadcast", evt.payload);
              break;
            case "points_change":
              this.emit("points_broadcast", evt.payload);
              break;
            case "player_status":
              this.emit("player_status", evt.payload);
              break;
            case "game_start":
              this.emit("game_start_broadcast", evt.payload);
              break;
            case "game_end":
              this.emit("game_end_broadcast", evt.payload);
              break;
            case "lap_time":
              this.emit("lap_time", evt.payload);
              break;
          }
        }
      });
    } catch (e) {
      console.warn("Convex realtime setup failed:", e);
    }
  }

  // ── Broadcast API (kept for compatibility; publishes to the event bus) ────

  private publishEvent(kind: string, payload: unknown) {
    this.client
      .mutation(api.events.publish, { kind, payload, source: this.clientId })
      .catch((e) => console.warn(`Failed to publish ${kind} event:`, e));
  }

  public broadcastRankUp(data: Celebration) {
    this.publishEvent("rank_up", data);
  }

  public broadcastGameStart(data: {
    id: string;
    title: string;
    startTime: number;
    endTime: number;
    durationSeconds: number;
    ts: number;
  }) {
    this.publishEvent("game_start", data);
  }

  public broadcastGameEnd(data: {
    id: string;
    game: { title: string };
    results: GameResult;
    ts: number;
  }) {
    this.emit("game_end_broadcast", data);
    this.publishEvent("game_end", data);
  }

  public broadcastPlayerStatus(data: { sessionId: string; studentId: string; isOut: boolean }) {
    this.publishEvent("player_status", data);
  }

  public broadcastPoints(data: {
    studentId: string;
    studentName: string;
    amount: number;
    message: string;
    ts: number;
  }) {
    this.emit("points_broadcast", data);
    this.publishEvent("points_change", data);
  }

  // Local celebration emits after a server-side award (server already published
  // the cross-client events with our clientId as source).
  private async handleAwardResult(result: AwardResult | null) {
    if (!result) return;
    if (result.amount !== 0) {
      this.emit("points_broadcast", {
        studentId: result.studentId,
        studentName: result.fullName,
        amount: result.amount,
        message: `${result.amount > 0 ? "+" : "-"}${Math.abs(result.amount)} pts`,
        ts: Date.now(),
      });
    }
    if (result.didRankUp) {
      const celebration = {
        type: "RANK_UP" as const,
        studentName: result.fullName,
        achievement: result.newRank.name,
        studentAvatar: result.avatarUrl,
        rankIcon: result.newRank.icon,
        ts: Date.now(),
      };
      this.emit("rank_up_broadcast", celebration);
      try {
        localStorage.setItem("rank_up_event", JSON.stringify(celebration));
        window.dispatchEvent(new CustomEvent("rank-up", { detail: celebration }));
      } catch (err) {
        console.error("Failed to broadcast rank-up event:", err);
      }
    }
  }

  // ── Catalog ────────────────────────────────────────────────────────────────

  public async getRanks(): Promise<Rank[]> {
    if (this.ranksCache) return this.ranksCache;
    try {
      const ranks = (await this.client.query(api.catalog.ranks, {})) as Rank[];
      this.ranksCache = ranks;
      // Keep the cache fresh reactively
      this.client.onUpdate(api.catalog.ranks, {}, (latest) => {
        this.ranksCache = latest as Rank[];
      });
      return ranks;
    } catch (e) {
      console.warn("getRanks failed, using defaults:", e);
      const { RANKS } = await import("../constants");
      return RANKS;
    }
  }

  public async createRank(rankData: Omit<Rank, "id">): Promise<void> {
    try {
      await this.client.mutation(api.catalog.createRank, {
        name: rankData.name,
        threshold: rankData.threshold,
        icon: rankData.icon,
        color: rankData.color,
        description: rankData.description,
        xpReward: rankData.xpReward ?? 0,
        pointsRequired: rankData.pointsRequired ?? rankData.threshold,
        criteriaTasks: rankData.criteriaTasks ?? [],
      });
      this.ranksCache = null;
    } catch (e) {
      this.handleError("createRank", e);
    }
  }

  public async updateRank(id: string, rankData: Partial<Omit<Rank, "id">>): Promise<void> {
    try {
      await this.client.mutation(api.catalog.updateRank, {
        key: id,
        name: rankData.name,
        threshold: rankData.threshold,
        icon: rankData.icon,
        color: rankData.color,
        description: rankData.description,
        xpReward: rankData.xpReward,
        pointsRequired: rankData.pointsRequired,
        criteriaTasks: rankData.criteriaTasks,
      });
      this.ranksCache = null;
    } catch (e) {
      this.handleError("updateRank", e);
    }
  }

  public async deleteRank(id: string): Promise<void> {
    try {
      await this.client.mutation(api.catalog.deleteRank, { key: id });
      this.ranksCache = null;
    } catch (e) {
      this.handleError("deleteRank", e);
    }
  }

  public async updateRankIcon(rankId: string, iconUrl: string) {
    try {
      await this.client.mutation(api.catalog.updateRank, { key: rankId, icon: iconUrl });
      this.ranksCache = null;
    } catch (e) {
      this.handleError("updateRankIcon", e);
    }
  }

  public async getTrophies(): Promise<Trophy[]> {
    try {
      return (await this.client.query(api.catalog.trophies, {})) as Trophy[];
    } catch (e) {
      console.warn("getTrophies failed:", e);
      return [];
    }
  }

  public async createTrophy(trophyData: Omit<Trophy, "id" | "createdAt">): Promise<void> {
    try {
      await this.client.mutation(api.catalog.createTrophy, {
        name: trophyData.name,
        description: trophyData.description,
        icon: trophyData.icon,
        xpReward: trophyData.xpReward,
        pointsRequired: trophyData.pointsRequired,
        criteriaTasks: trophyData.criteriaTasks ?? [],
        color: trophyData.color,
        isActive: trophyData.isActive,
      });
    } catch (e) {
      this.handleError("createTrophy", e);
    }
  }

  public async updateTrophy(
    id: string,
    trophyData: Partial<Omit<Trophy, "id" | "createdAt">>
  ): Promise<void> {
    try {
      await this.client.mutation(api.catalog.updateTrophy, {
        id: id as Id<"trophies">,
        ...trophyData,
      });
    } catch (e) {
      this.handleError("updateTrophy", e);
    }
  }

  public async deleteTrophy(id: string): Promise<void> {
    try {
      await this.client.mutation(api.catalog.deleteTrophy, { id: id as Id<"trophies"> });
    } catch (e) {
      this.handleError("deleteTrophy", e);
    }
  }

  public async getGameLibrary(): Promise<GameDefinition[]> {
    try {
      const defs = (await this.client.query(api.catalog.gameLibrary, {})) as GameDefinition[];
      return defs.length > 0 ? defs : GAME_LIBRARY;
    } catch {
      return GAME_LIBRARY;
    }
  }

  public async getBadges(): Promise<Badge[]> {
    try {
      return (await this.client.query(api.catalog.badges, {})) as Badge[];
    } catch {
      const { BADGES } = await import("../constants");
      return BADGES;
    }
  }

  public async getRewards(): Promise<Reward[]> {
    try {
      return (await this.client.query(api.catalog.rewards, {})) as Reward[];
    } catch {
      const { REWARDS } = await import("../constants");
      return REWARDS;
    }
  }

  // ── Students ───────────────────────────────────────────────────────────────

  public async getStudents(): Promise<Student[]> {
    try {
      const docs = (await this.client.query(api.students.list, {})) as unknown as StudentDoc[];
      return docs.map(mapStudent);
    } catch (e) {
      console.error("getStudents failed:", e);
      throw new UserFacingError(
        "Unable to connect to database. Please refresh the page and try again.",
        e instanceof Error ? e.message : String(e)
      );
    }
  }

  public async getLinkedStudents(parentId: string): Promise<Student[]> {
    try {
      const docs = (await this.client.query(api.parents.linkedStudents, {
        parentId: parentId as Id<"parents">,
      })) as unknown as StudentDoc[];
      return docs.map(mapStudent);
    } catch (err) {
      console.error("❌ Error fetching linked students:", err);
      return [];
    }
  }

  public async addStudent(
    studentData: Omit<Student, "id" | "points" | "hasWearable" | "rankId" | "badges">
  ): Promise<Student | null> {
    try {
      const doc = await this.client.mutation(api.students.add, {
        fullName: studentData.fullName,
        houseId: studentData.houseId,
        gender: studentData.gender,
        gamerTag: studentData.gamerTag || "",
        deviceId: studentData.deviceId ?? undefined,
        avatarUrl: studentData.avatarUrl || undefined,
      });
      return doc ? mapStudent(doc as unknown as StudentDoc) : null;
    } catch (err) {
      console.error("❌ Error adding student:", err);
      return null;
    }
  }

  public async enrollStudent(
    parentId: string,
    studentData: Omit<Student, "id" | "points" | "hasWearable" | "rankId" | "badges">
  ): Promise<Student | null> {
    try {
      const doc = await this.client.mutation(api.parents.enrollStudent, {
        parentId: parentId as Id<"parents">,
        fullName: studentData.fullName,
        gamerTag: studentData.gamerTag || "",
        houseId: studentData.houseId,
        gender: studentData.gender,
        isPresent: studentData.isPresent ?? false,
      });
      return doc ? mapStudent(doc as unknown as StudentDoc) : null;
    } catch (err) {
      console.error("❌ Error enrolling linked student:", err);
      return null;
    }
  }

  public async updateStudent(
    id: string,
    updates: {
      fullName?: string;
      houseId?: HouseId;
      gender?: "Male" | "Female";
      avatarUrl?: string;
      gamerTag?: string;
      displayPreference?: "FULL_NAME" | "GAMER_TAG" | "INITIALS";
      bio?: string;
    }
  ) {
    try {
      await this.client.mutation(api.students.update, {
        id: id as Id<"students">,
        ...updates,
      });
    } catch (e) {
      this.handleError("updateStudent", e);
    }
  }

  public async deleteStudent(id: string, adminName: string) {
    try {
      await this.client.mutation(api.students.remove, {
        id: id as Id<"students">,
        adminName,
      });
    } catch (e) {
      this.handleError("deleteStudent", e);
    }
  }

  public async addFriend(studentId: string, friendId: string): Promise<void> {
    try {
      await this.client.mutation(api.students.addFriend, {
        studentId: studentId as Id<"students">,
        friendId,
      });
    } catch (e) {
      this.handleError("addFriend", e);
    }
  }

  public async removeFriend(studentId: string, friendId: string): Promise<void> {
    try {
      await this.client.mutation(api.students.removeFriend, {
        studentId: studentId as Id<"students">,
        friendId,
      });
    } catch (e) {
      this.handleError("removeFriend", e);
    }
  }

  public async getFriends(studentId: string): Promise<Student[]> {
    try {
      const docs = (await this.client.query(api.students.friends, {
        studentId: studentId as Id<"students">,
      })) as unknown as StudentDoc[];
      return docs.map(mapStudent);
    } catch (e) {
      console.warn("getFriends failed:", e);
      return [];
    }
  }

  public async getTeamStats(houseId: HouseId): Promise<{
    totalPoints: number;
    memberCount: number;
    presentCount: number;
    topScorer: Student | null;
  }> {
    try {
      const students = await this.getStudents();
      const houseMembers = students.filter((s) => s.houseId === houseId);
      const presentMembers = houseMembers.filter((s) => s.isPresent);
      const totalPoints = houseMembers.reduce((sum, s) => sum + s.points, 0);
      const topScorer = houseMembers.sort((a, b) => b.points - a.points)[0] || null;
      return {
        totalPoints,
        memberCount: houseMembers.length,
        presentCount: presentMembers.length,
        topScorer,
      };
    } catch (e) {
      console.warn("getTeamStats failed:", e);
      return { totalPoints: 0, memberCount: 0, presentCount: 0, topScorer: null };
    }
  }

  public async toggleAttendance(studentId: string, _adminName: string) {
    try {
      await this.client.mutation(api.students.toggleAttendance, {
        id: studentId as Id<"students">,
      });
    } catch (e) {
      this.handleError("toggleAttendance", e);
    }
  }

  public async markPresent(studentId: string, present: boolean, adminName?: string) {
    try {
      await this.client.mutation(api.students.setPresent, {
        id: studentId as Id<"students">,
        present,
        adminName,
      });
    } catch (e) {
      this.handleError("markPresent", e);
    }
  }

  public async resetDailyPresence(adminName: string) {
    try {
      await this.client.mutation(api.students.resetPresence, { adminName });
    } catch (e) {
      this.handleError("resetDailyPresence", e);
    }
  }

  public async awardBadge(studentId: string, badgeId: string, adminName: string) {
    try {
      await this.client.mutation(api.students.awardBadge, {
        studentId: studentId as Id<"students">,
        badgeKey: badgeId,
        adminName,
      });
    } catch (e) {
      console.warn("awardBadge failed:", e);
    }
  }

  public async redeemReward(studentId: string, rewardId: string) {
    await this.client.mutation(api.students.redeemReward, {
      studentId: studentId as Id<"students">,
      rewardKey: rewardId,
    });
  }

  public async purchaseWearable(studentId: string, wearableId: string, cost: number): Promise<void> {
    await this.client.mutation(api.students.purchaseWearable, {
      studentId: studentId as Id<"students">,
      wearableId,
      cost,
    });
  }

  public async getStudentInventory(studentId: string): Promise<string[]> {
    try {
      return (await this.client.query(api.students.inventory, {
        studentId: studentId as Id<"students">,
      })) as string[];
    } catch {
      return [];
    }
  }

  public async seedDatabase() {
    console.log("Seeding database with demo data...");
    await this.client.mutation(api.students.seedDemo, {});
  }

  // ── Leaderboard ────────────────────────────────────────────────────────────

  public async getLeaderboardData(
    range: TimeRange = "ALL"
  ): Promise<{ houses: House[]; topStudents: Student[] }> {
    try {
      {
        // Every range reads the transactions ledger with the SAME metric —
        // points genuinely EARNED (awards, check-ins, around-town, jackpot) —
        // so Today <= Week <= Season always holds. Spending on crates or gear
        // never drags a kid or a house down the board; balances live in the
        // portals, standings are about earning.
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        if (range === "WEEK") start.setDate(start.getDate() - 6);
        const { students, houseTotals } = (await this.client.query(api.points.earnedBetween, {
          startMs: range === "ALL" ? 0 : start.getTime(),
        })) as {
          students: Array<{
            studentId: string;
            fullName: string;
            gamerTag?: string;
            displayPreference?: "FULL_NAME" | "GAMER_TAG" | "INITIALS";
            avatarUrl: string;
            houseId: string;
            rankId: string;
            earned: number;
            totalPoints: number;
            totalXp?: number;
            avatarMode?: "PHOTO" | "AVATAR";
            avatarLook?: Student["avatarLook"];
            isPresent?: boolean;
            gearEquipped?: string | null;
          }>;
          houseTotals: Record<string, number>;
        };
        const houseList = Object.values(HOUSES).map((house) => ({
          ...house,
          totalPoints: houseTotals[house.id] ?? 0,
        }));
        const topStudents: Student[] = students
          .filter((r) => r.earned > 0)
          .slice(0, 3)
          .map((r) => ({
            id: r.studentId,
            houseId: r.houseId as Student["houseId"],
            fullName: r.fullName,
            gender: "Male" as const,
            points: r.earned, // board shows points earned in the range
            hasWearable: false,
            isPresent: r.isPresent ?? true,
            avatarUrl: r.avatarUrl,
            rankId: r.rankId,
            gamerTag: r.gamerTag,
            displayPreference: r.displayPreference,
            totalXp: r.totalXp ?? 0,
            avatarMode: r.avatarMode,
            avatarLook: r.avatarLook,
            gearEquipped: r.gearEquipped ?? null,
          }));
        return { houses: houseList, topStudents };
      }
    } catch {
      return {
        houses: Object.values(HOUSES).map((h) => ({ ...h, totalPoints: 0 })),
        topStudents: [],
      };
    }
  }

  // ── Games ──────────────────────────────────────────────────────────────────

  public async getActiveGames(): Promise<GameSession[]> {
    try {
      const docs = (await this.client.query(api.games.active, {})) as unknown as SessionDoc[];
      return docs.map(mapSession);
    } catch {
      return [];
    }
  }

  public async getGameHistory(): Promise<GameSession[]> {
    try {
      const docs = (await this.client.query(api.games.history, {})) as unknown as SessionDoc[];
      return docs.map(mapSession);
    } catch {
      return [];
    }
  }

  public async startGame(
    gameKey: string,
    adminName: string,
    roster: string[],
    durationSeconds: number,
    customTitle?: string,
    captureMode?: "MANUAL" | "NFC"
  ) {
    try {
      const doc = await this.client.mutation(api.games.start, {
        gameKey,
        adminName,
        roster,
        durationSeconds,
        customTitle,
        captureMode,
        clientId: this.clientId,
      });
      const session = mapSession(doc as unknown as SessionDoc);
      try {
        const payload = {
          id: session.id,
          title: session.title,
          startTime: session.startTime,
          endTime: session.endTime,
          durationSeconds,
          ts: Date.now(),
        };
        localStorage.setItem("game_start_event", JSON.stringify(payload));
        window.dispatchEvent(new CustomEvent("game-start", { detail: payload }));
        this.emit("game_start_broadcast", payload);
      } catch (err) {
        console.warn("Failed to broadcast game start event:", err);
      }
      return session;
    } catch (e) {
      this.handleError("startGame", e);
    }
  }

  public async stopGame(sessionId: string) {
    try {
      const { session, results } = (await this.client.mutation(api.games.stop, {
        sessionId: sessionId as Id<"gameSessions">,
        clientId: this.clientId,
      })) as { session: SessionDoc; results: GameResult };

      const mapped = mapSession(session);
      try {
        const payload = {
          id: mapped.id,
          game: { title: mapped.title },
          results,
          ts: Date.now(),
        };
        localStorage.setItem("game_end_event", JSON.stringify(payload));
        window.dispatchEvent(new CustomEvent("game-end", { detail: payload }));
        this.emit("game_end_broadcast", payload);
      } catch (err) {
        console.error("Failed to broadcast game end event:", err);
      }
    } catch (e) {
      console.error("stopGame failed", e);
    }
  }

  public async pauseGame(sessionId: string): Promise<GameSession | null> {
    try {
      const doc = await this.client.mutation(api.games.pause, {
        sessionId: sessionId as Id<"gameSessions">,
        clientId: this.clientId,
      });
      return doc ? mapSession(doc as unknown as SessionDoc) : null;
    } catch (e) {
      console.error("pauseGame failed", e);
      return null;
    }
  }

  public async resumeGame(sessionId: string): Promise<GameSession | null> {
    try {
      const doc = await this.client.mutation(api.games.resume, {
        sessionId: sessionId as Id<"gameSessions">,
        clientId: this.clientId,
      });
      return doc ? mapSession(doc as unknown as SessionDoc) : null;
    } catch (e) {
      console.error("resumeGame failed", e);
      return null;
    }
  }

  public async togglePlayerStatus(
    sessionId: string,
    studentId: string,
    isOut: boolean,
    adminName: string
  ) {
    try {
      await this.client.mutation(api.games.togglePlayerStatus, {
        sessionId: sessionId as Id<"gameSessions">,
        studentId,
        isOut,
        adminName,
        clientId: this.clientId,
      });
      this.emit("player_status", { sessionId, studentId, isOut });
    } catch (e) {
      console.error("togglePlayerStatus failed", e);
    }
  }

  public async getDrillLeaderboard(sessionId: string): Promise<{
    students: Array<{ student: Student; drillScore: number }>;
    houses: Record<HouseId, number>;
  }> {
    try {
      const result = (await this.client.query(api.games.drillLeaderboard, {
        sessionId: sessionId as Id<"gameSessions">,
      })) as {
        students: Array<{ student: StudentDoc; drillScore: number }>;
        houses: Record<HouseId, number>;
      };
      return {
        students: result.students.map((e) => ({
          student: mapStudent(e.student),
          drillScore: e.drillScore,
        })),
        houses: result.houses,
      };
    } catch (e) {
      console.error("getDrillLeaderboard failed:", e);
      throw new UserFacingError(
        "Failed to load drill leaderboard",
        e instanceof Error ? e.message : String(e)
      );
    }
  }

  // ── Drill presets ──────────────────────────────────────────────────────────

  public async savePreset(
    name: string,
    gameKey: string,
    duration: number,
    roster: string[],
    adminName: string
  ) {
    try {
      await this.client.mutation(api.games.savePreset, {
        name,
        gameKey,
        defaultDuration: duration,
        defaultRoster: roster,
        createdBy: adminName,
      });
    } catch (e) {
      this.handleError("savePreset", e);
    }
  }

  public async getPresets(): Promise<any[]> {
    try {
      const docs = (await this.client.query(api.games.presets, {})) as unknown as Array<{
        _id: string;
        name: string;
        gameKey: string;
        defaultDuration: number;
        defaultRoster: string[];
        createdBy?: string;
        createdAt: number;
      }>;
      return docs.map((p) => ({
        id: p._id,
        name: p.name,
        game_key: p.gameKey,
        default_duration: p.defaultDuration,
        default_roster: p.defaultRoster,
        created_by: p.createdBy,
        created_at: new Date(p.createdAt).toISOString(),
      }));
    } catch (e) {
      console.error("Failed to load presets:", e);
      return [];
    }
  }

  public async deletePreset(presetId: string) {
    try {
      await this.client.mutation(api.games.deletePreset, {
        id: presetId as Id<"drillPresets">,
      });
    } catch (e) {
      this.handleError("deletePreset", e);
    }
  }

  public async launchPreset(presetId: string, adminName: string) {
    const preset = (await this.client.query(api.games.getPreset, {
      id: presetId as Id<"drillPresets">,
    })) as unknown as {
      gameKey: string;
      defaultRoster: string[];
      defaultDuration: number;
    } | null;
    if (!preset) throw new UserFacingError("Preset not found", "Invalid preset ID");
    return this.startGame(
      preset.gameKey,
      adminName,
      preset.defaultRoster || [],
      preset.defaultDuration
    );
  }

  // ── Points ─────────────────────────────────────────────────────────────────

  public async addPoints(
    studentId: string,
    amount: number,
    source: string,
    description: string,
    adminName: string
  ) {
    try {
      const result = (await this.client.mutation(api.points.award, {
        studentId: studentId as Id<"students">,
        amount,
        sourceType: source,
        description,
        adminName,
        clientId: this.clientId,
      })) as AwardResult;
      await this.handleAwardResult(result);
    } catch (e) {
      this.handleError("addPoints", e);
    }
  }

  public async recordScoreEvent(
    sessionId: string,
    studentId: string | undefined,
    houseId: HouseId | undefined,
    amount: number,
    adminName: string,
    description: string
  ) {
    try {
      const results = (await this.client.mutation(api.points.recordScoreEvent, {
        sessionId: sessionId as Id<"gameSessions">,
        studentId: studentId ? (studentId as Id<"students">) : undefined,
        houseId,
        amount,
        adminName,
        description,
        clientId: this.clientId,
      })) as AwardResult[];
      for (const r of results) await this.handleAwardResult(r);
    } catch (e) {
      this.handleError("recordScoreEvent", e);
    }
  }

  public async undoLastScoreEvent(_sessionId: string, adminName: string) {
    try {
      const result = (await this.client.mutation(api.points.undoLast, {
        adminName,
        clientId: this.clientId,
      })) as AwardResult | null;
      await this.handleAwardResult(result);
    } catch (e) {
      console.warn("Undo failed", e);
    }
  }

  public async addBatchPoints(ids: string[], amount: number, desc: string, admin: string) {
    try {
      const results = (await this.client.mutation(api.points.batchAward, {
        studentIds: ids as Id<"students">[],
        amount,
        description: desc,
        adminName: admin,
        clientId: this.clientId,
      })) as AwardResult[];
      for (const r of results) await this.handleAwardResult(r);
    } catch (e) {
      console.error("addBatchPoints failed:", e);
    }
  }

  public async awardHouseBonus(
    houseId: HouseId,
    amount: number,
    description: string,
    adminName: string
  ): Promise<number> {
    const { count, results } = (await this.client.mutation(api.points.houseAward, {
      houseId,
      amount: Math.abs(amount),
      description,
      adminName,
      clientId: this.clientId,
    })) as { count: number; results: AwardResult[] };
    for (const r of results) await this.handleAwardResult(r);
    return count;
  }

  public async deductHousePoints(
    houseId: HouseId,
    amount: number,
    description: string,
    adminName: string
  ): Promise<number> {
    const { count, results } = (await this.client.mutation(api.points.houseAward, {
      houseId,
      amount: -Math.abs(amount),
      description,
      adminName,
      clientId: this.clientId,
    })) as { count: number; results: AwardResult[] };
    for (const r of results) await this.handleAwardResult(r);
    return count;
  }

  public async getLastTransaction(
    studentId: string
  ): Promise<{ amount: number; description: string } | null> {
    try {
      return (await this.client.query(api.points.lastTransaction, {
        studentId: studentId as Id<"students">,
      })) as { amount: number; description: string } | null;
    } catch {
      return null;
    }
  }

  public async getTransactions(days: number = 7): Promise<Transaction[]> {
    try {
      const since = Date.now() - days * 24 * 60 * 60 * 1000;
      const docs = (await this.client.query(api.points.recent, {
        sinceMs: since,
      })) as unknown as Array<{
        _id: string;
        studentId: string;
        amount: number;
        sourceType: string;
        description?: string;
        createdAt: number;
      }>;
      return docs.map((t) => ({
        id: t._id,
        studentId: t.studentId,
        amount: t.amount,
        sourceType: t.sourceType as Transaction["sourceType"],
        description: t.description ?? "",
        createdAt: new Date(t.createdAt).toISOString(),
        adminName: "",
      }));
    } catch {
      return [];
    }
  }

  // ── Activity feed ──────────────────────────────────────────────────────────

  public async getGlobalActivity(): Promise<NotificationEvent[]> {
    try {
      const docs = (await this.client.query(api.activity.recent, {
        limit: 50,
      })) as unknown as NotificationDoc[];
      return docs.map(mapNotification);
    } catch {
      return [];
    }
  }

  public async logGameTime(studentId: string, seconds: number, gameTitle: string, adminName: string) {
    try {
      await this.client.mutation(api.activity.log, {
        type: "LAP_TIME",
        message: `Lap: ${seconds}s — ${gameTitle}`,
        adminName,
        studentId,
        amount: 0,
      });
    } catch (err) {
      console.warn("Failed to log game time:", err);
    }
  }

  public async recordLapTime(
    sessionId: string,
    studentId: string,
    seconds: number,
    gameTitle: string,
    adminName: string
  ) {
    try {
      await this.client.mutation(api.activity.log, {
        type: "LAP_TIME",
        message: `Lap: ${seconds}s — ${gameTitle}`,
        adminName,
        studentId,
        amount: 0,
      });
      if (seconds <= 30) {
        try {
          await this.awardBadge(studentId, "speed_demon", adminName);
        } catch (err) {
          console.warn("Failed to award speed badge:", err);
        }
      }
      this.emit("lap_time", { sessionId, studentId, seconds, gameTitle, ts: Date.now() });
    } catch (e) {
      console.warn("recordLapTime failed", e);
    }
  }

  // ── Settings & storage ─────────────────────────────────────────────────────

  public async getSettings(): Promise<AppSettings> {
    try {
      const rows = (await this.client.query(api.settings.all, {})) as Array<{
        key: string;
        value: string;
      }>;
      const settings: AppSettings = {};
      rows.forEach((r) => (settings[r.key] = r.value));
      return settings;
    } catch {
      return {};
    }
  }

  public async updateSetting(key: string, value: string) {
    try {
      await this.client.mutation(api.settings.upsert, { key, value });
    } catch (e) {
      this.handleError("updateSetting", e);
    }
  }

  public async uploadAsset(file: File | Blob, folder: string): Promise<string | null> {
    try {
      const uploadUrl = (await this.client.mutation(api.files.generateUploadUrl, {})) as string;
      const response = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type || "image/jpeg" },
        body: file,
      });
      if (!response.ok) {
        console.error("❌ Storage upload failed:", response.status, await response.text());
        return null;
      }
      const { storageId } = (await response.json()) as { storageId: string };
      const publicUrl = (await this.client.query(api.files.fileUrl, {
        storageId: storageId as Id<"_storage">,
      })) as string | null;
      console.log(`✅ Uploaded asset (${folder}) →`, publicUrl);
      return publicUrl;
    } catch (err) {
      console.error("❌ Unexpected error in uploadAsset:", err);
      return null;
    }
  }

  // ── V2 gamification ────────────────────────────────────────────────────────

  public async getSeasons(): Promise<Season[]> {
    try {
      return (await this.client.query(api.seasons.list, {})) as unknown as Season[];
    } catch {
      return [];
    }
  }

  public async createSeason(name: string, startDate: string, theme?: string): Promise<void> {
    try {
      await this.client.mutation(api.seasons.create, { name, startDate, theme });
    } catch (e) {
      this.handleError("createSeason", e);
    }
  }

  public async endSeason(seasonId: string | number): Promise<void> {
    try {
      await this.client.mutation(api.seasons.end, { id: String(seasonId) as Id<"seasons"> });
    } catch (e) {
      this.handleError("endSeason", e);
    }
  }

  public async getWearables(): Promise<Wearable[]> {
    try {
      return (await this.client.query(api.wearables.list, {})) as unknown as Wearable[];
    } catch {
      return [];
    }
  }

  public async getStudentAvatar(studentId: string): Promise<AvatarConfig> {
    try {
      return (await this.client.query(api.wearables.getAvatar, {
        studentId: studentId as Id<"students">,
      })) as AvatarConfig;
    } catch {
      return {};
    }
  }

  public async saveStudentAvatar(studentId: string, config: AvatarConfig): Promise<void> {
    try {
      await this.client.mutation(api.wearables.saveAvatar, {
        studentId: studentId as Id<"students">,
        baseFaceId: config.baseFaceId,
        hairstyleId: config.hairstyleId,
        topId: config.topId,
        accessoryId: config.accessoryId,
      });
    } catch (e) {
      this.handleError("saveStudentAvatar", e);
    }
  }

  public async awardXP(
    studentId: string,
    amount: number,
    sourceType: string,
    description?: string
  ): Promise<void> {
    try {
      await this.client.mutation(api.xp.award, {
        studentId: studentId as Id<"students">,
        amount,
        sourceType,
        description,
      });
    } catch (e) {
      this.handleError("awardXP", e);
    }
  }

  // ── Tournaments ────────────────────────────────────────────────────────────

  public async getTournaments(): Promise<Tournament[]> {
    try {
      return (await this.client.query(api.tournaments.list, {})) as unknown as Tournament[];
    } catch {
      return [];
    }
  }

  public async createTournament(
    name: string,
    type: TournamentType,
    maxParticipants?: number
  ): Promise<void> {
    try {
      await this.client.mutation(api.tournaments.create, { name, type, maxParticipants });
    } catch (e) {
      this.handleError("createTournament", e);
    }
  }

  public async getTournamentDetails(id: string): Promise<{
    tournament: Tournament;
    participants: TournamentParticipant[];
    matches: TournamentMatch[];
  } | null> {
    try {
      const result = (await this.client.query(api.tournaments.details, {
        id: id as Id<"tournaments">,
      })) as any;
      if (!result) return null;
      return {
        tournament: result.tournament as Tournament,
        participants: result.participants.map((p: any) => ({
          id: p.id,
          tournamentId: p.tournamentId,
          studentId: p.studentId,
          seedPosition: p.seedPosition,
          finalPlacement: p.finalPlacement,
          pointsEarned: p.pointsEarned,
          joinedAt: p.joinedAt,
          student: p.student ? mapStudent(p.student) : undefined,
        })),
        matches: result.matches.map((m: any) => ({
          id: m.id,
          tournamentId: m.tournamentId,
          roundNumber: m.roundNumber,
          matchNumber: m.matchNumber,
          participant1Id: m.participant1Id,
          participant2Id: m.participant2Id,
          winnerId: m.winnerId,
          score1: m.score1,
          score2: m.score2,
          status: m.status,
          scheduledTime: m.scheduledTime,
          completedAt: m.completedAt,
          p1: m.p1Student ? mapStudent(m.p1Student) : undefined,
          p2: m.p2Student ? mapStudent(m.p2Student) : undefined,
        })),
      };
    } catch {
      return null;
    }
  }

  public async joinTournament(tournamentId: string, studentId: string): Promise<void> {
    try {
      await this.client.mutation(api.tournaments.join, {
        tournamentId: tournamentId as Id<"tournaments">,
        studentId: studentId as Id<"students">,
      });
    } catch (e) {
      this.handleError("joinTournament", e);
    }
  }

  public async generateBracket(tournamentId: string): Promise<void> {
    try {
      await this.client.mutation(api.tournaments.generateBracket, {
        tournamentId: tournamentId as Id<"tournaments">,
      });
    } catch (e) {
      this.handleError("generateBracket", e);
    }
  }

  public async updateMatchResult(
    matchId: string,
    winnerId: string,
    score1: number,
    score2: number
  ): Promise<void> {
    try {
      await this.client.mutation(api.tournaments.updateMatchResult, {
        matchId: matchId as Id<"tournamentMatches">,
        winnerId: winnerId as Id<"tournamentParticipants">,
        score1,
        score2,
      });
    } catch (e) {
      this.handleError("updateMatchResult", e);
    }
  }

  // ── Blog / alerts ──────────────────────────────────────────────────────────

  public async getBlogPosts(_audience: string = "ALL"): Promise<BlogPost[]> {
    try {
      return (await this.client.query(api.blog.published, {})) as unknown as BlogPost[];
    } catch {
      return [];
    }
  }

  public async getAllBlogPosts(): Promise<BlogPost[]> {
    try {
      return (await this.client.query(api.blog.all, {})) as unknown as BlogPost[];
    } catch {
      return [];
    }
  }

  public async createBlogPost(post: {
    title: string;
    content: string;
    excerpt?: string;
    targetAudience?: string;
    priority?: string;
    isPublished?: boolean;
  }): Promise<void> {
    try {
      await this.client.mutation(api.blog.create, {
        title: post.title,
        content: post.content,
        excerpt: post.excerpt,
        targetAudience: (post.targetAudience as BlogPost["targetAudience"]) ?? "ALL",
        priority: (post.priority as BlogPost["priority"]) ?? "NORMAL",
        isPublished: post.isPublished ?? false,
      });
    } catch (e) {
      this.handleError("createBlogPost", e);
    }
  }

  public async updateBlogPost(
    id: string,
    post: {
      title?: string;
      content?: string;
      excerpt?: string;
      targetAudience?: string;
      priority?: string;
      isPublished?: boolean;
    }
  ): Promise<void> {
    try {
      await this.client.mutation(api.blog.update, {
        id: id as Id<"blogPosts">,
        title: post.title,
        content: post.content,
        excerpt: post.excerpt,
        targetAudience: post.targetAudience as BlogPost["targetAudience"] | undefined,
        priority: post.priority as BlogPost["priority"] | undefined,
        isPublished: post.isPublished,
      });
    } catch (e) {
      this.handleError("updateBlogPost", e);
    }
  }

  public async deleteBlogPost(id: string): Promise<void> {
    try {
      await this.client.mutation(api.blog.remove, { id: id as Id<"blogPosts"> });
    } catch (e) {
      this.handleError("deleteBlogPost", e);
    }
  }
}

export const backendService = new ConvexBackendService();
