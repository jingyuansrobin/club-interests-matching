import { createClient } from "npm:@supabase/supabase-js@2";

type ScoreMap = Record<string, number | null | undefined>;
type AvailabilityGrid = Record<string, number | null | undefined>;
type Preference = { ideal?: number | null; tolerance?: number | null; hard?: boolean };
type PreferenceMap = Record<string, Preference | undefined>;

type V1Profile = {
  user_id: string;
  display_name: string;
  intro: string | null;
  interests: string[] | null;
  pace: string | null;
  availability: string[] | null;
  duration: string | null;
  group_size: string | null;
  collaboration: string | null;
  roles: string[] | null;
  communication: string | null;
  research: string | null;
  session_style: string | null;
  resource_style: string | null;
  experience_style: string | null;
  discoverable: boolean;
};

type V2Profile = {
  user_id: string;
  profile_version: number;
  interest_scores: ScoreMap;
  current_intents: string[];
  intent_updated_at: string | null;
  availability_grid: AvailabilityGrid;
  availability_randomness: number | null;
  playstyle_preferences: PreferenceMap;
  role_preferences: ScoreMap;
  boundary_preferences: Record<string, Preference | undefined>;
  learning_preferences: ScoreMap;
};

type ModuleScore = {
  score: number;
  coverage: number;
  reasons: { text: string; strength: number }[];
};

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MODULE_WEIGHTS = {
  intent: 0.25,
  interests: 0.18,
  availability: 0.22,
  playstyle: 0.15,
  roles: 0.10,
  boundaries: 0.07,
  learning: 0.03,
} as const;

const INTEREST_LABELS: Record<string, string> = {
  tech: "科技整合包",
  vanilla: "原版 / 类原版",
  building: "建筑 / 景观",
  redstone: "红石 / 自动化",
  magic: "魔法模组",
  adventure: "冒险 / RPG",
  challenge: "高难 / 专家包",
  minigame: "小游戏 / 派对玩法",
  pvp: "PVP / 对抗",
  development: "Mod / 服务端开发",
  social: "社交玩法",
};

const SLOT_LABELS: Record<string, string> = {
  mon_morning: "周一上午", mon_afternoon: "周一下午", mon_evening: "周一晚上", mon_late: "周一深夜",
  tue_morning: "周二上午", tue_afternoon: "周二下午", tue_evening: "周二晚上", tue_late: "周二深夜",
  wed_morning: "周三上午", wed_afternoon: "周三下午", wed_evening: "周三晚上", wed_late: "周三深夜",
  thu_morning: "周四上午", thu_afternoon: "周四下午", thu_evening: "周四晚上", thu_late: "周四深夜",
  fri_morning: "周五上午", fri_afternoon: "周五下午", fri_evening: "周五晚上", fri_late: "周五深夜",
  sat_morning: "周六上午", sat_afternoon: "周六下午", sat_evening: "周六晚上", sat_late: "周六深夜",
  sun_morning: "周日上午", sun_afternoon: "周日下午", sun_evening: "周日晚上", sun_late: "周日深夜",
};

const RELATED_INTERESTS: Record<string, Record<string, number>> = {
  tech: { redstone: 0.55, challenge: 0.45, development: 0.35 },
  redstone: { tech: 0.55, building: 0.30 },
  adventure: { magic: 0.50, challenge: 0.45, vanilla: 0.25 },
  magic: { adventure: 0.50, tech: 0.20 },
  building: { vanilla: 0.40, redstone: 0.30 },
  vanilla: { building: 0.40, adventure: 0.25 },
  challenge: { tech: 0.45, adventure: 0.45 },
  development: { tech: 0.35, redstone: 0.20 },
  minigame: { pvp: 0.25 },
  pvp: { minigame: 0.25 },
};

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const numericEntries = (map: ScoreMap | AvailabilityGrid | undefined | null) =>
  Object.entries(map ?? {}).filter(([, value]) => typeof value === "number") as [string, number][];

function intentFreshness(updatedAt: string | null | undefined) {
  if (!updatedAt) return 0.65;
  const ageDays = Math.max(0, (Date.now() - new Date(updatedAt).getTime()) / 86_400_000);
  if (ageDays <= 14) return 1;
  if (ageDays >= 30) return 0;
  return 1 - ((ageDays - 14) / 16);
}

function scoreIntent(a: V2Profile, b: V2Profile): ModuleScore | null {
  const aIntents = a.current_intents ?? [];
  const bIntents = b.current_intents ?? [];
  if (!aIntents.length && !bIntents.length) return null;

  const readiness = (intents: string[], other: V2Profile, intentFresh: number) => {
    if (!intents.length) return null;
    let total = 0;
    for (const key of intents) {
      const sameIntent = other.current_intents?.includes(key) ? intentFreshness(other.intent_updated_at) : 0;
      const interest = typeof other.interest_scores?.[key] === "number"
        ? clamp01(Number(other.interest_scores[key]) / 4)
        : 0.45;
      total += Math.max(sameIntent, interest);
    }
    return (total / intents.length) * intentFresh;
  };

  const directions = [
    readiness(aIntents, b, intentFreshness(a.intent_updated_at)),
    readiness(bIntents, a, intentFreshness(b.intent_updated_at)),
  ].filter((value): value is number => value !== null);
  if (!directions.length) return null;

  const shared = aIntents.filter((key) => bIntents.includes(key));
  const reasons = shared.length
    ? [{ text: `最近都想玩${INTEREST_LABELS[shared[0]] ?? shared[0]}`, strength: 1 }]
    : [];

  return {
    score: clamp01(directions.reduce((sum, value) => sum + value, 0) / directions.length),
    coverage: aIntents.length && bIntents.length ? 1 : 0.68,
    reasons,
  };
}

function scoreInterests(a: ScoreMap, b: ScoreMap, quality = 1): ModuleScore | null {
  const aEntries = numericEntries(a);
  const bEntries = numericEntries(b);
  const bMap = new Map(bEntries);
  const shared = aEntries.filter(([key]) => bMap.has(key));
  if (!shared.length) return null;

  let weightedScore = 0;
  let weightTotal = 0;
  const common: { key: string; shared: number }[] = [];

  for (const [key, aValue] of shared) {
    const bValue = bMap.get(key)!;
    const importance = 0.6 + Math.max(aValue, bValue) / 4;
    const direct = Math.min(aValue, bValue) / 4;
    weightedScore += direct * importance;
    weightTotal += importance;
    common.push({ key, shared: direct });
  }

  let related = 0;
  let relatedWeight = 0;
  for (const [aKey, aValue] of aEntries) {
    for (const [bKey, bValue] of bEntries) {
      if (aKey === bKey) continue;
      const affinity = RELATED_INTERESTS[aKey]?.[bKey] ?? 0;
      if (!affinity) continue;
      related += (Math.min(aValue, bValue) / 4) * affinity;
      relatedWeight += affinity;
    }
  }

  const directScore = weightTotal ? weightedScore / weightTotal : 0;
  const relatedScore = relatedWeight ? related / relatedWeight : 0;
  const score = clamp01(directScore * 0.86 + relatedScore * 0.14);
  const denominator = Math.max(2, Math.min(Math.max(aEntries.length, bEntries.length), 8));
  const coverage = clamp01((shared.length / denominator) * quality);
  common.sort((x, y) => y.shared - x.shared);

  const reasons = common
    .filter((item) => item.shared >= 0.5)
    .slice(0, 1)
    .map((item) => ({
      text: `都对${INTEREST_LABELS[item.key] ?? item.key}有明显兴趣`,
      strength: item.shared,
    }));

  return { score, coverage, reasons };
}

function scoreAvailability(a: AvailabilityGrid, b: AvailabilityGrid, quality = 1): ModuleScore | null {
  const aPositive = numericEntries(a).filter(([, value]) => value > 0);
  const bPositive = numericEntries(b).filter(([, value]) => value > 0);
  if (!aPositive.length || !bPositive.length) return null;

  const bMap = new Map(bPositive);
  let overlap = 0;
  let sumA = 0;
  const sumB = bPositive.reduce((sum, [, value]) => sum + value, 0);
  const commonSlots: { key: string; strength: number }[] = [];

  for (const [key, aValue] of aPositive) {
    sumA += aValue;
    const bValue = bMap.get(key) ?? 0;
    const shared = Math.min(aValue, bValue);
    overlap += shared;
    if (shared > 0) commonSlots.push({ key, strength: shared });
  }

  const busyCoverage = overlap / Math.max(1, Math.min(sumA, sumB));
  const breadth = Math.min(1, commonSlots.length / 4);
  const score = clamp01(busyCoverage * 0.8 + breadth * 0.2);
  commonSlots.sort((x, y) => y.strength - x.strength);
  const labels = commonSlots.slice(0, 2).map((item) => SLOT_LABELS[item.key] ?? item.key);
  const reasons = labels.length
    ? [{ text: labels.length > 1 ? `${labels.join("、")}经常能碰到一起` : `${labels[0]}比较容易同时在线`, strength: score }]
    : [];

  return {
    score,
    coverage: clamp01((0.65 + Math.min(0.35, commonSlots.length * 0.08)) * quality),
    reasons,
  };
}

function preferenceScore(a?: Preference, b?: Preference) {
  if (typeof a?.ideal !== "number" || typeof b?.ideal !== "number") return null;
  const distance = Math.abs(a.ideal - b.ideal);
  const aTolerance = a.ideal === 2 ? Math.max(2, a.tolerance ?? 0) : (a.tolerance ?? 0);
  const bTolerance = b.ideal === 2 ? Math.max(2, b.tolerance ?? 0) : (b.tolerance ?? 0);
  const toleranceBuffer = (aTolerance + bTolerance) * 0.5;
  const effectiveDistance = Math.max(0, distance - toleranceBuffer);
  return clamp01(1 - effectiveDistance / 4);
}

function scorePlaystyle(a: PreferenceMap, b: PreferenceMap, quality = 1): ModuleScore | null {
  const labels: Record<string, string> = {
    paceIntensity: "推进节奏",
    collabSynchrony: "一起行动的习惯",
    collabDivision: "分工方式",
    sessionPlanning: "约局方式",
    resourceSharing: "资源共享习惯",
  };
  const keys = Object.keys(labels);
  const values: { key: string; score: number }[] = [];
  for (const key of keys) {
    const score = preferenceScore(a?.[key], b?.[key]);
    if (score !== null) values.push({ key, score });
  }
  if (!values.length) return null;
  const score = values.reduce((sum, item) => sum + item.score, 0) / values.length;
  const best = [...values].sort((x, y) => y.score - x.score)[0];
  return {
    score,
    coverage: clamp01((values.length / 3) * quality),
    reasons: best && best.score >= 0.72
      ? [{ text: `${labels[best.key]}比较接近`, strength: best.score * 0.85 }]
      : [],
  };
}

function scoreRoles(a: ScoreMap, b: ScoreMap, quality = 1): ModuleScore | null {
  const keys = new Set([...Object.keys(a ?? {}), ...Object.keys(b ?? {})]);
  const values: { key: string; team: number; joint: number; complement: number }[] = [];
  for (const key of keys) {
    const av = typeof a?.[key] === "number" ? Number(a[key]) : null;
    const bv = typeof b?.[key] === "number" ? Number(b[key]) : null;
    if (av === null || bv === null) continue;
    const team = Math.max(av, bv) / 2;
    const joint = Math.min(av, bv) / 2;
    const complement = Math.abs(av - bv) / 2 * team;
    values.push({ key, team, joint, complement });
  }
  if (!values.length) return null;
  const teamCoverage = values.reduce((sum, item) => sum + item.team, 0) / values.length;
  const joint = values.reduce((sum, item) => sum + item.joint, 0) / values.length;
  const complement = values.reduce((sum, item) => sum + item.complement, 0) / values.length;
  const score = clamp01(teamCoverage * 0.55 + complement * 0.30 + joint * 0.15);
  const bestComplement = [...values].sort((x, y) => y.complement - x.complement)[0];
  const roleLabels: Record<string, string> = {
    planner: "规划", technical: "技术", builder: "建筑", gatherer: "资源",
    explorer: "探索", combat: "战斗", logistics: "后勤", organizer: "组织",
  };
  return {
    score,
    coverage: clamp01((values.length / 4) * quality),
    reasons: bestComplement?.complement >= 0.7
      ? [{ text: `队伍角色在${roleLabels[bestComplement.key] ?? bestComplement.key}方向比较互补`, strength: bestComplement.complement * 0.8 }]
      : [],
  };
}

function scoreLearning(a: ScoreMap, b: ScoreMap, quality = 1): ModuleScore | null {
  const aTeach = typeof a?.teach === "number" ? Number(a.teach) : null;
  const aLearn = typeof a?.learn === "number" ? Number(a.learn) : null;
  const bTeach = typeof b?.teach === "number" ? Number(b.teach) : null;
  const bLearn = typeof b?.learn === "number" ? Number(b.learn) : null;
  const pairs: number[] = [];
  if (aTeach !== null && bLearn !== null) pairs.push(1 - Math.abs(aTeach - bLearn) / 4);
  if (bTeach !== null && aLearn !== null) pairs.push(1 - Math.abs(bTeach - aLearn) / 4);
  if (!pairs.length) return null;
  return {
    score: clamp01(pairs.reduce((sum, value) => sum + value, 0) / pairs.length),
    coverage: clamp01((pairs.length / 2) * quality),
    reasons: [],
  };
}

function v1InterestScores(profile: V1Profile): ScoreMap {
  return Object.fromEntries((profile.interests ?? []).map((key) => [key, 3]));
}

function v1RoleScores(profile: V1Profile): ScoreMap {
  return Object.fromEntries((profile.roles ?? []).map((key) => [key, 2]));
}

function v1Playstyle(profile: V1Profile): PreferenceMap {
  const result: PreferenceMap = {};
  const pace: Record<string, Preference> = {
    hardcore: { ideal: 4, tolerance: 0 },
    steady: { ideal: 3, tolerance: 1 },
    burst: { ideal: 3, tolerance: 1 },
    casual: { ideal: 0, tolerance: 1 },
    adaptive: { ideal: 2, tolerance: 2 },
  };
  if (profile.pace && pace[profile.pace]) result.paceIntensity = pace[profile.pace];

  if (profile.collaboration === "together") result.collabSynchrony = { ideal: 0, tolerance: 0 };
  if (profile.collaboration === "independent") result.collabSynchrony = { ideal: 4, tolerance: 1 };
  if (profile.collaboration === "divide") result.collabDivision = { ideal: 4, tolerance: 0 };
  if (profile.collaboration === "flexible") {
    result.collabSynchrony = { ideal: 2, tolerance: 2 };
    result.collabDivision = { ideal: 2, tolerance: 2 };
  }
  return result;
}

function aggregateV2ToV1Availability(grid: AvailabilityGrid) {
  const tags = new Set<string>();
  for (const [key, value] of numericEntries(grid)) {
    if (value <= 0) continue;
    if (key.startsWith("sat_") || key.startsWith("sun_")) {
      if (key.endsWith("_morning") || key.endsWith("_afternoon")) tags.add("weekend_day");
      if (key.endsWith("_evening")) tags.add("weekend_evening");
      if (key.endsWith("_late")) tags.add("late_night");
    } else {
      // V1 had no weekday-morning category, so do not fabricate one during bridge scoring.
      if (key.endsWith("_afternoon")) tags.add("weekday_afternoon");
      if (key.endsWith("_evening")) tags.add("weekday_evening");
      if (key.endsWith("_late")) tags.add("late_night");
    }
  }
  return tags;
}

function scoreV1Availability(v2Grid: AvailabilityGrid, v1Tags: string[] | null): ModuleScore | null {
  const tags = v1Tags ?? [];
  if (!tags.length) return null;
  if (tags.includes("random")) {
    return { score: 0.62, coverage: 0.35, reasons: [{ text: "TA 的上线时间较随机，但仍有临时约局空间", strength: 0.45 }] };
  }
  const own = aggregateV2ToV1Availability(v2Grid);
  if (!own.size) return null;
  const overlap = tags.filter((tag) => own.has(tag));
  const score = overlap.length / Math.max(1, Math.min(tags.length, own.size));
  return {
    score: clamp01(score),
    coverage: 0.52,
    reasons: overlap.length ? [{ text: "常见上线时间段有重合", strength: score * 0.7 }] : [],
  };
}

function asV2Bridge(profile: V1Profile): V2Profile {
  return {
    user_id: profile.user_id,
    profile_version: 1,
    interest_scores: v1InterestScores(profile),
    current_intents: [],
    intent_updated_at: null,
    availability_grid: {},
    availability_randomness: profile.availability?.includes("random") ? 4 : null,
    playstyle_preferences: v1Playstyle(profile),
    role_preferences: v1RoleScores(profile),
    boundary_preferences: {},
    learning_preferences: {},
  };
}

function scoreCandidate(own: V2Profile, candidate: V2Profile, candidateV1: V1Profile, isV2: boolean) {
  const quality = isV2 ? 1 : 0.62;
  const modules: Partial<Record<keyof typeof MODULE_WEIGHTS, ModuleScore>> = {};

  const intent = scoreIntent(own, candidate);
  if (intent) modules.intent = { ...intent, coverage: intent.coverage * quality };

  const interests = scoreInterests(own.interest_scores, candidate.interest_scores, quality);
  if (interests) modules.interests = interests;

  let availability: ModuleScore | null;
  if (isV2) availability = scoreAvailability(own.availability_grid, candidate.availability_grid, quality);
  else availability = scoreV1Availability(own.availability_grid, candidateV1.availability);
  if (availability) modules.availability = availability;

  const playstyle = scorePlaystyle(own.playstyle_preferences, candidate.playstyle_preferences, quality);
  if (playstyle) modules.playstyle = playstyle;

  const roles = scoreRoles(own.role_preferences, candidate.role_preferences, quality);
  if (roles) modules.roles = roles;

  const learning = scoreLearning(own.learning_preferences, candidate.learning_preferences, quality);
  if (learning) modules.learning = learning;

  let scoreNumerator = 0;
  let scoreDenominator = 0;
  let confidence = 0;
  const reasons: { text: string; strength: number }[] = [];

  for (const [key, weight] of Object.entries(MODULE_WEIGHTS) as [keyof typeof MODULE_WEIGHTS, number][]) {
    const module = modules[key];
    if (!module) continue;
    const effectiveWeight = weight * Math.max(0.2, module.coverage);
    scoreNumerator += module.score * effectiveWeight;
    scoreDenominator += effectiveWeight;
    confidence += weight * module.coverage;
    reasons.push(...module.reasons.map((reason) => ({ ...reason, strength: reason.strength * weight })));
  }

  if (!scoreDenominator) return null;
  const compatibility = clamp01(scoreNumerator / scoreDenominator);
  const confidenceClamped = clamp01(confidence);
  const ranking = 0.5 + (compatibility - 0.5) * (0.35 + 0.65 * confidenceClamped);

  reasons.sort((a, b) => b.strength - a.strength);
  const uniqueReasons: string[] = [];
  for (const reason of reasons) {
    if (!uniqueReasons.includes(reason.text)) uniqueReasons.push(reason.text);
    if (uniqueReasons.length >= 3) break;
  }

  return {
    compatibility: Math.round(compatibility * 100),
    confidence: Math.round(confidenceClamped * 100),
    ranking,
    reasons: uniqueReasons.length ? uniqueReasons : ["当前画像存在可继续了解的共同点"],
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) throw new Error("Missing auth token");

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userError } = await admin.auth.getUser(token);
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const userId = userData.user.id;
    const { data: ownRow, error: ownError } = await admin
      .from("member_match_profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (ownError) throw ownError;
    if (!ownRow || numericEntries((ownRow as V2Profile).interest_scores).length < 1) {
      return new Response(JSON.stringify({ matches: [], profileReady: false }), {
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }
    const own = ownRow as V2Profile;

    const [profilesResult, v2Result, contactsResult] = await Promise.all([
      admin.from("member_profiles").select(
        "user_id, display_name, intro, interests, pace, availability, duration, group_size, collaboration, roles, communication, research, session_style, resource_style, experience_style, discoverable"
      ),
      admin.from("member_match_profiles").select("*"),
      admin.from("member_contacts").select("user_id, qq, show_qq").eq("show_qq", true),
    ]);
    if (profilesResult.error) throw profilesResult.error;
    if (v2Result.error) throw v2Result.error;
    if (contactsResult.error) throw contactsResult.error;

    const profiles = (profilesResult.data ?? []) as V1Profile[];
    const v2Map = new Map(((v2Result.data ?? []) as V2Profile[]).map((row) => [row.user_id, row]));
    const qqMap = new Map((contactsResult.data ?? []).map((row) => [row.user_id, row.qq as string]));

    const matches = profiles
      .filter((profile) => profile.user_id !== userId)
      .map((profile) => {
        const v2 = v2Map.get(profile.user_id);
        const positiveV2Interest = v2
          ? numericEntries(v2.interest_scores).some(([, value]) => value > 0)
          : false;
        if (!profile.discoverable && !positiveV2Interest) return null;
        const candidate = v2 ?? asV2Bridge(profile);
        const result = scoreCandidate(own, candidate, profile, Boolean(v2));
        if (!result) return null;
        return {
          id: profile.user_id,
          name: profile.display_name,
          intro: profile.intro?.trim() || "Minecraft 社团成员",
          qq: qqMap.get(profile.user_id),
          score: result.compatibility,
          confidence: result.confidence,
          ranking: result.ranking,
          reasons: result.reasons,
          profileVersion: v2 ? 2 : 1,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .sort((a, b) => b.ranking - a.ranking)
      .slice(0, 12)
      .map(({ ranking: _ranking, ...item }) => item);

    return new Response(JSON.stringify({ matches, profileReady: true }), {
      headers: { ...CORS, "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
