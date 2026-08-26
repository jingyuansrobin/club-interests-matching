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
  session_style: string | null;
  resource_style: string | null;
  experience_style: string | null;
  discoverable: boolean;
};

type ContactRow = {
  user_id: string;
  qq: string;
  show_qq: boolean;
};

export type CommunityData = {
  enabled: boolean;
  members: Member[];
  ownProfile?: PartialProfile;
  ownName?: string;
  ownQq?: string;
  ownShowQq?: boolean;
  userId?: string;
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
    sessionStyle: row.session_style ?? undefined,
    resourceStyle: row.resource_style ?? undefined,
    experienceStyle: row.experience_style ?? undefined,
  };
}

function rowToMember(row: ProfileRow, qq?: string): Member {
  return {
    id: row.user_id,
    name: row.display_name,
    intro: row.intro || "Minecraft 社团成员",
    qq,
    ...rowToProfile(row),
  };
}

export async function loadCommunityData(): Promise<CommunityData> {
  if (!isSupabaseConfigured()) return { enabled: false, members: [] };

  const supabase = getSupabaseClient();
  if (!supabase) return { enabled: false, members: [] };

  const user = await ensureSession();
  if (!user) return { enabled: true, members: [] };

  const [{ data, error }, { data: contactData, error: contactError }] = await Promise.all([
    supabase
      .from("member_profiles")
      .select(
        "user_id, display_name, intro, interests, pace, availability, duration, group_size, collaboration, roles, communication, research, session_style, resource_style, experience_style, discoverable"
      ),
    supabase.from("member_contacts").select("user_id, qq, show_qq"),
  ]);

  if (error) throw error;
  if (contactError) throw contactError;

  const rows = (data ?? []) as ProfileRow[];
  const contacts = (contactData ?? []) as ContactRow[];
  const own = rows.find((row) => row.user_id === user.id);
  const ownContact = contacts.find((row) => row.user_id === user.id);
  const publicContacts = new Map(
    contacts.filter((row) => row.show_qq).map((row) => [row.user_id, row.qq])
  );

  return {
    enabled: true,
    userId: user.id,
    ownName: own?.display_name,
    ownQq: ownContact?.qq,
    ownShowQq: ownContact?.show_qq ?? false,
    ownProfile: own ? rowToProfile(own) : undefined,
    members: rows
      .filter((row) => row.user_id !== user.id && row.discoverable)
      .map((row) => rowToMember(row, publicContacts.get(row.user_id))),
  };
}

export async function saveCommunityProfile(
  displayName: string,
  profile: PartialProfile,
  qq: string,
  showQq: boolean,
  intro = "Minecraft 社团成员"
) {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("Supabase 尚未配置");

  const user = await ensureSession();
  if (!user) throw new Error("无法创建匿名会话");

  const cleanName = displayName.trim().slice(0, 32);
  if (!cleanName) throw new Error("请先填写社团昵称");

  const cleanQq = qq.trim();
  if (!/^\d{5,12}$/.test(cleanQq)) {
    throw new Error("请输入 5–12 位数字 QQ 号");
  }

  const { error: profileError } = await supabase.from("member_profiles").upsert(
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
      session_style: profile.sessionStyle ?? null,
      resource_style: profile.resourceStyle ?? null,
      experience_style: profile.experienceStyle ?? null,
      discoverable: Boolean(profile.interests?.length),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  if (profileError) throw profileError;

  const { error: contactError } = await supabase.from("member_contacts").upsert(
    {
      user_id: user.id,
      qq: cleanQq,
      show_qq: showQq,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  if (contactError) throw contactError;
  return user.id;
}
