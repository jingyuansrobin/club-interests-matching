"use client";

import { useEffect, useMemo, useState } from "react";
import { loadCommunityData, saveCommunityProfile } from "@/lib/community-store";
import { mockMembers } from "@/lib/mock-members";
import { chooseNextQuestion, rankMatches } from "@/lib/matching";
import { questions } from "@/lib/questions";
import type { Member, PartialProfile, ProfileField, Question } from "@/lib/types";

type DataMode = "loading" | "remote" | "mock";

export default function Home() {
  const [started, setStarted] = useState(false);
  const [identityDone, setIdentityDone] = useState(false);
  const [profile, setProfile] = useState<PartialProfile>({});
  const [previousScores, setPreviousScores] = useState<Record<string, number>>({});
  const [members, setMembers] = useState<Member[]>(mockMembers);
  const [dataMode, setDataMode] = useState<DataMode>("loading");
  const [dataMessage, setDataMessage] = useState("");
  const [nickname, setNickname] = useState("");
  const [savedNickname, setSavedNickname] = useState("");
  const [qq, setQq] = useState("");
  const [savedQq, setSavedQq] = useState("");
  const [showQq, setShowQq] = useState(false);
  const [savedShowQq, setSavedShowQq] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [copiedQqId, setCopiedQqId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    loadCommunityData()
      .then((data) => {
        if (cancelled) return;
        if (!data.enabled) {
          setDataMode("mock");
          setDataMessage("未配置 Supabase，当前使用演示成员数据");
          return;
        }

        setMembers(data.members);
        setDataMode("remote");
        setDataMessage("已连接真实成员池");

        if (data.ownName) {
          setNickname(data.ownName);
          setSavedNickname(data.ownName);
          setStarted(true);
        }
        if (data.ownQq) {
          setQq(data.ownQq);
          setSavedQq(data.ownQq);
        }
        setShowQq(data.ownShowQq ?? false);
        setSavedShowQq(data.ownShowQq ?? false);

        if (data.ownName && data.ownQq) setIdentityDone(true);
        if (data.ownProfile && Object.keys(data.ownProfile).length) {
          setProfile(data.ownProfile);
          setStarted(true);
        }
      })
      .catch((error) => {
        if (cancelled) return;
        console.error(error);
        setMembers(mockMembers);
        setDataMode("mock");
        setDataMessage("真实成员池暂不可用，已自动切换演示数据");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const matches = useMemo(() => rankMatches(profile, members), [profile, members]);
  const nextQuestion = useMemo(
    () => chooseNextQuestion(profile, matches.slice(0, 8).map((match) => match.member), questions),
    [profile, matches]
  );

  useEffect(() => {
    if (
      dataMode !== "remote" ||
      !identityDone ||
      !savedNickname ||
      !savedQq ||
      !profile.interests?.length
    ) return;

    const timer = window.setTimeout(async () => {
      try {
        setSaving(true);
        await saveCommunityProfile(savedNickname, profile, savedQq, savedShowQq);
        setSaveMessage("画像已自动同步");
      } catch (error) {
        console.error(error);
        setSaveMessage("自动同步失败，可稍后重试");
      } finally {
        setSaving(false);
      }
    }, 600);

    return () => window.clearTimeout(timer);
  }, [dataMode, identityDone, profile, savedNickname, savedQq, savedShowQq]);

  function answer(field: ProfileField, value: string | string[]) {
    setPreviousScores(Object.fromEntries(matches.map((match) => [match.member.id, match.score])));
    setProfile((current) => ({ ...current, [field]: value }));
  }

  async function saveIdentity() {
    const cleanName = nickname.trim();
    const cleanQq = qq.trim();

    if (!cleanName) {
      setSaveMessage("请先填写社团昵称");
      return;
    }
    if (!/^\d{5,12}$/.test(cleanQq)) {
      setSaveMessage("请输入 5–12 位数字 QQ 号");
      return;
    }

    try {
      setSaving(true);
      setSaveMessage("");

      if (dataMode === "remote") {
        await saveCommunityProfile(cleanName, profile, cleanQq, showQq);
        const fresh = await loadCommunityData();
        if (fresh.enabled) setMembers(fresh.members);
      }

      setSavedNickname(cleanName);
      setSavedQq(cleanQq);
      setSavedShowQq(showQq);
      setIdentityDone(true);
      setSaveMessage(showQq ? "资料已保存，匹配到你的成员可以看到 QQ" : "资料已保存，QQ 仅你自己可见");
    } catch (error) {
      console.error(error);
      setSaveMessage(error instanceof Error ? error.message : "保存失败，请稍后重试");
    } finally {
      setSaving(false);
    }
  }

  async function copyQq(member: Member) {
    if (!member.qq) return;
    try {
      await navigator.clipboard.writeText(member.qq);
      setCopiedQqId(member.id);
      window.setTimeout(() => setCopiedQqId(null), 1600);
    } catch {
      setCopiedQqId(null);
    }
  }

  const hasMatches = Boolean(profile.interests?.length);
  const top = matches.slice(0, 3);
  const overallConfidence = top.length
    ? Math.round((top.reduce((sum, item) => sum + item.confidence, 0) / top.length) * 100)
    : 0;

  return (
    <main className="shell">
      <header className="nav">
        <div className="brand"><span className="cube">◆</span> 方块搭子</div>
        <div className="navStatus">
          <span className={`sourceBadge ${dataMode}`}>
            {dataMode === "loading" ? "连接成员池…" : dataMode === "remote" ? "● 真实成员池" : "演示数据"}
          </span>
          <div className="badge">水杉方块社 · MVP</div>
        </div>
      </header>

      {!started ? (
        <section className="hero">
          <div className="eyebrow">不是问卷，是一次逐渐变准的同好发现</div>
          <h1>社团里可能已经有一个<br /><span>很适合和你一起玩的人。</span></h1>
          <p>先留下社团昵称和联系方式，再回答一个游戏偏好问题。每一次回答都会重新计算候选人。</p>
          <button className="primary heroButton" onClick={() => setStarted(true)}>开始找搭子 →</button>
          <div className="heroMeta"><span>无需注册账号</span><span>QQ 是否展示由你决定</span><span>答完立即反馈</span></div>
          {dataMessage && <p className="dataMessage">{dataMessage}</p>}
        </section>
      ) : (
        <div className="workspace">
          <section className="left">
            {!identityDone ? (
              <div className="questionCard identityCard">
                <div className="questionLabel">第一步 · 先认识一下你</div>
                <h2>在社团里，大家怎么称呼你？</h2>
                <p className="questionContext">昵称会显示在匹配结果里；QQ 是否展示完全由你决定。</p>
                <div className="identityFields">
                  <label>
                    <span>社团昵称 / MC ID</span>
                    <input value={nickname} maxLength={32} onChange={(event) => setNickname(event.target.value)} placeholder="例如 Jingyuans_robin" />
                  </label>
                  <label>
                    <span>QQ</span>
                    <input value={qq} inputMode="numeric" maxLength={12} onChange={(event) => setQq(event.target.value.replace(/\D/g, ""))} placeholder="输入你的 QQ 号" />
                  </label>
                </div>
                <label className="privacyToggle">
                  <input type="checkbox" checked={showQq} onChange={(event) => setShowQq(event.target.checked)} />
                  <span><b>愿意在匹配结果中展示我的 QQ</b><small>开启后，匹配到你的社员可以直接复制 QQ 添加你；关闭后，QQ 不会返回给其他成员。</small></span>
                </label>
                <button className="primary submit" disabled={saving || !nickname.trim() || !qq.trim()} onClick={saveIdentity}>
                  {saving ? "保存中…" : "保存并开始匹配 →"}
                </button>
                {saveMessage && <div className="saveMessage">{saveMessage}</div>}
              </div>
            ) : (
              <>
                <div className="profileStrip">
                  <div><span className="muted">当前身份</span><strong>{savedNickname}</strong><small>QQ {savedShowQq ? "会展示给匹配成员" : "仅自己可见"}</small></div>
                  <button className="textButton" onClick={() => { setIdentityDone(false); setSaveMessage(""); }}>修改昵称 / QQ</button>
                </div>

                {hasMatches && (
                  <div className="progressCard">
                    <div><span className="muted">匹配了解度</span><strong>{overallConfidence}%</strong></div>
                    <div className="progress"><span style={{ width: `${overallConfidence}%` }} /></div>
                    <p>不是问卷完成度，而是当前匹配结果有多少信息支撑。</p>
                  </div>
                )}

                {nextQuestion ? (
                  <QuestionCard key={nextQuestion.id} question={nextQuestion} onAnswer={answer} />
                ) : (
                  <div className="questionCard"><div className="discovery">✓ 已经掌握主要匹配信息</div><h2>现在可以直接看结果了。</h2></div>
                )}

                {saveMessage && <div className="saveMessage standaloneMessage">{saveMessage}</div>}
                {dataMode === "mock" && <div className="mockNotice">当前是演示模式，资料不会上传。</div>}
              </>
            )}
          </section>

          <aside className="right">
            {!identityDone ? (
              <div className="emptyState"><div className="radar">◎</div><h3>先留下你的社团身份</h3><p>下一步开始回答游戏偏好后，这里会立即出现潜在同好。</p></div>
            ) : !hasMatches ? (
              <div className="emptyState"><div className="radar">◎</div><h3>你的候选人还藏在社团里</h3><p>回答第一道游戏问题后，这里会立刻出现潜在同好。</p></div>
            ) : (
              <>
                <div className="resultsHeader">
                  <div><span className="muted">当前发现</span><h2>{matches.length} 位潜在同好</h2></div>
                  <span className="live">● 实时重排</span>
                </div>
                {top.length ? (
                  <div className="matchList">
                    {top.map((match, index) => {
                      const oldScore = previousScores[match.member.id];
                      const delta = oldScore === undefined ? 0 : Math.round((match.score - oldScore) * 100);
                      return (
                        <article className={`matchCard ${index === 0 ? "topMatch" : ""}`} key={match.member.id}>
                          <div className="rank">#{index + 1}</div>
                          <div className="matchTop">
                            <div className="avatar">{match.member.name.slice(0, 1)}</div>
                            <div className="identity"><h3>{match.member.name}</h3><p>{match.member.intro}</p></div>
                            <div className="score"><strong>{Math.round(match.score * 100)}%</strong><span>{match.confidence < 0.3 ? "很有潜力" : match.score >= 0.9 ? "非常合拍" : match.score >= 0.8 ? "很值得认识" : "可能玩得来"}</span></div>
                          </div>
                          {delta !== 0 && <div className={delta > 0 ? "delta up" : "delta down"}>{delta > 0 ? "↑" : "↓"} 刚刚 {Math.abs(delta)}%</div>}
                          <div className="reasonRow">{(match.reasons.length ? match.reasons : ["当前已有核心兴趣重合"]).map((reason) => <span key={reason}>{reason}</span>)}</div>
                          <div className="confidence"><span>了解度</span><div><i style={{ width: `${Math.round(match.confidence * 100)}%` }} /></div><b>{Math.round(match.confidence * 100)}%</b></div>
                          {dataMode === "remote" && (
                            match.member.qq ? (
                              <div className="qqArea">
                                <div><span>TA 愿意公开 QQ</span><strong>{match.member.qq}</strong></div>
                                <button onClick={() => copyQq(match.member)}>{copiedQqId === match.member.id ? "已复制 ✓" : "复制 QQ"}</button>
                              </div>
                            ) : (
                              <div className="qqMuted">TA 暂未选择展示 QQ</div>
                            )
                          )}
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  <div className="emptyState compactEmpty"><div className="radar">◎</div><h3>{dataMode === "remote" ? "还没有匹配到其他社员" : "演示成员里暂时没有重合"}</h3><p>{dataMode === "remote" ? "等其他社员填写后，结果会自然出现。" : "换一个兴趣组合再试试。"}</p></div>
                )}
              </>
            )}
          </aside>
        </div>
      )}
    </main>
  );
}

function QuestionCard({ question, onAnswer }: { question: Question; onAnswer: (field: ProfileField, value: string | string[]) => void }) {
  const [selected, setSelected] = useState<string[]>([]);

  function choose(value: string) {
    if (!question.multi) {
      onAnswer(question.field, value);
      return;
    }
    setSelected((current) => {
      if (current.includes(value)) return current.filter((item) => item !== value);
      if (current.length >= (question.maxSelections ?? 99)) return current;
      return [...current, value];
    });
  }

  return (
    <div className="questionCard">
      <div className="questionLabel">现在最值得确认的一点</div>
      <h2>{question.prompt}</h2>
      <p className="questionContext">{question.context}</p>
      <div className="options">
        {question.options.map((option) => (
          <button key={option.value} className={`option ${selected.includes(option.value) ? "selected" : ""}`} onClick={() => choose(option.value)}>
            <span>{option.label}</span>{option.hint && <small>{option.hint}</small>}
          </button>
        ))}
      </div>
      {question.multi && <button className="primary submit" disabled={!selected.length} onClick={() => onAnswer(question.field, selected)}>看看匹配发生什么变化 →</button>}
    </div>
  );
}
