
export enum HouseId {
  UNITY = 'UNITY',
  SAGE = 'SAGE',
  SPARK = 'SPARK',
  VALOR = 'VALOR',
}

export type ScoringTemplateId =
  | 'TEMPLATE_TIME_TRIAL'
  | 'TEMPLATE_H2H_ROUNDS'
  | 'TEMPLATE_REP_COUNTER'
  | 'TEMPLATE_ACCURACY'
  | 'TEMPLATE_QUIZ';

export interface Badge {
  id: string;
  name: string;
  icon: string;
  description: string;
  color: string;
}

export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export interface Reward {
  id: string;
  name: string;
  cost: number;
  icon: string;
  category: 'Virtual' | 'Real';
  description: string;
  /** Perk-shop card tier (Rocket League style) */
  rarity?: Rarity;
  /** Payload — e.g. avatar-skin image URL applied when redeemed */
  value?: string;
}

export interface GameDefinition {
  gameKey: string;
  displayName: string;
  category: string;
  houseTraitFocus: HouseId | 'Mixed';
  minPlayers: number;
  maxPlayers: number;
  recommendedAgeBand: string;
  durationDefaultSeconds: number;
  equipmentChecklist: string[];
  setupSteps: string[];
  rules: string[];
  scoringRules: string;
  penalties: string;
  tieBreaker: string;
  safetyNotes: string;
  accessibilityVariants: string;
  coachScriptShort: string;
  dataCaptureFields: string[];
  leaderboardMetric: 'time' | 'score' | 'accuracy' | 'mixed';
  templateId: ScoringTemplateId;
}

export interface GameScoreEvent {
  id: string;
  sessionId: string;
  studentId?: string;
  houseId?: HouseId;
  amount: number;
  type: 'POINT' | 'PENALTY' | 'BONUS';
  description: string;
  isUndone: boolean;
  timestamp: string;
}

export interface StudentNote {
  id: string;
  studentId: string;
  coachName: string;
  content: string;
  createdAt: string;
}

export interface GameSession {
  id: string;
  gameKey: string;
  title: string;
  startTime: number;
  endTime: number;
  isActive: boolean;
  startedBy: string;
  roster: string[];
  results?: GameResult;
}

export interface House {
  id: HouseId;
  name: string;
  colorHex: string;
  mascot: string;
  totalPoints: number;
  customIcon?: string;
}

export interface Rank {
  id: string;
  name: string;
  threshold: number;
  icon: string;
  color: string;
  description: string;
  customIcon?: string;
  // New gamification fields
  xpReward?: number;
  pointsRequired?: number;
  criteriaTasks?: string[];
  type?: 'RANK' | 'TROPHY';
}

export interface Trophy {
  id: string;
  name: string;
  description: string;
  icon: string;
  xpReward: number;
  pointsRequired: number;
  criteriaTasks: string[];
  color: string;
  isActive: boolean;
  createdAt?: string;
}

// XP System Types
export interface XPTransaction {
  id: string;
  studentId: string;
  amount: number;
  sourceType: 'SESSION_ATTENDANCE' | 'GAME_WIN' | 'CHALLENGE_COMPLETED' | 'STREAK_BONUS' | 'COACH_AWARD' | 'OTHER';
  description: string;
  createdAt: string;
}

export interface Season {
  id: string;
  name: string;
  startDate: string;
  endDate?: string;
  theme: string;
  isActive: boolean;
  status?: 'ACTIVE' | 'COMPLETED' | 'ARCHIVED';
}

export interface Wearable {
  id: string;
  name: string;
  slot: 'BASE_FACE' | 'HAIRSTYLE' | 'TOP' | 'ACCESSORY';
  filePath: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  xpCost: number;
  isDefault: boolean;
}

export interface AvatarConfig {
  baseFaceId?: string;
  hairstyleId?: string;
  topId?: string;
  accessoryId?: string;
}

export interface Challenge {
  id: string;
  type: 'DAILY' | 'WEEKLY' | 'SEASONAL' | 'MILESTONE';
  title: string;
  description: string;
  xpReward: number;
  isActive: boolean;
  requirement?: number;
}

export interface StudentChallenge {
  studentId: string;
  challengeId: string;
  progress: number;
  isCompleted: boolean;
}

// Blog/Alert System
export interface BlogPost {
  id: string;
  title: string;
  content: string;
  excerpt?: string;
  authorId?: string;
  isPublished: boolean;
  publishedAt?: string;
  targetAudience: 'ALL' | 'STUDENTS' | 'PARENTS' | 'COACHES' | 'ADMINS';
  priority: 'LOW' | 'NORMAL' | 'HIGH';
  createdAt: string;
}

export interface Student {
  id: string;
  houseId: HouseId;
  fullName: string;
  gender: 'Male' | 'Female';
  points: number;
  hasWearable: boolean;
  deviceId?: string;
  isPresent: boolean;
  avatarUrl: string;
  rankId: string;
  badges?: string[];
  inventory?: string[]; // Array of Reward IDs
  // Student Portal Fields
  gamerTag?: string;
  displayPreference?: 'FULL_NAME' | 'GAMER_TAG' | 'INITIALS';
  bio?: string;
  friendIds?: string[];
  totalXp?: number;
  // Layered avatar (components/avatar): photo vs avatar + equipped look
  avatarMode?: 'PHOTO' | 'AVATAR';
  avatarLook?: {
    body?: 'M' | 'F';
    skin?: string;
    hairColor?: string;
    hair?: string;
    top?: string;
    acc?: string | null;
  };
}

export interface GameResult {
  winningHouseId: HouseId | null;
  winningHouseScore: number;
  mvpStudentId: string | null;
  mvpStudentScore: number;
  outs?: Record<string, boolean>;
}

export interface Transaction {
  id: string;
  studentId: string;
  amount: number;
  sourceType:
    | 'MANUAL'
    | 'FIT'
    | 'REDEMPTION'
    | 'CHECKIN'
    | 'PARTNER_VISIT'
    | 'SPECIAL_TASK'
    | 'SYSTEM'
    | 'STORE_PURCHASE';
  description: string;
  createdAt: string | Date; // Can be ISO string or Date object
  adminName?: string;
}

export interface NotificationEvent {
  id?: string;
  type:
    | 'POINTS'
    | 'RANK_UP'
    | 'GAME_END'
    | 'ENROLL'
    | 'BADGE_EARNED'
    | 'REWARD_CLAIMED'
    | 'CHECKIN'
    | 'CHECKOUT'
    | 'PARTNER_VISIT'
    | 'SPECIAL_TASK'
    | 'NFC_ASSIGN'
    | 'LAP_TIME';
  studentId?: string;
  studentName?: string;
  avatarUrl?: string;
  houseId?: HouseId;
  message: string;
  amount?: number;
  rank?: Rank;
  badge?: Badge;
  reward?: Reward;
  timestamp: number; // Unix timestamp (milliseconds)
  adminName?: string;
}

export type TimeRange = 'DAY' | 'WEEK' | 'ALL';

export interface AppSettings {
  app_logo?: string;
  [key: string]: string | undefined;
}

export interface GeneratedGameIdea {
  title: string;
  description: string;
  suggestedDuration: number;
}

// --- TOURNAMENT TYPES ---
export type TournamentType = 'SINGLE_ELIM' | 'DOUBLE_ELIM' | 'ROUND_ROBIN' | 'HOUSE_BATTLE';
export type TournamentStatus = 'REGISTRATION' | 'SEEDING' | 'ACTIVE' | 'COMPLETED';
export type MatchStatus = 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED';

export interface Tournament {
  id: string;
  name: string;
  type: TournamentType;
  status: TournamentStatus;
  startDate?: string;
  endDate?: string;
  maxParticipants?: number;
  seasonId?: string;
  prizePool?: any; // JSONB
  createdBy?: string;
}

export interface TournamentParticipant {
  id: string;
  tournamentId: string;
  studentId: string;
  seedPosition?: number;
  finalPlacement?: number;
  pointsEarned: number;
  joinedAt: string;
  student?: Student; // Joined view
}

// --- GAME CENTER TYPES ---

export interface CheckIn {
  id: string;
  studentId: string;
  date: string; // YYYY-MM-DD
  checkedInAt: number;
  checkedOutAt?: number | null;
  method: 'QR' | 'NFC' | 'MANUAL';
  byParentId?: string | null;
  byAdminName?: string | null;
}

export interface BoardEntry {
  checkIn: CheckIn;
  student: Student;
}

export interface Conversation {
  id: string;
  parentId: string;
  subject?: string | null;
  lastMessageAt: number;
  lastMessagePreview: string;
  unreadForParent: number;
  unreadForStaff: number;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderType: 'STAFF' | 'PARENT';
  senderName: string;
  body: string;
  createdAt: number;
}

export interface StaffInboxEntry {
  conversation: Conversation;
  parent: { id: string; fullName: string; email: string };
}

export interface PartnerBusiness {
  id: string;
  name: string;
  description?: string | null;
  category?: string | null;
  address?: string | null;
  logoUrl?: string | null;
  pointsReward: number;
  /** Only present on admin queries */
  qrSecret?: string;
  isActive: boolean;
}

export interface BusinessVisit {
  id: string;
  studentId: string;
  businessId: string;
  points: number;
  date: string;
  verifiedBy: 'PARENT_QR' | 'ADMIN';
  createdAt: number;
}

export interface SpecialTask {
  id: string;
  title: string;
  description: string;
  points: number;
  isActive: boolean;
  requiresProof: boolean;
}

export interface TaskSubmission {
  id: string;
  taskId: string;
  studentId: string;
  byParentId: string;
  note?: string | null;
  photoUrl?: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reviewedBy?: string | null;
  reviewedAt?: number | null;
  createdAt: number;
}

export interface Redemption {
  id: string;
  studentId: string;
  rewardKey: string;
  rewardName: string;
  rewardIcon: string;
  cost: number;
  status: 'PENDING' | 'FULFILLED' | 'CANCELLED';
  requestedVia: 'STUDENT' | 'PARENT';
  fulfilledBy?: string | null;
  fulfilledAt?: number | null;
  createdAt: number;
}

export interface TournamentMatch {
  id: string;
  tournamentId: string;
  roundNumber: number;
  matchNumber: number;
  participant1Id?: string;
  participant2Id?: string;
  winnerId?: string;
  score1?: number;
  score2?: number;
  status: MatchStatus;
  scheduledTime?: string;
  completedAt?: string;
  p1?: Student; // Joined view
  p2?: Student; // Joined view
}
