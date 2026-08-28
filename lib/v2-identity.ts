import { getSupabaseClient } from "./supabase";
import type { V2Identity } from "./v2-types";

async function ensureSession() {
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  const { data: sessionData } = await supabase.auth.getSession();
  if (sessionData.session?.user) return sessionData.session.user;
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  return data.user;
}

export async function saveV2Identity(identity: V2Identity) {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("Supabase 尚未配置");
  const user = await ensureSession();
  if (!user) throw new Error("无法创建匿名会话");

  const name = identity.name.trim().slice(0, 32);
  const intro = identity.intro.trim().slice(0, 120);
  const qq = identity.qq.trim();
  if (!name) throw new Error("请先填写社团昵称");
  if (!/^\d{5,12}$/.test(qq)) throw new Error("请输入 5–12 位数字 QQ 号");

  const now = new Date().toISOString();
  const { data: existing, error: existingError } = await supabase
    .from("member_profiles")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (existingError) throw existingError;

  if (existing) {
    const { error } = await supabase
      .from("member_profiles")
      .update({ display_name: name, intro: intro || null, updated_at: now })
      .eq("user_id", user.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("member_profiles").insert({
      user_id: user.id,
      display_name: name,
      intro: intro || null,
      discoverable: false,
      updated_at: now,
    });
    if (error) throw error;
  }

  const { error: contactError } = await supabase.from("member_contacts").upsert(
    {
      user_id: user.id,
      qq,
      show_qq: identity.showQq,
      updated_at: now,
    },
    { onConflict: "user_id" }
  );
  if (contactError) throw contactError;
}
