import type { MatchResult, Member, PartialProfile, ProfileField, Question } from "./types";

export const FIELD_WEIGHTS: Record<ProfileField, number> = {
  interests: 25,
  pace: 15,
  availability: 15,
  duration: 10,
  groupSize: 10,
  collaboration: 10,
  roles: 7.5,
  communication: 5,
  research: 2.5,
};

const matrices: Partial<Record<ProfileField, Record<string, Record<string, number>>>> = {
  pace: matrix({
    hardcore: { hardcore: 1, steady: 0.7, casual: 0.25, adaptive: 0.9 },
    steady: { steady: 1, casual: 0.7, adaptive: 0.9 },
    casual: { casual: 1, adaptive: 0.9 },
    adaptive: { adaptive: 0.85 },
  }),
  duration: matrix({
    short: { short: 1, medium: 0.75, long: 0.4, very_long: 0.2, flexible: 0.85 },
    medium: { medium: 1, long: 0.75, very_long: 0.45, flexible: 0.9 },
    long: { long: 1, very_long: 0.85, flexible: 0.9 },
    very_long: { very_long: 1, flexible: 0.85 },
    flexible: { flexible: 0.85 },
  }),
  groupSize: matrix({
    duo: { duo: 1, small: 0.8, community: 0.35, parallel: 0.5, flexible: 0.9 },
    small: { small: 1, community: 0.7, parallel: 0.65, flexible: 0.95 },
    community: { community: 1, parallel: 0.75, flexible: 0.9 },
    parallel: { parallel: 1, flexible: 0.9 },
    flexible: { flexible: 0.9 },
  }),
  collaboration: matrix({
    together: { together: 1, divide: 0.85, independent: 0.55, follower: 0.85, organizer: 0.9 },
    divide: { divide: 1, independent: 0.8, follower: 0.85, organizer: 0.9 },
    independent: { independent: 1, follower: 0.65, organizer: 0.55 },
    follower: { follower: 0.65, organizer: 1 },
    organizer: { organizer: 0.7 },
  }),
  communication: matrix({
    voice: { voice: 1, text: 0.5, optional: 0.9, avoid: 0.25 },
    text: { text: 1, optional: 0.9, avoid: 0.95 },
    optional: { optional: 0.95, avoid: 0.85 },
    avoid: { avoid: 1 },
  }),
  research: matrix({
    self: { self: 0.9, ask: 0.8, together: 0.85, casual: 0.55 },
    ask: { ask: 0.7, together: 0.85, casual: 0.65 },
    together: { together: 1, casual: 0.8 },
    casual: { casual: 1 },
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

function list(value: unknown): string[] | undefined {
  return Array.isArray(value) ? value : undefined;
}

function interestScore(a: string[], b: string[]) {
  const importance = [1, 0.8, 0.6];
  const aw = new Map(a.map((value, index) => [value, importance[index] ?? 0.5]));
  const bw = new Map(b.map((value, index) => [value, importance[index] ?? 0.5]));
  const union = new Set([...a, ...b]);
  let numerator = 0;
  let denominator = 0;
  for (const value of union) {
    const left = aw.get(value) ?? 0;
    const right = bw.get(value) ?? 0;
    numerator += Math.min(left, right);
    denominator += Math.max(left, right);
  }
  return denominator ? numerator / denominator : 0;
}

function availabilityScore(a: string[], b: string[]) {
  if (a.includes("random") || b.includes("random")) return 0.7;
  const left = new Set(a);
  const right = new Set(b);
  const intersection = [...left].filter((item) => right.has(item)).length;
  const union = new Set([...a, ...b]).size;
  if (!intersection) return 0;
  const ratio = intersection / union;
  if (intersection >= 2 && ratio >= 0.6) return 0.95;
  if (intersection >= 2) return 0.9;
  return 0.75;
}

const rolePairs: Record<string, number> = {
  "planner|technical": 1,
  "builder|planner": 0.95,
  "planner|gatherer": 0.9,
  "organizer|technical": 0.95,
  "builder|organizer": 0.95,
  "builder|technical": 0.9,
  "gatherer|technical": 0.9,
  "builder|gatherer": 0.9,
  "explorer|gatherer": 0.85,
};

const sameRole: Record<string, number> = {
  builder: 0.95,
  technical: 0.9,
  explorer: 0.9,
  gatherer: 0.85,
  planner: 0.75,
  organizer: 0.7,
  generalist: 0.85,
};

function roleScore(a: string[], b: string[]) {
  const values: number[] = [];
  for (const left of a) {
    for (const right of b) {
      if (left === "generalist" || right === "generalist") values.push(0.85);
      else if (left === right) values.push(sameRole[left] ?? 0.8);
      else {
        const key = [left, right].sort().join("|");
        values.push(rolePairs[key] ?? 0.75);
      }
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
  const sharedInterests = userInterests.filter((item) => memberInterests.includes(item));
  const eligible = userInterests.length === 0 || sharedInterests.length > 0;

  let penalty = 1;
  if (profile.availability && member.availability && availabilityScore(profile.availability, member.availability) === 0) penalty *= 0.65;
  if (profile.groupSize && member.groupSize && new Set([profile.groupSize, member.groupSize]).has("duo") && new Set([profile.groupSize, member.groupSize]).has("community")) penalty *= 0.8;
  if (profile.communication && member.communication && new Set([profile.communication, member.communication]).has("voice") && new Set([profile.communication, member.communication]).has("avoid")) penalty *= 0.85;

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
  const shared = (profile.interests ?? []).filter((interest) => member.interests?.includes(interest));
  if (shared.length) reasons.push(`有 ${shared.length} 个核心兴趣重合`);
  if (profile.pace && profile.pace === member.pace) reasons.push("游戏推进节奏一致");
  if (profile.duration && profile.duration === member.duration) reasons.push("对存档生命周期的预期一致");
  if (profile.availability && member.availability) {
    const overlap = profile.availability.filter((time) => member.availability?.includes(time));
    if (overlap.length) reasons.push("有稳定的共同上线时间");
  }
  if (profile.roles && member.roles && roleScore(profile.roles, member.roles) >= 0.9) reasons.push("游戏内分工很互补");
  if (profile.collaboration && member.collaboration && categorical("collaboration", profile.collaboration, member.collaboration) >= 0.9) reasons.push("合作方式很合拍");
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
