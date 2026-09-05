"use client";

import { useState } from "react";
import { recordMatchFeedback } from "@/lib/v2-store";
import type { V2Match } from "@/lib/v2-types";

export default function V2MatchResults({ matches, coreComplete, matching }: { matches: V2Match[]; coreComplete: boolean; matching: boolean }) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [pendingCopy, setPendingCopy] = useState<V2Match | null>(null);
  const [feedback, setFeedback] = useState<Record<string, "positive" | "neutral" | "negative">>({});
  const top = matches.slice(0, 3);

  async function confirmCopyQq() {
    const match = pendingCopy;
    if (!match?.qq) return;
    try {
      await navigator.clipboard.writeText(match.qq);
      setCopiedId(match.id);
      setPendingCopy(null);
      window.setTimeout(() => setCopiedId(null), 1600);
      recordMatchFeedback(match.id, { qqCopied: true }).catch(console.error);
    } catch {
      // Browser clipboard permission can fail; keep the match card usable.
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
          <div className="v2Contact">{match.qq ? <button onClick={() => setPendingCopy(match)}>{copiedId === match.id ? "已复制 QQ ✓" : "复制 QQ"}</button> : <span>TA 暂未选择展示 QQ</span>}</div>
        </article>)}
      </div>}
    </aside>

    {pendingCopy && <div className="v2SafetyModalBackdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setPendingCopy(null); }}>
      <section className="v2SafetyModal" role="dialog" aria-modal="true" aria-labelledby="v2SafetyTitle">
        <div className="v2SafetyIcon" aria-hidden="true">!</div>
        <div className="v2SafetyKicker">添加好友前请先核验身份</div>
        <h2 id="v2SafetyTitle">谨防诈骗</h2>
        <p>你准备复制 <strong>{pendingCopy.name}</strong> 的 QQ。添加好友前，请务必先在社团大群 <strong>「ECNU水杉方块社」</strong> 中确认确实有这位成员，再决定是否添加。</p>
        <div className="v2SafetyNotice">
          <strong>请不要仅凭本页面信息判断身份。</strong>
          <span>如果群内无法确认该成员、对方主动索要钱款/验证码/账号密码，或发送可疑链接，请不要添加或继续交流。</span>
        </div>
        <div className="v2SafetyActions">
          <button className="secondary" onClick={() => setPendingCopy(null)}>取消</button>
          <button className="primary" onClick={confirmCopyQq}>我已确认，继续复制 QQ</button>
        </div>
      </section>
    </div>}
  </>;
}
