"use client";

import { useEffect, useMemo, useState } from "react";
import { loadCommunityData, saveCommunityProfile } from "@/lib/community-store";
import { mockMembers } from "@/lib/mock-members";
import { chooseNextQuestion, rankMatches } from "@/lib/matching";
import { questions } from "@/lib/questions";
import type { Member, PartialProfile, ProfileField, Question } from "@/lib/types";

type DataMode = "loading" | "remote" | "mock";

type QuestionHistoryEntry = {
  questionId: string;
  profileBefore: PartialProfile;
  answer: string | string[];
};

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
  const [questionHistory, setQuestionHistory] = useState<QuestionHistoryEntry[]>([]);
  const [revisitEntry, setRevisitEntry] = useState<QuestionHistoryEntry | null>(null);

  useEffect(() => {
    let cancelled = false;

    loadCommunityData()
      .then((data) => {
        if (cancelled) return;
        if (!data.enabled) {
          setDataMode("mock");
          setDataMessage("当前使用演示成员数据");
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
        setDataMessage("真实成员池暂不可用，已切换演示数据");
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
  const activeQuestion = useMemo(
    () => revisitEntry ? questions.find((question) => question.id === revisitEntry.questionId) ?? nextQuestion : nextQuestion,
    [revisitEntry, nextQuestion]
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
    if (!activeQuestion) return;

    setPreviousScores(Object.fromEntries(matches.map((match) => [match.member.id, match.score])));

    if (revisitEntry) {
      setQuestionHistory((current) => [
        ...current,
        {
          questionId: revisitEntry.questionId,
          profileBefore: revisitEntry.profileBefore,
          answer: value,
        },
      ]);
      setProfile({ ...revisitEntry.profileBefore, [field]: value });
      setRevisitEntry(null);
      return;
    }

    const profileBefore = { ...profile };
    setQuestionHistory((current) => [
      ...current,
      {
        questionId: activeQuestion.id,
        profileBefore,
        answer: value,
      },
    ]);
    setProfile({ ...profileBefore, [field]: value });
  }

  function goToPreviousQuestion() {
    if (!questionHistory.length) return;

    const previous = questionHistory[questionHistory.length - 1];
    setPreviousScores(Object.fromEntries(matches.map((match) => [match.member.id, match.score])));
    setQuestionHistory((current) => current.slice(0, -1));
    setProfile(previous.profileBefore);
    setRevisitEntry(previous);
    setSaveMessage("");
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
      setSaveMessage(showQq ? "资料已保存，匹配成员可以看到你的 QQ" : "资料已保存，QQ 仅你自己可见");
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
    <main className={`appRoot ${started ? "isStarted" : ""}`}>
      <div className="sceneBackdrop" aria-hidden="true" />
      <div className="sceneShade" aria-hidden="true" />

      <header className="siteNav">
        <button className="wordmark" onClick={() => setStarted(false)} aria-label="返回方块搭子首页">
          <span className="pixelMark">◆</span>
          <span>ECNUMC Match</span>
        </button>
        <div className="navRight">
          <span className={`poolStatus ${dataMode}`}>
            <i />
            {dataMode === "loading" ? "连接成员池" : dataMode === "remote" ? "真实成员池" : "演示模式"}
          </span>
          <span className="clubName">水杉方块社</span>
        </div>
      </header>

      {!started ? (
        <section className="landing">
          <div className="landingContent">
            <div className="landingKicker">ECNUMC · PLAYER MATCHING</div>
            <h1>方块搭子</h1>
            <p className="landingLead">找到社团里最适合和你一起玩 Minecraft 的人。</p>
            <p className="landingSub">回答几个轻松的问题，匹配会逐渐变准。愿意公开 QQ 的成员，可以直接被联系。</p>
            <button className="heroCta" onClick={() => setStarted(true)}>
              开始匹配
              <span>→</span>
            </button>
            <div className="landingMeta">
              <span>无需注册</span>
              <b>·</b>
              <span>渐进式匹配</span>
              <b>·</b>
              <span>QQ 展示由你决定</span>
            </div>
            {dataMessage && <div className="landingStatus">{dataMessage}</div>}
          </div>
          <div className="landingFooter">
            <span>水杉方块社 · 方块搭子</span>
            <span>Built for ECNUMC members</span>
          </div>
        </section>
      ) : !identityDone ? (
        <section className="identityStage">
          <div className="glassCard identityPanel">
            <div className="stepTag">STEP 01 · PLAYER ID</div>
            <h2>先认识一下你</h2>
            <p className="panelLead">留下社团昵称和 QQ。你可以决定是否让匹配到你的成员看到联系方式。</p>

            <div className="identityGrid">
              <label className="fieldGroup">
                <span>社团昵称 / MC ID</span>
                <input
                  value={nickname}
                  maxLength={32}
                  onChange={(event) => setNickname(event.target.value)}
                  placeholder="例如 Jingyuans_robin"
                />
              </label>
              <label className="fieldGroup">
                <span>QQ</span>
                <input
                  value={qq}
                  inputMode="numeric"
                  maxLength={12}
                  onChange={(event) => setQq(event.target.value.replace(/\D/g, ""))}
                  placeholder="输入你的 QQ 号"
                />
              </label>
            </div>

            <label className={`privacyChoice ${showQq ? "checked" : ""}`}>
              <input type="checkbox" checked={showQq} onChange={(event) => setShowQq(event.target.checked)} />
              <span className="privacyIcon">{showQq ? "✓" : "○"}</span>
              <span>
                <b>愿意在匹配结果中展示我的 QQ</b>
                <small>开启后，其他成员只有在匹配结果中发现你时，才能看到并复制你的 QQ。</small>
              </span>
            </label>

            <button className="mainButton" disabled={saving || !nickname.trim() || !qq.trim()} onClick={saveIdentity}>
              {saving ? "正在保存…" : "保存并开始匹配"}
              {!saving && <span>→</span>}
            </button>
            {saveMessage && <div className="formMessage">{saveMessage}</div>}
          </div>

          <div className="identityAside glassCard subtleCard">
            <div className="asideNumber">01</div>
            <h3>身份只填一次</h3>
            <p>之后每回答一个问题，系统都会立即更新候选人和匹配度。</p>
            <div className="asideRule" />
            <div className="privacyNote">
              <strong>隐私说明</strong>
              <span>关闭 QQ 展示时，数据库也不会把你的 QQ 返回给其他成员。</span>
            </div>
          </div>
        </section>
      ) : (
        <section className="matchStage">
          <div className="stageTop glassCard">
            <div className="playerSummary">
              <div className="playerAvatar">{savedNickname.slice(0, 1).toUpperCase()}</div>
              <div>
                <span>当前玩家</span>
                <strong>{savedNickname}</strong>
                <small>QQ {savedShowQq ? "公开给匹配成员" : "仅自己可见"}</small>
              </div>
            </div>

            <div className="confidenceSummary">
              <div>
                <span>了解你</span>
                <strong>{overallConfidence}%</strong>
              </div>
              <div className="confidenceTrack"><i style={{ width: `${overallConfidence}%` }} /></div>
              <small>{hasMatches ? "继续回答，推荐会更稳定" : "回答第一题后开始计算"}</small>
            </div>

            <button className="editIdentity" onClick={() => { setIdentityDone(false); setSaveMessage(""); }}>
              修改资料
            </button>
          </div>

          <div className="matchWorkspace">
            <section className="questionColumn">
              {activeQuestion ? (
                <QuestionCard
                  key={`${activeQuestion.id}-${revisitEntry ? "revisit" : "next"}`}
                  question={activeQuestion}
                  initialValue={revisitEntry?.answer}
                  canGoBack={questionHistory.length > 0}
                  onBack={goToPreviousQuestion}
                  onAnswer={answer}
                />
              ) : (
                <div className="glassCard completeCard">
                  <span className="completeMark">✓</span>
                  <div>
                    <div className="stepTag">PROFILE READY</div>
                    <h2>主要匹配信息已经足够</h2>
                    <p>现在可以直接查看右侧推荐结果。</p>
                    {questionHistory.length > 0 && (
                      <button className="questionBackButton completeBack" onClick={goToPreviousQuestion}>
                        <span>←</span>
                        返回上一题
                      </button>
                    )}
                  </div>
                </div>
              )}

              {saveMessage && <div className="syncMessage">{saveMessage}</div>}
              {dataMode === "mock" && <div className="mockMessage">演示模式：当前资料不会上传。</div>}
            </section>

            <aside className="resultColumn">
              <div className="resultHeading">
                <div>
                  <span>MATCHES</span>
                  <h2>{hasMatches ? `${matches.length} 位潜在同好` : "等待第一条偏好"}</h2>
                </div>
                {hasMatches && <div className="liveDot"><i />实时重排</div>}
              </div>

              {!hasMatches ? (
                <div className="glassCard waitingCard">
                  <div className="radarGraphic"><span>◎</span></div>
                  <h3>你的候选人还藏在社团里</h3>
                  <p>回答第一道游戏问题后，这里会立即出现潜在同好。</p>
                </div>
              ) : top.length ? (
                <div className="matchList">
                  {top.map((match, index) => {
                    const oldScore = previousScores[match.member.id];
                    const delta = oldScore === undefined ? 0 : Math.round((match.score - oldScore) * 100);
                    const label = match.confidence < 0.3
                      ? "很有潜力"
                      : match.score >= 0.9
                        ? "非常合拍"
                        : match.score >= 0.8
                          ? "很值得认识"
                          : "可能玩得来";

                    return (
                      <article className={`matchCard ${index === 0 ? "topMatch" : ""}`} key={match.member.id}>
                        <div className="rankBadge">#{index + 1}</div>
                        {index === 0 && <div className="recommendTag">TOP MATCH</div>}

                        <div className="matchHeader">
                          <div className="memberAvatar">{match.member.name.slice(0, 1).toUpperCase()}</div>
                          <div className="memberIdentity">
                            <h3>{match.member.name}</h3>
                            <p>{match.member.intro}</p>
                          </div>
                          <div className="matchScore">
                            <strong>{Math.round(match.score * 100)}%</strong>
                            <span>{label}</span>
                          </div>
                        </div>

                        {delta !== 0 && (
                          <div className={`scoreDelta ${delta > 0 ? "up" : "down"}`}>
                            {delta > 0 ? "↑" : "↓"} 刚刚 {Math.abs(delta)}%
                          </div>
                        )}

                        <div className="reasonTags">
                          {(match.reasons.length ? match.reasons : ["已有核心兴趣重合"]).map((reason) => (
                            <span key={reason}>{reason}</span>
                          ))}
                        </div>

                        <div className="memberConfidence">
                          <span>了解度</span>
                          <div><i style={{ width: `${Math.round(match.confidence * 100)}%` }} /></div>
                          <b>{Math.round(match.confidence * 100)}%</b>
                        </div>

                        {dataMode === "remote" && (
                          match.member.qq ? (
                            <div className="qqContact">
                              <div>
                                <span>TA 愿意公开 QQ</span>
                                <strong>{match.member.qq}</strong>
                              </div>
                              <button onClick={() => copyQq(match.member)}>
                                {copiedQqId === match.member.id ? "已复制 ✓" : "复制 QQ"}
                              </button>
                            </div>
                          ) : (
                            <div className="qqPrivate">TA 暂未选择展示 QQ</div>
                          )
                        )}
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="glassCard waitingCard compact">
                  <div className="radarGraphic"><span>◎</span></div>
                  <h3>{dataMode === "remote" ? "还没有找到重合成员" : "演示成员里暂时没有重合"}</h3>
                  <p>{dataMode === "remote" ? "等更多社员填写后，结果会自然出现。" : "换一个兴趣组合再试试。"}</p>
                </div>
              )}
            </aside>
          </div>
        </section>
      )}
    </main>
  );
}

function QuestionCard({
  question,
  initialValue,
  canGoBack,
  onBack,
  onAnswer,
}: {
  question: Question;
  initialValue?: string | string[];
  canGoBack: boolean;
  onBack: () => void;
  onAnswer: (field: ProfileField, value: string | string[]) => void;
}) {
  const initialSelected = Array.isArray(initialValue)
    ? initialValue
    : initialValue
      ? [initialValue]
      : [];
  const [selected, setSelected] = useState<string[]>(initialSelected);

  function choose(value: string) {
    if (!question.multi) {
      setSelected([value]);
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
    <div className="glassCard questionPanel">
      <div className="questionNavRow">
        <button
          className="questionBackButton"
          onClick={onBack}
          disabled={!canGoBack}
          aria-label="返回上一题"
        >
          <span>←</span>
          上一题
        </button>
        <div className="questionTopline">
          <div className="stepTag">{initialValue !== undefined ? "PREVIOUS QUESTION" : "NEXT QUESTION"}</div>
          {question.multi && <span>最多选择 {question.maxSelections ?? "多"} 项</span>}
        </div>
      </div>
      <h2>{question.prompt}</h2>
      <p className="questionContext">{question.context}</p>
      <div className="optionGrid">
        {question.options.map((option, index) => (
          <button
            key={option.value}
            className={`answerOption ${selected.includes(option.value) ? "selected" : ""}`}
            onClick={() => choose(option.value)}
          >
            <span className="optionIndex">{String(index + 1).padStart(2, "0")}</span>
            <span className="optionText">
              <b>{option.label}</b>
              {option.hint && <small>{option.hint}</small>}
            </span>
            <span className="optionArrow">{selected.includes(option.value) ? "✓" : "→"}</span>
          </button>
        ))}
      </div>
      {question.multi && (
        <button className="mainButton answerSubmit" disabled={!selected.length} onClick={() => onAnswer(question.field, selected)}>
          看看匹配发生什么变化
          <span>→</span>
        </button>
      )}
    </div>
  );
}
