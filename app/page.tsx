"use client";

import { useMemo, useState } from "react";
import { mockMembers } from "@/lib/mock-members";
import { chooseNextQuestion, rankMatches } from "@/lib/matching";
import { questions } from "@/lib/questions";
import type { PartialProfile, ProfileField, Question } from "@/lib/types";

export default function Home() {
  const [started, setStarted] = useState(false);
  const [profile, setProfile] = useState<PartialProfile>({});
  const [previousScores, setPreviousScores] = useState<Record<string, number>>({});

  const matches = useMemo(() => rankMatches(profile, mockMembers), [profile]);
  const nextQuestion = useMemo(
    () => chooseNextQuestion(profile, matches.slice(0, 8).map((match) => match.member), questions),
    [profile, matches]
  );

  function answer(field: ProfileField, value: string | string[]) {
    setPreviousScores(Object.fromEntries(matches.map((match) => [match.member.id, match.score])));
    setProfile((current) => ({ ...current, [field]: value }));
  }

  const hasMatches = Boolean(profile.interests?.length);
  const top = matches.slice(0, 3);
  const overallConfidence = top.length ? Math.round((top.reduce((sum, item) => sum + item.confidence, 0) / top.length) * 100) : 0;

  return (
    <main className="shell">
      <header className="nav">
        <div className="brand"><span className="cube">◆</span> 方块搭子</div>
        <div className="badge">水杉方块社 · MVP</div>
      </header>

      {!started ? (
        <section className="hero">
          <div className="eyebrow">不是问卷，是一次逐渐变准的同好发现</div>
          <h1>社团里可能已经有一个<br /><span>很适合和你一起玩的人。</span></h1>
          <p>先回答一个问题。每一次回答都会重新计算候选人，你随时可以停下来查看当前结果。</p>
          <button className="primary heroButton" onClick={() => setStarted(true)}>回答第一个问题 →</button>
          <div className="heroMeta"><span>无需一次答完</span><span>规则可解释</span><span>答完立即反馈</span></div>
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
