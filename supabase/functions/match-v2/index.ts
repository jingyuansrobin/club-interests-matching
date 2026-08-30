import { createClient } from "npm:@supabase/supabase-js@2";

type ScoreMap = Record<string, number | null | undefined>;
type AvailabilityGrid = Record<string, number | null | undefined>;
type Preference = { ideal?: number | null; tolerance?: number | null; hard?: boolean };
type PreferenceMap = Record<string, Preference | undefined>;
type EnrichmentModule = "team" | "communication" | "resource" | "roles" | "learning";

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
  boundary_preferences: PreferenceMap;
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
  tech: "科技整合包", vanilla: "原版 / 类原版", building: "建筑 / 景观", redstone: "红石 / 自动化",
  magic: "魔法模组", adventure: "冒险 / RPG", challenge: "高难 / 专家包", minigame: "小游戏 / 派对玩法",
  pvp: "PVP / 对抗", development: "Mod / 服务端开发", social: "社交玩法",
};

const SLOT_LABELS: Record<string, string> = {};
for (const [day, dayLabel] of Object.entries({ mon: "周一", tue: "周二", wed: "周三", thu: "周四", fri: "周五", sat: "周六", sun: "周日" })) {
  for (const [bucket, bucketLabel] of Object.entries({ morning: "上午", afternoon: "下午", evening: "晚上", late: "深夜" })) {
    SLOT_LABELS[`${day}_${bucket}`] = `${dayLabel}${bucketLabel}`;
  }
}

const RELATED_INTERESTS: Record<string, Record<string, number>> = {
  tech: { redstone: 0.55, challenge: 0.45, development: 0.35 }, redstone: { tech: 0.55, building: 0.30 },
  adventure: { magic: 0.50, challenge: 0.45, vanilla: 0.25 }, magic: { adventure: 0.50, tech: 0.20 },
  building: { vanilla: 0.40, redstone: 0.30 }, vanilla: { building: 0.40, adventure: 0.25 },
  challenge: { tech: 0.45, adventure: 0.45 }, development: { tech: 0.35, redstone: 0.20 },
  minigame: { pvp: 0.25 }, pvp: { minigame: 0.25 },
};

const BOUNDARY_LABELS: Record<string, string> = {
  groupSize: "队伍规模", duration: "存档周期", voice: "语音习惯", asyncProgress: "异步推进习惯",
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
  const readiness = (intents: string[], other: V2Profile, freshness: number) => {
    if (!intents.length) return null;
    let total = 0;
    for (const key of intents) {
      const sameIntent = other.current_intents?.includes(key) ? intentFreshness(other.intent_updated_at) : 0;
      const interest = typeof other.interest_scores?.[key] === "number" ? clamp01(Number(other.interest_scores[key]) / 4) : 0.45;
      total += Math.max(sameIntent, interest);
    }
    return (total / intents.length) * freshness;
  };
  const directions = [readiness(aIntents, b, intentFreshness(a.intent_updated_at)), readiness(bIntents, a, intentFreshness(b.intent_updated_at))]
    .filter((value): value is number => value !== null);
  if (!directions.length) return null;
  const shared = aIntents.filter((key) => bIntents.includes(key));
  return {
    score: clamp01(directions.reduce((sum, value) => sum + value, 0) / directions.length),
    coverage: aIntents.length && bIntents.length ? 1 : 0.68,
    reasons: shared.length ? [{ text: `最近都想玩${INTEREST_LABELS[shared[0]] ?? shared[0]}`, strength: 1 }] : [],
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
  return {
    score,
    coverage,
    reasons: common.filter((item) => item.shared >= 0.5).slice(0, 1).map((item) => ({
      text: `都对${INTEREST_LABELS[item.key] ?? item.key}有明显兴趣`, strength: item.shared,
    })),
  };
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
  return {
    score,
    coverage: clamp01((0.65 + Math.min(0.35, commonSlots.length * 0.08)) * quality),
    reasons: labels.length ? [{ text: labels.length > 1 ? `${labels.join("、")}经常能碰到一起` : `${labels[0]}比较容易同时在线`, strength: score }] : [],
  };
}

function preferenceScore(a?: Preference, b?: Preference) {
  if (typeof a?.ideal !== "number" || typeof b?.ideal !== "number") return null;
  const distance = Math.abs(a.ideal - b.ideal);
  const toleranceBuffer = ((a.tolerance ?? 0) + (b.tolerance ?? 0)) * 0.5;
  return clamp01(1 - Math.max(0, distance - toleranceBuffer) / 4);
}

function hasHardConflict(a: PreferenceMap, b: PreferenceMap) {
  for (const key of new Set([...Object.keys(a ?? {}), ...Object.keys(b ?? {})])) {
    const av = a?.[key];
    const bv = b?.[key];
    if (typeof av?.ideal !== "number" || typeof bv?.ideal !== "number") continue;
    if (av.hard && Math.abs(av.ideal - bv.ideal) > (av.tolerance ?? 0)) return true;
    if (bv.hard && Math.abs(av.ideal - bv.ideal) > (bv.tolerance ?? 0)) return true;
  }
  return false;
}

function scorePlaystyle(a: PreferenceMap, b: PreferenceMap, quality = 1): ModuleScore | null {
  const labels: Record<string, string> = {
    paceIntensity: "推进节奏", collabSynchrony: "一起行动的习惯", collabDivision: "分工方式",
    sessionPlanning: "约局方式", resourceSharing: "资源共享习惯",
  };
  const values: { key: string; score: number }[] = [];
  for (const key of Object.keys(labels)) {
    const score = preferenceScore(a?.[key], b?.[key]);
    if (score !== null) values.push({ key, score });
  }
  if (!values.length) return null;
  const score = values.reduce((sum, item) => sum + item.score, 0) / values.length;
  const best = [...values].sort((x, y) => y.score - x.score)[0];
  return {
    score,
    coverage: clamp01((values.length / 5) * quality),
    reasons: best && best.score >= 0.72 ? [{ text: `${labels[best.key]}比较接近`, strength: best.score * 0.85 }] : [],
  };
}

function scoreBoundaries(a: PreferenceMap, b: PreferenceMap, quality = 1): ModuleScore | null {
  const values: { key: string; score: number }[] = [];
  for (const key of Object.keys(BOUNDARY_LABELS)) {
    const score = preferenceScore(a?.[key], b?.[key]);
    if (score !== null) values.push({ key, score });
  }
  if (!values.length) return null;
  const score = values.reduce((sum, item) => sum + item.score, 0) / values.length;
  const best = [...values].sort((x, y) => y.score - x.score)[0];
  const worst = [...values].sort((x, y) => x.score - y.score)[0];
  const reasons = best?.score >= 0.78 ? [{ text: `${BOUNDARY_LABELS[best.key]}比较合拍`, strength: best.score * 0.8 }] : [];
  if (worst?.score <= 0.25) reasons.push({ text: `${BOUNDARY_LABELS[worst.key]}差异比较大`, strength: 0.25 });
  return { score, coverage: clamp01((values.length / 4) * quality), reasons };
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
  const best = [...values].sort((x, y) => y.complement - x.complement)[0];
  const labels: Record<string, string> = { planner: "规划", technical: "技术", builder: "建筑", gatherer: "资源", explorer: "探索", combat: "战斗", logistics: "后勤", organizer: "组织" };
  return {
    score,
    coverage: clamp01((values.length / 8) * quality),
    reasons: best?.complement >= 0.7 ? [{ text: `队伍角色在${labels[best.key] ?? best.key}方向比较互补`, strength: best.complement * 0.8 }] : [],
  };
}

function scoreLearning(a: ScoreMap, b: ScoreMap, quality = 1): ModuleScore | null {
  const pairs: number[] = [];
  const aTeach = typeof a?.teach === "number" ? Number(a.teach) : null;
  const aLearn = typeof a?.learn === "number" ? Number(a.learn) : null;
  const bTeach = typeof b?.teach === "number" ? Number(b.teach) : null;
  const bLearn = typeof b?.learn === "number" ? Number(b.learn) : null;
  if (aTeach !== null && bLearn !== null) pairs.push(1 - Math.abs(aTeach - bLearn) / 4);
  if (bTeach !== null && aLearn !== null) pairs.push(1 - Math.abs(bTeach - aLearn) / 4);
  const aResearch = typeof a?.researchIndependence === "number" ? Number(a.researchIndependence) : null;
  const bResearch = typeof b?.researchIndependence === "number" ? Number(b.researchIndependence) : null;
  if (aResearch !== null && bResearch !== null) pairs.push(1 - Math.abs(aResearch - bResearch) / 4);
  if (!pairs.length) return null;
  return { score: clamp01(pairs.reduce((sum, value) => sum + value, 0) / pairs.length), coverage: clamp01((pairs.length / 3) * quality), reasons: [] };
}

const pref = (ideal: number, tolerance = 1, hard = false): Preference => ({ ideal, tolerance, hard });

function v1InterestScores(profile: V1Profile): ScoreMap {
  return Object.fromEntries((profile.interests ?? []).map((key) => [key, 3]));
}

function v1RoleScores(profile: V1Profile): ScoreMap {
  return Object.fromEntries((profile.roles ?? []).map((key) => [key, 2]));
}

function v1Playstyle(profile: V1Profile): PreferenceMap {
  const result: PreferenceMap = {};
  const pace: Record<string, Preference> = {
    hardcore: pref(4, 0), steady: pref(3, 1), burst: pref(3, 1), casual: pref(0, 1), adaptive: pref(2, 2),
  };
  if (profile.pace && pace[profile.pace]) result.paceIntensity = pace[profile.pace];
  if (profile.collaboration === "together") result.collabSynchrony = pref(0, 0);
  if (profile.collaboration === "independent") result.collabSynchrony = pref(4, 1);
  if (profile.collaboration === "divide") result.collabDivision = pref(4, 0);
  if (profile.collaboration === "flexible") { result.collabSynchrony = pref(2, 2); result.collabDivision = pref(2, 2); }
  const session: Record<string, Preference> = { scheduled: pref(4, 1), ping: pref(1, 1), dropin: pref(0, 1), async: pref(2, 2), flexible: pref(2, 2) };
  if (profile.session_style && session[profile.session_style]) result.sessionPlanning = session[profile.session_style];
  const resource: Record<string, Preference> = { shared: pref(4, 0), core_shared: pref(3, 1), separate: pref(0, 0), flexible: pref(2, 2) };
  if (profile.resource_style && resource[profile.resource_style]) result.resourceSharing = resource[profile.resource_style];
  return result;
}

function v1Boundaries(profile: V1Profile): PreferenceMap {
  const result: PreferenceMap = {};
  const duration: Record<string, Preference> = { one_off: pref(0), short: pref(1), medium: pref(2), long: pref(3), very_long: pref(4), flexible: pref(2, 2) };
  if (profile.duration && duration[profile.duration]) result.duration = duration[profile.duration];
  const group: Record<string, Preference> = { duo: pref(0), small: pref(1), community: pref(4), parallel: pref(3, 2), flexible: pref(2, 2) };
  if (profile.group_size && group[profile.group_size]) result.groupSize = group[profile.group_size];
  const voice: Record<string, Preference> = { voice: pref(4), listen: pref(3), text: pref(1), optional: pref(2, 2), avoid: pref(0, 0) };
  if (profile.communication && voice[profile.communication]) result.voice = voice[profile.communication];
  if (profile.session_style === "async") result.asyncProgress = pref(4, 1);
  if (profile.session_style === "scheduled") result.asyncProgress = pref(0, 1);
  if (profile.session_style === "flexible") result.asyncProgress = pref(2, 2);
  return result;
}

function v1Learning(profile: V1Profile): ScoreMap {
  const result: ScoreMap = {};
  if (profile.research === "self") result.researchIndependence = 4;
  if (profile.research === "ask") result.researchIndependence = 1;
  if (profile.research === "together") result.researchIndependence = 2;
  if (profile.research === "guided") result.researchIndependence = 0;
  if (profile.experience_style === "teach") { result.teach = 4; result.learn = 1; }
  if (profile.experience_style === "learn") { result.teach = 1; result.learn = 4; }
  if (profile.experience_style === "peer") { result.teach = 2; result.learn = 2; }
  if (profile.experience_style === "mixed") { result.teach = 3; result.learn = 3; }
  return result;
}

function aggregateV2ToV1Availability(grid: AvailabilityGrid) {
  const tags = new Set<string>();
  for (const [key, value] of numericEntries(grid)) {
    if (value <= 0) continue;
    const weekend = key.startsWith("sat_") || key.startsWith("sun_");
    if (key.endsWith("_morning") || key.endsWith("_afternoon")) tags.add(weekend ? "weekend_day" : "weekday_afternoon");
    if (key.endsWith("_evening")) tags.add(weekend ? "weekend_evening" : "weekday_evening");
    if (key.endsWith("_late")) tags.add("late_night");
  }
  return tags;
}

function scoreV1Availability(v2Grid: AvailabilityGrid, v1Tags: string[] | null): ModuleScore | null {
  const tags = v1Tags ?? [];
  if (!tags.length) return null;
  if (tags.includes("random")) return { score: 0.62, coverage: 0.35, reasons: [{ text: "TA 的上线时间较随机，但仍有临时约局空间", strength: 0.45 }] };
  const own = aggregateV2ToV1Availability(v2Grid);
  if (!own.size) return null;
  const overlap = tags.filter((tag) => own.has(tag));
  const score = overlap.length / Math.max(1, Math.min(tags.length, own.size));
  return { score: clamp01(score), coverage: 0.52, reasons: overlap.length ? [{ text: "常见上线时间段有重合", strength: score * 0.7 }] : [] };
}

function asV2Bridge(profile: V1Profile): V2Profile {
  return {
    user_id: profile.user_id, profile_version: 1, interest_scores: v1InterestScores(profile), current_intents: [], intent_updated_at: null,
    availability_grid: {}, availability_randomness: profile.availability?.includes("random") ? 4 : null,
    playstyle_preferences: v1Playstyle(profile), role_preferences: v1RoleScores(profile), boundary_preferences: v1Boundaries(profile), learning_preferences: v1Learning(profile),
  };
}

function scoreCandidate(own: V2Profile, candidate: V2Profile, candidateV1: V1Profile, isV2: boolean) {
  const quality = isV2 ? 1 : 0.62;
  if (hasHardConflict(own.boundary_preferences, candidate.boundary_preferences)) return null;
  const modules: Partial<Record<keyof typeof MODULE_WEIGHTS, ModuleScore>> = {};
  const intent = scoreIntent(own, candidate); if (intent) modules.intent = { ...intent, coverage: intent.coverage * quality };
  const interests = scoreInterests(own.interest_scores, candidate.interest_scores, quality); if (interests) modules.interests = interests;
  const availability = isV2 ? scoreAvailability(own.availability_grid, candidate.availability_grid, quality) : scoreV1Availability(own.availability_grid, candidateV1.availability);
  if (availability) modules.availability = availability;
  const playstyle = scorePlaystyle(own.playstyle_preferences, candidate.playstyle_preferences, quality); if (playstyle) modules.playstyle = playstyle;
  const roles = scoreRoles(own.role_preferences, candidate.role_preferences, quality); if (roles) modules.roles = roles;
  const boundaries = scoreBoundaries(own.boundary_preferences, candidate.boundary_preferences, quality); if (boundaries) modules.boundaries = boundaries;
  const learning = scoreLearning(own.learning_preferences, candidate.learning_preferences, quality); if (learning) modules.learning = learning;

  let scoreNumerator = 0; let scoreDenominator = 0; let confidence = 0;
  const reasons: { text: string; strength: number }[] = [];
  for (const [key, weight] of Object.entries(MODULE_WEIGHTS) as [keyof typeof MODULE_WEIGHTS, number][]) {
    const module = modules[key]; if (!module) continue;
    const effectiveWeight = weight * Math.max(0.2, module.coverage);
    scoreNumerator += module.score * effectiveWeight; scoreDenominator += effectiveWeight; confidence += weight * module.coverage;
    reasons.push(...module.reasons.map((reason) => ({ ...reason, strength: reason.strength * weight })));
  }
  if (!scoreDenominator) return null;
  const compatibility = clamp01(scoreNumerator / scoreDenominator);
  const confidenceClamped = clamp01(confidence);
  const ranking = 0.5 + (compatibility - 0.5) * (0.35 + 0.65 * confidenceClamped);
  reasons.sort((a, b) => b.strength - a.strength);
  const uniqueReasons: string[] = [];
  for (const reason of reasons) { if (!uniqueReasons.includes(reason.text)) uniqueReasons.push(reason.text); if (uniqueReasons.length >= 3) break; }
  return { compatibility: Math.round(compatibility * 100), confidence: Math.round(confidenceClamped * 100), ranking, reasons: uniqueReasons.length ? uniqueReasons : ["当前画像存在可继续了解的共同点"] };
}

function moduleMissing(profile: V2Profile, module: EnrichmentModule) {
  if (module === "team") return !(typeof profile.boundary_preferences?.groupSize?.ideal === "number" && typeof profile.boundary_preferences?.duration?.ideal === "number");
  if (module === "communication") return !(typeof profile.boundary_preferences?.voice?.ideal === "number" && typeof profile.boundary_preferences?.asyncProgress?.ideal === "number" && typeof profile.playstyle_preferences?.sessionPlanning?.ideal === "number");
  if (module === "resource") return typeof profile.playstyle_preferences?.resourceSharing?.ideal !== "number";
  if (module === "roles") return numericEntries(profile.role_preferences).length < 4;
  return !(typeof profile.learning_preferences?.teach === "number" && typeof profile.learning_preferences?.learn === "number" && typeof profile.learning_preferences?.researchIndependence === "number");
}

function valuesForModule(profile: V2Profile, module: EnrichmentModule): number[] {
  const pickPrefs = (map: PreferenceMap, keys: string[]) => keys.map((key) => map?.[key]?.ideal).filter((v): v is number => typeof v === "number");
  if (module === "team") return pickPrefs(profile.boundary_preferences, ["groupSize", "duration"]);
  if (module === "communication") return [...pickPrefs(profile.boundary_preferences, ["voice", "asyncProgress"]), ...pickPrefs(profile.playstyle_preferences, ["sessionPlanning"])];
  if (module === "resource") return pickPrefs(profile.playstyle_preferences, ["resourceSharing"]);
  if (module === "roles") return numericEntries(profile.role_preferences).map(([, value]) => value * 2);
  return numericEntries(profile.learning_preferences).map(([, value]) => value);
}

function dispersion(profiles: V2Profile[], module: EnrichmentModule) {
  const values = profiles.flatMap((profile) => valuesForModule(profile, module));
  if (values.length < 2) return 0.35;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return clamp01(Math.sqrt(variance) / 2);
}

function chooseNextModule(own: V2Profile, candidates: V2Profile[]) {
  const base: Record<EnrichmentModule, number> = { communication: 1, team: 0.95, roles: 0.9, resource: 0.75, learning: 0.55 };
  const modules = (Object.keys(base) as EnrichmentModule[]).filter((module) => moduleMissing(own, module));
  if (!modules.length) return {};
  const scored = modules.map((module) => ({ module, score: base[module] * (0.75 + dispersion(candidates, module) * 0.25) })).sort((a, b) => b.score - a.score);
  const selected = scored[0].module;
  const labels: Record<EnrichmentModule, string> = { team: "队伍规模和存档周期", communication: "语音和约局习惯", resource: "资源共享习惯", roles: "队伍角色", learning: "教学与研究习惯" };
  return { nextModule: selected, nextModuleReason: `当前最值得补充的是${labels[selected]}，回答后会立即重新计算 Top 3。` };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: { ...CORS, "Content-Type": "application/json" } });
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (!token) throw new Error("Missing auth token");
    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: userData, error: userError } = await admin.auth.getUser(token);
    if (userError || !userData.user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...CORS, "Content-Type": "application/json" } });
    const userId = userData.user.id;
    const { data: ownRow, error: ownError } = await admin.from("member_match_profiles").select("*").eq("user_id", userId).maybeSingle();
    if (ownError) throw ownError;
    if (!ownRow || numericEntries((ownRow as V2Profile).interest_scores).length < 1) return new Response(JSON.stringify({ matches: [], profileReady: false }), { headers: { ...CORS, "Content-Type": "application/json" } });
    const own = ownRow as V2Profile;

    const [profilesResult, v2Result, contactsResult] = await Promise.all([
      admin.from("member_profiles").select("user_id, display_name, intro, interests, pace, availability, duration, group_size, collaboration, roles, communication, research, session_style, resource_style, experience_style, discoverable"),
      admin.from("member_match_profiles").select("*"),
      admin.from("member_contacts").select("user_id, qq, show_qq").eq("show_qq", true),
    ]);
    if (profilesResult.error) throw profilesResult.error;
    if (v2Result.error) throw v2Result.error;
    if (contactsResult.error) throw contactsResult.error;

    const profiles = (profilesResult.data ?? []) as V1Profile[];
    const v2Map = new Map(((v2Result.data ?? []) as V2Profile[]).map((row) => [row.user_id, row]));
    const qqMap = new Map((contactsResult.data ?? []).map((row) => [row.user_id, row.qq as string]));
    const ranked = profiles.filter((profile) => profile.user_id !== userId).map((profile) => {
      const v2 = v2Map.get(profile.user_id);
      const positiveV2Interest = v2 ? numericEntries(v2.interest_scores).some(([, value]) => value > 0) : false;
      if (!profile.discoverable && !positiveV2Interest) return null;
      const candidate = v2 ?? asV2Bridge(profile);
      const result = scoreCandidate(own, candidate, profile, Boolean(v2));
      if (!result) return null;
      return { candidate, result, output: { id: profile.user_id, name: profile.display_name, intro: profile.intro?.trim() || "Minecraft 社团成员", qq: qqMap.get(profile.user_id), score: result.compatibility, confidence: result.confidence, reasons: result.reasons, profileVersion: v2 ? 2 : 1 as const } };
    }).filter((item): item is NonNullable<typeof item> => item !== null).sort((a, b) => b.result.ranking - a.result.ranking);

    const top = ranked.slice(0, 12);
    const next = chooseNextModule(own, top.slice(0, 5).map((item) => item.candidate));
    return new Response(JSON.stringify({ matches: top.map((item) => item.output), profileReady: true, ...next }), { headers: { ...CORS, "Content-Type": "application/json", "Cache-Control": "no-store" } });
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), { status: 500, headers: { ...CORS, "Content-Type": "application/json" } });
  }
});
