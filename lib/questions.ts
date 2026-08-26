import type { Question } from "./types";

export const questions: Question[] = [
  {
    id: "interests",
    field: "interests",
    prompt: "今晚突然空出来三个小时，你最想玩什么？",
    context: "最多选 3 项。选得越靠前，代表你现在越想玩。",
    multi: true,
    maxSelections: 3,
    options: [
      { value: "tech", label: "⚙️ 科技整合包", hint: "GTNH、ATM、机械动力等" },
      { value: "vanilla", label: "🌲 原版 / 类原版生存" },
      { value: "building", label: "🏗️ 建筑" },
      { value: "redstone", label: "🔴 红石 / 自动化" },
      { value: "pvp", label: "⚔️ PVP / 小游戏" },
      { value: "magic", label: "🪄 魔法模组" },
      { value: "adventure", label: "🗺️ 冒险 / RPG" },
      { value: "development", label: "💻 Mod / 服务端 / 技术开发" },
      { value: "social", label: "💬 在服里逛逛、聊天" }
    ]
  },
  {
    id: "pace",
    field: "pace",
    prompt: "开了一个你特别喜欢的新档以后，你通常是什么节奏？",
    context: "这题经常会直接改变谁排在第一名。",
    options: [
      { value: "hardcore", label: "🔥 有空就猛推" },
      { value: "steady", label: "⚙️ 稳定推进" },
      { value: "casual", label: "🌱 佛系慢慢玩" },
      { value: "adaptive", label: "👥 主要看队友节奏" }
    ]
  },
  {
    id: "availability",
    field: "availability",
    prompt: "你一般什么时候最容易上线？",
    context: "可以多选，系统只关心你们有没有真正能碰到的时间。",
    multi: true,
    maxSelections: 3,
    options: [
      { value: "weekday_afternoon", label: "工作日下午" },
      { value: "weekday_evening", label: "工作日晚上" },
      { value: "late_night", label: "深夜" },
      { value: "weekend_day", label: "周末白天" },
      { value: "weekend_evening", label: "周末晚上" },
      { value: "random", label: "时间不固定" }
    ]
  },
  {
    id: "duration",
    field: "duration",
    prompt: "如果遇到一个很好玩的档，你希望它持续多久？",
    context: "同样喜欢一个整合包，不代表都想投入半年。",
    options: [
      { value: "short", label: "几个晚上，有意思就行" },
      { value: "medium", label: "几周左右" },
      { value: "long", label: "几个月慢慢推进" },
      { value: "very_long", label: "半年以上也可以" },
      { value: "flexible", label: "完全看游戏和队友" }
    ]
  },
  {
    id: "groupSize",
    field: "groupSize",
    prompt: "找到玩得来的人后，你最希望是什么状态？",
    context: "我们在判断你想找的是固定搭子、小队，还是热闹的大服。",
    options: [
      { value: "duo", label: "👥 一个固定搭子" },
      { value: "small", label: "👨‍👩‍👧 3–5 人固定小队" },
      { value: "community", label: "🌐 人越多越热闹" },
      { value: "parallel", label: "🏠 同服但平时各玩各的" },
      { value: "flexible", label: "都可以" }
    ]
  },
  {
    id: "collaboration",
    field: "collaboration",
    prompt: "多人档里，哪种合作状态最舒服？",
    context: "有些维度不是越像越好，组织者和跟随型反而可能很合拍。",
    options: [
      { value: "together", label: "一起规划、一起推进" },
      { value: "divide", label: "明确分工，各自负责一块" },
      { value: "independent", label: "各玩各的，有需要再合作" },
      { value: "follower", label: "别人组织我就参加" },
      { value: "organizer", label: "我喜欢组织大家一起干" }
    ]
  },
  {
    id: "roles",
    field: "roles",
    prompt: "新服务器开荒，你最容易自然承担什么角色？",
    context: "最多选 2 项。系统同时看共同点和分工互补。",
    multi: true,
    maxSelections: 2,
    options: [
      { value: "planner", label: "🧠 研究路线 / 规划" },
      { value: "technical", label: "⚙️ 机器 / 红石 / 技术" },
      { value: "builder", label: "🏗️ 基地 / 建筑" },
      { value: "gatherer", label: "⛏️ 挖矿 / 资源收集" },
      { value: "explorer", label: "🗺️ 探索 / 跑图" },
      { value: "organizer", label: "📢 组织公共项目" },
      { value: "generalist", label: "🎲 缺什么补什么" }
    ]
  },
  {
    id: "communication",
    field: "communication",
    prompt: "一起玩的时候，你对开语音是什么态度？",
    context: "这是典型的潜在雷点验证题。",
    options: [
      { value: "voice", label: "🎙️ 基本都会开" },
      { value: "text", label: "💬 更喜欢打字" },
      { value: "optional", label: "🔄 看情况，熟了都可以" },
      { value: "avoid", label: "🙈 基本不想语音" }
    ]
  },
  {
    id: "research",
    field: "research",
    prompt: "遇到完全不会的新模组或机制，你通常会？",
    context: "这是低权重细节题，用来做最后一点修正。",
    options: [
      { value: "self", label: "自己查 Wiki / JEI / 攻略" },
      { value: "ask", label: "直接问懂的人" },
      { value: "together", label: "几个人一起摸索" },
      { value: "casual", label: "不研究效率，体验为主" }
    ]
  }
];

export const questionByField = Object.fromEntries(
  questions.map((question) => [question.field, question])
) as Record<Question["field"], Question>;
