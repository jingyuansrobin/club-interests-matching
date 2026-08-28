export const V2_INTERESTS = [
  { key: "tech", label: "科技整合包", icon: "⚙️", hint: "GTNH、ATM、机械动力、自动化产线等" },
  { key: "vanilla", label: "原版 / 类原版", icon: "🌲", hint: "长期生存、原版机制、轻量模组服" },
  { key: "building", label: "建筑 / 景观", icon: "🏗️", hint: "基地设计、校园复刻、城市与景观" },
  { key: "redstone", label: "红石 / 自动化", icon: "🔴", hint: "红石机器、农场、仓储与原版自动化" },
  { key: "magic", label: "魔法模组", icon: "🪄", hint: "神秘、植物魔法、血魔法等体系" },
  { key: "adventure", label: "冒险 / RPG", icon: "🗺️", hint: "探索、任务、地牢、Boss、剧情地图" },
  { key: "challenge", label: "高难 / 专家包", icon: "💀", hint: "专家包、硬核生存、受限资源、高难目标" },
  { key: "minigame", label: "小游戏 / 派对", icon: "🎮", hint: "跑酷、合作挑战、小游戏服、轻竞技" },
  { key: "pvp", label: "PVP / 对抗", icon: "⚔️", hint: "竞技、阵营、战斗向玩法" },
  { key: "development", label: "Mod / 服务端开发", icon: "💻", hint: "插件、模组、脚本、服务端和工具开发" },
] as const;

export type V2InterestKey = (typeof V2_INTERESTS)[number]["key"];
export type InterestScores = Partial<Record<V2InterestKey, number>>;

export const INTEREST_SCALE = [
  { value: 0, short: "不想玩", label: "不想玩" },
  { value: 1, short: "能陪玩", label: "有人叫可以" },
  { value: 2, short: "偶尔想", label: "偶尔想玩" },
  { value: 3, short: "挺想玩", label: "挺想玩" },
  { value: 4, short: "很想玩", label: "最近很想玩" },
] as const;

export const V2_DAYS = [
  { key: "mon", label: "周一" },
  { key: "tue", label: "周二" },
  { key: "wed", label: "周三" },
  { key: "thu", label: "周四" },
  { key: "fri", label: "周五" },
  { key: "sat", label: "周六" },
  { key: "sun", label: "周日" },
] as const;

export const V2_TIME_BUCKETS = [
  { key: "afternoon", label: "下午", hint: "约 13:00–18:00" },
  { key: "evening", label: "晚上", hint: "约 18:00–22:00" },
  { key: "late", label: "深夜", hint: "约 22:00 以后" },
] as const;

export type AvailabilityGrid = Record<string, number>;

export type V2Preference = {
  ideal: number;
  tolerance: number;
  hard?: boolean;
};

export type V2PlaystyleKey = "paceIntensity" | "collabSynchrony" | "collabDivision" | "sessionPlanning" | "resourceSharing";
export type V2PlaystylePreferences = Partial<Record<V2PlaystyleKey, V2Preference>>;

export type V2MatchProfile = {
  profileVersion: 2;
  interestScores: InterestScores;
  currentIntents: V2InterestKey[];
  intentUpdatedAt?: string;
  availabilityGrid: AvailabilityGrid;
  availabilityRandomness?: number;
  playstylePreferences: V2PlaystylePreferences;
  rolePreferences: Record<string, number>;
  boundaryPreferences: Record<string, V2Preference>;
  learningPreferences: Record<string, number>;
};

export type V2Match = {
  id: string;
  name: string;
  intro: string;
  qq?: string;
  score: number;
  confidence: number;
  reasons: string[];
  profileVersion: 1 | 2;
};

export type V2Identity = {
  name: string;
  intro: string;
  qq: string;
  showQq: boolean;
};

export const EMPTY_V2_PROFILE: V2MatchProfile = {
  profileVersion: 2,
  interestScores: {},
  currentIntents: [],
  availabilityGrid: {},
  playstylePreferences: {},
  rolePreferences: {},
  boundaryPreferences: {},
  learningPreferences: {},
};

export function cloneV2Profile(profile: V2MatchProfile): V2MatchProfile {
  return JSON.parse(JSON.stringify(profile)) as V2MatchProfile;
}
