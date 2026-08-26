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
  const [profile, setProfile] = useState<PartialProfile>({});
  const [previousScores, setPreviousScores] = useState<Record<string, number>>({});
  const [members, setMembers] = useState<Member[]>(mockMembers);
  const [dataMode, setDataMode] = useState<DataMode>("loading");
  const [dataMessage, setDataMessage] = useState("");
  const [nickname, setNickname] = useState("");
  const [savedNickname, setSavedNickname] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

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
        }
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
    if (dataMode !== "remote" || !savedNickname || !profile.interests?.length) return;

    const timer = window.setTimeout(async () => {
      try {
        setSaving(true);
        await saveCommunityProfile(savedNickname, profile);
        setSaveMessage("画像已自动同步");
      } catch (error) {
        console.error(error);
        setSaveMessage("自动同步失败，可稍后重试");
      } finally {
        setSaving(false);
      }
    }, 600);

    return () => window.clearTimeout(timer);
  }, [dataMode, profile, savedNickname]);

  function answer(field: ProfileField, value: string | string[]) {
    setPreviousScores(Object.fromEntries(matches.map((match) => [match.member.id, match.score])));
    setProfile((current) => ({ ...current, [field]: value }));
  }

  async function joinPool() {
    if (dataMode !== "remote") return;
    try {
      setSaving(true);
      setSaveMessage("");
      const cleanName = nickname.trim();
      await saveCommunityProfile(cleanName, profile);
      setSavedNickname(cleanName);
      setSaveMessage("已加入真实成员匹配池，后续答案会自动保存");

      const fresh = await loadCommunityData();
      if (fresh.enabled) setMembers(fresh.members);
    } catch (error) {
      console.error(error);
      setSaveMessage(error instanceof Error ? error.message : "保存失败，请稍后重试");
    } finally {
      setSaving(false);
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
          <p>先回答一个问题。每一次回答都会重新计算候选人，你随时可以停下来查看当前结果。</p>
          <button className="primary heroButton" onClick={() => setStarted(true)}>回答第一个问题 →</button>
          <div className="heroMeta"><span>无需一次答完</span><span>规则可解释</span><span>答完立即反馈</span></div>
          {dataMessage && <p className="dataMessage">{dataMessage}</p>}
        </section>
      ) : (
        <div className="workspace">
          <section className="left">
            {hasMatches && (
              <div className="progressCard">
                <div>
                  <span className="muted">匹配了解度</span>
                  <strong>{overallConfidence}%</strong>
                </div>
                <div className="progress"><span style={{ width: `${overallConfidence}%` }} /></div>
                <p>不是完成度。它表示我们掌握了多少足以比较你和候选人的信息。</p>
              </div>
            )}

            {nextQuestion ? (
              <QuestionCard key={nextQuestion.id} question={nextQuestion} onAnswer={answer} />
            ) : (
              <div className="questionCard"><div className="discovery">✓ 已经掌握主要匹配信息</div><h2>现在可以直接看结果了。</h2></div>
            )}

            {hasMatches && dataMode === "remote" && (
              <div className="joinCard">
                <div>
                  <span className="questionLabel">保存你的玩家画像</span>
                  <h3>{savedNickname ? `已以「${savedNickname}」加入匹配池` : "让其他社员也能发现你"}</h3>
                  <p>只需要一个社团昵称，不要求邮箱或密码。当前版本不会收集联系方式。</p>
                </div>
                <div className="joinControls">
                  <input
                    value={nickname}
                    maxLength={32}
                    onChange={(event) => setNickname(event.target.value)}
                    placeholder="你的社团昵称 / MC ID"
                    aria-label="社团昵称"
                  />
                  <button className="primary" disabled={saving || !nickname.trim()} onClick={joinPool}>
                    {saving ? "保存中…" : savedNickname ? "更新昵称" : "加入匹配池"}
                  </button>
                </div>
                {saveMessage && <div className="saveMessage">{saveMessage}</div>}
              </div>
            )}

            {hasMatches && dataMode === "mock" && (
              <div className="joinCard mutedCard">
                <span className="questionLabel">当前是演示模式</span>
                <h3>匹配逻辑可正常体验，但画像不会上传。</h3>
                <p>配置 Supabase 后，这里会自动切换为真实成员池。</p>
              </div>
            )}
          </section>

          <aside className="right">
            {!hasMatches ? (
              <div className="emptyState"><div className="radar">◎</div><h3>你的候选人还藏在社团里</h3><p>回答第一题后，这里会立刻出现潜在同好。</p></div>
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
                          <div className="reasonRow">
                            {(match.reasons.length ? match.reasons : ["当前已有核心兴趣重合"]).map((reason) => <span key={reason}>{reason}</span>)}
                          </div>
                          <div className="confidence"><span>了解度</span><div><i style={{ width: `${Math.round(match.confidence * 100)}%` }} /></div><b>{Math.round(match.confidence * 100)}%</b></div>
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  <div className="emptyState compactEmpty">
                    <div className="radar">◎</div>
                    <h3>{dataMode === "remote" ? "还没有匹配到其他社员" : "演示成员里暂时没有重合"}</h3>
                    <p>{dataMode === "remote" ? "你可以先加入匹配池。等其他社员填写后，结果会自然出现。" : "换一个兴趣组合再试试。"}</p>
                  </div>
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
      {question.multi && (
        <button className="primary submit" disabled={!selected.length} onClick={() => onAnswer(question.field, selected)}>
          看看匹配发生什么变化 →
        </button>
      )}
    </div>
  );
}
