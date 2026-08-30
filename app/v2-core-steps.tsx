"use client";

import {
  INTEREST_SCALE,
  V2_DAYS,
  V2_INTERESTS,
  V2_TIME_BUCKETS,
  type V2InterestKey,
  type V2MatchProfile,
  type V2PlaystyleKey,
} from "@/lib/v2-types";

export const CORE_PLAYSTYLE_AXES: { key: V2PlaystyleKey; prompt: string; left: string; right: string; labels: string[] }[] = [
  { key: "paceIntensity", prompt: "推进一个喜欢的存档时", left: "更看重体验", right: "更看重推进", labels: ["很佛系", "偏佛系", "都可以", "偏推进", "很在意推进"] },
  { key: "collabSynchrony", prompt: "多人档里", left: "喜欢一起行动", right: "喜欢各自发展", labels: ["基本一起", "偏一起", "都可以", "偏独立", "各自发展"] },
  { key: "collabDivision", prompt: "做一个大型项目的时候", left: "大家一起做", right: "喜欢明确分工", labels: ["一起完成", "偏一起", "都可以", "偏分工", "明确分工"] },
];

export function ratedInterestCount(profile: V2MatchProfile) {
  return Object.values(profile.interestScores).filter((value) => typeof value === "number").length;
}

export function interestReady(profile: V2MatchProfile) {
  const values = Object.values(profile.interestScores).filter((value): value is number => typeof value === "number");
  return values.length >= 2 && values.some((value) => value > 0);
}

export function availabilityReady(profile: V2MatchProfile) {
  return Object.values(profile.availabilityGrid).some((value) => value > 0) || (profile.availabilityRandomness ?? 0) >= 3;
}

export function playstyleReady(profile: V2MatchProfile) {
  return CORE_PLAYSTYLE_AXES.every((axis) => typeof profile.playstylePreferences[axis.key]?.ideal === "number");
}

export function InterestStep({ profile, legacySuggested, onScore, onIntent, onContinue, saving }: {
  profile: V2MatchProfile; legacySuggested: boolean; onScore: (key: V2InterestKey, value: number) => void; onIntent: (key: V2InterestKey) => void; onContinue: () => void; saving: boolean;
}) {
  const ready = interestReady(profile);
  const ratedCount = ratedInterestCount(profile);
  return <div className="v2Step">
    <div className="v2StepHeader">
      <div><div className="stepTag">BASE PROFILE · 1 / 3</div><h2>最近什么最容易把你叫上线？</h2><p>给有感觉的玩法标一下兴趣程度，不需要全部填写。没操作代表“还不知道”，和明确的“不想玩”不同。</p></div>
      <span className="v2Counter">已评价 {ratedCount} 项</span>
    </div>
    {legacySuggested && <div className="v2LegacyBanner">已根据旧版画像预填部分兴趣。请按现在的真实情况确认或调整；旧版未选择的项目不会被当成“不喜欢”。</div>}
    <div className="v2InterestGrid">
      {V2_INTERESTS.map((item) => {
        const score = profile.interestScores[item.key];
        const intent = profile.currentIntents.includes(item.key);
        return <article className={`v2InterestCard ${typeof score === "number" ? "rated" : ""} ${intent ? "intent" : ""}`} key={item.key}>
          <div className="v2InterestTitle"><span className="v2InterestIcon">{item.icon}</span><div><strong>{item.label}</strong><small>{item.hint}</small></div></div>
          <div className="v2Scale" aria-label={`${item.label}兴趣程度`}>
            {INTEREST_SCALE.map((option) => <button className={score === option.value ? "active" : ""} key={option.value} onClick={() => onScore(item.key, option.value)} title={option.label}><i /><span>{option.short}</span></button>)}
          </div>
          <button className={`v2IntentButton ${intent ? "active" : ""}`} onClick={() => onIntent(item.key)} disabled={typeof score !== "number" || score <= 0}>{intent ? "🔥 最近最想玩" : "＋ 标记为最近最想玩"}</button>
        </article>;
      })}
    </div>
    <div className="v2StepFooter">
      <div><strong>{ready ? "已经足够进入下一步 ✓" : "至少评价 2 个玩法，其中一个不是“基本不去”"}</strong><small>“最近最想玩”最多 2 项；其他玩法可以放心留空。</small></div>
      <button className="v2Primary" disabled={!ready || saving} onClick={onContinue}>{saving ? "正在计算…" : "继续看看什么时候能碰到一起 →"}</button>
    </div>
  </div>;
}

export function AvailabilityStep({ profile, onCycle, onQuick, onRandomness, onBack, onContinue, saving }: {
  profile: V2MatchProfile; onCycle: (slot: string) => void; onQuick: (mode: "every_evening" | "weekday_evening" | "weekend" | "random") => void; onRandomness: (value: number) => void; onBack: () => void; onContinue: () => void; saving: boolean;
}) {
  const ready = availabilityReady(profile);
  const positiveSlots = Object.values(profile.availabilityGrid).filter((value) => value > 0).length;
  return <div className="v2Step">
    <div className="v2StepHeader"><div><div className="stepTag">BASE PROFILE · 2 / 3</div><h2>什么时候最容易在服务器碰到你？</h2><p>点你通常有空的时间即可：点一次“偶尔”，再点一次“经常”，第三次清除。不需要填满整张表。</p></div><span className="v2Counter">{positiveSlots} 个常见窗口</span></div>
    <div className="v2QuickRow"><span>快速填写</span><button onClick={() => onQuick("every_evening")}>基本每天晚上</button><button onClick={() => onQuick("weekday_evening")}>工作日晚</button><button onClick={() => onQuick("weekend")}>周末比较多</button><button onClick={() => onQuick("random")}>时间很随机</button></div>
    <div className="v2Heatmap">
      <div className="v2HeatHeader"><span />{V2_TIME_BUCKETS.map((bucket) => <div key={bucket.key}><strong>{bucket.label}</strong><small>{bucket.hint}</small></div>)}</div>
      {V2_DAYS.map((day) => <div className="v2HeatRow" key={day.key}><strong>{day.label}</strong>{V2_TIME_BUCKETS.map((bucket) => {
        const slot = `${day.key}_${bucket.key}`;
        const value = profile.availabilityGrid[slot];
        return <button className={`v2HeatCell level${value ?? 0}`} key={slot} onClick={() => onCycle(slot)}><i /><span>{value === 2 ? "经常" : value === 1 ? "偶尔" : ""}</span></button>;
      })}</div>)}
    </div>
    <div className="v2Randomness"><div><strong>你的上线时间规律吗？</strong><small>这和“什么时候有空”分开记录。</small></div>{[{ v: 0, t: "比较固定" }, { v: 2, t: "有时变化" }, { v: 4, t: "很随机" }].map((item) => <button className={profile.availabilityRandomness === item.v ? "active" : ""} key={item.v} onClick={() => onRandomness(item.v)}>{item.t}</button>)}</div>
    <div className="v2StepFooter"><button className="v2Back" onClick={onBack}>← 返回兴趣</button><div className="v2FooterSpacer" /><button className="v2Primary" disabled={!ready || saving} onClick={onContinue}>{saving ? "正在计算…" : "继续描述一起玩的习惯 →"}</button></div>
  </div>;
}

export function PlaystyleStep({ profile, onSet, onBack, onContinue, saving }: {
  profile: V2MatchProfile; onSet: (key: V2PlaystyleKey, ideal: number) => void; onBack: () => void; onContinue: () => void; saving: boolean;
}) {
  const ready = playstyleReady(profile);
  return <div className="v2Step">
    <div className="v2StepHeader"><div><div className="stepTag">BASE PROFILE · 3 / 3</div><h2>一起开档时，你通常怎么玩？</h2><p>不是把你归进某一种“玩家人格”，而是看看你在几条真实游戏习惯上更偏哪边。</p></div></div>
    <div className="v2AxisList">
      {CORE_PLAYSTYLE_AXES.map((axis) => {
        const value = profile.playstylePreferences[axis.key];
        return <article className="v2AxisCard" key={axis.key}>
          <div className="v2AxisPrompt"><strong>{axis.prompt}</strong><div><span>{axis.left}</span><i>↔</i><span>{axis.right}</span></div></div>
          <div className="v2AxisOptions">{axis.labels.map((label, index) => <button className={value?.ideal === index ? "active" : ""} key={label} onClick={() => onSet(axis.key, index)}><i />{label}</button>)}</div>
        </article>;
      })}
    </div>
    <div className="v2StepFooter"><button className="v2Back" onClick={onBack}>← 返回时间</button><div className="v2FooterSpacer" /><button className="v2Primary" disabled={!ready || saving} onClick={onContinue}>{saving ? "正在计算最终推荐…" : "生成我的正式 Top 3 →"}</button></div>
  </div>;
}
