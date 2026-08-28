import { getSupabaseClient, isSupabaseConfigured } from "./supabase";
import type { V2Identity, V2Match, V2MatchProfile } from "./v2-types";
import { EMPTY_V2_PROFILE } from "./v2-types";

type V1OwnProfile = {
  user_id: string;
  display_name: string;
  intro: string | null;
  interests: string[] | null;
  pace: string | null;
  collaboration: string | null;
};

type V2Row = {
  user_id: string;
  profile_version: number;
  interest_scores: Record<string, number> | null;
  current_intents: string[] | null;
  intent_updated_at: string | null;
  availability_grid: Record<string, number> | null;
  availability_randomness: number | null;
  playstyle_preferences: Record<string, { ideal: number; tolerance: number; hard?: boolean }> | null;
  role_preferences: Record<string, number> | null;
  boundary_preferences: Record<string, { ideal: number; tolerance: number; hard?: boolean }> | null;
  learning_preferences: Record<string, number> | null;
};

type ContactRow = {
  user_id: string;
  qq: string;
  show_qq: boolean;
};

export type V2LoadResult = {
  enabled: boolean;
  identity?: V2Identity;
  profile: V2MatchProfile;
  legacySuggested: boolean;
};

async function ensureSession() {
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  const { data: sessionData } = await supabase.auth.getSession();
  if (sessionData.session?.user) return sessionData.session.user;
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  return data.user;
}

function fromRow(row: V2Row): V2MatchProfile {
  return {
    profileVersion: 2,
    interestScores: (row.interest_scores ?? {}) as V2MatchProfile["interestScores"],
    currentIntents: (row.current_intents ?? []) as V2MatchProfile["currentIntents"],
    intentUpdatedAt: row.intent_updated_at ?? undefined,
    availabilityGrid: row.availability_grid ?? {},
    availabilityRandomness: row.availability_randomness ?? undefined,
    playstylePreferences: (row.playstyle_preferences ?? {}) as V2MatchProfile["playstylePreferences"],
    rolePreferences: row.role_preferences ?? {},
    boundaryPreferences: (row.boundary_preferences ?? {}) as V2MatchProfile["boundaryPreferences"],
    learningPreferences: row.learning_preferences ?? {},
  };
}

function buildLegacySuggestion(v1: V1OwnProfile): V2MatchProfile {
  const profile: V2MatchProfile = JSON.parse(JSON.stringify(EMPTY_V2_PROFILE));
  for (const interest of v1.interests ?? []) {
    if (["tech", "vanilla", "building", "redstone", "pvp", "minigame", "magic", "adventure", "challenge", "development"].includes(interest)) {
      profile.interestScores[interest as keyof typeof profile.interestScores] = 3;
    }
  }

  const paceMap: Record<string, { ideal: number; tolerance: number }> = {
    hardcore: { ideal: 4, tolerance: 0 },
    steady: { ideal: 3, tolerance: 1 },
    burst: { ideal: 3, tolerance: 1 },
    casual: { ideal: 0, tolerance: 1 },
    adaptive: { ideal: 2, tolerance: 2 },
  };
  if (v1.pace && paceMap[v1.pace]) profile.playstylePreferences.paceIntensity = paceMap[v1.pace];

  if (v1.collaboration === "together") profile.playstylePreferences.collabSynchrony = { ideal: 0, tolerance: 0 };
  if (v1.collaboration === "independent") profile.playstylePreferences.collabSynchrony = { ideal: 4, tolerance: 1 };
  if (v1.collaboration === "divide") profile.playstylePreferences.collabDivision = { ideal: 4, tolerance: 0 };
  if (v1.collaboration === "flexible") {
    profile.playstylePreferences.collabSynchrony = { ideal: 2, tolerance: 2 };
    profile.playstylePreferences.collabDivision = { ideal: 2, tolerance: 2 };
  }
  return profile;
}

export async function loadV2OwnData(): Promise<V2LoadResult> {
  if (!isSupabaseConfigured()) return { enabled: false, profile: JSON.parse(JSON.stringify(EMPTY_V2_PROFILE)), legacySuggested: false };
  const supabase = getSupabaseClient();
  if (!supabase) return { enabled: false, profile: JSON.parse(JSON.stringify(EMPTY_V2_PROFILE)), legacySuggested: false };

  const user = await ensureSession();
  if (!user) return { enabled: true, profile: JSON.parse(JSON.stringify(EMPTY_V2_PROFILE)), legacySuggested: false };

  const [profileResult, contactResult, v2Result] = await Promise.all([
    supabase
      .from("member_profiles")
      .select("user_id, display_name, intro, interests, pace, collaboration")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase.from("member_contacts").select("user_id, qq, show_qq").eq("user_id", user.id).maybeSingle(),
    supabase.from("member_match_profiles").select("*").eq("user_id", user.id).maybeSingle(),
  ]);

  if (profileResult.error) throw profileResult.error;
  if (contactResult.error) throw contactResult.error;
  if (v2Result.error) throw v2Result.error;

  const own = profileResult.data as V1OwnProfile | null;
  const contact = contactResult.data as ContactRow | null;
  const v2 = v2Result.data as V2Row | null;
  const legacySuggested = Boolean(!v2 && own?.interests?.length);

  return {
    enabled: true,
    identity: own && contact
      ? {
          name: own.display_name,
          intro: own.intro ?? "",
          qq: contact.qq,
          showQq: contact.show_qq,
        }
      : undefined,
    profile: v2 ? fromRow(v2) : own ? buildLegacySuggestion(own) : JSON.parse(JSON.stringify(EMPTY_V2_PROFILE)),
    legacySuggested,
  };
}

export async function saveV2MatchProfile(profile: V2MatchProfile) {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("Supabase 尚未配置");
  const user = await ensureSession();
  if (!user) throw new Error("无法创建匿名会话");

  const now = new Date().toISOString();
  const { error } = await supabase.from("member_match_profiles").upsert(
    {
      user_id: user.id,
      profile_version: 2,
      interest_scores: profile.interestScores,
      current_intents: profile.currentIntents,
      intent_updated_at: profile.currentIntents.length ? (profile.intentUpdatedAt ?? now) : null,
      availability_grid: profile.availabilityGrid,
      availability_randomness: profile.availabilityRandomness ?? null,
      playstyle_preferences: profile.playstylePreferences,
      role_preferences: profile.rolePreferences,
      boundary_preferences: profile.boundaryPreferences,
      learning_preferences: profile.learningPreferences,
      updated_at: now,
    },
    { onConflict: "user_id" }
  );
  if (error) throw error;

  const interestValues = Object.values(profile.interestScores).filter((value): value is number => typeof value === "number");
  const discoverable = interestValues.length >= 2 && interestValues.some((value) => value > 0);
  const { error: discoverableError } = await supabase
    .from("member_profiles")
    .update({ discoverable, updated_at: now })
    .eq("user_id", user.id);
  if (discoverableError) throw discoverableError;
}

export async function resetV2MatchProfile() {
  const supabase = getSupabaseClient();
  if (!supabase) return;
  const user = await ensureSession();
  if (!user) return;
  const { error } = await supabase.from("member_match_profiles").delete().eq("user_id", user.id);
  if (error) throw error;
  const { error: profileError } = await supabase
    .from("member_profiles")
    .update({
      interests: null,
      pace: null,
      availability: null,
      duration: null,
      group_size: null,
      collaboration: null,
      roles: null,
      communication: null,
      research: null,
      session_style: null,
      resource_style: null,
      experience_style: null,
      discoverable: false,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", user.id);
  if (profileError) throw profileError;
}

export async function fetchV2Matches(): Promise<V2Match[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];
  await ensureSession();
  const { data, error } = await supabase.functions.invoke("match-v2", { body: {} });
  if (error) throw error;
  const payload = data as { matches?: V2Match[] } | null;
  return payload?.matches ?? [];
}
