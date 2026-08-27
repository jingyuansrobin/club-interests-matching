"use client";

import { useEffect, useState } from "react";
import { loadCommunityData } from "@/lib/community-store";
import { getSupabaseClient } from "@/lib/supabase";

type OtpMode = "protect" | "restore" | null;

function authErrorMessage(error: unknown, fallback: string) {
  const raw = error instanceof Error ? error.message : "";
  const lower = raw.toLowerCase();
  if (lower.includes("email rate limit exceeded") || lower.includes("rate limit")) {
    return "邮件发送过于频繁，请稍后再试。验证码发送后 60 秒内无需重复请求。";
  }
  if (lower.includes("token has expired") || lower.includes("otp expired")) {
    return "验证码已过期，请重新获取。";
  }
  if (lower.includes("invalid") && (lower.includes("token") || lower.includes("otp"))) {
    return "验证码不正确，请检查后重试。";
  }
  return raw || fallback;
}

export default function AccountControl() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [otpMode, setOtpMode] = useState<OtpMode>(null);
  const [boundEmail, setBoundEmail] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
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
      window.setTimeout(() => refresh().catch(console.error), 0);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setInterval(() => {
      setCooldown((value) => Math.max(0, value - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  const onAdminPage = typeof window !== "undefined" && window.location.pathname.startsWith("/admin");
  if (onAdminPage) return null;

  function cleanEmail() {
    return email.trim().toLowerCase();
  }

  function validEmail(value: string) {
    return /^\S+@\S+\.\S+$/.test(value);
  }

  async function sendProtectOtp() {
    const normalizedEmail = cleanEmail();
    if (!validEmail(normalizedEmail)) {
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

      const { error } = await client.auth.updateUser({ email: normalizedEmail });
      if (error) throw error;
      setOtpMode("protect");
      setOtp("");
      setCooldown(60);
      setMessage("6 位验证码已发送到邮箱。输入验证码后，这份资料才会正式绑定。无需点击邮件中的链接。");
    } catch (error) {
      console.error(error);
      setMessage(authErrorMessage(error, "验证码发送失败，请稍后重试。"));
    } finally {
      setBusy(false);
    }
  }

  async function sendRestoreOtp() {
    const normalizedEmail = cleanEmail();
    if (!validEmail(normalizedEmail)) {
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
        email: normalizedEmail,
        options: { shouldCreateUser: false },
      });
      if (error) throw error;
      setOtpMode("restore");
      setOtp("");
      setCooldown(60);
      setMessage("6 位恢复验证码已发送到邮箱。请直接在这里输入验证码。" );
    } catch (error) {
      console.error(error);
      setMessage(authErrorMessage(error, "发送恢复验证码失败，请稍后重试。"));
    } finally {
      setBusy(false);
    }
  }

  async function verifyOtp() {
    const normalizedEmail = cleanEmail();
    const normalizedOtp = otp.replace(/\D/g, "");
    if (!otpMode) return;
    if (!/^\d{6}$/.test(normalizedOtp)) {
      setMessage("请输入邮件中的 6 位数字验证码。");
      return;
    }

    const client = getSupabaseClient();
    if (!client) return;

    try {
      setBusy(true);
      setMessage("");
      const { error } = await client.auth.verifyOtp({
        email: normalizedEmail,
        token: normalizedOtp,
        type: otpMode === "protect" ? "email_change" : "email",
      });
      if (error) throw error;

      if (otpMode === "protect") {
        const { data } = await client.auth.getUser();
        setBoundEmail(data.user?.email ?? normalizedEmail);
        setIsAnonymous(data.user?.is_anonymous ?? false);
        setOtpMode(null);
        setOtp("");
        setMessage("邮箱绑定成功。以后清缓存或换设备，都可以用这个邮箱和验证码恢复资料。");
      } else {
        setMessage("身份恢复成功，正在载入原来的玩家资料…");
        window.setTimeout(() => window.location.reload(), 350);
      }
    } catch (error) {
      console.error(error);
      setMessage(authErrorMessage(error, "验证码验证失败，请检查后重试。"));
    } finally {
      setBusy(false);
    }
  }

  async function resendOtp() {
    if (cooldown > 0 || busy || !otpMode) return;
    if (otpMode === "protect") await sendProtectOtp();
    else await sendRestoreOtp();
  }

  function resetOtpFlow() {
    setOtpMode(null);
    setOtp("");
    setMessage("");
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
                  即使清除浏览器数据或更换设备，也可以使用这个邮箱的 6 位验证码恢复昵称、QQ、自我介绍和匹配画像。
                </div>
              </>
            ) : (
              <>
                <h2>{otpMode ? "输入 6 位邮箱验证码" : "不登录，也可以保护这份资料"}</h2>
                <p>{otpMode ? `验证码已发送到 ${cleanEmail()}，无需打开任何登录链接。` : "平时仍然保持免登录使用。只有换设备或清除浏览器数据时，才需要邮箱验证码恢复。"}</p>
                <label className="accountEmailField">
                  <span>邮箱</span>
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => {
                      setEmail(event.target.value);
                      if (otpMode) resetOtpFlow();
                    }}
                    placeholder="name@example.com"
                    autoComplete="email"
                    disabled={busy}
                  />
                </label>

                {otpMode ? (
                  <>
                    <label className="accountEmailField">
                      <span>6 位验证码</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        maxLength={6}
                        value={otp}
                        onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))}
                        placeholder="000000"
                      />
                    </label>
                    <div className="accountActions">
                      <button className="accountPrimary" disabled={busy || otp.length !== 6} onClick={verifyOtp}>
                        {busy ? "正在验证…" : otpMode === "protect" ? "确认绑定" : "确认并恢复资料"}
                      </button>
                      <button className="accountSecondary" disabled={busy || cooldown > 0} onClick={resendOtp}>
                        {cooldown > 0 ? `${cooldown} 秒后可重新发送` : "重新发送验证码"}
                      </button>
                      <button className="accountSecondary" disabled={busy} onClick={resetOtpFlow}>
                        返回修改邮箱
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="accountActions">
                    <button className="accountPrimary" disabled={busy} onClick={sendProtectOtp}>
                      {busy ? "正在发送…" : "保护当前资料"}
                    </button>
                    <button className="accountSecondary" disabled={busy} onClick={sendRestoreOtp}>
                      已绑定过邮箱？恢复资料
                    </button>
                  </div>
                )}
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
