// Game-center service: dynamic check-in, staff↔parent messaging, partner
// businesses, special tasks, and perk redemptions. Same singleton-service
// pattern as services/backend.ts; parent-scoped calls read the session token
// from parentAuth automatically.
import { ConvexClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { parentAuth } from "./parentAuth";
import {
  BoardEntry,
  CheckIn,
  ChatMessage,
  Conversation,
  PartnerBusiness,
  Redemption,
  SpecialTask,
  StaffInboxEntry,
  TaskSubmission,
} from "../types";
import { mapStudent } from "./backend";

const CONVEX_URL =
  (import.meta.env.VITE_CONVEX_URL as string | undefined) ||
  "https://dependable-spoonbill-535.convex.cloud";

// Device-local calendar date, e.g. "2026-07-15"
export const localDate = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
};

const requireToken = (): string => {
  const token = parentAuth.sessionToken;
  if (!token) throw new Error("Please sign in to your parent account first");
  return token;
};

const mapId = <T extends { _id: string }>(doc: T): Omit<T, "_id"> & { id: string } => {
  const { _id, ...rest } = doc;
  return { id: _id, ...rest };
};

export type CheckInResult = {
  studentId: string;
  fullName: string;
  status: "OK" | "ALREADY";
};

class GameCenterService {
  private client: ConvexClient;

  constructor() {
    this.client = new ConvexClient(CONVEX_URL);
  }

  // ── Check-in ───────────────────────────────────────────────────────────────

  /** Admin board: mint a fresh rotating QR token (call on an interval). */
  public async issueCheckinToken(): Promise<{ token: string; expiresAt: number }> {
    return await this.client.mutation(api.checkins.issueToken, {});
  }

  public async getNfcSecret(): Promise<{ token: string; createdAt: number } | null> {
    return await this.client.query(api.checkins.nfcSecret, {});
  }

  public async rotateNfcSecret(): Promise<{ token: string }> {
    return await this.client.mutation(api.checkins.rotateNfcSecret, {});
  }

  /** Parent scanned the front-desk QR / NFC tag: check in selected kids. */
  public async checkInWithToken(
    token: string,
    studentIds: string[],
    method: "QR" | "NFC" = "QR"
  ): Promise<CheckInResult[]> {
    return await this.client.mutation(api.checkins.checkInWithToken, {
      token,
      sessionToken: requireToken(),
      studentIds: studentIds as Id<"students">[],
      localDate: localDate(),
      method,
    });
  }

  public async manualCheckIn(studentId: string, adminName: string): Promise<CheckInResult> {
    return await this.client.mutation(api.checkins.manualCheckIn, {
      studentId: studentId as Id<"students">,
      adminName,
      localDate: localDate(),
    });
  }

  public async checkOut(studentId: string, adminName?: string): Promise<void> {
    await this.client.mutation(api.checkins.checkOut, {
      studentId: studentId as Id<"students">,
      localDate: localDate(),
      adminName,
      sessionToken: adminName ? undefined : parentAuth.sessionToken ?? undefined,
    });
  }

  /** Live subscription to today's check-in board. Returns unsubscribe. */
  public subscribeBoard(cb: (entries: BoardEntry[]) => void): () => void {
    return this.client.onUpdate(api.checkins.board, { date: localDate() }, (rows) => {
      cb(
        (rows as any[]).map((r) => ({
          checkIn: mapId(r.checkIn) as CheckIn,
          student: mapStudent(r.student),
        }))
      );
    });
  }

  public async getBoard(): Promise<BoardEntry[]> {
    const rows = (await this.client.query(api.checkins.board, {
      date: localDate(),
    })) as any[];
    return rows.map((r) => ({
      checkIn: mapId(r.checkIn) as CheckIn,
      student: mapStudent(r.student),
    }));
  }

  public async checkinHistoryForParent(): Promise<
    Array<{ checkIn: CheckIn; studentName: string; studentId: string }>
  > {
    const rows = (await this.client.query(api.checkins.historyForParent, {
      sessionToken: requireToken(),
    })) as any[];
    return rows.map((r) => ({ ...r, checkIn: mapId(r.checkIn) as CheckIn }));
  }

  public async checkinHistoryForStudent(studentId: string): Promise<CheckIn[]> {
    const rows = (await this.client.query(api.checkins.historyForStudent, {
      studentId: studentId as Id<"students">,
    })) as any[];
    return rows.map(mapId) as CheckIn[];
  }

  // ── Messaging ──────────────────────────────────────────────────────────────

  public async sendMessageAsParent(body: string): Promise<void> {
    await this.client.mutation(api.messaging.sendFromParent, {
      sessionToken: requireToken(),
      body,
    });
  }

  public async sendMessageAsStaff(
    parentId: string,
    body: string,
    adminName: string
  ): Promise<void> {
    await this.client.mutation(api.messaging.sendFromStaff, {
      parentId: parentId as Id<"parents">,
      body,
      adminName,
    });
  }

  public subscribeStaffInbox(cb: (entries: StaffInboxEntry[]) => void): () => void {
    return this.client.onUpdate(api.messaging.staffInbox, {}, (rows) => {
      cb(
        (rows as any[]).map((r) => ({
          conversation: mapId(r.conversation) as Conversation,
          parent: r.parent,
        }))
      );
    });
  }

  public subscribeParentThread(
    cb: (thread: { conversation: Conversation | null; messages: ChatMessage[] }) => void
  ): () => void {
    const token = parentAuth.sessionToken;
    if (!token) return () => {};
    return this.client.onUpdate(
      api.messaging.threadForParent,
      { sessionToken: token },
      (result: any) => {
        cb({
          conversation: result.conversation
            ? (mapId(result.conversation) as Conversation)
            : null,
          messages: (result.messages as any[]).map(mapId) as ChatMessage[],
        });
      }
    );
  }

  public subscribeConversation(
    conversationId: string,
    cb: (messages: ChatMessage[]) => void
  ): () => void {
    return this.client.onUpdate(
      api.messaging.messagesFor,
      { conversationId: conversationId as Id<"conversations"> },
      (rows) => cb((rows as any[]).map(mapId) as ChatMessage[])
    );
  }

  public async markThreadReadAsParent(): Promise<void> {
    const token = parentAuth.sessionToken;
    if (!token) return;
    await this.client.mutation(api.messaging.markReadByParent, { sessionToken: token });
  }

  public async markThreadReadAsStaff(conversationId: string): Promise<void> {
    await this.client.mutation(api.messaging.markReadByStaff, {
      conversationId: conversationId as Id<"conversations">,
    });
  }

  // ── Partner businesses ─────────────────────────────────────────────────────

  public async listPartners(): Promise<PartnerBusiness[]> {
    const rows = (await this.client.query(api.partners.listActive, {})) as any[];
    return rows.map(mapId) as PartnerBusiness[];
  }

  public async adminListPartners(): Promise<PartnerBusiness[]> {
    const rows = (await this.client.query(api.partners.adminList, {})) as any[];
    return rows.map(mapId) as PartnerBusiness[];
  }

  public async createPartner(args: {
    name: string;
    description?: string;
    category?: string;
    address?: string;
    pointsReward: number;
  }): Promise<PartnerBusiness> {
    const row = await this.client.mutation(api.partners.create, args);
    return mapId(row as any) as PartnerBusiness;
  }

  public async updatePartner(
    id: string,
    patch: Partial<
      Pick<
        PartnerBusiness,
        "name" | "description" | "category" | "address" | "pointsReward" | "isActive"
      >
    >
  ): Promise<void> {
    await this.client.mutation(api.partners.update, {
      id: id as Id<"partnerBusinesses">,
      name: patch.name,
      description: patch.description ?? undefined,
      category: patch.category ?? undefined,
      address: patch.address ?? undefined,
      pointsReward: patch.pointsReward,
      isActive: patch.isActive,
    });
  }

  public async removePartner(id: string): Promise<void> {
    await this.client.mutation(api.partners.remove, { id: id as Id<"partnerBusinesses"> });
  }

  public async rotatePartnerSecret(id: string): Promise<PartnerBusiness> {
    const row = await this.client.mutation(api.partners.rotateSecret, {
      id: id as Id<"partnerBusinesses">,
    });
    return mapId(row as any) as PartnerBusiness;
  }

  /** Preview a scanned business QR before confirming. */
  public async resolveVisitSecret(
    qrSecret: string
  ): Promise<{ id: string; name: string; description?: string; pointsReward: number } | null> {
    return await this.client.query(api.partners.resolveSecret, { qrSecret });
  }

  public async recordVisit(
    qrSecret: string,
    studentIds: string[]
  ): Promise<{
    business: { id: string; name: string };
    results: Array<CheckInResult & { points?: number }>;
  }> {
    return await this.client.mutation(api.partners.recordVisit, {
      sessionToken: requireToken(),
      qrSecret,
      studentIds: studentIds as Id<"students">[],
      localDate: localDate(),
    });
  }

  public async visitsForParent(): Promise<
    Array<{ visit: any; studentName: string; businessName: string }>
  > {
    return (await this.client.query(api.partners.visitsForParent, {
      sessionToken: requireToken(),
    })) as any[];
  }

  public async visitsForStudent(
    studentId: string
  ): Promise<Array<{ visit: any; businessName: string }>> {
    return (await this.client.query(api.partners.visitsForStudent, {
      studentId: studentId as Id<"students">,
    })) as any[];
  }

  // ── Special tasks ──────────────────────────────────────────────────────────

  public async listActiveTasks(): Promise<SpecialTask[]> {
    const rows = (await this.client.query(api.specialTasks.listActive, {})) as any[];
    return rows.map(mapId) as SpecialTask[];
  }

  public async adminListTasks(): Promise<SpecialTask[]> {
    const rows = (await this.client.query(api.specialTasks.adminList, {})) as any[];
    return rows.map(mapId) as SpecialTask[];
  }

  public async createTask(args: {
    title: string;
    description: string;
    points: number;
    requiresProof?: boolean;
  }): Promise<SpecialTask> {
    const row = await this.client.mutation(api.specialTasks.create, args);
    return mapId(row as any) as SpecialTask;
  }

  public async updateTask(
    id: string,
    patch: Partial<Pick<SpecialTask, "title" | "description" | "points" | "isActive" | "requiresProof">>
  ): Promise<void> {
    await this.client.mutation(api.specialTasks.update, {
      id: id as Id<"specialTasks">,
      ...patch,
    });
  }

  public async removeTask(id: string): Promise<void> {
    await this.client.mutation(api.specialTasks.remove, { id: id as Id<"specialTasks"> });
  }

  public async submitTask(args: {
    taskId: string;
    studentId: string;
    note?: string;
    photoUrl?: string;
  }): Promise<TaskSubmission> {
    const row = await this.client.mutation(api.specialTasks.submit, {
      sessionToken: requireToken(),
      taskId: args.taskId as Id<"specialTasks">,
      studentId: args.studentId as Id<"students">,
      note: args.note,
      photoUrl: args.photoUrl,
    });
    return mapId(row as any) as TaskSubmission;
  }

  public async taskSubmissionsForParent(): Promise<
    Array<{ submission: TaskSubmission; taskTitle: string; points: number; studentName: string }>
  > {
    const rows = (await this.client.query(api.specialTasks.submissionsForParent, {
      sessionToken: requireToken(),
    })) as any[];
    return rows.map((r) => ({ ...r, submission: mapId(r.submission) as TaskSubmission }));
  }

  public subscribePendingSubmissions(
    cb: (
      rows: Array<{
        submission: TaskSubmission;
        taskTitle: string;
        points: number;
        studentName: string;
        parentName: string;
      }>
    ) => void
  ): () => void {
    return this.client.onUpdate(api.specialTasks.pending, {}, (rows) => {
      cb(
        (rows as any[]).map((r) => ({
          ...r,
          submission: mapId(r.submission) as TaskSubmission,
        }))
      );
    });
  }

  public async reviewSubmission(
    submissionId: string,
    approve: boolean,
    adminName: string
  ): Promise<void> {
    await this.client.mutation(api.specialTasks.review, {
      submissionId: submissionId as Id<"taskSubmissions">,
      approve,
      adminName,
    });
  }

  // ── Redemptions (perk shop) ────────────────────────────────────────────────

  public async redeem(
    studentId: string,
    rewardKey: string,
    requestedVia: "STUDENT" | "PARENT" = "STUDENT"
  ): Promise<Redemption> {
    const row = await this.client.mutation(api.redemptions.redeem, {
      studentId: studentId as Id<"students">,
      rewardKey,
      requestedVia,
      sessionToken:
        requestedVia === "PARENT" ? requireToken() : parentAuth.sessionToken ?? undefined,
    });
    return mapId(row as any) as Redemption;
  }

  public async redemptionsForStudent(studentId: string): Promise<Redemption[]> {
    const rows = (await this.client.query(api.redemptions.forStudent, {
      studentId: studentId as Id<"students">,
    })) as any[];
    return rows.map(mapId) as Redemption[];
  }

  public async redemptionsForParent(): Promise<
    Array<{ redemption: Redemption; studentName: string }>
  > {
    const rows = (await this.client.query(api.redemptions.forParent, {
      sessionToken: requireToken(),
    })) as any[];
    return rows.map((r) => ({ ...r, redemption: mapId(r.redemption) as Redemption }));
  }

  public subscribePendingRedemptions(
    cb: (rows: Array<{ redemption: Redemption; studentName: string }>) => void
  ): () => void {
    return this.client.onUpdate(api.redemptions.pending, {}, (rows) => {
      cb(
        (rows as any[]).map((r) => ({
          ...r,
          redemption: mapId(r.redemption) as Redemption,
        }))
      );
    });
  }

  public async fulfillRedemption(redemptionId: string, adminName: string): Promise<void> {
    await this.client.mutation(api.redemptions.fulfill, {
      redemptionId: redemptionId as Id<"redemptions">,
      adminName,
    });
  }

  public async cancelRedemption(redemptionId: string, adminName: string): Promise<void> {
    await this.client.mutation(api.redemptions.cancel, {
      redemptionId: redemptionId as Id<"redemptions">,
      adminName,
    });
  }
}

export const gameCenter = new GameCenterService();
