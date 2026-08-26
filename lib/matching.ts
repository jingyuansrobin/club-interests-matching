import type { MatchResult, Member, PartialProfile, ProfileField, Question } from "./types";

export const FIELD_WEIGHTS: Record<ProfileField, number> = {
  interests: 22,
  pace: 12,
  availability: 14,
  duration: 8,
  groupSize: 8,
  collaboration: 9,
  roles: 7,
  communication: 5,
  research: 3,
  sessionStyle: 5,
  resourceStyle: 4,
  experienceStyle: 3,
};

const matrices: Partial<Record<ProfileField, Record<string, Record<string, number>>>> = {
  pace: matrix({
    hardcore: { hardcore: 1, steady: 0.72, burst: 0.82, casual: 0.25, adaptive: 0.9 },
    steady: { steady: 1, burst: 0.78, casual: 0.72, adaptive: 0.92 },
    burst: { burst: 0.9, casual: 0.58, adaptive: 0.88 },
    casual: { casual: 1, adaptive: 0.9 },
    adaptive: { adaptive: 0.88 },
  }),
  duration: matrix({
    one_off: { one_off: 1, short: 0.82, medium: 0.42, long: 0.2, very_long: 0.12, flexible: 0.85 },
    short: { short: 1, medium: 0.76, long: 0.42, very_long: 0.22, flexible: 0.88 },
    medium: { medium: 1, long: 0.76, very_long: 0.48, flexible: 0.92 },
    long: { long: 1, very_long: 0.86, flexible: 0.92 },
    very_long: { very_long: 1, flexible: 0.86 },
    flexible: { flexible: 0.88 },
  }),
  groupSize: matrix({
    duo: { duo: 1, small: 0.82, community: 0.35, parallel: 0.52, flexible: 0.92 },
    small: { small: 1, community: 0.72, parallel: 0.68, flexible: 0.96 },
    community: { community: 1, parallel: 0.76, flexible: 0.92 },
    parallel: { parallel: 1, flexible: 0.92 },
    flexible: { flexible: 0.9 },
  }),
  collaboration: matrix({
    together: { together: 1, divide: 0.88, independent: 0.55, follower: 0.88, organizer: 0.92, flexible: 0.94 },
    divide: { divide: 1, independent: 0.8, follower: 0.86, organizer: 0.94, flexible: 0.95 },
    independent: { independent: 1, follower: 0.66, organizer: 0.58, flexible: 0.9 },
    follower: { follower: 0.68, organizer: 1, flexible: 0.92 },
    organizer: { organizer: 0.72, flexible: 0.92 },
    flexible: { flexible: 0.9 },
  }),
  communication: matrix({
    voice: { voice: 1, listen: 0.88, text: 0.5, optional: 0.92, avoid: 0.25 },
    listen: { listen: 0.94, text: 0.78, optional: 0.96, avoid: 0.58 },
    text: { text: 1, optional: 0.92, avoid: 0.96 },
    optional: { optional: 0.96, avoid: 0.86 },
    avoid: { avoid: 1 },
  }),
  research: matrix({
    self: { self: 0.92, ask: 0.8, together: 0.86, guided: 0.72, casual: 0.55 },
    ask: { ask: 0.78, together: 0.88, guided: 0.9, casual: 0.66 },
    together: { together: 1, guided: 0.9, casual: 0.8 },
    guided: { guided: 0.8, casual: 0.68 },
    casual: { casual: 1 },
  }),
  sessionStyle: matrix({
    scheduled: { scheduled: 1, ping: 0.75, dropin: 0.48, async: 0.62, flexible: 0.92 },
    ping: { ping: 1, dropin: 0.88, async: 0.65, flexible: 0.96 },
    dropin: { dropin: 1, async: 0.76, flexible: 0.94 },
    async: { async: 1, flexible: 0.92 },
    flexible: { flexible: 0.9 },
  }),
  resourceStyle: matrix({
    shared: { shared: 1, core_shared: 0.92, separate: 0.45, flexible: 0.92 },
    core_shared: { core_shared: 1, separate: 0.76, flexible: 0.96 },
    separate: { separate: 1, flexible: 0.9 },
    flexible: { flexible: 0.9 },
  }),
  experienceStyle: matrix({
    teach: { teach: 0.76, learn: 1, peer: 0.82, mixed: 0.92 },
    learn: { learn: 0.66, peer: 0.76, mixed: 0.92 },
    peer: { peer: 1, mixed: 0.92 },
    mixed: { mixed: 0.9 },
  }),
};

function matrix(input: Record<string, Record<string, number>>) {
  const output: Record<string, Record<string, number>> = {};
  for (const [a, row] of Object.entries(input)) {
    output[a] ??= {};
    for (const [b, value] of Object.entries(row)) {
      output[a][b] = value;
      output[b] ??= {};
      output[b][a] = value;
    }
  }
  return output;
}

function pairKey(a: string, b: string) {
  return [a, b].sort().join("|");
}

const interestAffinities: Record<string, number> = {
  [pairKey("tech", "redstone")]: 0.72,
  [pairKey("tech", "development")]: 0.62,
  [pairKey("tech", "challenge")]: 0.64,
  [pairKey("tech", "magic")]: 0.32,
  [pairKey("vanilla", "building")]: 0.58,
  [pairKey("vanilla", "redstone")]: 0.55,
  [pairKey("vanilla", "adventure")]: 0.5,
  [pairKey("vanilla", "challenge")]: 0.46,
  [pairKey("vanilla", "social")]: 0.34,
  [pairKey("building", "redstone")]: 0.46,
  [pairKey("building", "adventure")]: 0.36,
  [pairKey("building", "social")]: 0.38,
  [pairKey("pvp", "minigame")]: 0.72,
  [pairKey("pvp", "challenge")]: 0.46,
  [pairKey("minigame", "social")]: 0.58,
  [pairKey("magic", "adventure")]: 0.64,
  [pairKey("magic", "challenge")]: 0.46,
  [pairKey("adventure", "challenge")]: 0.6,
  [pairKey("adventure", "social")]: 0.36,
  [pairKey("development", "redstone")]: 0.5,
  [pairKey("development", "minigame")]: 0.32,
};

const interestLabels: Record<string, string> = {
  tech: "科技整合包",
  vanilla: "原版生存",
  building: "建筑",
  redstone: "红石自动化",
  pvp: "PVP",
  minigame: "小游戏",
  magic: "魔法模组",
  adventure: "冒险 RPG",
  challenge: "高难挑战",
  development: "技术开发",
  social: "社交玩法",
};

function interestAffinity(a: string, b: string) {
  if (a === b) return 1;
  return interestAffinities[pairKey(a, b)] ?? 0;
}

function list(value: unknown): string[] | undefined {
  return Array.isArray(value) ? value : undefined;
}

function interestScore(user: string[], candidate: string[]) {
  const userImportance = [1, 0.8, 0.6];
  const candidateImportance = [1, 0.9, 0.8];
  let earned = 0;
  let possible = 0;

  user.forEach((interest, index) => {
    const weight = userImportance[index] ?? 0.5;
    possible += weight;
    let best = 0;

    candidate.forEach((candidateInterest, candidateIndex) => {
      const affinity = interestAffinity(interest, candidateInterest);
      const rankWeight = candidateImportance[candidateIndex] ?? 0.7;
      best = Math.max(best, affinity * rankWeight);
    });

    earned += weight * best;
  });

  return possible ? earned / possible : 0;
}

function strongestInterestAffinity(a: string[], b: string[]) {
  let strongest = 0;
  for (const left of a) {
    for (const right of b) strongest = Math.max(strongest, interestAffinity(left, right));
  }
  return strongest;
}

const timeAdjacency: Record<string, number> = {
  [pairKey("weekday_afternoon", "weekday_evening")]: 0.35,
  [pairKey("weekday_evening", "late_night")]: 0.5,
  [pairKey("weekend_day", "weekend_evening")]: 0.4,
};

function availabilityScore(a: string[], b: string[]) {
  if (a.includes("random") && b.includes("random")) return 0.75;
  if (a.includes("random") || b.includes("random")) return 0.65;

  const left = new Set(a);
  const right = new Set(b);
  const intersection = [...left].filter((item) => right.has(item)).length;
  const union = new Set([...a, ...b]).size;

  if (intersection) {
    const ratio = intersection / union;
    if (intersection >= 2 && ratio >= 0.6) return 0.96;
    if (intersection >= 2) return 0.9;
    return 0.76;
  }

  let adjacent = 0;
  for (const leftTime of a) {
    for (const rightTime of b) adjacent = Math.max(adjacent, timeAdjacency[pairKey(leftTime, rightTime)] ?? 0);
  }
  return adjacent;
}

const rolePairs: Record<string, number> = {
  [pairKey("planner", "technical")]: 1,
  [pairKey("planner", "builder")]: 0.95,
  [pairKey("planner", "gatherer")]: 0.9,
  [pairKey("planner", "logistics")]: 0.92,
  [pairKey("planner", "explorer")]: 0.82,
  [pairKey("organizer", "technical")]: 0.95,
  [pairKey("organizer", "builder")]: 0.95,
  [pairKey("organizer", "logistics")]: 0.96,
  [pairKey("organizer", "combat")]: 0.86,
  [pairKey("technical", "builder")]: 0.9,
  [pairKey("technical", "gatherer")]: 0.9,
  [pairKey("technical", "logistics")]: 0.96,
  [pairKey("builder", "gatherer")]: 0.9,
  [pairKey("builder", "logistics")]: 0.86,
  [pairKey("explorer", "gatherer")]: 0.86,
  [pairKey("explorer", "combat")]: 0.96,
  [pairKey("combat", "gatherer")]: 0.82,
  [pairKey("gatherer", "logistics")]: 0.92,
};

const sameRole: Record<string, number> = {
  builder: 0.95,
  technical: 0.9,
  explorer: 0.9,
  combat: 0.9,
  gatherer: 0.85,
  logistics: 0.86,
  planner: 0.76,
  organizer: 0.72,
  generalist: 0.85,
};

function roleScore(a: string[], b: string[]) {
  const values: number[] = [];
  for (const left of a) {
    for (const right of b) {
      if (left === "generalist" || right === "generalist") values.push(0.85);
      else if (left === right) values.push(sameRole[left] ?? 0.8);
      else values.push(rolePairs[pairKey(left, right)] ?? 0.75);
    }
  }
  values.sort((x, y) => y - x);
  if (!values.length) return 0;
  return (values[0] ?? 0) * 0.7 + (values[1] ?? values[0] ?? 0) * 0.3;
}

function categorical(field: ProfileField, a: string, b: string) {
  return matrices[field]?.[a]?.[b] ?? (a === b ? 1 : 0.5);
}

function fieldScore(field: ProfileField, a: unknown, b: unknown) {
  if (field === "interests") return interestScore(list(a) ?? [], list(b) ?? []);
  if (field === "availability") return availabilityScore(list(a) ?? [], list(b) ?? []);
  if (field === "roles") return roleScore(list(a) ?? [], list(b) ?? []);
  return categorical(field, String(a), String(b));
}

function hasValue(value: unknown) {
  return value !== undefined && value !== null && (!Array.isArray(value) || value.length > 0);
}

export function scoreMatch(profile: PartialProfile, member: Member): MatchResult {
  let weighted = 0;
  let knownWeight = 0;

  for (const field of Object.keys(FIELD_WEIGHTS) as ProfileField[]) {
    const userValue = profile[field];
    const memberValue = member[field];
    if (!hasValue(userValue) || !hasValue(memberValue)) continue;
    const weight = FIELD_WEIGHTS[field];
    weighted += fieldScore(field, userValue, memberValue) * weight;
    knownWeight += weight;
  }

  const userInterests = profile.interests ?? [];
  const memberInterests = member.interests ?? [];
  const interestAffinityValue = strongestInterestAffinity(userInterests, memberInterests);
  const eligible = userInterests.length === 0 || interestAffinityValue >= 0.45;

  let penalty = 1;
  if (profile.availability && member.availability && availabilityScore(profile.availability, member.availability) === 0) penalty *= 0.65;
  if (profile.groupSize && member.groupSize && new Set([profile.groupSize, member.groupSize]).has("duo") && new Set([profile.groupSize, member.groupSize]).has("community")) penalty *= 0.8;
  if (profile.communication && member.communication && new Set([profile.communication, member.communication]).has("voice") && new Set([profile.communication, member.communication]).has("avoid")) penalty *= 0.85;
  if (profile.resourceStyle && member.resourceStyle && new Set([profile.resourceStyle, member.resourceStyle]).has("shared") && new Set([profile.resourceStyle, member.resourceStyle]).has("separate")) penalty *= 0.85;
  if (profile.sessionStyle && member.sessionStyle && new Set([profile.sessionStyle, member.sessionStyle]).has("scheduled") && new Set([profile.sessionStyle, member.sessionStyle]).has("dropin")) penalty *= 0.9;

  const score = knownWeight ? (weighted / knownWeight) * penalty : 0;
  const confidence = knownWeight / 100;

  return {
    member,
    score: eligible ? score : 0,
    confidence,
    reasons: buildReasons(profile, member),
    eligible,
  };
}

export function rankMatches(profile: PartialProfile, members: Member[]) {
  return members
    .map((member) => scoreMatch(profile, member))
    .filter((result) => result.eligible)
    .sort((a, b) => b.score - a.score);
}

function buildReasons(profile: PartialProfile, member: Member) {
  const reasons: string[] = [];
  const userInterests = profile.interests ?? [];
  const memberInterests = member.interests ?? [];
  const shared = userInterests.filter((interest) => memberInterests.includes(interest));

  if (shared.length) {
    const labels = shared.slice(0, 2).map((interest) => interestLabels[interest] ?? interest).join("、");
    reasons.push(`共同偏好：${labels}`);
  } else if (strongestInterestAffinity(userInterests, memberInterests) >= 0.6) {
    reasons.push("核心玩法方向很接近");
  }

  if (profile.availability && member.availability && availabilityScore(profile.availability, member.availability) >= 0.75) reasons.push("有稳定的共同上线时间");
  if (profile.pace && member.pace && categorical("pace", profile.pace, member.pace) >= 0.88) reasons.push("游戏推进节奏接近");
  if (profile.collaboration && member.collaboration && categorical("collaboration", profile.collaboration, member.collaboration) >= 0.9) reasons.push("合作方式很合拍");
  if (profile.roles && member.roles && roleScore(profile.roles, member.roles) >= 0.9) reasons.push("游戏内分工很互补");
  if (profile.sessionStyle && member.sessionStyle && categorical("sessionStyle", profile.sessionStyle, member.sessionStyle) >= 0.9) reasons.push("约局习惯很一致");
  if (profile.resourceStyle && member.resourceStyle && categorical("resourceStyle", profile.resourceStyle, member.resourceStyle) >= 0.9) reasons.push("资源与基地习惯一致");
  if (profile.experienceStyle && member.experienceStyle && categorical("experienceStyle", profile.experienceStyle, member.experienceStyle) >= 0.9) reasons.push("带人 / 学习方式很合拍");
  if (profile.duration && member.duration && categorical("duration", profile.duration, member.duration) >= 0.9) reasons.push("对存档周期的预期一致");

  return reasons.slice(0, 3);
}

export function chooseNextQuestion(profile: PartialProfile, topMembers: Member[], questions: Question[]) {
  const unanswered = questions.filter((question) => !hasValue(profile[question.field]));
  if (!profile.interests) return questions.find((question) => question.field === "interests");

  let best: { question: Question; value: number } | undefined;
  for (const question of unanswered) {
    const answers = topMembers
      .map((member) => member[question.field])
      .filter(hasValue)
      .map((value) => Array.isArray(value) ? [...value].sort().join("|") : String(value));

    if (answers.length < Math.min(3, topMembers.length)) continue;
    const unique = new Set(answers).size;
    const theoretical = Math.max(2, question.options.length);
    const diversity = Math.min(1, unique / Math.min(theoretical, answers.length));
    const coverage = topMembers.length ? answers.length / topMembers.length : 0;
    const value = FIELD_WEIGHTS[question.field] * diversity * coverage;
    if (!best || value > best.value) best = { question, value };
  }

  return best?.question ?? unanswered.sort((a, b) => FIELD_WEIGHTS[b.field] - FIELD_WEIGHTS[a.field])[0];
}
