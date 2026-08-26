"use client";

import { useEffect, useMemo, useState } from "react";
import { questions } from "@/lib/questions";
import { getSupabaseClient } from "@/lib/supabase";
import "./admin.css";

type DashboardStats = {
  profileCount: number;
  discoverableCount: number;
  completeCount: number;
  publicQqCount: number;
  boundEmailCount: number;
  recent7dCount: number;
};

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
  boundEmail: boolean;
  createdAt: string;
  updatedAt: string;
  completion: number;
};

type AdminDashboardData = {
  stats: DashboardStats;
  members: AdminMember[];
};

const fieldLabels: Record<string, string> = {
  interests: "核心兴趣",
  pace: "推进节奏",
  availability: "上线时间",
  duration: "存档周期",
  groupSize: "组队规模",
  collaboration: "合作方式",
  roles: "游戏角色",
  communication: "沟通方式",
  research: "学习方式",
  sessionStyle: "约局方式",
  resourceStyle: "资源共享",
  experienceStyle: "经验关系",
};

const optionLabelMap = new Map<string, string>();
for (const question of questions) {
  for (const option of question.options) {
    optionLabelMap.set(`${question.field}:${option.value}`, option.label.replace(/^\S+\s*/, ""));
  }
}

function labelFor(field: string, value: string | null | undefined) {
  if (!value) return "未填写";
  return optionLabelMap.get(`${field}:${value}`) ?? value;
}

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export default function AdminPage() {
  const [email, setEmail] = useState("ruihaotan@outlook.com");
  const [currentEmail, setCurrentEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [data, setData] = useState<AdminDashboardData | null>(null);
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    const maybeClient = getSupabaseClient();
    if (!maybeClient) {
      setMessage("Supabase 未配置，管理员面板无法加载。");
      setLoading(false);
      return;
    }
    const client = maybeClient;

    const load = async () => {
      setLoading(true);
      setMessage("");
      const { data: userData } = await client.auth.getUser();
      const user = userData.user;
      setCurrentEmail(user?.email ?? "");

      if (!user?.email) {
        setData(null);
        setLoading(false);
        return;
      }

      const { data: dashboard, error } = await client.rpc("get_admin_dashboard");
      if (error) {
        setData(null);
        setMessage("当前账号没有管理员权限，或管理数据暂时无法读取。");
      } else {
        setData(dashboard as AdminDashboardData);
      }
      setLoading(false);
    };

    load().catch((error) => {
      console.error(error);
      setMessage("管理员数据加载失败。");
      setLoading(false);
    });

    const { data: listener } = client.auth.onAuthStateChange(() => {
      window.setTimeout(() => load().catch(console.error), 0);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  async function sendLoginLink() {
    const cleanEmail = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) {
      setMessage("请输入有效邮箱。");
      return;
    }

    const client = getSupabaseClient();
    if (!client) return;

    try {
      setSending(true);
      setMessage("");
      const { error } = await client.auth.signInWithOtp({
        email: cleanEmail,
        options: {
          shouldCreateUser: false,
          emailRedirectTo: `${window.location.origin}/admin/`,
        },
      });
      if (error) throw error;
      setMessage("管理员登录邮件已发送。打开邮件中的链接后会返回这个页面。首次使用前，请先在主站用“保护 / 恢复资料”把管理员邮箱绑定到现有身份。只有数据库白名单邮箱能够读取管理数据。");
    } catch (error) {
      console.error(error);
      setMessage(error instanceof Error ? error.message : "登录邮件发送失败。首次使用请先回主站绑定管理员邮箱。");
    } finally {
      setSending(false);
    }
  }

  async function signOut() {
    const client = getSupabaseClient();
    if (!client) return;
    await client.auth.signOut();
    setData(null);
    setCurrentEmail("");
    setMessage("");
  }

  const filteredMembers = useMemo(() => {
    if (!data) return [];
    const needle = query.trim().toLowerCase();
    if (!needle) return data.members;
    return data.members.filter((member) => {
      const values = [
        member.name,
        member.intro,
        ...member.interests,
        ...member.roles,
        member.pace ?? "",
        member.groupSize ?? "",
      ];
      return values.some((value) => value.toLowerCase().includes(needle));
    });
  }, [data, query]);

  if (loading) {
    return <main className="adminShell"><div className="adminLoading">正在验证管理员身份…</div></main>;
  }

  if (!data) {
    return (
      <main className="adminShell adminLoginShell">
        <a className="adminBack" href="/">← 返回方块搭子</a>
        <section className="adminLoginCard">
          <div className="adminKicker">ECNUMC MATCH · ADMIN</div>
          <h1>管理员面板</h1>
          <p>通过管理员邮箱的 Magic Link 登录。首次使用请先在主站把管理员邮箱绑定到当前资料，避免生成与玩家画像分离的账号。</p>
          {currentEmail ? (
            <div className="adminWrongAccount">
              当前登录邮箱：<strong>{currentEmail}</strong>
              <button onClick={signOut}>退出并更换账号</button>
            </div>
          ) : (
            <>
              <label className="adminEmailField">
                <span>管理员邮箱</span>
                <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" />
              </label>
              <button className="adminLoginButton" onClick={sendLoginLink} disabled={sending}>
                {sending ? "正在发送…" : "发送管理员登录邮件"}
              </button>
            </>
          )}
          {message && <div className="adminMessage">{message}</div>}
        </section>
      </main>
    );
  }

  const stats = data.stats;
  return (
    <main className="adminShell">
      <header className="adminHeader">
        <div>
          <div className="adminKicker">ECNUMC MATCH · INTERNAL TEST</div>
          <h1>方块搭子 · 内测数据</h1>
          <p>管理员：{currentEmail}</p>
        </div>
        <div className="adminHeaderActions">
          <a href="/">返回主站</a>
          <button onClick={signOut}>退出管理</button>
        </div>
      </header>

      <section className="adminStats">
        <Stat label="已建立资料" value={stats.profileCount} hint="至少保存过昵称 / QQ 的成员" />
        <Stat label="进入匹配池" value={stats.discoverableCount} hint="已回答核心兴趣" />
        <Stat label="完成全部问题" value={stats.completeCount} hint="12 个维度均已填写" />
        <Stat label="公开 QQ" value={stats.publicQqCount} hint="仅统计公开意愿，不展示隐藏号码" />
        <Stat label="绑定邮箱" value={stats.boundEmailCount} hint="清缓存后仍可恢复资料" />
        <Stat label="近 7 天新增" value={stats.recent7dCount} hint="按资料首次创建时间" />
      </section>

      <section className="adminMemberSection">
        <div className="adminMemberTop">
          <div>
            <span>MEMBERS</span>
            <h2>成员画像与 Tag</h2>
          </div>
          <input
            className="adminSearch"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索昵称、介绍、兴趣或角色"
          />
        </div>

        <div className="adminMemberList">
          {filteredMembers.length ? filteredMembers.map((member) => (
            <details className="adminMemberCard" key={member.id}>
              <summary>
                <div className="adminMemberAvatar">{member.name.slice(0, 1).toUpperCase()}</div>
                <div className="adminMemberIdentity">
                  <strong>{member.name}</strong>
                  <p>{member.intro || "未填写自我介绍"}</p>
                  <div className="adminTagRow">
                    {member.interests.slice(0, 3).map((item) => <span key={item}>{labelFor("interests", item)}</span>)}
                    {member.roles.slice(0, 2).map((item) => <span key={item}>{labelFor("roles", item)}</span>)}
                  </div>
                </div>
                <div className="adminMemberMeta">
                  <b>{member.completion}%</b>
                  <span>画像完成度</span>
                  <small>{formatDate(member.updatedAt)} 更新</small>
                </div>
              </summary>

              <div className="adminMemberDetails">
                <div className="adminStatusRow">
                  <span className={member.discoverable ? "ok" : "muted"}>{member.discoverable ? "在匹配池" : "未进入匹配池"}</span>
                  <span className={member.showQq ? "ok" : "muted"}>{member.showQq ? "QQ 已公开" : "QQ 隐藏"}</span>
                  <span className={member.boundEmail ? "ok" : "muted"}>{member.boundEmail ? "邮箱已绑定" : "匿名身份"}</span>
                  <span className="muted">创建于 {formatDate(member.createdAt)}</span>
                </div>
                <div className="adminDimensionGrid">
                  <Dimension label={fieldLabels.pace} value={labelFor("pace", member.pace)} />
                  <Dimension label={fieldLabels.availability} value={member.availability.length ? member.availability.map((v) => labelFor("availability", v)).join(" · ") : "未填写"} />
                  <Dimension label={fieldLabels.duration} value={labelFor("duration", member.duration)} />
                  <Dimension label={fieldLabels.groupSize} value={labelFor("groupSize", member.groupSize)} />
                  <Dimension label={fieldLabels.collaboration} value={labelFor("collaboration", member.collaboration)} />
                  <Dimension label={fieldLabels.communication} value={labelFor("communication", member.communication)} />
                  <Dimension label={fieldLabels.sessionStyle} value={labelFor("sessionStyle", member.sessionStyle)} />
                  <Dimension label={fieldLabels.resourceStyle} value={labelFor("resourceStyle", member.resourceStyle)} />
                  <Dimension label={fieldLabels.research} value={labelFor("research", member.research)} />
                  <Dimension label={fieldLabels.experienceStyle} value={labelFor("experienceStyle", member.experienceStyle)} />
                </div>
              </div>
            </details>
          )) : <div className="adminEmpty">当前没有符合条件的成员。</div>}
        </div>
      </section>
    </main>
  );
}

function Stat({ label, value, hint }: { label: string; value: number; hint: string }) {
  return <article className="adminStatCard"><span>{label}</span><strong>{value}</strong><small>{hint}</small></article>;
}

function Dimension({ label, value }: { label: string; value: string }) {
  return <div className="adminDimension"><span>{label}</span><strong>{value}</strong></div>;
}
