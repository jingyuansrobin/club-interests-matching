"use client";

import { useEffect, useMemo, useState } from "react";
import { saveV2Identity } from "@/lib/v2-identity";
import { fetchV2MatchBundle, loadV2OwnData, resetV2MatchProfile, saveV2MatchProfile } from "@/lib/v2-store";
import { V2_DAYS, V2_INTERESTS, type V2EnrichmentModule, type V2Identity, type V2InterestKey, type V2Match, type V2MatchProfile, type V2PlaystyleKey } from "@/lib/v2-types";
import { AvailabilityStep, InterestStep, PlaystyleStep, availabilityReady, interestReady, playstyleReady } from "./v2-core-steps";
import V2Enrichment, { enrichmentCompletion } from "./v2-enrichment";
import V2MatchResults from "./v2-match-results";

const EMPTY_IDENTITY: V2Identity = { name: "", intro: "", qq: "", showQq: false };
type CoreStep = 0 | 1 | 2 | 3;

const MODULE_LABELS: Record<V2EnrichmentModule, string> = {
  team: "队伍与存档",
  communication: "沟通与约局",
  resource: "资源习惯",
  roles: "队伍角色",
  learning: "教学与研究",
};

function resolveStep(profile: V2MatchProfile, legacySuggested: boolean): CoreStep {
  if (legacySuggested || !interestReady(profile)) return 0;
  if (!availabilityReady(profile)) return 1;
  if (!playstyleReady(profile)) return 2;
  return 3;
}

function baseCompletion(profile: V2MatchProfile) {
  if (!interestReady(profile)) return 0;
  if (!availabilityReady(profile)) return 33;
  if (!playstyleReady(profile)) return 67;
  return 100;
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
  const [suggestedModule, setSuggestedModule] = useState<V2EnrichmentModule | undefined>();
  const [suggestionReason, setSuggestionReason] = useState<string | undefined>();
  const [enrichmentOpen, setEnrichmentOpen] = useState(false);
  const [activeModule, setActiveModule] = useState<V2EnrichmentModule>("communication");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [matching, setMatching] = useState(false);
  const [message, setMessage] = useState("");

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
          setCoreStep(resolveStep(data.profile, data.legacySuggested));
          if (!data.legacySuggested && interestReady(data.profile)) {
            try {
              const bundle = await fetchV2MatchBundle();
              if (cancelled) return;
              setMatches(bundle.matches);
              setSuggestedModule(bundle.nextModule);
              setSuggestionReason(bundle.nextModuleReason);
              if (bundle.nextModule) setActiveModule(bundle.nextModule);
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
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const coreComplete = Boolean(profile && interestReady(profile) && availabilityReady(profile) && playstyleReady(profile));
  const baseProgress = profile ? baseCompletion(profile) : 0;
  const positiveSlots = profile ? Object.values(profile.availabilityGrid).filter((value) => value > 0).length : 0;
  const interestSummary = useMemo(() => (profile ? topInterestLabels(profile) : []), [profile]);
  const refineCount = profile ? enrichmentCompletion(profile) : 0;

  async function refreshMatches() {
    try {
      setMatching(true);
      const bundle = await fetchV2MatchBundle();
      setMatches(bundle.matches);
      setSuggestedModule(bundle.nextModule);
      setSuggestionReason(bundle.nextModuleReason);
      return bundle;
    } catch (error) {
      console.error(error);
      setMessage("画像已保存，但推荐刷新失败，可稍后重试。");
      return null;
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
      const bundle = await refreshMatches();
      if (nextStep === 3 && bundle?.nextModule) setActiveModule(bundle.nextModule);
      setMessage(nextStep === 3 ? "基础画像完成，正式推荐已经生成。" : "画像已同步，推荐已重新计算。");
    } catch (error) {
      console.error(error);
      setMessage(error instanceof Error ? error.message : "保存失败，请稍后重试。");
    } finally {
      setSaving(false);
    }
  }

  async function saveEnrichment() {
    if (!profile) return;
    try {
      setSaving(true);
      setMessage("");
      await saveV2MatchProfile(profile);
      const bundle = await refreshMatches();
      if (bundle?.nextModule) setActiveModule(bundle.nextModule);
      setMessage(bundle?.nextModule ? `已更新推荐。下一块建议补充：${MODULE_LABELS[bundle.nextModule]}。` : "补充画像已经完整，推荐已按全部 V2 信息重新计算。" );
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
    setProfile({ ...profile, interestScores: { ...profile.interestScores, [key]: value }, currentIntents: nextIntents, intentUpdatedAt: nextIntents.length ? profile.intentUpdatedAt : undefined });
    setMessage("");
  }

  function toggleIntent(key: V2InterestKey) {
    if (!profile) return;
    const score = profile.interestScores[key];
    if (typeof score !== "number" || score <= 0) { setMessage("先标一下你对这个玩法的兴趣程度，再把它设为最近最想玩。"); return; }
    const active = profile.currentIntents.includes(key);
    if (!active && profile.currentIntents.length >= 2) { setMessage("最近最想玩的方向最多标记 2 项，先取消一个再选择。"); return; }
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
      setMessage("已标记为时间较随机；如果仍有常见空闲时间，也可以继续点选。");
      return;
    }
    const next = { ...profile.availabilityGrid };
    if (mode === "every_evening") for (const day of V2_DAYS) next[`${day.key}_evening`] = 2;
    if (mode === "weekday_evening") for (const day of V2_DAYS.slice(0, 5)) next[`${day.key}_evening`] = 2;
    if (mode === "weekend") for (const day of V2_DAYS.slice(5)) { next[`${day.key}_morning`] = 2; next[`${day.key}_afternoon`] = 2; next[`${day.key}_evening`] = 2; }
    setProfile({ ...profile, availabilityGrid: next });
    setMessage("");
  }

  function setPlaystyle(key: V2PlaystyleKey, ideal: number) {
    if (!profile) return;
    const old = profile.playstylePreferences[key];
    setProfile({ ...profile, playstylePreferences: { ...profile.playstylePreferences, [key]: { ideal, tolerance: ideal === 2 ? 2 : 1, hard: old?.hard ?? false } } });
    setMessage("");
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
      setEnrichmentOpen(false);
      setSuggestedModule(undefined);
      setMessage("游戏画像已清空，可以重新填写。");
    } catch (error) {
      console.error(error);
      setMessage("重新开始失败，请稍后重试。");
    } finally { setSaving(false); }
  }

  if (loading || !profile) return <main className="appRoot v2App v2Bright isStarted"><div className="sceneBackdrop" aria-hidden="true" /><div className="sceneShade" aria-hidden="true" /><div className="v2Loading glassCard">正在连接成员池并读取你的玩家画像…</div></main>;

  return <main className={`appRoot v2App ${started ? "isStarted v2Bright" : ""}`}>
    <div className="sceneBackdrop" aria-hidden="true" /><div className="sceneShade" aria-hidden="true" />
    <header className="siteNav"><button className="wordmark" onClick={() => setStarted(false)}><span className="pixelMark">◆</span><span>ECNUMC Match</span></button><div className="navRight"><span className="poolStatus remote"><i />V2 成员池</span><span className="clubName">水杉方块社</span></div></header>

    {!started ? <section className="landing"><div className="landingContent"><div className="landingKicker">ECNUMC · PLAYER MATCHING V2</div><h1>方块搭子</h1><p className="landingLead">不是找一个和你一模一样的人，而是找到真正能一起玩的搭子。</p><p className="landingSub">告诉我们最近想玩什么、什么时候有空、习惯怎么一起玩。大约一分钟即可得到第一轮推荐，之后再按需要慢慢完善画像。</p><button className="heroCta" onClick={() => setStarted(true)}>{identityDone ? "继续匹配" : "开始匹配"}<span>→</span></button><div className="landingMeta"><span>无需注册</span><b>·</b><span>渐进式画像</span><b>·</b><span>推荐理由可解释</span></div></div><div className="landingFooter"><span>水杉方块社 · 方块搭子 V2</span><span>Built for ECNUMC members</span></div></section>
    : !identityDone ? <section className="identityStage"><div className="glassCard identityPanel v2IdentityPanel"><div className="stepTag">STEP 00 · PLAYER ID</div><h2>先认识一下你</h2><p className="panelLead">身份资料只需要维护一份；游戏画像之后可以随时重新填写。</p><div className="identityGrid"><label className="fieldGroup"><span>社团昵称 / MC ID</span><input value={identity.name} maxLength={32} onChange={(e) => setIdentity({ ...identity, name: e.target.value })} placeholder="例如 Jingyuans_robin" /></label><label className="fieldGroup"><span>QQ</span><input value={identity.qq} inputMode="numeric" maxLength={12} onChange={(e) => setIdentity({ ...identity, qq: e.target.value.replace(/\D/g, "") })} placeholder="输入你的 QQ 号" /></label></div><label className="v2IntroField"><span><b>简短自我介绍</b><small>{identity.intro.length}/120</small></span><textarea value={identity.intro} maxLength={120} rows={3} onChange={(e) => setIdentity({ ...identity, intro: e.target.value })} placeholder="最近在玩的整合包、喜欢的玩法、想找什么样的搭子……" /><small>会展示在匹配卡片中。</small></label><label className={`privacyChoice ${identity.showQq ? "checked" : ""}`}><input type="checkbox" checked={identity.showQq} onChange={(e) => setIdentity({ ...identity, showQq: e.target.checked })} /><span className="privacyIcon">{identity.showQq ? "✓" : "○"}</span><span><b>愿意在匹配结果中展示我的 QQ</b><small>只有主动开启时，匹配到你的成员才能看到并复制 QQ。</small></span></label><button className="mainButton" disabled={saving || !identity.name.trim() || !/^\d{5,12}$/.test(identity.qq)} onClick={saveIdentity}>{saving ? "正在保存…" : "保存并建立玩家画像"}<span>→</span></button>{message && <div className="formMessage">{message}</div>}</div><div className="identityAside glassCard subtleCard"><div className="asideNumber">V2</div><h3>先快速匹配，再慢慢变准</h3><p>三个核心模块完成后就能看正式 Top 3，后面的补充问题全部可选。</p><div className="asideRule" /><div className="privacyNote"><strong>隐私升级</strong><span>精细上线时间和边界只由服务端用于匹配，不直接展示给其他成员。</span></div></div></section>
    : <section className="v2Stage">
      <div className="v2StageTop glassCard"><div className="playerSummary"><div className="playerAvatar">{identity.name.slice(0, 1).toUpperCase()}</div><div><span>当前玩家</span><strong>{identity.name}</strong><small>QQ {identity.showQq ? "公开给匹配成员" : "仅自己可见"}</small></div></div><div className="confidenceSummary v2Understanding"><div><span>基础画像完成度</span><strong>{baseProgress}%</strong></div><div className="confidenceTrack"><i style={{ width: `${baseProgress}%` }} /></div><small>{coreComplete ? `基础画像已完成 · 补充模块 ${refineCount}/5` : "三个核心模块完成后进入正式推荐"}</small></div><button className="editIdentity" onClick={() => { setIdentityDone(false); setMessage(""); }}>修改资料</button></div>
      <div className="v2Workspace"><section className="v2QuestionPane glassCard">
        {coreStep === 0 && <InterestStep profile={profile} legacySuggested={legacySuggested} onScore={setInterestScore} onIntent={toggleIntent} onContinue={() => persistProfile(1)} saving={saving} />}
        {coreStep === 1 && <AvailabilityStep profile={profile} onCycle={cycleAvailability} onQuick={quickAvailability} onRandomness={(value) => setProfile({ ...profile, availabilityRandomness: value })} onBack={() => setCoreStep(0)} onContinue={() => persistProfile(2)} saving={saving} />}
        {coreStep === 2 && <PlaystyleStep profile={profile} onSet={setPlaystyle} onBack={() => setCoreStep(1)} onContinue={() => persistProfile(3)} saving={saving} />}
        {coreStep === 3 && !enrichmentOpen && <div className="v2CompletePanel"><span className="v2CompleteMark">✓</span><div className="stepTag">CORE PROFILE READY</div><h2>正式推荐已经生成</h2><p>三个核心模块已经完成。现在就可以联系搭子；如果愿意再花一点时间，系统还能继续区分队伍规模、语音、角色和长期习惯。</p><div className="v2ProfileTags">{profile.currentIntents.map((key) => { const item = V2_INTERESTS.find((interest) => interest.key === key); return item ? <span className="intentTag" key={key}>🔥 {item.label}</span> : null; })}{interestSummary.map((item) => <span key={item.key}>{item.icon} {item.label}</span>)}<span>🕒 {positiveSlots || "随机"} 个常见上线窗口</span></div><div className="v2RefineSummary"><div><strong>补充画像 {refineCount}/5</strong><span>{suggestedModule ? suggestionReason : "补充画像已经完整。"}</span></div>{refineCount < 5 && <button className="v2Primary" onClick={() => { const next = suggestedModule ?? "communication"; setActiveModule(next); setEnrichmentOpen(true); }}>继续让推荐更准 →</button>}</div><div className="v2EditActions"><button onClick={() => setCoreStep(0)}>修改兴趣</button><button onClick={() => setCoreStep(1)}>修改时间</button><button onClick={() => setCoreStep(2)}>修改习惯</button>{refineCount > 0 && <button onClick={() => setEnrichmentOpen(true)}>修改补充画像</button>}</div><button className="v2RestartButton" onClick={restart} disabled={saving}>↻ 重新填写游戏画像</button></div>}
        {coreStep === 3 && enrichmentOpen && <V2Enrichment profile={profile} activeModule={activeModule} suggestedModule={suggestedModule} suggestionReason={suggestionReason} saving={saving} onSelectModule={setActiveModule} onChange={setProfile} onSave={saveEnrichment} onClose={() => setEnrichmentOpen(false)} />}
        {message && <div className="v2InlineMessage">{message}</div>}
      </section><V2MatchResults matches={matches} coreComplete={coreComplete} matching={matching} /></div>
    </section>}
  </main>;
}
