"use client";

import { useEffect, useState } from "react";
import { loadCommunityData } from "@/lib/community-store";
import { getSupabaseClient } from "@/lib/supabase";

export default function AccountControl() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [boundEmail, setBoundEmail] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (window.location.pathname.startsWith("/admin")) return;
    const maybeClient = getSupabaseClient();
    if (!maybeClient) return;
    const client = maybeClient;

    const refresh = async () => {
      const { data } = await client.auth.getUser();
      const user = data.user;
      setIsAnonymous(user?.is_anonymous ?? true);
      setBoundEmail(user?.email ?? "");
    };

    refresh().catch(console.error);
    const { data: listener } = client.auth.onAuthStateChange(() => {
      refresh().catch(console.error);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const onAdminPage = typeof window !== "undefined" && window.location.pathname.startsWith("/admin");
  if (onAdminPage) return null;

  async function protectCurrentProfile() {
    const cleanEmail = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) {
      setMessage("请输入有效的邮箱地址。");
      return;
    }

    const client = getSupabaseClient();
    if (!client) {
      setMessage("当前未连接成员数据库。");
      return;
    }

    try {
      setBusy(true);
      setMessage("");
      const community = await loadCommunityData();
      if (!community.ownName || !community.ownQq) {
        setMessage("请先填写并保存昵称、QQ 和身份资料，再绑定邮箱。");
        return;
      }

      const { data: userData, error: userError } = await client.auth.getUser();
      if (userError) throw userError;
      if (!userData.user?.is_anonymous) {
        setBoundEmail(userData.user?.email ?? "");
        setIsAnonymous(false);
        setMessage("这份资料已经绑定邮箱，无需重复绑定。");
        return;
      }

      const { error } = await client.auth.updateUser(
        { email: cleanEmail },
        { emailRedirectTo: `${window.location.origin}/` }
      );
      if (error) throw error;
      setMessage("确认邮件已发送。打开邮件中的链接完成绑定后，这份画像就可以跨设备恢复。\n如果链接没有回到当前站点，需要把当前内测域名加入 Supabase Auth Redirect URLs。");
    } catch (error) {
      console.error(error);
      setMessage(error instanceof Error ? error.message : "绑定邮箱失败，请稍后重试。");
    } finally {
      setBusy(false);
    }
  }

  async function restoreProfile() {
    const cleanEmail = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) {
      setMessage("请输入之前绑定过的邮箱地址。");
      return;
    }

    const client = getSupabaseClient();
    if (!client) {
      setMessage("当前未连接成员数据库。");
      return;
    }

    try {
      setBusy(true);
      setMessage("");
      const { error } = await client.auth.signInWithOtp({
        email: cleanEmail,
        options: {
          shouldCreateUser: false,
          emailRedirectTo: `${window.location.origin}/`,
        },
      });
      if (error) throw error;
      setMessage("恢复邮件已发送。打开邮件中的登录链接后，会重新载入原来的昵称、QQ、自我介绍和全部匹配答案。");
    } catch (error) {
      console.error(error);
      setMessage(error instanceof Error ? error.message : "发送恢复邮件失败，请稍后重试。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button className="accountFloatButton" onClick={() => { setOpen(true); setMessage(""); }}>
        <span>{!isAnonymous && boundEmail ? "✓" : "◇"}</span>
        {!isAnonymous && boundEmail ? "资料已保护" : "保护 / 恢复资料"}
      </button>

      {open && (
        <div className="accountOverlay" role="dialog" aria-modal="true" aria-label="保护或恢复资料">
          <div className="accountModal">
            <button className="accountClose" onClick={() => setOpen(false)} aria-label="关闭">×</button>
            <div className="accountKicker">PLAYER PROFILE</div>
            {!isAnonymous && boundEmail ? (
              <>
                <h2>这份资料已经可以找回</h2>
                <p>绑定邮箱：<strong>{boundEmail}</strong></p>
                <div className="accountProtectedNote">
                  即使清除浏览器数据或更换设备，也可以使用这个邮箱重新恢复昵称、QQ、自我介绍和匹配画像。
                </div>
              </>
            ) : (
              <>
                <h2>不登录，也可以保护这份资料</h2>
                <p>平时仍然保持免登录使用。只有换设备或清除浏览器数据时，才需要通过邮箱恢复。</p>
                <label className="accountEmailField">
                  <span>邮箱</span>
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="name@example.com"
                    autoComplete="email"
                  />
                </label>
                <div className="accountActions">
                  <button className="accountPrimary" disabled={busy} onClick={protectCurrentProfile}>
                    {busy ? "处理中…" : "保护当前资料"}
                  </button>
                  <button className="accountSecondary" disabled={busy} onClick={restoreProfile}>
                    已绑定过邮箱？恢复资料
                  </button>
                </div>
                <small className="accountPrivacy">邮箱只用于身份恢复，不会出现在其他成员的匹配卡片中。</small>
              </>
            )}
            {message && <div className="accountMessage">{message}</div>}
          </div>
        </div>
      )}
    </>
  );
}
