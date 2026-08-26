import type { Member, PartialProfile } from "./types";
import { getSupabaseClient, isSupabaseConfigured } from "./supabase";

type ProfileRow = {
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
  discoverable: boolean;
};

type ConnectionRow = {
  requester_id: string;
  target_id: string;
};

export type CommunityData = {
  enabled: boolean;
  members: Member[];
  ownProfile?: PartialProfile;
  ownName?: string;
  userId?: string;
  outgoingInterest: string[];
  incomingInterest: string[];
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

function rowToProfile(row: ProfileRow): PartialProfile {
  return {
    interests: row.interests ?? undefined,
    pace: row.pace ?? undefined,
    availability: row.availability ?? undefined,
    duration: row.duration ?? undefined,
    groupSize: row.group_size ?? undefined,
    collaboration: row.collaboration ?? undefined,
    roles: row.roles ?? undefined,
    communication: row.communication ?? undefined,
    research: row.research ?? undefined,
  };
}

function rowToMember(row: ProfileRow): Member {
  return {
    id: row.user_id,
    name: row.display_name,
    intro: row.intro || "Minecraft 社团成员",
    ...rowToProfile(row),
  };
}

export async function loadCommunityData(): Promise<CommunityData> {
  if (!isSupabaseConfigured()) {
    return { enabled: false, members: [], outgoingInterest: [], incomingInterest: [] };
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return { enabled: false, members: [], outgoingInterest: [], incomingInterest: [] };
  }

  const user = await ensureSession();
  if (!user) {
    return { enabled: true, members: [], outgoingInterest: [], incomingInterest: [] };
  }

  const [{ data, error }, { data: connectionData, error: connectionError }] = await Promise.all([
    supabase
      .from("member_profiles")
      .select(
        "user_id, display_name, intro, interests, pace, availability, duration, group_size, collaboration, roles, communication, research, discoverable"
      )
      .eq("discoverable", true),
    supabase
      .from("connection_requests")
      .select("requester_id, target_id")
      .or(`requester_id.eq.${user.id},target_id.eq.${user.id}`),
  ]);

  if (error) throw error;
  if (connectionError) throw connectionError;

  const rows = (data ?? []) as ProfileRow[];
  const connections = (connectionData ?? []) as ConnectionRow[];
  const own = rows.find((row) => row.user_id === user.id);

  return {
    enabled: true,
    userId: user.id,
    ownName: own?.display_name,
    ownProfile: own ? rowToProfile(own) : undefined,
    members: rows.filter((row) => row.user_id !== user.id).map(rowToMember),
    outgoingInterest: connections
      .filter((row) => row.requester_id === user.id)
      .map((row) => row.target_id),
    incomingInterest: connections
      .filter((row) => row.target_id === user.id)
      .map((row) => row.requester_id),
  };
}

export async function saveCommunityProfile(
  displayName: string,
  profile: PartialProfile,
  intro = "Minecraft 社团成员"
) {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("Supabase 尚未配置");

  const user = await ensureSession();
  if (!user) throw new Error("无法创建匿名会话");

  const cleanName = displayName.trim().slice(0, 32);
  if (!cleanName) throw new Error("请先填写昵称");

  const { error } = await supabase.from("member_profiles").upsert(
    {
      user_id: user.id,
      display_name: cleanName,
      intro,
      interests: profile.interests ?? null,
      pace: profile.pace ?? null,
      availability: profile.availability ?? null,
      duration: profile.duration ?? null,
      group_size: profile.groupSize ?? null,
      collaboration: profile.collaboration ?? null,
      roles: profile.roles ?? null,
      communication: profile.communication ?? null,
      research: profile.research ?? null,
      discoverable: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  if (error) throw error;
  return user.id;
}

export async function expressInterest(targetId: string) {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("Supabase 尚未配置");

  const user = await ensureSession();
  if (!user) throw new Error("无法创建匿名会话");
  if (user.id === targetId) throw new Error("不能向自己发起连线");

  const { error } = await supabase.from("connection_requests").insert({
    requester_id: user.id,
    target_id: targetId,
  });

  if (error && error.code !== "23505") throw error;
}

export async function withdrawInterest(targetId: string) {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("Supabase 尚未配置");

  const user = await ensureSession();
  if (!user) throw new Error("无法创建匿名会话");

  const { error } = await supabase
    .from("connection_requests")
    .delete()
    .eq("requester_id", user.id)
    .eq("target_id", targetId);

  if (error) throw error;
}
