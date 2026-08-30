"use client";

import { useEffect, useMemo, useState } from "react";
import { questions } from "@/lib/questions";
import { getSupabaseClient } from "@/lib/supabase";
import { V2_DAYS, V2_INTERESTS, V2_ROLE_OPTIONS, V2_TIME_BUCKETS } from "@/lib/v2-types";
import "./admin.css";

type DashboardStats = {
  profileCount: number;
  discoverableCount: number;
  completeCount: number;
  v2Count: number;
  enrichedCount: number;
  publicQqCount: number;
  boundEmailCount: number;
  recent7dCount: number;
  feedbackCount: number;
  negativeFeedbackCount: number;
  qqCopyCount: number;
};

type Pref = { ideal?: number; tolerance?: number; hard?: boolean };
type PrefMap = Record<string, Pref | undefined>;

type AdminMember = {
  id: string;
  name: string;
  intro: string;
  interests: string[];
  pace: string | null;
  availability: string[];
  duration: string | null;
  groupSize: string | null;
  collaboration: string | null;
  roles: string[];
  communication: string | null;
  research: string | null;
  sessionStyle: string | null;
  resourceStyle: string | null;
  experienceStyle: string | null;
  discoverable: boolean;
  showQq: boolean;
  publicQq: string | null;
  boundEmail: boolean;
  createdAt: string;
  updatedAt: string;
  completion: number;
  profileVersion: 1 | 2;
  v2InterestScores: Record<string, number>;
  v2CurrentIntents: string[];
  v2AvailabilityGrid: Record<string, number>;
  v2AvailabilityRandomness: number | null;
  v2PlaystylePreferences: PrefMap;
  v2RolePreferences: Record<string, number>;
  v2BoundaryPreferences: PrefMap;
  v2LearningPreferences: Record<string, number>;
  enrichmentCompletion: number;
  receivedPositive: number;
  receivedNeutral: number;
  receivedNegative: number;
  qqCopyCount: number;
};

type AdminDashboardData = { stats: DashboardStats; members: AdminMember[] };
type MemberFilter = "all" | "v2" | "pool" | "needs_core" | "enriched" | "public_qq" | "bound_email" | "negative";
type MemberSort = "updated" | "completion" | "name" | "feedback";
type ExportGroup = "basic" | "status" | "interests" | "availability" | "core" | "team" | "communication" | "roles" | "learning" | "feedback" | "timestamps";

const fieldLabels: Record<string, string> = {
  interests: "核心兴趣", pace: "推进节奏", availability: "上线时间", duration: "存档周期",
  groupSize: "组队规模", collaboration: "合作方式", roles: "游戏角色", communication: "沟通方式",
  research: "学习方式", sessionStyle: "约局方式", resourceStyle: "资源共享", experienceStyle: "经验关系",
};

const optionLabelMap = new Map<string, string>();
for (const question of questions) for (const option of question.options) optionLabelMap.set(`${question.field}:${option.value}`, option.label.replace(/^\S+\s*/, ""));

const interestMap = new Map(V2_INTERESTS.map((item) => [item.key, item]));
const roleMap = new Map(V2_ROLE_OPTIONS.map((item) => [item.key, item]));
const slotMap = new Map<string, string>();
for (const day of V2_DAYS) for (const bucket of V2_TIME_BUCKETS) slotMap.set(`${day.key}_${bucket.key}`, `${day.label}${bucket.label}`);

const PLAYSTYLE_LABELS: Record<string, string[]> = {
  paceIntensity: ["很佛系", "偏佛系", "都可以", "偏推进", "很在意推进"],
  collabSynchrony: ["基本一起", "偏一起", "都可以", "偏独立", "各自发展"],
  collabDivision: ["一起完成", "偏一起", "都可以", "偏分工", "明确分工"],
  sessionPlanning: ["临时喊人", "偏临时", "都可以", "偏计划", "提前约好"],
  resourceSharing: ["各自独立", "偏独立", "核心共享", "偏共享", "全部共享"],
};
const PLAYSTYLE_NAMES: Record<string, string> = {
  paceIntensity: "推进节奏", collabSynchrony: "行动同步", collabDivision: "分工方式", sessionPlanning: "约局方式", resourceSharing: "资源共享",
};
const BOUNDARY_LABELS: Record<string, string[]> = {
  groupSize: ["2 人", "3–5 人", "6–10 人", "11–20 人", "大社区"],
  duration: ["一次活动", "1–2 周", "1–2 个月", "3–6 个月", "半年以上"],
  voice: ["完全不语音", "尽量文字", "都可以", "愿意语音", "基本开麦"],
  asyncProgress: ["希望同时在线", "偏同步", "都可以", "可异步推进", "很接受异步"],
};
const BOUNDARY_NAMES: Record<string, string> = { groupSize: "队伍规模", duration: "存档周期", voice: "语音习惯", asyncProgress: "异步推进" };
const LEARNING_LABELS: Record<string, string[]> = {
  teach: ["不太想带", "较少带人", "看情况", "愿意带", "很愿意带"],
  learn: ["更想自己摸索", "偶尔问人", "都可以", "希望有人提示", "希望队友愿意带"],
  researchIndependence: ["更依赖带路", "偏问别人", "一起研究", "偏自己查", "喜欢自己研究"],
};
const LEARNING_NAMES: Record<string, string> = { teach: "带人意愿", learn: "被带需求", researchIndependence: "查资料方式" };
const ROLE_VALUE_LABELS = ["不太想负责", "可以负责", "很愿意负责"];
const INTEREST_VALUE_LABELS = ["基本不去", "多半不去", "看情况", "大多会去", "很想加入"];

const EXPORT_GROUPS: { key: ExportGroup; label: string; hint: string }[] = [
  { key: "basic", label: "基础资料", hint: "昵称、自我介绍、V1/V2" },
  { key: "status", label: "状态 / 联系", hint: "匹配池、完成度、公开 QQ、邮箱绑定" },
  { key: "interests", label: "玩法兴趣", hint: "兴趣评分与最近最想玩" },
  { key: "availability", label: "上线时间", hint: "V2 时间热力图 / V1 时间段" },
  { key: "core", label: "核心习惯", hint: "推进、行动同步、分工" },
  { key: "team", label: "队伍与存档", hint: "规模、周期与硬性边界" },
  { key: "communication", label: "沟通与资源", hint: "语音、约局、异步、共享" },
  { key: "roles", label: "队伍角色", hint: "8 类角色意愿" },
  { key: "learning", label: "教学与研究", hint: "带人、被带、查资料" },
  { key: "feedback", label: "匹配反馈", hint: "合适 / 一般 / 不合适、QQ复制" },
  { key: "timestamps", label: "时间戳", hint: "创建、最近更新" },
];

function labelFor(field: string, value: string | null | undefined) {
  if (!value) return "未填写";
  return optionLabelMap.get(`${field}:${value}`) ?? value;
}

function formatDate(value: string, full = false) {
  try {
    return new Intl.DateTimeFormat("zh-CN", full ? { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" } : { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
  } catch { return value; }
}

function prefLabel(map: PrefMap, key: string, labels: Record<string, string[]>) {
  const value = map[key];
  if (typeof value?.ideal !== "number") return "未填写";
  const text = labels[key]?.[value.ideal] ?? String(value.ideal);
  return value.hard ? `${text}（硬性）` : text;
}

function positiveInterestTags(member: AdminMember) {
  if (member.profileVersion === 2) {
    return Object.entries(member.v2InterestScores)
      .filter(([, score]) => typeof score === "number" && score >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([key, score]) => ({ key, label: interestMap.get(key)?.label ?? key, score, intent: member.v2CurrentIntents.includes(key) }));
  }
  return member.interests.slice(0, 5).map((key) => ({ key, label: labelFor("interests", key), score: 3, intent: false }));
}

function formatInterest(member: AdminMember) {
  if (member.profileVersion === 2) {
    return Object.entries(member.v2InterestScores)
      .filter(([, value]) => typeof value === "number")
      .sort((a, b) => b[1] - a[1])
      .map(([key, value]) => `${member.v2CurrentIntents.includes(key) ? "🔥" : ""}${interestMap.get(key)?.label ?? key}:${value}/4（${INTEREST_VALUE_LABELS[value] ?? value}）`)
      .join("；") || "未填写";
  }
  return member.interests.length ? member.interests.map((v) => labelFor("interests", v)).join("；") : "未填写";
}

function formatAvailability(member: AdminMember) {
  if (member.profileVersion === 2) {
    const parts = Object.entries(member.v2AvailabilityGrid)
      .filter(([, value]) => value > 0)
      .sort(([a], [b]) => Array.from(slotMap.keys()).indexOf(a) - Array.from(slotMap.keys()).indexOf(b))
      .map(([slot, value]) => `${slotMap.get(slot) ?? slot}:${value === 2 ? "经常" : "偶尔"}`);
    if ((member.v2AvailabilityRandomness ?? 0) >= 3) parts.push("时间较随机");
    return parts.join("；") || "未填写";
  }
  return member.availability.length ? member.availability.map((v) => labelFor("availability", v)).join("；") : "未填写";
}

function formatPlaystyle(member: AdminMember, keys = ["paceIntensity", "collabSynchrony", "collabDivision"]) {
  if (member.profileVersion !== 2) return [labelFor("pace", member.pace), labelFor("collaboration", member.collaboration)].filter((v) => v !== "未填写").join("；") || "未填写";
  return keys.map((key) => `${PLAYSTYLE_NAMES[key]}:${prefLabel(member.v2PlaystylePreferences, key, PLAYSTYLE_LABELS)}`).filter((value) => !value.endsWith(":未填写")).join("；") || "未填写";
}

function formatBoundaries(member: AdminMember, keys: string[]) {
  if (member.profileVersion !== 2) return "V1 画像";
  return keys.map((key) => `${BOUNDARY_NAMES[key]}:${prefLabel(member.v2BoundaryPreferences, key, BOUNDARY_LABELS)}`).filter((value) => !value.endsWith(":未填写")).join("；") || "未填写";
}

function formatRoles(member: AdminMember) {
  if (member.profileVersion === 2) {
    return Object.entries(member.v2RolePreferences).filter(([, value]) => typeof value === "number").map(([key, value]) => `${roleMap.get(key)?.label ?? key}:${ROLE_VALUE_LABELS[value] ?? value}`).join("；") || "未填写";
  }
  return member.roles.length ? member.roles.map((v) => labelFor("roles", v)).join("；") : "未填写";
}

function formatLearning(member: AdminMember) {
  if (member.profileVersion !== 2) return [labelFor("research", member.research), labelFor("experienceStyle", member.experienceStyle)].filter((v) => v !== "未填写").join("；") || "未填写";
  return Object.entries(LEARNING_NAMES).map(([key, name]) => {
    const value = member.v2LearningPreferences[key];
    return typeof value === "number" ? `${name}:${LEARNING_LABELS[key]?.[value] ?? value}` : "";
  }).filter(Boolean).join("；") || "未填写";
}

function searchableText(member: AdminMember) {
  const positiveInterests = member.profileVersion === 2
    ? Object.entries(member.v2InterestScores).filter(([, score]) => score >= 3).map(([key]) => `${interestMap.get(key)?.label ?? key} ${interestMap.get(key)?.hint ?? ""}`)
    : member.interests.map((key) => labelFor("interests", key));
  const positiveRoles = member.profileVersion === 2
    ? Object.entries(member.v2RolePreferences).filter(([, score]) => score >= 1).map(([key]) => roleMap.get(key)?.label ?? key)
    : member.roles.map((key) => labelFor("roles", key));
  const intents = member.v2CurrentIntents.map((key) => `最近最想玩 ${interestMap.get(key)?.label ?? key}`);
  const v1 = [member.pace, member.groupSize, member.collaboration, member.communication, member.research, member.sessionStyle, member.resourceStyle, member.experienceStyle]
    .filter(Boolean).map((value) => String(value));
  return [member.name, member.intro, ...positiveInterests, ...positiveRoles, ...intents, formatPlaystyle(member), formatBoundaries(member, ["groupSize", "duration", "voice", "asyncProgress"]), formatLearning(member), ...v1].join(" ").toLowerCase();
}

function authErrorMessage(error: unknown, fallback: string) {
  const raw = error instanceof Error ? error.message : "";
  const lower = raw.toLowerCase();
  if (lower.includes("email rate limit exceeded") || lower.includes("rate limit")) return "邮件发送过于频繁，请稍后再试。验证码发送后 60 秒内无需重复请求。";
  if (lower.includes("token has expired") || lower.includes("otp expired")) return "验证码已过期，请重新获取。";
  if (lower.includes("invalid") && (lower.includes("token") || lower.includes("otp"))) return "验证码不正确，请检查后重试。";
  return raw || fallback;
}

function xmlEscape(value: unknown) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function exportExcel(members: AdminMember[], groups: Set<ExportGroup>) {
  const columns: { title: string; value: (member: AdminMember) => string | number }[] = [];
  if (groups.has("basic")) columns.push(
    { title: "昵称", value: (m) => m.name }, { title: "自我介绍", value: (m) => m.intro }, { title: "画像版本", value: (m) => `V${m.profileVersion}` },
  );
  if (groups.has("status")) columns.push(
    { title: "匹配池", value: (m) => m.discoverable ? "是" : "否" }, { title: "基础画像完成度", value: (m) => `${m.completion}%` },
    { title: "补充画像", value: (m) => `${m.enrichmentCompletion}/5` }, { title: "QQ公开", value: (m) => m.showQq ? "是" : "否" },
    { title: "公开QQ", value: (m) => m.publicQq ?? "" }, { title: "邮箱绑定", value: (m) => m.boundEmail ? "是" : "否" },
  );
  if (groups.has("interests")) columns.push({ title: "玩法兴趣", value: formatInterest }, { title: "最近最想玩", value: (m) => m.v2CurrentIntents.map((key) => interestMap.get(key)?.label ?? key).join("；") });
  if (groups.has("availability")) columns.push({ title: "上线时间", value: formatAvailability });
  if (groups.has("core")) columns.push({ title: "核心游戏习惯", value: (m) => formatPlaystyle(m) });
  if (groups.has("team")) columns.push({ title: "队伍与存档", value: (m) => m.profileVersion === 2 ? formatBoundaries(m, ["groupSize", "duration"]) : `${labelFor("groupSize", m.groupSize)}；${labelFor("duration", m.duration)}` });
  if (groups.has("communication")) columns.push(
    { title: "沟通与约局", value: (m) => m.profileVersion === 2 ? `${formatBoundaries(m, ["voice", "asyncProgress"])}；${formatPlaystyle(m, ["sessionPlanning"])}` : `${labelFor("communication", m.communication)}；${labelFor("sessionStyle", m.sessionStyle)}` },
    { title: "资源共享", value: (m) => m.profileVersion === 2 ? formatPlaystyle(m, ["resourceSharing"]) : labelFor("resourceStyle", m.resourceStyle) },
  );
  if (groups.has("roles")) columns.push({ title: "队伍角色", value: formatRoles });
  if (groups.has("learning")) columns.push({ title: "教学与研究", value: formatLearning });
  if (groups.has("feedback")) columns.push(
    { title: "推荐-合适", value: (m) => m.receivedPositive }, { title: "推荐-一般", value: (m) => m.receivedNeutral },
    { title: "推荐-不太合适", value: (m) => m.receivedNegative }, { title: "QQ复制次数", value: (m) => m.qqCopyCount },
  );
  if (groups.has("timestamps")) columns.push({ title: "创建时间", value: (m) => formatDate(m.createdAt, true) }, { title: "最近更新时间", value: (m) => formatDate(m.updatedAt, true) });
  if (!columns.length) throw new Error("至少选择一类数据");

  const rowXml = (values: (string | number)[]) => `<Row>${values.map((value) => `<Cell><Data ss:Type="String">${xmlEscape(value)}</Data></Cell>`).join("")}</Row>`;
  const workbook = `<?xml version="1.0" encoding="UTF-8"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="成员数据"><Table>${rowXml(columns.map((c) => c.title))}${members.map((member) => rowXml(columns.map((column) => column.value(member)))).join("")}</Table></Worksheet></Workbook>`;
  const blob = new Blob(["\ufeff", workbook], { type: "application/vnd.ms-excel;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `方块搭子_管理员导出_${new Date().toISOString().slice(0, 10)}.xls`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export default function AdminPage() {
  const [email, setEmail] = useState("ruihaotan@outlook.com");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [currentEmail, setCurrentEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [data, setData] = useState<AdminDashboardData | null>(null);
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<MemberFilter>("all");
  const [sort, setSort] = useState<MemberSort>("updated");
  const [exportOpen, setExportOpen] = useState(false);
  const [exportFilteredOnly, setExportFilteredOnly] = useState(true);
  const [exportGroups, setExportGroups] = useState<Set<ExportGroup>>(new Set(EXPORT_GROUPS.map((item) => item.key)));

  useEffect(() => {
    const maybeClient = getSupabaseClient();
    if (!maybeClient) { setMessage("Supabase 未配置，管理员面板无法加载。"); setLoading(false); return; }
    const client = maybeClient;
    const load = async () => {
      setLoading(true); setMessage("");
      const { data: userData } = await client.auth.getUser();
      const user = userData.user; setCurrentEmail(user?.email ?? "");
      if (!user?.email) { setData(null); setLoading(false); return; }
      const { data: dashboard, error } = await client.rpc("get_admin_dashboard");
      if (error) { setData(null); setMessage("当前账号没有管理员权限，或管理数据暂时无法读取。"); }
      else setData(dashboard as AdminDashboardData);
      setLoading(false);
    };
    load().catch((error) => { console.error(error); setMessage("管理员数据加载失败。"); setLoading(false); });
    const { data: listener } = client.auth.onAuthStateChange(() => window.setTimeout(() => load().catch(console.error), 0));
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setInterval(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  async function sendLoginCode() {
    const cleanEmail = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) { setMessage("请输入有效邮箱。"); return; }
    const client = getSupabaseClient(); if (!client) return;
    try {
      setSending(true); setMessage("");
      const { error } = await client.auth.signInWithOtp({ email: cleanEmail, options: { shouldCreateUser: false } });
      if (error) throw error;
      setOtpSent(true); setOtp(""); setCooldown(60);
      setMessage("6 位管理员验证码已发送到邮箱。请直接在此页面输入验证码，无需点击邮件链接。");
    } catch (error) { console.error(error); setMessage(authErrorMessage(error, "管理员验证码发送失败。")); }
    finally { setSending(false); }
  }

  async function verifyLoginCode() {
    const cleanEmail = email.trim().toLowerCase(); const cleanOtp = otp.replace(/\D/g, "");
    if (!/^\d{6}$/.test(cleanOtp)) { setMessage("请输入邮件中的 6 位数字验证码。"); return; }
    const client = getSupabaseClient(); if (!client) return;
    try {
      setVerifying(true); setMessage("");
      const { error } = await client.auth.verifyOtp({ email: cleanEmail, token: cleanOtp, type: "email" });
      if (error) throw error;
      setMessage("验证成功，正在进入管理员面板…"); window.setTimeout(() => window.location.reload(), 250);
    } catch (error) { console.error(error); setMessage(authErrorMessage(error, "验证码验证失败，请检查后重试。")); }
    finally { setVerifying(false); }
  }

  async function signOut() {
    const client = getSupabaseClient(); if (!client) return;
    await client.auth.signOut(); setData(null); setCurrentEmail(""); setOtpSent(false); setOtp(""); setMessage("");
  }

  const filteredMembers = useMemo(() => {
    if (!data) return [];
    const needle = query.trim().toLowerCase();
    const result = data.members.filter((member) => {
      if (needle && !searchableText(member).includes(needle)) return false;
      if (filter === "v2" && member.profileVersion !== 2) return false;
      if (filter === "pool" && !member.discoverable) return false;
      if (filter === "needs_core" && member.completion >= 100) return false;
      if (filter === "enriched" && member.enrichmentCompletion < 5) return false;
      if (filter === "public_qq" && !member.showQq) return false;
      if (filter === "bound_email" && !member.boundEmail) return false;
      if (filter === "negative" && member.receivedNegative <= 0) return false;
      return true;
    });
    result.sort((a, b) => {
      if (sort === "completion") return b.completion - a.completion || b.enrichmentCompletion - a.enrichmentCompletion;
      if (sort === "name") return a.name.localeCompare(b.name, "zh-CN");
      if (sort === "feedback") return b.receivedNegative - a.receivedNegative || b.receivedPositive - a.receivedPositive;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
    return result;
  }, [data, query, filter, sort]);

  function toggleExportGroup(group: ExportGroup) {
    setExportGroups((current) => {
      const next = new Set(current);
      if (next.has(group)) next.delete(group); else next.add(group);
      return next;
    });
  }

  if (loading) return <main className="adminShell"><div className="adminLoading">正在验证管理员身份…</div></main>;

  if (!data) return <main className="adminShell adminLoginShell"><a className="adminBack" href="/">← 返回方块搭子</a><section className="adminLoginCard"><div className="adminKicker">ECNUMC MATCH · ADMIN</div><h1>管理员面板</h1><p>使用管理员邮箱的 6 位验证码登录。无需点击邮件链接，验证码只用于验证管理员身份。</p>{currentEmail ? <div className="adminWrongAccount">当前登录邮箱：<strong>{currentEmail}</strong><button onClick={signOut}>退出并更换账号</button></div> : <><label className="adminEmailField"><span>管理员邮箱</span><input value={email} onChange={(event) => { setEmail(event.target.value); if (otpSent) { setOtpSent(false); setOtp(""); setMessage(""); } }} type="email" disabled={sending || verifying} /></label>{otpSent && <label className="adminEmailField"><span>6 位验证码</span><input value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))} type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="000000" /></label>}{otpSent ? <><button className="adminLoginButton" onClick={verifyLoginCode} disabled={verifying || otp.length !== 6}>{verifying ? "正在验证…" : "验证并进入管理员面板"}</button><button className="adminLoginButton secondary" onClick={sendLoginCode} disabled={sending || cooldown > 0}>{cooldown > 0 ? `${cooldown} 秒后可重新发送` : sending ? "正在发送…" : "重新发送验证码"}</button></> : <button className="adminLoginButton" onClick={sendLoginCode} disabled={sending}>{sending ? "正在发送…" : "发送 6 位管理员验证码"}</button>}</>}{message && <div className="adminMessage">{message}</div>}</section></main>;

  const stats = data.stats;
  return <main className="adminShell">
    <header className="adminHeader"><div><div className="adminKicker">ECNUMC MATCH · INTERNAL TEST</div><h1>方块搭子 · 内测数据</h1><p>管理员：{currentEmail}</p></div><div className="adminHeaderActions"><a href="/">返回主站</a><button onClick={() => setExportOpen((v) => !v)}>导出 Excel</button><button onClick={signOut}>退出管理</button></div></header>

    <section className="adminStats">
      <Stat label="已建立资料" value={stats.profileCount} hint="保存过身份资料的成员" />
      <Stat label="进入匹配池" value={stats.discoverableCount} hint="当前可参与匹配" />
      <Stat label="基础画像完成" value={stats.completeCount} hint="V2 三核心模块 / V1 全量问卷" />
      <Stat label="V2 画像" value={stats.v2Count} hint="已经升级到 V2 的成员" />
      <Stat label="补充画像 5/5" value={stats.enrichedCount} hint="五个增强模块均完成" />
      <Stat label="公开 QQ" value={stats.publicQqCount} hint="仅玩家主动公开" />
      <Stat label="绑定邮箱" value={stats.boundEmailCount} hint="可跨设备恢复资料" />
      <Stat label="近 7 天新增" value={stats.recent7dCount} hint="按资料创建时间" />
      <Stat label="匹配反馈" value={stats.feedbackCount} hint={`其中 ${stats.negativeFeedbackCount} 条不太合适`} />
      <Stat label="QQ 被复制" value={stats.qqCopyCount} hint="可作为真实联系意向信号" />
    </section>

    {exportOpen && <section className="adminExportPanel">
      <div className="adminExportHeader"><div><span>EXPORT</span><h2>导出成员数据</h2><p>勾选需要的字段类型。隐藏 QQ 不会被导出；公开 QQ 才会出现在文件中。</p></div><button onClick={() => setExportOpen(false)}>关闭</button></div>
      <div className="adminExportGrid">{EXPORT_GROUPS.map((item) => <label key={item.key} className={exportGroups.has(item.key) ? "checked" : ""}><input type="checkbox" checked={exportGroups.has(item.key)} onChange={() => toggleExportGroup(item.key)} /><span><strong>{item.label}</strong><small>{item.hint}</small></span></label>)}</div>
      <div className="adminExportFooter"><label><input type="checkbox" checked={exportFilteredOnly} onChange={(e) => setExportFilteredOnly(e.target.checked)} />只导出当前搜索 / 筛选结果（{filteredMembers.length} 人）</label><div><button onClick={() => setExportGroups(new Set(EXPORT_GROUPS.map((item) => item.key)))}>全选</button><button onClick={() => setExportGroups(new Set())}>清空</button><button className="primary" onClick={() => { try { exportExcel(exportFilteredOnly ? filteredMembers : data.members, exportGroups); } catch (error) { setMessage(error instanceof Error ? error.message : "导出失败"); } }}>生成 Excel</button></div></div>
    </section>}

    <section className="adminMemberSection">
      <div className="adminMemberTop"><div><span>MEMBERS</span><h2>成员画像与 Tag</h2><p>{query ? `“${query}” 找到 ${filteredMembers.length} 位成员` : `当前显示 ${filteredMembers.length} / ${data.members.length} 位成员`}</p></div><div className="adminSearchWrap"><input className="adminSearch" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="例如：红石、GTNH、建筑、语音、昵称……" />{query && <button onClick={() => setQuery("")}>清空</button>}</div></div>

      <div className="adminQuickInterests"><span>快速找玩法：</span>{V2_INTERESTS.map((item) => <button key={item.key} className={query === item.label ? "active" : ""} onClick={() => setQuery(query === item.label ? "" : item.label)}>{item.icon} {item.label}</button>)}</div>

      <div className="adminToolbar"><label>筛选<select value={filter} onChange={(e) => setFilter(e.target.value as MemberFilter)}><option value="all">全部成员</option><option value="v2">仅 V2</option><option value="pool">仅匹配池</option><option value="needs_core">基础画像未完成</option><option value="enriched">补充画像 5/5</option><option value="public_qq">公开 QQ</option><option value="bound_email">绑定邮箱</option><option value="negative">收到“不太合适”反馈</option></select></label><label>排序<select value={sort} onChange={(e) => setSort(e.target.value as MemberSort)}><option value="updated">最近更新</option><option value="completion">画像完成度</option><option value="name">昵称</option><option value="feedback">负反馈优先</option></select></label><span className="adminResultCount">{filteredMembers.length} 人</span></div>

      <div className="adminMemberList">{filteredMembers.length ? filteredMembers.map((member) => {
        const tags = positiveInterestTags(member);
        return <details className="adminMemberCard" key={member.id}><summary><div className="adminMemberAvatar">{member.name.slice(0, 1).toUpperCase()}</div><div className="adminMemberIdentity"><div className="adminNameRow"><strong>{member.name}</strong><span className={`adminVersion v${member.profileVersion}`}>V{member.profileVersion}</span>{member.v2CurrentIntents.length > 0 && <span className="adminIntentBadge">🔥 有近期意向</span>}</div><p>{member.intro || "未填写自我介绍"}</p><div className="adminTagRow">{tags.map((item) => <span className={item.intent ? "intent" : ""} key={item.key}>{item.intent ? "🔥 " : ""}{item.label}{member.profileVersion === 2 ? ` ${item.score}/4` : ""}</span>)}</div></div><div className="adminMemberMeta"><b>{member.completion}%</b><span>基础画像</span><small>补充 {member.enrichmentCompletion}/5 · {formatDate(member.updatedAt)} 更新</small></div></summary>
          <div className="adminMemberDetails"><div className="adminStatusRow"><span className={member.discoverable ? "ok" : "muted"}>{member.discoverable ? "在匹配池" : "未进入匹配池"}</span><span className={member.showQq ? "ok" : "muted"}>{member.showQq ? `公开 QQ ${member.publicQq ?? ""}` : "QQ 隐藏"}</span><span className={member.boundEmail ? "ok" : "muted"}>{member.boundEmail ? "邮箱已绑定" : "匿名身份"}</span><span className="muted">创建于 {formatDate(member.createdAt)}</span>{member.receivedNegative > 0 && <span className="warn">收到 {member.receivedNegative} 条“不太合适”</span>}</div>
            {member.profileVersion === 2 ? <div className="adminDimensionGrid v2"><Dimension label="玩法兴趣" value={formatInterest(member)} /><Dimension label="最近最想玩" value={member.v2CurrentIntents.length ? member.v2CurrentIntents.map((key) => interestMap.get(key)?.label ?? key).join(" · ") : "未标记"} /><Dimension label="上线时间" value={formatAvailability(member)} /><Dimension label="核心习惯" value={formatPlaystyle(member)} /><Dimension label="队伍与存档" value={formatBoundaries(member, ["groupSize", "duration"])} /><Dimension label="沟通边界" value={formatBoundaries(member, ["voice", "asyncProgress"])} /><Dimension label="约局 / 资源" value={formatPlaystyle(member, ["sessionPlanning", "resourceSharing"])} /><Dimension label="队伍角色" value={formatRoles(member)} /><Dimension label="教学与研究" value={formatLearning(member)} /><Dimension label="匹配反馈" value={`👍 ${member.receivedPositive} · 😐 ${member.receivedNeutral} · 👎 ${member.receivedNegative} · QQ复制 ${member.qqCopyCount}`} /></div> : <div className="adminDimensionGrid"><Dimension label={fieldLabels.pace} value={labelFor("pace", member.pace)} /><Dimension label={fieldLabels.availability} value={formatAvailability(member)} /><Dimension label={fieldLabels.duration} value={labelFor("duration", member.duration)} /><Dimension label={fieldLabels.groupSize} value={labelFor("groupSize", member.groupSize)} /><Dimension label={fieldLabels.collaboration} value={labelFor("collaboration", member.collaboration)} /><Dimension label={fieldLabels.communication} value={labelFor("communication", member.communication)} /><Dimension label={fieldLabels.sessionStyle} value={labelFor("sessionStyle", member.sessionStyle)} /><Dimension label={fieldLabels.resourceStyle} value={labelFor("resourceStyle", member.resourceStyle)} /><Dimension label={fieldLabels.research} value={labelFor("research", member.research)} /><Dimension label={fieldLabels.experienceStyle} value={labelFor("experienceStyle", member.experienceStyle)} /></div>}
          </div></details>;
      }) : <div className="adminEmpty"><strong>没有找到成员</strong><span>可以清空搜索词或切换筛选条件。</span></div>}</div>
    </section>
    {message && <div className="adminFloatingMessage">{message}</div>}
  </main>;
}

function Stat({ label, value, hint }: { label: string; value: number; hint: string }) { return <article className="adminStatCard"><span>{label}</span><strong>{value}</strong><small>{hint}</small></article>; }
function Dimension({ label, value }: { label: string; value: string }) { return <div className="adminDimension"><span>{label}</span><strong>{value}</strong></div>; }
