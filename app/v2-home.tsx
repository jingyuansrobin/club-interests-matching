"use client";

import { useEffect, useMemo, useState } from "react";
import { saveV2Identity } from "@/lib/v2-identity";
import { fetchV2Matches, loadV2OwnData, resetV2MatchProfile, saveV2MatchProfile } from "@/lib/v2-store";
import {
  INTEREST_SCALE,
  V2_DAYS,
  V2_INTERESTS,
  V2_TIME_BUCKETS,
  type V2Identity,
  type V2InterestKey,
  type V2Match,
  type V2MatchProfile,
  type V2PlaystyleKey,
} from "@/lib/v2-types";

const EMPTY_IDENTITY: V2Identity = { name: "", intro: "", qq: "", showQq: false };

type CoreStep = 0 | 1 | 2 | 3;

type AxisDefinition = {
  key: V2PlaystyleKey;
  prompt: string;
  left: string;
  right: string;
  labels: string[];
};

const PLAYSTYLE_AXES: AxisDefinition[] = [
  {
    key: "paceIntensity",
    prompt: "推进一个喜欢的存档时",
    left: "更看重体验",
    right: "更看重推进",
    labels: ["很佛系", "偏佛系", "都可以", "偏推进", "很在意推进"],
  },
  {
    key: "collabSynchrony",
    prompt: "多人档里",
    left: "喜欢一起行动",
    right: "喜欢各自发展",
    labels: ["基本一起", "偏一起", "都可以", "偏独立", "各自发展"],
  },
  {
    key: "collabDivision",
    prompt: "做一个大型项目的时候",
    left: "大家一起做",
    right: "喜欢明确分工",
    labels: ["一起完成", "偏一起", "都可以", "偏分工", "明确分工"],
  },
];

function ratedInterestCount(profile: V2MatchProfile) {
  return Object.values(profile.interestScores).filter((value) => typeof value === "number").length;
}

function interestReady(profile: V2MatchProfile) {
  const values = Object.values(profile.interestScores).filter((value): value is number => typeof value === "number");
  return values.length >= 2 && values.some((value) => value > 0);
}

function availabilityReady(profile: V2MatchProfile) {
  return Object.values(profile.availabilityGrid).some((value) => value > 0) || (profile.availabilityRandomness ?? 0) >= 3;
}

function playstyleReady(profile: V2MatchProfile) {
  return PLAYSTYLE_AXES.every((axis) => typeof profile.playstylePreferences[axis.key]?.ideal === "number");
}

function resolveStep(profile: V2MatchProfile, legacySuggested: boolean): CoreStep {
  if (legacySuggested || !interestReady(profile)) return 0;
  if (!availabilityReady(profile)) return 1;
  if (!playstyleReady(profile)) return 2;
  return 3;
}

function understandingScore(profile: V2MatchProfile) {
  const interestPart = interestReady(profile) ? 30 : Math.min(24, ratedInterestCount(profile) * 8);
  const intentPart = profile.currentIntents.length ? 10 : 0;
  const availabilityPart = availabilityReady(profile) ? 22 : Math.min(18, Object.values(profile.availabilityGrid).filter((v) => v > 0).length * 3);
  const playstyleCount = PLAYSTYLE_AXES.filter((axis) => typeof profile.playstylePreferences[axis.key]?.ideal === "number").length;
  const playstylePart = playstyleCount * 5;
  const rolePart = Math.min(10, Object.keys(profile.rolePreferences).length * 2);
  const boundaryPart = Math.min(7, Object.keys(profile.boundaryPreferences).length * 2);
  const learningPart = Math.min(3, Object.keys(profile.learningPreferences).length);
  return Math.min(100, interestPart + intentPart + availabilityPart + playstylePart + rolePart + boundaryPart + learningPart);
}

function topInterestLabels(profile: V2MatchProfile) {
  return V2_INTERESTS
    .map((item) => ({ ...item, score: profile.interestScores[item.key] }))
    .filter((item): item is typeof item & { score: number } => typeof item.score === "number" && item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);
}

export default function V2Home() {
  const [started, setStarted] = useState(false);
  const [identityDone, setIdentityDone] = useState(false);
  const [identity, setIdentity] = useState<V2Identity>(EMPTY_IDENTITY);
  const [profile, setProfile] = useState<V2MatchProfile | null>(null);
  const [coreStep, setCoreStep] = useState<CoreStep>(0);
  const [legacySuggested, setLegacySuggested] = useState(false);
  const [matches, setMatches] = useState<V2Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [matching, setMatching] = useState(false);
  const [message, setMessage] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadV2OwnData()
      .then(async (data) => {
        if (cancelled) return;
        setProfile(data.profile);
        setLegacySuggested(data.legacySuggested);
        if (data.identity) {
          setIdentity(data.identity);
          setIdentityDone(true);
          setStarted(true);
          const nextStep = resolveStep(data.profile, data.legacySuggested);
          setCoreStep(nextStep);
          if (!data.legacySuggested && interestReady(data.profile)) {
            try {
              const nextMatches = await fetchV2Matches();
              if (!cancelled) setMatches(nextMatches);
            } catch (error) {
              console.error(error);
              if (!cancelled) setMessage("已读取画像，但暂时无法刷新推荐。");
            }
          }
        }
      })
      .catch((error) => {
        console.error(error);
        if (!cancelled) setMessage("成员数据暂时无法加载，请刷新后重试。");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const understanding = profile ? understandingScore(profile) : 0;
  const coreComplete = Boolean(profile && interestReady(profile) && availabilityReady(profile) && playstyleReady(profile));
  const ratedCount = profile ? ratedInterestCount(profile) : 0;
  const positiveSlots = profile ? Object.values(profile.availabilityGrid).filter((value) => value > 0).length : 0;
  const interestSummary = useMemo(() => (profile ? topInterestLabels(profile) : []), [profile]);

  async function refreshMatches() {
    try {
      setMatching(true);
      const next = await fetchV2Matches();
      setMatches(next);
    } catch (error) {
      console.error(error);
      setMessage("画像已保存，但推荐刷新失败，可稍后重试。");
    } finally {
      setMatching(false);
    }
  }

  async function persistProfile(nextStep?: CoreStep) {
    if (!profile) return;
    try {
      setSaving(true);
      setMessage("");
      await saveV2MatchProfile(profile);
      setLegacySuggested(false);
      if (nextStep !== undefined) setCoreStep(nextStep);
      await refreshMatches();
      setMessage("画像已同步，推荐已重新计算。");
    } catch (error) {
      console.error(error);
      setMessage(error instanceof Error ? error.message : "保存失败，请稍后重试。");
    } finally {
      setSaving(false);
    }
  }

  async function saveIdentity() {
    try {
      setSaving(true);
      setMessage("");
      await saveV2Identity(identity);
      setIdentity((current) => ({ ...current, name: current.name.trim(), intro: current.intro.trim(), qq: current.qq.trim() }));
      setIdentityDone(true);
      setStarted(true);
      setMessage("身份资料已保存。接下来用几步建立你的玩家画像。");
    } catch (error) {
      console.error(error);
      setMessage(error instanceof Error ? error.message : "保存失败，请稍后重试。");
    } finally {
      setSaving(false);
    }
  }

  function setInterestScore(key: V2InterestKey, value: number) {
    if (!profile) return;
    const nextIntents = value === 0 ? profile.currentIntents.filter((item) => item !== key) : profile.currentIntents;
    setProfile({
      ...profile,
      interestScores: { ...profile.interestScores, [key]: value },
      currentIntents: nextIntents,
      intentUpdatedAt: nextIntents.length ? profile.intentUpdatedAt : undefined,
    });
    setMessage("");
  }

  function toggleIntent(key: V2InterestKey) {
    if (!profile) return;
    const currentScore = profile.interestScores[key];
    if (typeof currentScore !== "number" || currentScore <= 0) {
      setMessage("先标一下你对这个玩法的兴趣程度，再把它设为近期意向。");
      return;
    }
    const active = profile.currentIntents.includes(key);
    if (!active && profile.currentIntents.length >= 2) {
      setMessage("近期最想玩的方向最多标记 2 项，先取消一个再选择。");
      return;
    }
    const next = active ? profile.currentIntents.filter((item) => item !== key) : [...profile.currentIntents, key];
    setProfile({ ...profile, currentIntents: next, intentUpdatedAt: next.length ? new Date().toISOString() : undefined });
    setMessage("");
  }

  function cycleAvailability(slot: string) {
    if (!profile) return;
    const current = profile.availabilityGrid[slot];
    const nextGrid = { ...profile.availabilityGrid };
    if (current === undefined) nextGrid[slot] = 1;
    else if (current === 1) nextGrid[slot] = 2;
    else delete nextGrid[slot];
    setProfile({ ...profile, availabilityGrid: nextGrid });
    setMessage("");
  }

  function quickAvailability(mode: "every_evening" | "weekday_evening" | "weekend" | "random") {
    if (!profile) return;
    if (mode === "random") {
      setProfile({ ...profile, availabilityRandomness: 4 });
      setMessage("已标记为时间较随机；如果仍有常见空闲时间，也可以在表格里继续点选。");
      return;
    }
    const next = { ...profile.availabilityGrid };
    if (mode === "every_evening") {
      for (const day of V2_DAYS) next[`${day.key}_evening`] = 2;
    }
    if (mode === "weekday_evening") {
      for (const day of V2_DAYS.slice(0, 5)) next[`${day.key}_evening`] = 2;
    }
    if (mode === "weekend") {
      for (const day of V2_DAYS.slice(5)) {
        next[`${day.key}_afternoon`] = 2;
        next[`${day.key}_evening`] = 2;
      }
    }
    setProfile({ ...profile, availabilityGrid: next });
    setMessage("");
  }

  function setRandomness(value: number) {
    if (!profile) return;
    setProfile({ ...profile, availabilityRandomness: value });
  }

  function setPlaystyle(key: V2PlaystyleKey, ideal: number) {
    if (!profile) return;
    const previous = profile.playstylePreferences[key];
    setProfile({
      ...profile,
      playstylePreferences: {
        ...profile.playstylePreferences,
        [key]: { ideal, tolerance: previous?.tolerance ?? 1 },
      },
    });
    setMessage("");
  }

  function toggleTolerance(key: V2PlaystyleKey) {
    if (!profile) return;
    const previous = profile.playstylePreferences[key];
    if (!previous) return;
    setProfile({
      ...profile,
      playstylePreferences: {
        ...profile.playstylePreferences,
        [key]: { ...previous, tolerance: previous.tolerance >= 2 ? 1 : 2 },
      },
    });
  }

  async function copyQq(match: V2Match) {
    if (!match.qq) return;
    try {
      await navigator.clipboard.writeText(match.qq);
      setCopiedId(match.id);
      window.setTimeout(() => setCopiedId(null), 1600);
    } catch {
      setMessage("浏览器未允许复制，请手动复制 QQ。");
    }
  }

  async function restart() {
    if (!window.confirm("确认重新填写游戏画像？昵称、QQ、自我介绍和邮箱绑定都会保留。")) return;
    try {
      setSaving(true);
      await resetV2MatchProfile();
      const fresh = await loadV2OwnData();
      setProfile(fresh.profile);
      setMatches([]);
      setLegacySuggested(false);
      setCoreStep(0);
      setMessage("游戏画像已清空，可以重新填写。");
    } catch (error) {
      console.error(error);
      setMessage("重新开始失败，请稍后重试。");
    } finally {
      setSaving(false);
    }
  }

  if (loading || !profile) {
    return (
      <main className="appRoot v2App v2Bright isStarted">
        <div className="sceneBackdrop" aria-hidden="true" />
        <div className="sceneShade" aria-hidden="true" />
        <div className="v2Loading glassCard">正在连接成员池并读取你的玩家画像…</div>
      </main>
    );
  }

  return (
    <main className={`appRoot v2App ${started ? "isStarted v2Bright" : ""}`}>
      <div className="sceneBackdrop" aria-hidden="true" />
      <div className="sceneShade" aria-hidden="true" />

      <header className="siteNav">
        <button className="wordmark" onClick={() => setStarted(false)} aria-label="返回方块搭子首页">
          <span className="pixelMark">◆</span>
          <span>ECNUMC Match</span>
        </button>
        <div className="navRight">
          <span className="poolStatus remote"><i />V2 成员池</span>
          <span className="clubName">水杉方块社</span>
        </div>
      </header>

      {!started ? (
        <section className="landing">
          <div className="landingContent">
            <div className="landingKicker">ECNUMC · PLAYER MATCHING V2</div>
            <h1>方块搭子</h1>
            <p className="landingLead">不是找一个和你一模一样的人，而是找到真正能一起玩的搭子。</p>
            <p className="landingSub">告诉我们最近想玩什么、什么时候有空、习惯怎么一起玩。大约一分钟即可得到第一轮推荐，之后再按需要慢慢完善画像。</p>
            <button className="heroCta" onClick={() => setStarted(true)}>
              {identityDone ? "继续匹配" : "开始匹配"}<span>→</span>
            </button>
            <div className="landingMeta"><span>无需注册</span><b>·</b><span>渐进式画像</span><b>·</b><span>推荐理由可解释</span></div>
          </div>
          <div className="landingFooter"><span>水杉方块社 · 方块搭子 V2</span><span>Built for ECNUMC members</span></div>
        </section>
      ) : !identityDone ? (
        <section className="identityStage">
          <div className="glassCard identityPanel v2IdentityPanel">
            <div className="stepTag">STEP 00 · PLAYER ID</div>
            <h2>先认识一下你</h2>
            <p className="panelLead">身份资料只需要维护一份；游戏画像之后可以随时重新填写。</p>
            <div className="identityGrid">
              <label className="fieldGroup">
                <span>社团昵称 / MC ID</span>
                <input value={identity.name} maxLength={32} onChange={(event) => setIdentity({ ...identity, name: event.target.value })} placeholder="例如 Jingyuans_robin" />
              </label>
              <label className="fieldGroup">
                <span>QQ</span>
                <input value={identity.qq} inputMode="numeric" maxLength={12} onChange={(event) => setIdentity({ ...identity, qq: event.target.value.replace(/\D/g, "") })} placeholder="输入你的 QQ 号" />
              </label>
            </div>
            <label className="v2IntroField">
              <span><b>简短自我介绍</b><small>{identity.intro.length}/120</small></span>
              <textarea value={identity.intro} maxLength={120} rows={3} onChange={(event) => setIdentity({ ...identity, intro: event.target.value })} placeholder="最近在玩的整合包、喜欢的玩法、想找什么样的搭子……" />
              <small>会展示在匹配卡片中。输入内容由当前表单统一管理，不会再被后台异步读取覆盖。</small>
            </label>
            <label className={`privacyChoice ${identity.showQq ? "checked" : ""}`}>
              <input type="checkbox" checked={identity.showQq} onChange={(event) => setIdentity({ ...identity, showQq: event.target.checked })} />
              <span className="privacyIcon">{identity.showQq ? "✓" : "○"}</span>
              <span><b>愿意在匹配结果中展示我的 QQ</b><small>只有你主动开启时，匹配到你的成员才能看到并复制 QQ。</small></span>
            </label>
            <button className="mainButton" disabled={saving || !identity.name.trim() || !/^\d{5,12}$/.test(identity.qq)} onClick={saveIdentity}>
              {saving ? "正在保存…" : "保存并建立玩家画像"}<span>→</span>
            </button>
            {message && <div className="formMessage">{message}</div>}
          </div>
          <div className="identityAside glassCard subtleCard">
            <div className="asideNumber">V2</div>
            <h3>先快速匹配，再慢慢变准</h3>
            <p>前三屏只问最影响“能不能真的一起玩”的信息。完成后就可以直接看 Top 3。</p>
            <div className="asideRule" />
            <div className="privacyNote"><strong>隐私升级</strong><span>V2 的精细上线时间不会直接下发给其他成员浏览器，只由服务端用于计算。</span></div>
          </div>
        </section>
      ) : (
        <section className="v2Stage">
          <div className="v2StageTop glassCard">
            <div className="playerSummary">
              <div className="playerAvatar">{identity.name.slice(0, 1).toUpperCase()}</div>
              <div><span>当前玩家</span><strong>{identity.name}</strong><small>QQ {identity.showQq ? "公开给匹配成员" : "仅自己可见"}</small></div>
            </div>
            <div className="confidenceSummary v2Understanding">
              <div><span>了解你</span><strong>{understanding}%</strong></div>
              <div className="confidenceTrack"><i style={{ width: `${understanding}%` }} /></div>
              <small>{coreComplete ? "基础画像已建立，可继续完善" : "前三屏完成后进入正式推荐"}</small>
            </div>
            <button className="editIdentity" onClick={() => { setIdentityDone(false); setMessage(""); }}>修改资料</button>
          </div>

          <div className="v2Workspace">
            <section className="v2QuestionPane glassCard">
              {coreStep === 0 && (
                <InterestStep
                  profile={profile}
                  legacySuggested={legacySuggested}
                  ratedCount={ratedCount}
                  onScore={setInterestScore}
                  onIntent={toggleIntent}
                  onContinue={() => persistProfile(1)}
                  saving={saving}
                />
              )}

              {coreStep === 1 && (
                <AvailabilityStep
                  profile={profile}
                  positiveSlots={positiveSlots}
                  onCycle={cycleAvailability}
                  onQuick={quickAvailability}
                  onRandomness={setRandomness}
                  onBack={() => setCoreStep(0)}
                  onContinue={() => persistProfile(2)}
                  saving={saving}
                />
              )}

              {coreStep === 2 && (
                <PlaystyleStep
                  profile={profile}
                  onSet={setPlaystyle}
                  onTolerance={toggleTolerance}
                  onBack={() => setCoreStep(1)}
                  onContinue={() => persistProfile(3)}
                  saving={saving}
                />
              )}

              {coreStep === 3 && (
                <div className="v2CompletePanel">
                  <span className="v2CompleteMark">✓</span>
                  <div className="stepTag">CORE PROFILE READY</div>
                  <h2>基础画像已经足够开始找搭子</h2>
                  <p>后续角色、语音、资源共享和存档周期会作为“让推荐再准一点”的渐进式模块继续加入，不会阻塞你现在使用。</p>
                  <div className="v2ProfileTags">
                    {profile.currentIntents.map((key) => {
                      const item = V2_INTERESTS.find((interest) => interest.key === key);
                      return item ? <span className="intentTag" key={key}>🔥 {item.label}</span> : null;
                    })}
                    {interestSummary.map((item) => <span key={item.key}>{item.icon} {item.label}</span>)}
                    <span>🕒 {positiveSlots || "随机"} 个常见上线窗口</span>
                  </div>
                  <div className="v2EditActions">
                    <button onClick={() => setCoreStep(0)}>修改兴趣</button>
                    <button onClick={() => setCoreStep(1)}>修改时间</button>
                    <button onClick={() => setCoreStep(2)}>修改习惯</button>
                  </div>
                  <button className="v2RestartButton" onClick={restart} disabled={saving}>↻ 重新填写游戏画像</button>
                </div>
              )}

              {message && <div className="v2InlineMessage">{message}</div>}
            </section>

            <MatchResults
              matches={matches}
              coreComplete={coreComplete}
              matching={matching}
              copiedId={copiedId}
              onCopy={copyQq}
            />
          </div>
        </section>
      )}
    </main>
  );
}

function InterestStep({
  profile,
  legacySuggested,
  ratedCount,
  onScore,
  onIntent,
  onContinue,
  saving,
}: {
  profile: V2MatchProfile;
  legacySuggested: boolean;
  ratedCount: number;
  onScore: (key: V2InterestKey, value: number) => void;
  onIntent: (key: V2InterestKey) => void;
  onContinue: () => void;
  saving: boolean;
}) {
  const ready = interestReady(profile);
  return (
    <div className="v2Step">
      <div className="v2StepHeader">
        <div><div className="stepTag">BASE PROFILE · 1 / 3</div><h2>最近什么最容易把你叫上线？</h2><p>给有感觉的玩法标一下兴趣程度，不需要全部填写。没操作代表“还不知道”，和明确的“不想玩”不同。</p></div>
        <span className="v2Counter">已评价 {ratedCount} 项</span>
      </div>
      {legacySuggested && <div className="v2LegacyBanner">已根据你的旧版画像预填部分兴趣和习惯。请按现在的真实情况确认或调整；旧版未选择的项目不会被当成“不喜欢”。</div>}
      <div className="v2InterestGrid">
        {V2_INTERESTS.map((item) => {
          const score = profile.interestScores[item.key];
          const intent = profile.currentIntents.includes(item.key);
          return (
            <article className={`v2InterestCard ${typeof score === "number" ? "rated" : ""} ${intent ? "intent" : ""}`} key={item.key}>
              <div className="v2InterestTitle"><span className="v2InterestIcon">{item.icon}</span><div><strong>{item.label}</strong><small>{item.hint}</small></div></div>
              <div className="v2Scale" aria-label={`${item.label}兴趣程度`}>
                {INTEREST_SCALE.map((option) => (
                  <button className={score === option.value ? "active" : ""} key={option.value} onClick={() => onScore(item.key, option.value)} title={option.label}>
                    <i /> <span>{option.short}</span>
                  </button>
                ))}
              </div>
              <button className={`v2IntentButton ${intent ? "active" : ""}`} onClick={() => onIntent(item.key)} disabled={typeof score !== "number" || score <= 0}>
                {intent ? "🔥 最近正想玩" : "＋ 标记为近期意向"}
              </button>
            </article>
          );
        })}
      </div>
      <div className="v2StepFooter">
        <div><strong>{ready ? "已经足够进入下一步 ✓" : "至少评价 2 个玩法，其中一个不是“不想玩”"}</strong><small>近期意向最多 2 项；它会比长期兴趣拥有更高匹配权重。</small></div>
        <button className="v2Primary" disabled={!ready || saving} onClick={onContinue}>{saving ? "正在计算…" : "继续看看什么时候能碰到一起 →"}</button>
      </div>
    </div>
  );
}

function AvailabilityStep({
  profile,
  positiveSlots,
  onCycle,
  onQuick,
  onRandomness,
  onBack,
  onContinue,
  saving,
}: {
  profile: V2MatchProfile;
  positiveSlots: number;
  onCycle: (slot: string) => void;
  onQuick: (mode: "every_evening" | "weekday_evening" | "weekend" | "random") => void;
  onRandomness: (value: number) => void;
  onBack: () => void;
  onContinue: () => void;
  saving: boolean;
}) {
  const ready = availabilityReady(profile);
  return (
    <div className="v2Step">
      <div className="v2StepHeader"><div><div className="stepTag">BASE PROFILE · 2 / 3</div><h2>什么时候最容易在服务器碰到你？</h2><p>点你通常有空的时间即可：点一次“偶尔”，再点一次“经常”，第三次清除。不需要填满整张表。</p></div><span className="v2Counter">{positiveSlots} 个常见窗口</span></div>
      <div className="v2QuickRow"><span>快速填写</span><button onClick={() => onQuick("every_evening")}>基本每天晚上</button><button onClick={() => onQuick("weekday_evening")}>工作日晚</button><button onClick={() => onQuick("weekend")}>周末比较多</button><button onClick={() => onQuick("random")}>时间很随机</button></div>
      <div className="v2Heatmap">
        <div className="v2HeatHeader"><span />{V2_TIME_BUCKETS.map((bucket) => <div key={bucket.key}><strong>{bucket.label}</strong><small>{bucket.hint}</small></div>)}</div>
        {V2_DAYS.map((day) => (
          <div className="v2HeatRow" key={day.key}>
            <strong>{day.label}</strong>
            {V2_TIME_BUCKETS.map((bucket) => {
              const slot = `${day.key}_${bucket.key}`;
              const value = profile.availabilityGrid[slot];
              return <button className={`v2HeatCell level${value ?? 0}`} key={slot} onClick={() => onCycle(slot)} aria-label={`${day.label}${bucket.label}${value === 2 ? "经常" : value === 1 ? "偶尔" : "未设置"}`}><i /> <span>{value === 2 ? "经常" : value === 1 ? "偶尔" : ""}</span></button>;
            })}
          </div>
        ))}
      </div>
      <div className="v2Randomness">
        <div><strong>你的上线时间规律吗？</strong><small>这和“什么时候有空”分开记录。</small></div>
        {[{ v: 0, t: "比较固定" }, { v: 2, t: "有时变化" }, { v: 4, t: "很随机" }].map((item) => <button className={profile.availabilityRandomness === item.v ? "active" : ""} key={item.v} onClick={() => onRandomness(item.v)}>{item.t}</button>)}
      </div>
      <div className="v2StepFooter"><button className="v2Back" onClick={onBack}>← 返回兴趣</button><div className="v2FooterSpacer" /><button className="v2Primary" disabled={!ready || saving} onClick={onContinue}>{saving ? "正在计算…" : "继续描述一起玩的习惯 →"}</button></div>
    </div>
  );
}

function PlaystyleStep({
  profile,
  onSet,
  onTolerance,
  onBack,
  onContinue,
  saving,
}: {
  profile: V2MatchProfile;
  onSet: (key: V2PlaystyleKey, ideal: number) => void;
  onTolerance: (key: V2PlaystyleKey) => void;
  onBack: () => void;
  onContinue: () => void;
  saving: boolean;
}) {
  const ready = playstyleReady(profile);
  return (
    <div className="v2Step">
      <div className="v2StepHeader"><div><div className="stepTag">BASE PROFILE · 3 / 3</div><h2>一起开档时，你通常怎么玩？</h2><p>不是把你归进某一种“玩家人格”，而是看看你在几条真实游戏习惯上更偏哪边。</p></div></div>
      <div className="v2AxisList">
        {PLAYSTYLE_AXES.map((axis) => {
          const value = profile.playstylePreferences[axis.key];
          const flexible = (value?.tolerance ?? 0) >= 2;
          return (
            <article className="v2AxisCard" key={axis.key}>
              <div className="v2AxisPrompt"><strong>{axis.prompt}</strong><div><span>{axis.left}</span><i>↔</i><span>{axis.right}</span></div></div>
              <div className="v2AxisOptions">
                {axis.labels.map((label, index) => <button className={value?.ideal === index ? "active" : ""} key={label} onClick={() => onSet(axis.key, index)}><i />{label}</button>)}
              </div>
              <label className={`v2Tolerance ${flexible ? "active" : ""}`}><input type="checkbox" checked={flexible} disabled={!value} onChange={() => onTolerance(axis.key)} /><span>{flexible ? "✓" : "○"}</span>其实两边我都能适应</label>
            </article>
          );
        })}
      </div>
      <div className="v2StepFooter"><button className="v2Back" onClick={onBack}>← 返回时间</button><div className="v2FooterSpacer" /><button className="v2Primary" disabled={!ready || saving} onClick={onContinue}>{saving ? "正在计算最终推荐…" : "生成我的正式 Top 3 →"}</button></div>
    </div>
  );
}

function MatchResults({
  matches,
  coreComplete,
  matching,
  copiedId,
  onCopy,
}: {
  matches: V2Match[];
  coreComplete: boolean;
  matching: boolean;
  copiedId: string | null;
  onCopy: (match: V2Match) => void;
}) {
  const top = matches.slice(0, 3);
  return (
    <aside className="v2Results">
      <div className="resultHeading v2ResultHeading">
        <div><span>MATCHES</span><h2>{coreComplete ? "最适合你的方块搭子" : top.length ? "初步推荐" : "正在认识你"}</h2></div>
        {matching ? <div className="liveDot"><i />重新计算中</div> : top.length ? <div className="liveDot"><i />服务端匹配</div> : null}
      </div>
      {!top.length ? (
        <div className="v2Waiting glassCard"><div className="v2Radar">◎</div><h3>先告诉我们一点你的玩法</h3><p>完成第一屏后，这里就会开始出现社团里的潜在搭子。精细 V2 画像只在服务端参与计算，不会直接展示给其他成员。</p></div>
      ) : (
        <div className="v2MatchList">
          {top.map((match, index) => (
            <article className={`v2MatchCard ${index === 0 ? "top" : ""}`} key={match.id}>
              {index === 0 && <span className="v2RecommendTag">TOP MATCH</span>}
              <span className="v2Rank">0{index + 1}</span>
              <div className="v2MatchHead">
                <div className="memberAvatar">{match.name.slice(0, 1).toUpperCase()}</div>
                <div className="v2MatchIdentity"><h3>{match.name}</h3><p>{match.intro}</p></div>
                <div className="v2MatchScore">{coreComplete ? <><strong>{match.score}%</strong><span>匹配度</span></> : <><strong>推荐</strong><span>初步判断</span></>}</div>
              </div>
              <div className="v2MatchConfidence"><span>了解程度 {match.confidence}%</span><div><i style={{ width: `${match.confidence}%` }} /></div>{match.profileVersion === 1 && <small>对方仍是旧版画像，置信度会保守计算</small>}</div>
              <div className="v2Reasons">{match.reasons.slice(0, 3).map((reason) => <span key={reason}>✓ {reason}</span>)}</div>
              <div className="v2Contact">{match.qq ? <button onClick={() => onCopy(match)}>{copiedId === match.id ? "已复制 QQ ✓" : "复制 QQ"}</button> : <span>TA 暂未选择展示 QQ</span>}</div>
            </article>
          ))}
        </div>
      )}
    </aside>
  );
}
