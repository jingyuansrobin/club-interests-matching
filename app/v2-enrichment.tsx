"use client";

import { V2_ROLE_OPTIONS, type V2EnrichmentModule, type V2MatchProfile, type V2PlaystyleKey, type V2Preference } from "@/lib/v2-types";

const MODULE_META: Record<V2EnrichmentModule, { icon: string; title: string; desc: string }> = {
  team: { icon: "👥", title: "队伍与存档", desc: "队伍规模、存档周期" },
  communication: { icon: "🎙️", title: "沟通与约局", desc: "语音、约时间、异步推进" },
  resource: { icon: "📦", title: "资源习惯", desc: "个人边界与公共资源" },
  roles: { icon: "🧩", title: "队伍角色", desc: "更愿意主动负责什么" },
  learning: { icon: "🧠", title: "教学与研究", desc: "带人、被带、查资料" },
};

const GROUP_LABELS = ["2 人", "3–5 人", "6–10 人", "11–20 人", "大社区"];
const DURATION_LABELS = ["一次活动", "1–2 周", "1–2 个月", "3–6 个月", "半年以上"];
const VOICE_LABELS = ["完全不语音", "尽量文字", "都可以", "愿意语音", "基本开麦"];
const PLANNING_LABELS = ["临时喊人", "偏临时", "都可以", "偏计划", "提前约好"];
const ASYNC_LABELS = ["希望同时在线", "偏同步", "都可以", "可异步推进", "很接受异步"];
const RESOURCE_LABELS = ["各自独立", "偏独立", "核心共享", "偏共享", "全部共享"];
const TEACH_LABELS = ["不太想带", "较少带人", "看情况", "愿意带", "很愿意带"];
const LEARN_LABELS = ["更想自己摸索", "偶尔问人", "都可以", "希望有人提示", "希望队友愿意带"];
const RESEARCH_LABELS = ["更依赖带路", "偏问别人", "一起研究", "偏自己查", "喜欢自己研究"];

export function enrichmentModuleReady(profile: V2MatchProfile, module: V2EnrichmentModule) {
  if (module === "team") return typeof profile.boundaryPreferences.groupSize?.ideal === "number" && typeof profile.boundaryPreferences.duration?.ideal === "number";
  if (module === "communication") return typeof profile.boundaryPreferences.voice?.ideal === "number" && typeof profile.boundaryPreferences.asyncProgress?.ideal === "number" && typeof profile.playstylePreferences.sessionPlanning?.ideal === "number";
  if (module === "resource") return typeof profile.playstylePreferences.resourceSharing?.ideal === "number";
  if (module === "roles") return Object.values(profile.rolePreferences).filter((value) => typeof value === "number").length >= 4;
  return typeof profile.learningPreferences.teach === "number" && typeof profile.learningPreferences.learn === "number" && typeof profile.learningPreferences.researchIndependence === "number";
}

export function enrichmentCompletion(profile: V2MatchProfile) {
  const modules = Object.keys(MODULE_META) as V2EnrichmentModule[];
  return modules.filter((module) => enrichmentModuleReady(profile, module)).length;
}

function preference(ideal: number, old?: V2Preference): V2Preference {
  return { ideal, tolerance: ideal === 2 ? 2 : 1, hard: old?.hard ?? false };
}

function ChoiceScale({ labels, value, onChange }: { labels: string[]; value?: number; onChange: (value: number) => void }) {
  return <div className="v2EnhanceScale">{labels.map((label, index) => <button key={label} className={value === index ? "active" : ""} onClick={() => onChange(index)}><i />{label}</button>)}</div>;
}

function HardToggle({ checked, disabled, onChange }: { checked: boolean; disabled?: boolean; onChange: () => void }) {
  return <button className={`v2HardToggle ${checked ? "active" : ""}`} disabled={disabled} onClick={onChange}>{checked ? "✓ 已设为硬性要求" : "○ 这是我的硬性要求"}</button>;
}

export default function V2Enrichment({
  profile,
  activeModule,
  suggestedModule,
  suggestionReason,
  saving,
  onSelectModule,
  onChange,
  onSave,
  onClose,
}: {
  profile: V2MatchProfile;
  activeModule: V2EnrichmentModule;
  suggestedModule?: V2EnrichmentModule;
  suggestionReason?: string;
  saving: boolean;
  onSelectModule: (module: V2EnrichmentModule) => void;
  onChange: (profile: V2MatchProfile) => void;
  onSave: () => void;
  onClose: () => void;
}) {
  const completed = enrichmentCompletion(profile);

  const setBoundary = (key: string, ideal: number) => onChange({
    ...profile,
    boundaryPreferences: { ...profile.boundaryPreferences, [key]: preference(ideal, profile.boundaryPreferences[key]) },
  });
  const setPlaystyle = (key: V2PlaystyleKey, ideal: number) => onChange({
    ...profile,
    playstylePreferences: { ...profile.playstylePreferences, [key]: preference(ideal, profile.playstylePreferences[key]) },
  });
  const toggleBoundaryHard = (key: string) => {
    const current = profile.boundaryPreferences[key];
    if (!current) return;
    onChange({ ...profile, boundaryPreferences: { ...profile.boundaryPreferences, [key]: { ...current, hard: !current.hard } } });
  };
  const setRole = (key: string, value: number) => onChange({ ...profile, rolePreferences: { ...profile.rolePreferences, [key]: value } });
  const setLearning = (key: string, value: number) => onChange({ ...profile, learningPreferences: { ...profile.learningPreferences, [key]: value } });

  const ready = enrichmentModuleReady(profile, activeModule);
  const meta = MODULE_META[activeModule];

  return <div className="v2Enrichment">
    <div className="v2EnrichmentHeader">
      <div><div className="stepTag">REFINE MATCH · OPTIONAL</div><h2>让推荐再准一点</h2><p>{suggestionReason || "这些问题不会阻塞使用；每补一块，系统都会重新计算当前 Top 3。"}</p></div>
      <div className="v2EnhanceProgress"><strong>{completed}/5</strong><span>补充模块</span></div>
    </div>

    <div className="v2ModuleTabs">{(Object.keys(MODULE_META) as V2EnrichmentModule[]).map((module) => {
      const item = MODULE_META[module];
      const done = enrichmentModuleReady(profile, module);
      return <button key={module} className={`${activeModule === module ? "active" : ""} ${done ? "done" : ""}`} onClick={() => onSelectModule(module)}><span>{item.icon}</span><b>{item.title}</b><small>{done ? "已完成 ✓" : module === suggestedModule ? "建议优先" : item.desc}</small></button>;
    })}</div>

    <section className="v2EnhanceCard">
      <div className="v2EnhanceTitle"><span>{meta.icon}</span><div><h3>{meta.title}</h3><p>{meta.desc}</p></div></div>

      {activeModule === "team" && <>
        <div className="v2EnhanceQuestion"><div><strong>你最舒服的队伍规模是？</strong><small>选择理想状态；不是要求所有档都必须是这个人数。</small></div><ChoiceScale labels={GROUP_LABELS} value={profile.boundaryPreferences.groupSize?.ideal} onChange={(value) => setBoundary("groupSize", value)} /><HardToggle checked={Boolean(profile.boundaryPreferences.groupSize?.hard)} disabled={!profile.boundaryPreferences.groupSize} onChange={() => toggleBoundaryHard("groupSize")} /></div>
        <div className="v2EnhanceQuestion"><div><strong>你更希望一个档持续多久？</strong><small>从一次活动到半年以上，选最符合你期待的。</small></div><ChoiceScale labels={DURATION_LABELS} value={profile.boundaryPreferences.duration?.ideal} onChange={(value) => setBoundary("duration", value)} /><HardToggle checked={Boolean(profile.boundaryPreferences.duration?.hard)} disabled={!profile.boundaryPreferences.duration} onChange={() => toggleBoundaryHard("duration")} /></div>
      </>}

      {activeModule === "communication" && <>
        <div className="v2EnhanceQuestion"><div><strong>一起玩时，你对语音是什么态度？</strong><small>“完全不语音”和“基本开麦”都可以成为明确边界。</small></div><ChoiceScale labels={VOICE_LABELS} value={profile.boundaryPreferences.voice?.ideal} onChange={(value) => setBoundary("voice", value)} /><HardToggle checked={Boolean(profile.boundaryPreferences.voice?.hard)} disabled={!profile.boundaryPreferences.voice} onChange={() => toggleBoundaryHard("voice")} /></div>
        <div className="v2EnhanceQuestion"><div><strong>约局时你更喜欢？</strong><small>从“临时喊一声”到“提前约好时间”。</small></div><ChoiceScale labels={PLANNING_LABELS} value={profile.playstylePreferences.sessionPlanning?.ideal} onChange={(value) => setPlaystyle("sessionPlanning", value)} /></div>
        <div className="v2EnhanceQuestion"><div><strong>不能同时上线时，能接受异步推进吗？</strong><small>比如你做材料、TA 下次上线接着做机器。</small></div><ChoiceScale labels={ASYNC_LABELS} value={profile.boundaryPreferences.asyncProgress?.ideal} onChange={(value) => setBoundary("asyncProgress", value)} /></div>
      </>}

      {activeModule === "resource" && <div className="v2EnhanceQuestion"><div><strong>多人档里的资源，你更偏向怎么管理？</strong><small>个人边界强 ↔ 公共资源充分共享。</small></div><ChoiceScale labels={RESOURCE_LABELS} value={profile.playstylePreferences.resourceSharing?.ideal} onChange={(value) => setPlaystyle("resourceSharing", value)} /></div>}

      {activeModule === "roles" && <>
        <div className="v2EnhanceHint">不用把 8 项全部评分。标 4 个你最有感觉的角色就够了；没填的仍然是“未知”。</div>
        <div className="v2RoleGrid">{V2_ROLE_OPTIONS.map((role) => <div className="v2RoleRow" key={role.key}><div><span>{role.icon}</span><strong>{role.label}</strong></div><div>{["不太想负责", "可以负责", "很愿意负责"].map((label, value) => <button key={label} className={profile.rolePreferences[role.key] === value ? "active" : ""} onClick={() => setRole(role.key, value)}>{label}</button>)}</div></div>)}</div>
      </>}

      {activeModule === "learning" && <>
        <div className="v2EnhanceQuestion"><div><strong>遇到不熟悉玩法的队友，你愿意带人吗？</strong></div><ChoiceScale labels={TEACH_LABELS} value={profile.learningPreferences.teach} onChange={(value) => setLearning("teach", value)} /></div>
        <div className="v2EnhanceQuestion"><div><strong>自己不会的时候，你希望队友愿意带你吗？</strong></div><ChoiceScale labels={LEARN_LABELS} value={profile.learningPreferences.learn} onChange={(value) => setLearning("learn", value)} /></div>
        <div className="v2EnhanceQuestion"><div><strong>遇到不会的机制，你通常怎么解决？</strong></div><ChoiceScale labels={RESEARCH_LABELS} value={profile.learningPreferences.researchIndependence} onChange={(value) => setLearning("researchIndependence", value)} /></div>
      </>}
    </section>

    <div className="v2EnrichmentFooter"><button className="v2Back" onClick={onClose}>暂时到这里</button><div><small>{ready ? "这一模块的信息已经足够 ✓" : activeModule === "roles" ? "标 4 个角色即可保存" : "完成当前模块后即可重新计算"}</small><button className="v2Primary" disabled={!ready || saving} onClick={onSave}>{saving ? "正在重新计算…" : "保存并更新推荐 →"}</button></div></div>
  </div>;
}
