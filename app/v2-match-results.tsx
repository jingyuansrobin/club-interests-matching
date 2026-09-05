"use client";

import { useEffect, useState } from "react";
import { recordMatchFeedback } from "@/lib/v2-store";
import type { V2Match } from "@/lib/v2-types";

export default function V2MatchResults({ matches, coreComplete, matching }: { matches: V2Match[]; coreComplete: boolean; matching: boolean }) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [pendingCopy, setPendingCopy] = useState<V2Match | null>(null);
  const [copyError, setCopyError] = useState("");
  const [feedback, setFeedback] = useState<Record<string, "positive" | "neutral" | "negative">>({});
  const top = matches.slice(0, 3);

  useEffect(() => {
    if (!pendingCopy) return;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setPendingCopy(null);
        setCopyError("");
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => {
      document.body.style.overflow = oldOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [pendingCopy]);

  function requestCopyQq(match: V2Match) {
    if (!match.qq) return;
    setPendingCopy(match);
    setCopyError("");
  }

  async function confirmCopyQq() {
    const match = pendingCopy;
    if (!match?.qq) return;
    try {
      await navigator.clipboard.writeText(match.qq);
      setCopiedId(match.id);
      setPendingCopy(null);
      setCopyError("");
      window.setTimeout(() => setCopiedId(null), 1600);
      recordMatchFeedback(match.id, { qqCopied: true }).catch(console.error);
    } catch {
      setCopyError("浏览器没有允许自动复制。你可以手动复制下方 QQ，但仍请先完成群内身份确认。");
    }
  }

  async function sendFeedback(match: V2Match, value: "positive" | "neutral" | "negative") {
    setFeedback((current) => ({ ...current, [match.id]: value }));
    try {
      await recordMatchFeedback(match.id, { feedback: value });
    } catch (error) {
      console.error(error);
    }
  }

  return <>
    <aside className="v2Results">
      <div className="resultHeading v2ResultHeading">
        <div><span>MATCHES</span><h2>{coreComplete ? "最适合你的方块搭子" : top.length ? "初步推荐" : "正在认识你"}</h2></div>
        {matching ? <div className="liveDot"><i />重新计算中</div> : top.length ? <div className="liveDot"><i />服务端匹配</div> : null}
      </div>
      {!top.length ? <div className="v2Waiting glassCard"><div className="v2Radar">◎</div><h3>先告诉我们一点你的玩法</h3><p>完成第一屏后，这里就会开始出现社团里的潜在搭子。精细画像只在服务端参与计算。</p></div> : <div className="v2MatchList">
        {top.map((match, index) => <article className={`v2MatchCard ${index === 0 ? "top" : ""}`} key={match.id}>
          {index === 0 && <span className="v2RecommendTag">TOP MATCH</span>}
          <span className="v2Rank">0{index + 1}</span>
          <div className="v2MatchHead">
            <div className="memberAvatar">{match.name.slice(0, 1).toUpperCase()}</div>
            <div className="v2MatchIdentity"><h3>{match.name}</h3><p>{match.intro}</p></div>
            <div className="v2MatchScore">{coreComplete ? <><strong>{match.score}%</strong><span>匹配度</span></> : <><strong>推荐</strong><span>初步判断</span></>}</div>
          </div>
          <div className="v2MatchConfidence"><span>了解程度 {match.confidence}%</span><div><i style={{ width: `${match.confidence}%` }} /></div>{match.profileVersion === 1 && <small>对方仍是旧版画像，置信度会保守计算</small>}</div>
          <div className="v2Reasons">{match.reasons.slice(0, 3).map((reason) => <span key={reason}>✓ {reason}</span>)}</div>
          {coreComplete && <div className="v2Feedback"><span>这个推荐怎么样？</span><div><button className={feedback[match.id] === "positive" ? "active" : ""} onClick={() => sendFeedback(match, "positive")}>👍 合适</button><button className={feedback[match.id] === "neutral" ? "active" : ""} onClick={() => sendFeedback(match, "neutral")}>😐 一般</button><button className={feedback[match.id] === "negative" ? "active" : ""} onClick={() => sendFeedback(match, "negative")}>👎 不太合适</button></div></div>}
          <div className="v2Contact">{match.qq ? <button onClick={() => requestCopyQq(match)}>{copiedId === match.id ? "已复制 QQ ✓" : "复制 QQ"}</button> : <span>TA 暂未选择展示 QQ</span>}</div>
        </article>)}
      </div>}
    </aside>

    {pendingCopy?.qq && <div className="v2SafetyModalBackdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) {
        setPendingCopy(null);
        setCopyError("");
      }
    }}>
      <section className="v2SafetyModal" role="dialog" aria-modal="true" aria-labelledby="v2SafetyTitle" aria-describedby="v2SafetyDescription">
        <button className="v2SafetyClose" aria-label="关闭安全提醒" onClick={() => { setPendingCopy(null); setCopyError(""); }}>×</button>
        <div className="v2SafetyIcon" aria-hidden="true">!</div>
        <div className="v2SafetyKicker">添加好友前请先核验身份</div>
        <h2 id="v2SafetyTitle">谨防冒充与诈骗</h2>
        <p id="v2SafetyDescription">你准备复制 <strong>{pendingCopy.name}</strong> 的 QQ。请务必先在社团大群 <strong>「ECNU水杉方块社」</strong> 中确认群内确实有这个人，并核对昵称 / QQ 等身份信息，再决定是否添加。</p>
        <div className="v2SafetyNotice">
          <strong>如果群内无法确认身份，请不要添加。</strong>
          <span>遇到转账、验证码、账号密码、屏幕共享、远程控制或可疑链接等要求时，请立即停止操作，并向社团管理员核实。</span>
        </div>
        <div className="v2SafetyQq"><span>待复制 QQ</span><strong>{pendingCopy.qq}</strong></div>
        {copyError && <div className="v2SafetyError">{copyError}</div>}
        <div className="v2SafetyActions">
          <button className="secondary" onClick={() => { setPendingCopy(null); setCopyError(""); }}>取消</button>
          <button className="primary" onClick={confirmCopyQq}>我已在群内确认，复制 QQ</button>
        </div>
        <small className="v2SafetyFootnote">本网站只提供成员匹配信息，不代表社团对任何账号身份、交易或私聊内容作担保。</small>
      </section>
    </div>}
  </>;
}
