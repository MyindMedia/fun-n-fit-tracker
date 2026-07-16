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

  public async manualCheckIn(
    studentId: string,
    adminName: string,
    method: "QR" | "NFC" | "MANUAL" = "MANUAL"
  ): Promise<CheckInResult> {
    return await this.client.mutation(api.checkins.manualCheckIn, {
      studentId: studentId as Id<"students">,
      adminName,
      localDate: localDate(),
      method,
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

  // ── Staff / coach management (Clerk invitations) ───────────────────────────

  public async inviteStaff(
    email: string,
    invitedBy: string
  ): Promise<{ id: string; email: string; status: string }> {
    return await this.client.action(api.staff.invite, { email, invitedBy });
  }

  public async listStaffInvitations(): Promise<
    Array<{ id: string; email: string; status: string; createdAt: number }>
  > {
    return await this.client.action(api.staff.listInvitations, {});
  }

  public async revokeStaffInvitation(invitationId: string): Promise<void> {
    await this.client.action(api.staff.revokeInvitation, { invitationId });
  }

  public async listStaff(): Promise<
    Array<{ id: string; name: string; email: string; imageUrl: string; lastActiveAt: number | null }>
  > {
    return await this.client.action(api.staff.listStaff, {});
  }

  // ── Medals / superlatives ──────────────────────────────────────────────────

  public async awardMedals(args: {
    studentIds: string[];
    key: string;
    title: string;
    note?: string;
    bonusPoints?: number;
    awardedBy: string;
  }): Promise<{ awarded: number; results: Array<{ studentId: string; fullName: string }> }> {
    return await this.client.mutation(api.medals.award, {
      studentIds: args.studentIds as Id<'students'>[],
      key: args.key,
      title: args.title,
      note: args.note,
      bonusPoints: args.bonusPoints,
      awardedBy: args.awardedBy,
      localDate: localDate(),
    });
  }

  public async medalsForStudent(studentId: string): Promise<any[]> {
    return (await this.client.query(api.medals.forStudent, {
      studentId: studentId as Id<'students'>,
    })) as any[];
  }

  public async recentMedals(limit?: number): Promise<any[]> {
    return (await this.client.query(api.medals.recent, { limit })) as any[];
  }

  public async removeMedal(medalId: string): Promise<void> {
    await this.client.mutation(api.medals.remove, { medalId: medalId as Id<'medals'> });
  }

  // ── Point multiplier ───────────────────────────────────────────────────────

  public async getPointMultiplier(): Promise<number> {
    const rows = (await this.client.query(api.settings.all, {})) as Array<{ key: string; value: string }>;
    const row = rows.find((r) => r.key === 'point_multiplier');
    const mult = row ? parseFloat(row.value) : 1;
    return Number.isFinite(mult) && mult >= 1 ? mult : 1;
  }

  public async setPointMultiplier(mult: number): Promise<void> {
    await this.client.mutation(api.settings.upsert, {
      key: 'point_multiplier',
      value: String(mult),
    });
  }

  // Smart tap: live NFC-mode game decides (splits or points), else check-in.
  public async nfcAutoScan(tagUid: string, adminName: string): Promise<any> {
    return await this.client.mutation(api.nfc.autoScan, {
      tagUid,
      adminName,
      localDate: localDate(),
    });
  }

  // ── Parent invites ─────────────────────────────────────────────────────────

  public async createParentInvite(args: {
    email: string;
    fullName: string;
    studentIds: string[];
    adminName: string;
  }): Promise<{ token: string; url: string; email: string; kidNames: string[] }> {
    return (await this.client.mutation(api.invites.create, {
      email: args.email,
      fullName: args.fullName,
      studentIds: args.studentIds as Id<'students'>[],
      adminName: args.adminName,
    })) as any;
  }

  public async recentParentInvites(): Promise<any[]> {
    return (await this.client.query(api.invites.recent, {})) as any[];
  }

  // ── Student self-login (parent-granted, PIN) ───────────────────────────────

  public async portalStatus(studentId: string): Promise<{ enabled: boolean }> {
    return (await this.client.query(api.portalAccess.status, {
      studentId: studentId as Id<'students'>,
    })) as { enabled: boolean };
  }

  public async portalSettings(studentId: string): Promise<{ enabled: boolean; pin: string }> {
    return (await this.client.query(api.portalAccess.settings, {
      studentId: studentId as Id<'students'>,
    })) as { enabled: boolean; pin: string };
  }

  public async setPortalAccess(studentId: string, enabled: boolean, pin?: string): Promise<void> {
    await this.client.mutation(api.portalAccess.setAccess, {
      studentId: studentId as Id<'students'>,
      enabled,
      pin,
    });
  }

  public async verifyPortalPin(
    studentId: string,
    pin: string
  ): Promise<{ ok: boolean; reason: 'DISABLED' | 'WRONG_PIN' | null }> {
    return (await this.client.mutation(api.portalAccess.verify, {
      studentId: studentId as Id<'students'>,
      pin,
    })) as { ok: boolean; reason: 'DISABLED' | 'WRONG_PIN' | null };
  }

  // ── Trades (badges + avatar items) ─────────────────────────────────────────

  public async tradableInventory(studentId: string): Promise<{
    badges: string[];
    items: Array<{ key: string; upgradeLevel: number }>;
  }> {
    return (await this.client.query(api.trades.tradable, {
      studentId: studentId as Id<'students'>,
    })) as any;
  }

  public async proposeTrade(args: {
    fromStudentId: string;
    toStudentId: string;
    giveKind: 'BADGE' | 'ITEM';
    giveKey: string;
    wantKind: 'BADGE' | 'ITEM';
    wantKey: string;
  }): Promise<void> {
    await this.client.mutation(api.trades.propose, {
      fromStudentId: args.fromStudentId as Id<'students'>,
      toStudentId: args.toStudentId as Id<'students'>,
      giveKind: args.giveKind,
      giveKey: args.giveKey,
      wantKind: args.wantKind,
      wantKey: args.wantKey,
    });
  }

  public async respondTrade(tradeId: string, accept: boolean): Promise<void> {
    await this.client.mutation(api.trades.respond, {
      tradeId: tradeId as Id<'trades'>,
      accept,
    });
  }

  public async cancelTrade(tradeId: string, byStudentId: string): Promise<void> {
    await this.client.mutation(api.trades.cancel, {
      tradeId: tradeId as Id<'trades'>,
      byStudentId: byStudentId as Id<'students'>,
    });
  }

  public async tradesFor(studentId: string): Promise<{ incoming: any[]; outgoing: any[] }> {
    return (await this.client.query(api.trades.listFor, {
      studentId: studentId as Id<'students'>,
    })) as any;
  }

  // ── Gear shop (boost items) ────────────────────────────────────────────────

  public async gearShop(studentId: string): Promise<{
    items: Array<{ key: string; owned: boolean; equipped: boolean; progress: number | null }>;
    equipped: string | null;
    points: number;
  }> {
    return (await this.client.query(api.gear.shop, {
      studentId: studentId as Id<'students'>,
    })) as any;
  }

  public async gearEquip(studentId: string, gearKey: string | null): Promise<void> {
    await this.client.mutation(api.gear.equip, {
      studentId: studentId as Id<'students'>,
      gearKey,
    });
  }

  public async gearBuy(studentId: string, gearKey: string): Promise<{ ok: boolean; balance: number }> {
    return (await this.client.mutation(api.gear.buy, {
      studentId: studentId as Id<'students'>,
      gearKey,
    })) as any;
  }

  public async gearClaim(studentId: string, gearKey: string): Promise<void> {
    await this.client.mutation(api.gear.claim, {
      studentId: studentId as Id<'students'>,
      gearKey,
    });
  }

  // ── Avatar studio + loot crates ────────────────────────────────────────────

  public async ownedWearables(studentId: string): Promise<Array<{ key: string; upgradeLevel: number }>> {
    return (await this.client.query(api.avatar.ownedWearables, {
      studentId: studentId as Id<'students'>,
    })) as Array<{ key: string; upgradeLevel: number }>;
  }

  public async saveAvatarLook(
    studentId: string,
    look: { skin?: string; hairColor?: string; hair?: string; top?: string; acc?: string | null }
  ): Promise<void> {
    await this.client.mutation(api.avatar.saveLook, {
      studentId: studentId as Id<'students'>,
      look,
    });
  }

  public async setAvatarMode(studentId: string, mode: 'PHOTO' | 'AVATAR'): Promise<void> {
    await this.client.mutation(api.avatar.setMode, {
      studentId: studentId as Id<'students'>,
      mode,
    });
  }

  public async openLootBox(
    studentId: string,
    box: 'STANDARD' | 'PREMIUM'
  ): Promise<{
    outcome: 'NEW' | 'UPGRADE' | 'SHARDS';
    item: { key: string; name: string; slot: string; rarity: string };
    upgradeLevel: number;
    refund?: number;
    balance: number;
    opensToday: number;
    capPerDay: number;
  }> {
    return (await this.client.mutation(api.lootBoxes.open, {
      studentId: studentId as Id<'students'>,
      box,
      localDate: localDate(),
    })) as any;
  }

  public async lootTodayStatus(studentId: string): Promise<{ opensToday: number; capPerDay: number }> {
    return (await this.client.query(api.lootBoxes.todayStatus, {
      studentId: studentId as Id<'students'>,
      localDate: localDate(),
    })) as { opensToday: number; capPerDay: number };
  }

  // Live multiplier updates — fires immediately and on every settings change.
  public subscribePointMultiplier(cb: (mult: number) => void): () => void {
    return this.client.onUpdate(api.settings.all, {}, (rows) => {
      const row = (rows as Array<{ key: string; value: string }>).find(
        (r) => r.key === 'point_multiplier'
      );
      const mult = row ? parseFloat(row.value) : 1;
      cb(Number.isFinite(mult) && mult >= 1 ? mult : 1);
    });
  }

  // ── NFC tags / wristbands ──────────────────────────────────────────────────

  public async nfcTagRoster(): Promise<
    Array<{ studentId: string; fullName: string; houseId: string; avatarUrl?: string; tagUid: string | null }>
  > {
    return (await this.client.query(api.nfc.tagRoster, {})) as any[];
  }

  public async nfcResolveTag(tagUid: string): Promise<any | null> {
    return await this.client.query(api.nfc.resolveTag, { tagUid });
  }

  public async nfcAssignTag(studentId: string, tagUid: string, adminName: string) {
    return await this.client.mutation(api.nfc.assignTag, {
      studentId: studentId as Id<'students'>,
      tagUid,
      adminName,
    });
  }

  public async nfcUnassignTag(studentId: string, adminName: string) {
    return await this.client.mutation(api.nfc.unassignTag, {
      studentId: studentId as Id<'students'>,
      adminName,
    });
  }

  public async nfcCheckInByTag(tagUid: string, adminName: string): Promise<{
    status: 'OK' | 'ALREADY' | 'UNKNOWN_TAG';
    tagUid?: string;
    studentId?: string;
    fullName?: string;
    houseId?: string;
    avatarUrl?: string;
  }> {
    return await this.client.mutation(api.nfc.checkInByTag, {
      tagUid,
      adminName,
      localDate: localDate(),
    });
  }

  /** Unified check-in & scan log for a time range (admin Scan Log page). */
  public async scanLog(fromMs: number, toMs: number): Promise<
    Array<{ ts: number; type: string; studentName: string; houseId?: string | null; detail: string; actor: string }>
  > {
    return (await this.client.query(api.scanlog.list, { fromMs, toMs })) as any[];
  }

  /** Live scan feed for one game session (Timing mode splits board). */
  public subscribeSessionScans(
    sessionId: string,
    cb: (scans: Array<{ studentId?: string | null; studentName?: string | null; houseId?: string | null; splitMs?: number | null; ts: number; kind: string }>) => void
  ): () => void {
    return this.client.onUpdate(
      api.nfc.sessionScans,
      { sessionId: sessionId as Id<'gameSessions'> },
      (rows) => cb(rows as any[])
    );
  }

  public async nfcAwardByTag(
    tagUid: string,
    amount: number,
    description: string,
    adminName: string,
    sessionId?: string
  ): Promise<{
    status: 'OK' | 'UNKNOWN_TAG';
    tagUid?: string;
    studentId?: string;
    fullName?: string;
    houseId?: string;
    avatarUrl?: string;
    amount?: number;
    finalPoints?: number;
    didRankUp?: boolean;
    checkedIn?: boolean;
  }> {
    return await this.client.mutation(api.nfc.awardByTag, {
      tagUid,
      amount,
      description,
      adminName,
      sessionId: sessionId as Id<'gameSessions'> | undefined,
      localDate: localDate(),
    });
  }

  /** Live USB reader presence (agent heartbeats every ~20s). */
  public subscribeNfcReaderStatus(
    cb: (status: { readerId: string; ts: number; online: boolean } | null) => void
  ): () => void {
    return this.client.onUpdate(api.nfc.readerStatus, {}, (status) => cb(status as any));
  }

  /** Live scans from the local USB reader agent (scripts/nfc-agent.mjs). */
  public subscribeNfcAgentScans(
    cb: (scan: { uid: string; readerId: string; ts: number }) => void
  ): () => void {
    const seen = new Set<string>();
    const sinceTs = Date.now();
    return this.client.onUpdate(api.nfc.latestScans, { sinceTs }, (rows) => {
      for (const row of rows as any[]) {
        if (seen.has(row.id)) continue;
        seen.add(row.id);
        cb({ uid: row.uid, readerId: row.readerId, ts: row.ts });
      }
    });
  }

  public async nfcGameScanByTag(
    tagUid: string,
    adminName: string,
    sessionId?: string
  ): Promise<{
    status: 'OK' | 'UNKNOWN_TAG';
    tagUid?: string;
    studentId?: string;
    fullName?: string;
    houseId?: string;
    avatarUrl?: string;
    ts: number;
    splitMs?: number | null;
    lap?: number;
    checkedIn?: boolean;
  }> {
    return await this.client.mutation(api.nfc.gameScanByTag, {
      tagUid,
      adminName,
      sessionId: sessionId as Id<'gameSessions'> | undefined,
      localDate: localDate(),
    });
  }
}

export const gameCenter = new GameCenterService();
