
import { GoogleGenAI, Type } from "@google/genai";
import { GeneratedGameIdea } from "../types";

export const generateGameIdeas = async (
  duration: number,
  intensity: 'Low' | 'Medium' | 'High'
): Promise<GeneratedGameIdea> => {

  // Robust check for API key availability
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey || apiKey === 'PLACEHOLDER_API_KEY') {
    console.warn("Gemini API Key missing or placeholder. Returning fallback content.");
    return {
      title: "Obstacle Course Relay",
      description: "A classic obstacle course where teams compete to finish fastest. Includes jumping jacks, crawling, and balancing.",
      suggestedDuration: duration || 10
    };
  }

  try {
    // Initialize inside function to avoid module-level crashes
    const ai = new GoogleGenAI({ apiKey });

    const prompt = `Create a fun, creative fitness game for children (ages 6-12) for a fitness academy.
    Duration: ${duration} minutes.
    Intensity: ${intensity}.
    Focus on teamwork and movement.
    Return ONLY JSON.`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            description: { type: Type.STRING },
            suggestedDuration: { type: Type.NUMBER },
          },
          required: ["title", "description", "suggestedDuration"]
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");

    return JSON.parse(text) as GeneratedGameIdea;

  } catch (error) {
    console.error("Gemini API Error:", error);
    return {
       title: "Tag (Offline Mode)",
       description: "Classic tag game. (AI currently unavailable)",
       suggestedDuration: 15
    }
  }
};

// ── Rank requirement parsing ─────────────────────────────────────────────────
// Turns a coach's free-text prompt (e.g. "3 Session Legends and 15 check-ins
// and 500 points") into the structured `criteria` shape used by ranks. Tries
// Gemini for natural language, then ALWAYS reconciles with a plain regex parser
// so it works with NO API key and when Gemini returns junk. Whatever comes back
// just PRE-FILLS editable fields the coach can correct — nothing is enforced
// until they review and save.

export interface ParsedRankCriteria {
  points?: number;
  xp?: number;
  checkIns?: number;
  medals?: Array<{ title: string; count: number }>;
  tasks?: Array<{ taskId: string; count: number }>;
}

// The existing special tasks, so a task NAME in the prompt maps to its id.
export interface KnownTask {
  id: string;
  title: string;
}

// Normalize a title for fuzzy comparison: lowercase, drop "medal"/"task" words
// and punctuation, collapse spaces, and gently de-pluralize each word end. The
// SAME normalization is applied to both sides so "Session Legends" matches a
// stored "Session Legend".
const normalizeTitle = (s: string): string =>
  s
    .toLowerCase()
    .replace(/\bmedals?\b|\btasks?\b/g, " ")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/([a-z0-9]{4,})s\b/g, "$1");

const matchKnownTask = (title: string, known: KnownTask[]): KnownTask | null => {
  const n = normalizeTitle(title);
  if (!n) return null;
  return known.find((k) => normalizeTitle(k.title) === n) ?? null;
};

// Any parsed medal whose title matches an existing special task is re-homed as a
// task requirement (with the resolved taskId); the rest stay medal requirements.
const reconcileTasks = (
  parsed: ParsedRankCriteria,
  known: KnownTask[]
): ParsedRankCriteria => {
  const out: ParsedRankCriteria = { ...parsed };
  if (!known.length) return out;
  const keptMedals: Array<{ title: string; count: number }> = [];
  const tasks: Array<{ taskId: string; count: number }> = out.tasks ? [...out.tasks] : [];
  for (const m of out.medals ?? []) {
    const hit = matchKnownTask(m.title, known);
    if (hit) tasks.push({ taskId: hit.id, count: m.count });
    else keptMedals.push(m);
  }
  out.medals = keptMedals.length ? keptMedals : undefined;
  out.tasks = tasks.length ? tasks : undefined;
  return out;
};

const titleCaseMedal = (clause: string): string => {
  let t = clause
    .replace(/\d[\d,]*/g, " ")
    .replace(
      /\b(x|times|of|the|a|an|earn|earned|get|got|need|needs|require[sd]?|reach|to|and|medals?|tasks?)\b/gi,
      " "
    )
    .replace(/[^A-Za-z0-9 '/-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!t) return "";
  // Gentle de-pluralize the final long word (Legends -> Legend).
  t = t.replace(/([A-Za-z]{4,})s\b/, "$1");
  return t
    .split(" ")
    .map((w) =>
      w.length <= 3 ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
    )
    .join(" ");
};

// Plain keyword/regex parser — no API needed. Splits on connectors and reads a
// number + a kind from each clause: "N points", "N xp", "N check-ins", or a
// leftover "N <name>" as a medal (later mapped to a task if the name matches).
export function parseCriteriaFallback(input: string): ParsedRankCriteria {
  const out: ParsedRankCriteria = {};
  const medals: Array<{ title: string; count: number }> = [];
  const clauses = (input || "")
    .split(/\band\b|&|,|;|\bplus\b|\n/gi)
    .map((c) => c.trim())
    .filter(Boolean);
  for (const clause of clauses) {
    const numMatch = clause.match(/\d[\d,]*/);
    if (!numMatch) continue;
    const num = parseInt(numMatch[0].replace(/,/g, ""), 10);
    if (!Number.isFinite(num) || num <= 0) continue;
    const lower = clause.toLowerCase();
    if (/\bxp\b/.test(lower)) {
      out.xp = num;
    } else if (/check[\s-]?in|\bvisit|\bday|\battendance/.test(lower)) {
      out.checkIns = num;
    } else if (/\bpoint|\bpts\b/.test(lower)) {
      out.points = num;
    } else {
      const title = titleCaseMedal(clause);
      if (title) medals.push({ title, count: num });
    }
  }
  if (medals.length) out.medals = medals;
  return out;
}

const toPositiveInt = (v: unknown): number | undefined =>
  typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.round(v) : undefined;

// Coerce arbitrary AI JSON into a safe ParsedRankCriteria (numbers rounded,
// non-positive/invalid dropped, medals need a title).
function sanitizeCriteria(raw: unknown): ParsedRankCriteria {
  const out: ParsedRankCriteria = {};
  if (!raw || typeof raw !== "object") return out;
  const r = raw as Record<string, unknown>;
  const p = toPositiveInt(r.points);
  if (p) out.points = p;
  const x = toPositiveInt(r.xp);
  if (x) out.xp = x;
  const c = toPositiveInt(r.checkIns ?? (r as any).checkins ?? (r as any).check_ins);
  if (c) out.checkIns = c;
  if (Array.isArray(r.medals)) {
    const medals = (r.medals as unknown[])
      .map((m) => {
        const mm = (m ?? {}) as Record<string, unknown>;
        return { title: String(mm.title ?? "").trim(), count: toPositiveInt(mm.count) ?? 1 };
      })
      .filter((m) => m.title.length > 0);
    if (medals.length) out.medals = medals;
  }
  return out;
}

const isEmptyCriteria = (c: ParsedRankCriteria): boolean =>
  c.points === undefined &&
  c.xp === undefined &&
  c.checkIns === undefined &&
  !(c.medals && c.medals.length) &&
  !(c.tasks && c.tasks.length);

export const parseRankCriteria = async (
  prompt: string,
  knownTasks: KnownTask[] = []
): Promise<ParsedRankCriteria> => {
  const fallback = reconcileTasks(parseCriteriaFallback(prompt), knownTasks);

  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey || apiKey === "PLACEHOLDER_API_KEY") return fallback;

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `You configure promotion requirements for a kids' fitness rank.
Extract ONLY what the coach states into JSON — never invent values.
Fields: points (number of points), xp (total XP), checkIns (number of distinct
check-in days), medals (array of { title, count } for coach-awarded accolades
like "Session Legend", "MVP", "Hustle"). Omit anything not mentioned.
Return ONLY JSON.

Coach text: "${prompt}"`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            points: { type: Type.NUMBER },
            xp: { type: Type.NUMBER },
            checkIns: { type: Type.NUMBER },
            medals: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  count: { type: Type.NUMBER },
                },
              },
            },
          },
        },
      },
    });

    const text = response.text;
    if (!text) return fallback;
    const reconciled = reconcileTasks(sanitizeCriteria(JSON.parse(text)), knownTasks);
    return isEmptyCriteria(reconciled) ? fallback : reconciled;
  } catch (error) {
    console.warn("parseRankCriteria: Gemini unavailable, using regex fallback", error);
    return fallback;
  }
};
