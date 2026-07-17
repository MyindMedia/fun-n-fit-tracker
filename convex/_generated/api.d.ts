/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as activity from "../activity.js";
import type * as avatar from "../avatar.js";
import type * as blog from "../blog.js";
import type * as catalog from "../catalog.js";
import type * as celebrations from "../celebrations.js";
import type * as checkins from "../checkins.js";
import type * as clerkBridge from "../clerkBridge.js";
import type * as email from "../email.js";
import type * as events from "../events.js";
import type * as files from "../files.js";
import type * as fitTokens from "../fitTokens.js";
import type * as games from "../games.js";
import type * as gear from "../gear.js";
import type * as helpers from "../helpers.js";
import type * as houses from "../houses.js";
import type * as http from "../http.js";
import type * as invites from "../invites.js";
import type * as jackpot from "../jackpot.js";
import type * as lootBoxes from "../lootBoxes.js";
import type * as market from "../market.js";
import type * as medals from "../medals.js";
import type * as messaging from "../messaging.js";
import type * as migration from "../migration.js";
import type * as nfc from "../nfc.js";
import type * as parents from "../parents.js";
import type * as partners from "../partners.js";
import type * as points from "../points.js";
import type * as portalAccess from "../portalAccess.js";
import type * as push from "../push.js";
import type * as pushNode from "../pushNode.js";
import type * as redemptions from "../redemptions.js";
import type * as resets from "../resets.js";
import type * as scanlog from "../scanlog.js";
import type * as seasons from "../seasons.js";
import type * as seed from "../seed.js";
import type * as settings from "../settings.js";
import type * as specialTasks from "../specialTasks.js";
import type * as staff from "../staff.js";
import type * as students from "../students.js";
import type * as tournaments from "../tournaments.js";
import type * as trades from "../trades.js";
import type * as volt from "../volt.js";
import type * as wearables from "../wearables.js";
import type * as xp from "../xp.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  activity: typeof activity;
  avatar: typeof avatar;
  blog: typeof blog;
  catalog: typeof catalog;
  celebrations: typeof celebrations;
  checkins: typeof checkins;
  clerkBridge: typeof clerkBridge;
  email: typeof email;
  events: typeof events;
  files: typeof files;
  fitTokens: typeof fitTokens;
  games: typeof games;
  gear: typeof gear;
  helpers: typeof helpers;
  houses: typeof houses;
  http: typeof http;
  invites: typeof invites;
  jackpot: typeof jackpot;
  lootBoxes: typeof lootBoxes;
  market: typeof market;
  medals: typeof medals;
  messaging: typeof messaging;
  migration: typeof migration;
  nfc: typeof nfc;
  parents: typeof parents;
  partners: typeof partners;
  points: typeof points;
  portalAccess: typeof portalAccess;
  push: typeof push;
  pushNode: typeof pushNode;
  redemptions: typeof redemptions;
  resets: typeof resets;
  scanlog: typeof scanlog;
  seasons: typeof seasons;
  seed: typeof seed;
  settings: typeof settings;
  specialTasks: typeof specialTasks;
  staff: typeof staff;
  students: typeof students;
  tournaments: typeof tournaments;
  trades: typeof trades;
  volt: typeof volt;
  wearables: typeof wearables;
  xp: typeof xp;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
