"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { getSupabaseClient } from "@/lib/supabase";
import { loadCommunityData } from "@/lib/community-store";

export default function ProfileRecoveryControl() {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [hasProfile, setHasProfile] = useState(false);
  const [boundEmail, setBoundEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    function findTarget() {
      setTarget(document.querySelector<HTMLElement>(".navRight"));
    }
    findTarget();
    const observer = new MutationObserver(findTarget);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    Promise.all([supabase.auth.getUser(), loadCommunityData()])
      .then(([userResult, community]) => {
        setBoundEmail(userResult.data.user?.email ?? "");
        setHasProfile(Boolean(community.ownName && community.ownQq));
      })
      .catch((error) => console.error("Failed to inspect profile recovery state", error));
  }, []);

  async function bindCurrentProfile() {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      setMessage("请输入有效邮箱。");
      return;
    }
    if (!hasProfile) {
      setMessage("请先完成昵称和 QQ 信息，再绑定当前资料。");
      return;
    }

    const supabase = getSupabaseClient();
    if (!supabase) return;

    try {
      setBusy(true);
      setMessage("");
      const { error } = await supabase.auth.updateUser(
        { email: cleanEmail },
        { emailRedirectTo: window.location.href }
      );
      if (error) throw error;
      setMessage("验证邮件已发送。完成邮箱确认后，这份资料就可以跨浏览器恢复。");
    } catch (error) {
      console.error(error);
      setMessage(error instanceof Error ? error.message : "绑定失败，请稍后重试。");
    } finally {
      setBusy(false);
    }
  }

  async function restoreProfile() {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      setMessage("请输入之前绑定资料时使用的邮箱。");
      return;
    }

    const supabase = getSupabaseClient();
    if (!supabase) return;

    try {
      setBusy(true);
      setMessage("");
      const { error } = await supabase.auth.signInWithOtp({
        email: cleanEmail,
        options: {
          shouldCreateUser: false,
          emailRedirectTo: window.location.href,
        },
      });
      if (error) throw error;
      setMessage("恢复链接已发送到邮箱。打开邮件中的链接后，会自动恢复原资料。");
    } catch (error) {
      console.error(error);
      setMessage("没有找到可恢复的绑定资料，或邮件发送失败。请确认邮箱是否正确。");
    } finally {
      setBusy(false);
    }
  }

  if (!target) return null;

  return createPortal(
    <>
      <button className="recoveryNavButton" onClick={() => setOpen(true)}>
        {boundEmail ? "资料已绑定" : "保护 / 恢复资料"}
      </button>
      {open && (
        <div className="recoveryOverlay" onMouseDown={(event) => event.target === event.currentTarget && setOpen(false)}>
          <section className="recoveryDialog glassCard">
            <button className="recoveryClose" onClick={() => setOpen(false)} aria-label="关闭">×</button>
            <div className="stepTag">PROFILE RECOVERY</div>
            <h2>保护或恢复你的搭子资料</h2>
            <p>网站仍然可以免登录使用。绑定邮箱只是为了在清缓存、换浏览器或换设备后找回原来的昵称、QQ、自我介绍和全部答题结果。</p>

            {boundEmail ? (
              <div className="recoveryBound">
                <strong>这份资料已经绑定邮箱</strong>
                <span>{boundEmail}</span>
                <small>以后清除浏览器数据后，可以通过这个邮箱恢复。</small>
              </div>
            ) : (
              <>
                <label className="recoveryField">
                  <span>邮箱</span>
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="例如 name@outlook.com"
                    autoComplete="email"
                  />
                </label>
                <div className="recoveryActions">
                  <button className="mainButton" disabled={busy || !hasProfile} onClick={bindCurrentProfile}>
                    {busy ? "处理中…" : "绑定当前资料"}
                  </button>
                  <button className="recoverySecondary" disabled={busy} onClick={restoreProfile}>
                    恢复已有资料
                  </button>
                </div>
                {!hasProfile && <small className="recoveryTip">当前浏览器还没有完整身份资料；你仍然可以使用“恢复已有资料”。</small>}
              </>
            )}
            {message && <div className="recoveryMessage">{message}</div>}
          </section>
        </div>
      )}
    </>,
    target
  );
}
