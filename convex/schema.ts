import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// House ids match the HouseId enum in types.ts
export const houseId = v.union(
  v.literal("UNITY"),
  v.literal("SAGE"),
  v.literal("SPARK"),
  v.literal("VALOR")
);

// Relay Race launch config, stored on the session so the scorer knows the mode
export const relayConfig = v.object({
  mode: v.union(v.literal("INDIVIDUAL"), v.literal("TEAM")),
  scoring: v.union(v.literal("TIME_TRIAL"), v.literal("PLACEMENTS")),
  headToHead: v.boolean(),
  attempts: v.number(),
  teams: v.optional(
    v.array(v.object({ name: v.string(), memberIds: v.array(v.string()) }))
  ),
});

// Results blob stored on a finished game session
export const gameResults = v.object({
  winningHouseId: v.optional(v.union(houseId, v.null())),
  winningHouseScore: v.optional(v.number()),
  mvpStudentId: v.optional(v.union(v.string(), v.null())),
  mvpStudentScore: v.optional(v.number()),
  outs: v.optional(v.record(v.string(), v.boolean())),
});

export default defineSchema({
  // ── Core roster ────────────────────────────────────────────────────────────
  students: defineTable({
    fullName: v.string(),
    houseId: houseId,
    gender: v.union(v.literal("Male"), v.literal("Female")),
    points: v.number(),
    hasWearable: v.boolean(),
    deviceId: v.optional(v.union(v.string(), v.null())),
    isPresent: v.boolean(),
    avatarUrl: v.optional(v.string()),
    rankId: v.string(), // references ranks.key (e.g. 'r_noob')
    badges: v.array(v.string()), // badge keys
    inventory: v.array(v.string()), // reward keys
    // Student portal fields
    gamerTag: v.optional(v.string()),
    displayPreference: v.optional(
      v.union(v.literal("FULL_NAME"), v.literal("GAMER_TAG"), v.literal("INITIALS"))
    ),
    bio: v.optional(v.string()),
    friendIds: v.optional(v.array(v.string())), // student _ids
    totalXp: v.optional(v.number()),
    // Layered avatar (components/avatar/AvatarRig): photo vs avatar choice +
    // the equipped look, denormalized here so boards render without joins.
    avatarMode: v.optional(v.union(v.literal("PHOTO"), v.literal("AVATAR"))),
    // Equipped gear item (gearCatalog.ts) — multiplies point earning by source
    gearEquipped: v.optional(v.union(v.string(), v.null())),
    // FitTokens balance (parent-paid cosmetic currency; audited in fitTokenLedger)
    fitTokens: v.optional(v.number()),
    // Volt System loadout (voltCatalog.ts): equipped perk per row + wildcard;
    // flex is the Perk Greed fourth slot.
    voltLoadout: v.optional(
      v.object({
        perk1: v.optional(v.union(v.string(), v.null())),
        perk2: v.optional(v.union(v.string(), v.null())),
        perk3: v.optional(v.union(v.string(), v.null())),
        flex: v.optional(v.union(v.string(), v.null())),
        wildcard: v.optional(v.union(v.string(), v.null())),
      })
    ),
    avatarLook: v.optional(
      v.object({
        body: v.optional(v.union(v.literal("M"), v.literal("F"))),
        skin: v.optional(v.string()),
        hairColor: v.optional(v.string()),
        hair: v.optional(v.string()),
        top: v.optional(v.string()),
        acc: v.optional(v.union(v.string(), v.null())),
      })
    ),
    createdAt: v.number(),
  })
    .index("by_house", ["houseId"])
    .index("by_points", ["points"])
    .index("by_present", ["isPresent"]),

  // ── Games ─────────────────────────────────────────────────────────────────
  gameSessions: defineTable({
    gameKey: v.string(),
    title: v.string(),
    startTime: v.number(), // ms epoch
    endTime: v.number(), // ms epoch
    isActive: v.boolean(),
    startedBy: v.optional(v.string()),
    roster: v.array(v.string()), // student _ids
    // Coach picks at launch: MANUAL scoring or NFC bands. In NFC mode every
    // tap is auto-routed to this session and processed per the game's rules.
    captureMode: v.optional(v.union(v.literal("MANUAL"), v.literal("NFC"))),
    // Coach pause: pausedAt set while paused; pausedMs accumulates total paused time
    pausedAt: v.optional(v.union(v.number(), v.null())),
    pausedMs: v.optional(v.number()),
    results: v.optional(gameResults),
    // Relay Race: coach's launch config (mode, scoring, head-to-head, teams)
    relay: v.optional(relayConfig),
    createdAt: v.number(),
  })
    .index("by_active", ["isActive"])
    .index("by_endTime", ["endTime"]),

  gameLibrary: defineTable({
    gameKey: v.string(),
    displayName: v.string(),
    category: v.string(),
    houseTraitFocus: v.string(),
    minPlayers: v.number(),
    maxPlayers: v.number(),
    recommendedAgeBand: v.string(),
    durationDefaultSeconds: v.number(),
    equipmentChecklist: v.array(v.string()),
    setupSteps: v.array(v.string()),
    rules: v.array(v.string()),
    scoringRules: v.string(),
    penalties: v.string(),
    tieBreaker: v.string(),
    safetyNotes: v.string(),
    accessibilityVariants: v.string(),
    coachScriptShort: v.string(),
    dataCaptureFields: v.array(v.string()),
    leaderboardMetric: v.string(),
    templateId: v.string(),
  }).index("by_gameKey", ["gameKey"]),

  drillPresets: defineTable({
    name: v.string(),
    gameKey: v.string(),
    defaultDuration: v.number(),
    defaultRoster: v.array(v.string()),
    createdBy: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_createdAt", ["createdAt"]),

  // ── Points ledger & activity feed ─────────────────────────────────────────
  transactions: defineTable({
    studentId: v.id("students"),
    amount: v.number(),
    sourceType: v.string(), // MANUAL | FIT | REDEMPTION | SYSTEM | STORE_PURCHASE
    description: v.optional(v.string()),
    adminName: v.optional(v.union(v.string(), v.null())), // who gave/took the points
    gameSessionId: v.optional(v.id("gameSessions")), // set when earned in a game
    createdAt: v.number(),
  })
    .index("by_student", ["studentId", "createdAt"])
    .index("by_createdAt", ["createdAt"])
    .index("by_session", ["gameSessionId"]),

  // Coach-awarded accolades (Session Legend, MVP, custom) — the superlatives
  // record, separate from the static badges/trophies catalogs.
  medals: defineTable({
    studentId: v.id("students"),
    key: v.string(), // 'legend' | 'mvp' | 'hustle' | custom slug
    title: v.string(),
    note: v.optional(v.union(v.string(), v.null())),
    awardedBy: v.string(),
    date: v.string(), // YYYY-MM-DD
    gameSessionId: v.optional(v.id("gameSessions")), // set when awarded in a game
    createdAt: v.number(),
  })
    .index("by_student", ["studentId", "createdAt"])
    .index("by_createdAt", ["createdAt"])
    .index("by_date", ["date"])
    .index("by_session", ["gameSessionId"]),

  notifications: defineTable({
    type: v.string(), // POINTS | RANK_UP | RANK_DOWN | GAME_END | ENROLL | BADGE_EARNED | REWARD_CLAIMED | LAP_TIME | ACCOUNT_DELETE
    studentId: v.optional(v.union(v.string(), v.null())),
    studentName: v.optional(v.union(v.string(), v.null())),
    avatarUrl: v.optional(v.union(v.string(), v.null())),
    houseId: v.optional(v.union(houseId, v.null())),
    message: v.string(),
    amount: v.optional(v.union(v.number(), v.null())),
    timestamp: v.number(), // ms epoch
    adminName: v.optional(v.union(v.string(), v.null())),
  }).index("by_timestamp", ["timestamp"]),

  // Ephemeral cross-client broadcast events (replaces Supabase broadcast channels)
  appEvents: defineTable({
    kind: v.string(), // rank_up | game_start | game_end | player_status | points_change | lap_time
    payload: v.any(),
    source: v.optional(v.string()), // client id that published it (skip echo on sender)
    ts: v.number(),
  }).index("by_ts", ["ts"]),

  // ── Catalog (keyed by stable string slugs referenced from students) ──────
  ranks: defineTable({
    key: v.string(), // e.g. 'r_noob'
    name: v.string(),
    threshold: v.number(),
    icon: v.string(),
    color: v.string(),
    description: v.optional(v.string()),
    xpReward: v.optional(v.number()),
    pointsRequired: v.optional(v.number()),
    criteriaTasks: v.optional(v.array(v.string())),
    // Enforceable, coach-configured promotion requirements BEYOND points. A rank
    // with no criteria (or an empty object) promotes on points alone — EXACTLY
    // the legacy behavior. When present, EVERY set criterion must also be met:
    //   points   — min points floor (defaults to `threshold` when unset)
    //   xp       — min total XP
    //   checkIns — min distinct check-in DAYS
    //   medals   — required medal titles + counts (e.g. 3x "Session Legend")
    //   tasks    — required special tasks + counts (approved taskSubmissions)
    criteria: v.optional(
      v.object({
        points: v.optional(v.number()),
        xp: v.optional(v.number()),
        checkIns: v.optional(v.number()),
        medals: v.optional(
          v.array(v.object({ title: v.string(), count: v.number() }))
        ),
        tasks: v.optional(
          v.array(v.object({ taskId: v.string(), count: v.optional(v.number()) }))
        ),
      })
    ),
    type: v.optional(v.union(v.literal("RANK"), v.literal("TROPHY"))),
  })
    .index("by_key", ["key"])
    .index("by_threshold", ["threshold"]),

  badges: defineTable({
    key: v.string(), // e.g. 'b_first_drill'
    name: v.string(),
    icon: v.string(),
    description: v.optional(v.string()),
    color: v.optional(v.string()),
  }).index("by_key", ["key"]),

  rewards: defineTable({
    key: v.string(),
    name: v.string(),
    cost: v.number(),
    icon: v.string(),
    category: v.union(v.literal("Virtual"), v.literal("Real")),
    description: v.optional(v.string()),
    // Game-center perk shop: rarity drives card styling (common..legendary);
    // value carries a payload (e.g. avatar-skin image URL applied on redeem).
    rarity: v.optional(v.string()),
    value: v.optional(v.string()),
  }).index("by_key", ["key"]),

  trophies: defineTable({
    name: v.string(),
    description: v.string(),
    icon: v.string(),
    xpReward: v.number(),
    pointsRequired: v.number(),
    criteriaTasks: v.array(v.string()),
    color: v.string(),
    isActive: v.boolean(),
    createdAt: v.number(),
  }).index("by_pointsRequired", ["pointsRequired"]),

  appSettings: defineTable({
    key: v.string(),
    value: v.string(),
    updatedAt: v.number(),
  }).index("by_key", ["key"]),

  // ── V2 gamification ───────────────────────────────────────────────────────
  seasons: defineTable({
    name: v.string(),
    startDate: v.string(),
    endDate: v.optional(v.union(v.string(), v.null())),
    theme: v.optional(v.union(v.string(), v.null())),
    status: v.string(), // ACTIVE | COMPLETED | ARCHIVED
    isActive: v.boolean(),
    createdAt: v.number(),
  }).index("by_createdAt", ["createdAt"]),

  xpTransactions: defineTable({
    studentId: v.id("students"),
    amount: v.number(),
    sourceType: v.string(),
    description: v.optional(v.union(v.string(), v.null())),
    createdAt: v.number(),
  }).index("by_student", ["studentId", "createdAt"]),

  wearables: defineTable({
    key: v.string(),
    name: v.string(),
    slot: v.union(
      v.literal("BASE_FACE"),
      v.literal("HAIRSTYLE"),
      v.literal("TOP"),
      v.literal("ACCESSORY")
    ),
    filePath: v.string(),
    rarity: v.string(), // common | uncommon | rare | epic | legendary
    xpCost: v.number(),
    isDefault: v.boolean(),
  }).index("by_key", ["key"]),

  studentWearables: defineTable({
    studentId: v.id("students"),
    wearableId: v.string(), // wearables.key or wearable _id
    acquiredAt: v.number(),
    upgradeLevel: v.optional(v.number()), // 0 base → 3 volt (duplicates upgrade)
  }).index("by_student", ["studentId"]),

  // Parent sign-up invites: pre-creates the parent + athlete links so the kid
  // is already there at first sign-in. Sent by admins or the GHL webhook.
  parentInvites: defineTable({
    email: v.string(), // lowercase
    fullName: v.string(),
    studentIds: v.array(v.string()),
    token: v.string(),
    status: v.string(), // PENDING | ACCEPTED
    invitedBy: v.string(), // admin name or "GHL"
    createdAt: v.number(),
    acceptedAt: v.optional(v.number()),
  })
    .index("by_token", ["token"])
    .index("by_email", ["email"])
    .index("by_createdAt", ["createdAt"]),

  // Kid self-login: parent-granted portal access + PIN. Separate table so the
  // PIN never travels with the public students list.
  portalAccess: defineTable({
    studentId: v.id("students"),
    enabled: v.boolean(),
    pin: v.string(), // 4-digit, set by the parent
    updatedAt: v.number(),
  }).index("by_student", ["studentId"]),

  // Player-to-player trades: badges and avatar items, both-sides consent.
  trades: defineTable({
    fromStudentId: v.id("students"),
    toStudentId: v.id("students"),
    giveKind: v.string(), // BADGE | ITEM (avatar wearable)
    giveKey: v.string(),
    wantKind: v.string(),
    wantKey: v.string(),
    status: v.string(), // PENDING | ACCEPTED | DECLINED | CANCELLED
    createdAt: v.number(),
    resolvedAt: v.optional(v.number()),
  })
    .index("by_to", ["toStudentId", "status"])
    .index("by_from", ["fromStudentId", "status"]),

  // Owned gear items (bought or earned via achievements).
  studentGear: defineTable({
    studentId: v.id("students"),
    gearKey: v.string(),
    acquiredVia: v.string(), // BUY | ACHIEVEMENT
    acquiredAt: v.number(),
  }).index("by_student", ["studentId"]),

  // One row per crate opened — the loot ledger (odds audit + daily cap).
  lootBoxOpens: defineTable({
    studentId: v.id("students"),
    box: v.string(), // STANDARD | PREMIUM
    cost: v.number(),
    itemKey: v.string(),
    rarity: v.string(), // common | uncommon | legendary
    outcome: v.string(), // NEW | UPGRADE | SHARDS
    refund: v.optional(v.number()),
    date: v.string(), // YYYY-MM-DD (kid's local day, for the daily cap)
    createdAt: v.number(),
  })
    .index("by_student_date", ["studentId", "date"])
    .index("by_createdAt", ["createdAt"]),

  studentAvatars: defineTable({
    studentId: v.id("students"),
    baseFaceId: v.optional(v.union(v.string(), v.null())),
    hairstyleId: v.optional(v.union(v.string(), v.null())),
    topId: v.optional(v.union(v.string(), v.null())),
    accessoryId: v.optional(v.union(v.string(), v.null())),
    updatedAt: v.number(),
  }).index("by_student", ["studentId"]),

  challenges: defineTable({
    type: v.union(
      v.literal("DAILY"),
      v.literal("WEEKLY"),
      v.literal("SEASONAL"),
      v.literal("MILESTONE")
    ),
    title: v.string(),
    description: v.string(),
    xpReward: v.number(),
    isActive: v.boolean(),
    requirement: v.optional(v.number()),
  }).index("by_active", ["isActive"]),

  studentChallenges: defineTable({
    studentId: v.id("students"),
    challengeId: v.id("challenges"),
    progress: v.number(),
    isCompleted: v.boolean(),
  }).index("by_student", ["studentId"]),

  // ── Tournaments ───────────────────────────────────────────────────────────
  tournaments: defineTable({
    name: v.string(),
    type: v.union(
      v.literal("SINGLE_ELIM"),
      v.literal("DOUBLE_ELIM"),
      v.literal("ROUND_ROBIN"),
      v.literal("HOUSE_BATTLE")
    ),
    status: v.union(
      v.literal("REGISTRATION"),
      v.literal("SEEDING"),
      v.literal("ACTIVE"),
      v.literal("COMPLETED")
    ),
    startDate: v.optional(v.union(v.string(), v.null())),
    endDate: v.optional(v.union(v.string(), v.null())),
    maxParticipants: v.optional(v.union(v.number(), v.null())),
    seasonId: v.optional(v.union(v.id("seasons"), v.null())),
    prizePool: v.optional(v.any()),
    createdBy: v.optional(v.union(v.string(), v.null())),
    createdAt: v.number(),
  }).index("by_createdAt", ["createdAt"]),

  tournamentParticipants: defineTable({
    tournamentId: v.id("tournaments"),
    studentId: v.id("students"),
    seedPosition: v.optional(v.union(v.number(), v.null())),
    finalPlacement: v.optional(v.union(v.number(), v.null())),
    pointsEarned: v.number(),
    joinedAt: v.number(),
  })
    .index("by_tournament", ["tournamentId"])
    .index("by_student", ["studentId"]),

  tournamentMatches: defineTable({
    tournamentId: v.id("tournaments"),
    roundNumber: v.number(),
    matchNumber: v.number(),
    participant1Id: v.optional(v.union(v.id("tournamentParticipants"), v.null())),
    participant2Id: v.optional(v.union(v.id("tournamentParticipants"), v.null())),
    winnerId: v.optional(v.union(v.id("tournamentParticipants"), v.null())),
    score1: v.optional(v.union(v.number(), v.null())),
    score2: v.optional(v.union(v.number(), v.null())),
    status: v.union(v.literal("SCHEDULED"), v.literal("IN_PROGRESS"), v.literal("COMPLETED")),
    scheduledTime: v.optional(v.union(v.string(), v.null())),
    completedAt: v.optional(v.union(v.string(), v.null())),
  }).index("by_tournament", ["tournamentId"]),

  // ── Blog / alerts ─────────────────────────────────────────────────────────
  blogPosts: defineTable({
    title: v.string(),
    content: v.string(),
    excerpt: v.optional(v.union(v.string(), v.null())),
    authorId: v.optional(v.union(v.string(), v.null())),
    isPublished: v.boolean(),
    publishedAt: v.optional(v.union(v.number(), v.null())),
    targetAudience: v.union(
      v.literal("ALL"),
      v.literal("STUDENTS"),
      v.literal("PARENTS"),
      v.literal("COACHES"),
      v.literal("ADMINS")
    ),
    priority: v.union(v.literal("LOW"), v.literal("NORMAL"), v.literal("HIGH")),
    createdAt: v.number(),
  })
    .index("by_published", ["isPublished", "publishedAt"])
    .index("by_createdAt", ["createdAt"]),

  // ── Parent portal (replaces Supabase Auth + parent_profiles) ─────────────
  parents: defineTable({
    email: v.string(), // stored lowercase
    fullName: v.string(),
    phone: v.optional(v.union(v.string(), v.null())),
    passwordHash: v.string(), // hex PBKDF2-SHA256
    salt: v.string(), // hex
    createdAt: v.number(),
  }).index("by_email", ["email"]),

  parentSessions: defineTable({
    parentId: v.id("parents"),
    token: v.string(),
    createdAt: v.number(),
    expiresAt: v.number(),
  })
    .index("by_token", ["token"])
    .index("by_parent", ["parentId"]),

  parentStudentLinks: defineTable({
    parentId: v.id("parents"),
    studentId: v.id("students"),
    createdAt: v.number(),
  })
    .index("by_parent", ["parentId"])
    .index("by_student", ["studentId"])
    .index("by_parent_student", ["parentId", "studentId"]),

  // ── Game center: dynamic check-in ─────────────────────────────────────────
  checkinTokens: defineTable({
    token: v.string(),
    kind: v.union(v.literal("FRONT_DESK"), v.literal("NFC_KIOSK")),
    expiresAt: v.number(),
    createdAt: v.number(),
  })
    .index("by_token", ["token"])
    .index("by_kind", ["kind"]),

  checkIns: defineTable({
    studentId: v.id("students"),
    date: v.string(), // YYYY-MM-DD (device-local)
    checkedInAt: v.number(),
    checkedOutAt: v.optional(v.union(v.number(), v.null())),
    method: v.union(v.literal("QR"), v.literal("NFC"), v.literal("MANUAL")),
    byParentId: v.optional(v.union(v.id("parents"), v.null())),
    byAdminName: v.optional(v.union(v.string(), v.null())),
  })
    .index("by_date", ["date"])
    .index("by_student_date", ["studentId", "date"])
    .index("by_student", ["studentId"]),

  // ── Game center: staff ↔ parent messaging ─────────────────────────────────
  conversations: defineTable({
    parentId: v.id("parents"),
    subject: v.optional(v.union(v.string(), v.null())),
    lastMessageAt: v.number(),
    lastMessagePreview: v.string(),
    unreadForParent: v.number(),
    unreadForStaff: v.number(),
    createdAt: v.number(),
  })
    .index("by_parent", ["parentId"])
    .index("by_lastMessageAt", ["lastMessageAt"]),

  messages: defineTable({
    conversationId: v.id("conversations"),
    senderType: v.union(v.literal("STAFF"), v.literal("PARENT")),
    senderName: v.string(),
    body: v.string(),
    createdAt: v.number(),
  }).index("by_conversation", ["conversationId", "createdAt"]),

  // ── Game center: partner businesses (earn around town) ────────────────────
  partnerBusinesses: defineTable({
    name: v.string(),
    description: v.optional(v.union(v.string(), v.null())),
    category: v.optional(v.union(v.string(), v.null())),
    address: v.optional(v.union(v.string(), v.null())),
    logoUrl: v.optional(v.union(v.string(), v.null())),
    pointsReward: v.number(),
    qrSecret: v.string(),
    isActive: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_secret", ["qrSecret"])
    .index("by_active", ["isActive"]),

  businessVisits: defineTable({
    studentId: v.id("students"),
    businessId: v.id("partnerBusinesses"),
    points: v.number(),
    date: v.string(), // YYYY-MM-DD — one visit per student/business/day
    byParentId: v.optional(v.union(v.id("parents"), v.null())),
    verifiedBy: v.union(v.literal("PARENT_QR"), v.literal("ADMIN")),
    createdAt: v.number(),
  })
    .index("by_student", ["studentId", "createdAt"])
    .index("by_business", ["businessId", "createdAt"])
    .index("by_student_business_date", ["studentId", "businessId", "date"]),

  // ── Game center: special tasks (off-site earning, staff-approved) ─────────
  specialTasks: defineTable({
    title: v.string(),
    description: v.string(),
    points: v.number(),
    isActive: v.boolean(),
    requiresProof: v.boolean(),
    createdAt: v.number(),
  }).index("by_active", ["isActive"]),

  taskSubmissions: defineTable({
    taskId: v.id("specialTasks"),
    studentId: v.id("students"),
    byParentId: v.id("parents"),
    note: v.optional(v.union(v.string(), v.null())),
    photoUrl: v.optional(v.union(v.string(), v.null())),
    status: v.union(v.literal("PENDING"), v.literal("APPROVED"), v.literal("REJECTED")),
    reviewedBy: v.optional(v.union(v.string(), v.null())),
    reviewedAt: v.optional(v.union(v.number(), v.null())),
    createdAt: v.number(),
  })
    .index("by_status", ["status", "createdAt"])
    .index("by_student", ["studentId", "createdAt"])
    .index("by_parent", ["byParentId", "createdAt"]),

  // ── Game center: durable NFC scan log (check-in taps live in checkIns) ────
  nfcScans: defineTable({
    ts: v.number(),
    kind: v.union(v.literal("CHECKIN"), v.literal("GAME"), v.literal("AWARD")),
    tagUid: v.string(),
    studentId: v.optional(v.union(v.id("students"), v.null())),
    studentName: v.optional(v.union(v.string(), v.null())),
    houseId: v.optional(v.union(houseId, v.null())),
    sessionId: v.optional(v.union(v.id("gameSessions"), v.null())),
    gameTitle: v.optional(v.union(v.string(), v.null())),
    splitMs: v.optional(v.union(v.number(), v.null())), // vs student's previous scan in the session
    amount: v.optional(v.union(v.number(), v.null())),
    actor: v.string(),
  })
    .index("by_ts", ["ts"])
    .index("by_session", ["sessionId", "ts"])
    .index("by_student", ["studentId", "ts"]),

  // ── FitTokens: parent-paid cosmetic currency (vanity only, never power) ────
  fitTokenPacks: defineTable({
    key: v.string(),
    name: v.string(),
    tokens: v.number(),
    priceLabel: v.string(), // display only, e.g. "$4.99" — money moves on hosted checkout
    paymentUrl: v.optional(v.union(v.string(), v.null())), // hosted checkout link (Stripe/GHL)
    sort: v.number(),
    active: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_key", ["key"])
    .index("by_active", ["active"]),

  fitTokenPurchases: defineTable({
    parentId: v.id("parents"),
    studentId: v.id("students"),
    packKey: v.string(),
    tokens: v.number(),
    reference: v.string(), // FT-XXXXXX, rides the hosted checkout as client_reference_id
    status: v.union(v.literal("PENDING"), v.literal("CREDITED"), v.literal("CANCELLED")),
    creditedBy: v.optional(v.union(v.string(), v.null())), // "WEBHOOK" or admin name
    createdAt: v.number(),
    resolvedAt: v.optional(v.union(v.number(), v.null())),
  })
    .index("by_reference", ["reference"])
    .index("by_status", ["status", "createdAt"])
    .index("by_parent", ["parentId", "createdAt"])
    .index("by_student", ["studentId", "createdAt"]),

  fitTokenLedger: defineTable({
    studentId: v.id("students"),
    amount: v.number(), // +credit / -spend
    kind: v.union(
      v.literal("PURCHASE"),
      v.literal("ADJUST"),
      v.literal("SPEND"),
      v.literal("JACKPOT")
    ),
    description: v.string(),
    byName: v.optional(v.union(v.string(), v.null())),
    createdAt: v.number(),
  })
    .index("by_student", ["studentId", "createdAt"])
    .index("by_createdAt", ["createdAt"]),

  // ── Consumable gear activations (DAILY cooldown / ONE_SHOT) ───────────────
  gearActivations: defineTable({
    studentId: v.id("students"),
    gearKey: v.string(),
    kind: v.union(v.literal("DAILY"), v.literal("ONE_SHOT")),
    date: v.string(), // YYYY-MM-DD local — DAILY items: one per day
    activatedAt: v.number(),
    expiresAt: v.number(), // effect window end
  })
    .index("by_student_date", ["studentId", "date"])
    .index("by_student", ["studentId", "expiresAt"]),

  // ── Points marketplace: in-kind donated prizes, confirmed handover ────────
  marketItems: defineTable({
    name: v.string(),
    description: v.string(),
    icon: v.string(), // Ic icon key or short label
    imageUrl: v.optional(v.union(v.string(), v.null())),
    pointCost: v.number(),
    qtyAvailable: v.number(),
    donatedBy: v.optional(v.union(v.string(), v.null())),
    active: v.boolean(),
    createdAt: v.number(),
  }).index("by_active", ["active"]),

  marketOrders: defineTable({
    studentId: v.id("students"),
    itemId: v.id("marketItems"),
    itemName: v.string(),
    cost: v.number(),
    claimCode: v.string(), // 6-char code the family shows at the desk
    status: v.union(v.literal("PENDING"), v.literal("FULFILLED"), v.literal("CANCELLED")),
    requestedVia: v.union(v.literal("STUDENT"), v.literal("PARENT")),
    confirmedBy: v.optional(v.union(v.string(), v.null())),
    createdAt: v.number(),
    resolvedAt: v.optional(v.union(v.number(), v.null())),
  })
    .index("by_status", ["status", "createdAt"])
    .index("by_student", ["studentId", "createdAt"])
    .index("by_claimCode", ["claimCode"]),

  // ── Jackpot: coach-triggered random gift wheel ─────────────────────────────
  jackpotPrizes: defineTable({
    key: v.string(),
    label: v.string(),
    kind: v.union(
      v.literal("POINTS"),
      v.literal("TOKENS"),
      v.literal("AVATAR_ITEM"),
      v.literal("GEAR_ITEM")
    ),
    value: v.string(), // POINTS/TOKENS: amount; AVATAR_ITEM: rarity; GEAR_ITEM: gear key
    weight: v.number(),
    active: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_key", ["key"])
    .index("by_active", ["active"]),

  jackpotSpins: defineTable({
    studentId: v.id("students"),
    prizeKey: v.string(),
    label: v.string(), // what actually landed (resolved item name etc.)
    byAdmin: v.string(),
    createdAt: v.number(),
  })
    .index("by_student", ["studentId", "createdAt"])
    .index("by_createdAt", ["createdAt"]),

  // ── House draft: staged assignments held until reveal ─────────────────────
  // Singleton row. Assignments stay invisible to kids/parents until revealed
  // manually or at the coach-scheduled time; reveal patches students.houseId.
  houseDraft: defineTable({
    assignments: v.record(v.string(), houseId), // studentId -> staged house
    revealAt: v.optional(v.union(v.number(), v.null())),
    scheduledJobId: v.optional(v.union(v.string(), v.null())),
    updatedBy: v.string(),
    updatedAt: v.number(),
  }),

  // ── Pending celebrations: queued congrats shown on next app open ──────────
  pendingCelebrations: defineTable({
    studentId: v.id("students"),
    kind: v.union(v.literal("LEVEL_UP"), v.literal("HOUSE_REVEAL"), v.literal("AWARD")),
    title: v.string(),
    message: v.string(),
    icon: v.optional(v.union(v.string(), v.null())), // asset URL (house logo etc.)
    createdAt: v.number(),
    seenAt: v.optional(v.union(v.number(), v.null())),
  }).index("by_student", ["studentId", "seenAt"]),

  // ── Web push subscriptions (game + team alert notifications) ──────────────
  pushSubscriptions: defineTable({
    endpoint: v.string(),
    subscription: v.string(), // full PushSubscription JSON
    audience: v.union(v.literal("PARENT"), v.literal("ADMIN"), v.literal("STUDENT")),
    parentId: v.optional(v.union(v.id("parents"), v.null())),
    label: v.optional(v.union(v.string(), v.null())), // user agent hint
    createdAt: v.number(),
  }).index("by_endpoint", ["endpoint"]),

  // ── Game center: perk redemptions ──────────────────────────────────────────
  redemptions: defineTable({
    studentId: v.id("students"),
    rewardKey: v.string(),
    rewardName: v.string(),
    rewardIcon: v.string(),
    cost: v.number(),
    status: v.union(v.literal("PENDING"), v.literal("FULFILLED"), v.literal("CANCELLED")),
    requestedVia: v.union(v.literal("STUDENT"), v.literal("PARENT")),
    fulfilledBy: v.optional(v.union(v.string(), v.null())),
    fulfilledAt: v.optional(v.union(v.number(), v.null())),
    createdAt: v.number(),
  })
    .index("by_status", ["status", "createdAt"])
    .index("by_student", ["studentId", "createdAt"]),
});
