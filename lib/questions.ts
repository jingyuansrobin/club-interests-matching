import type { Question } from "./types";

export const questions: Question[] = [
  {
    id: "interests",
    field: "interests",
    prompt: "如果今晚群里有人喊开玩，哪些内容最容易把你叫上线？",
    context: "最多选 3 项，请按你现在最想玩的顺序点击。这里决定匹配的第一层方向。",
    multi: true,
    maxSelections: 3,
    options: [
      { value: "tech", label: "⚙️ 科技整合包", hint: "GTNH、ATM、机械动力、自动化产线等" },
      { value: "vanilla", label: "🌲 原版 / 类原版生存", hint: "长期生存、原版机制、轻量模组服" },
      { value: "building", label: "🏗️ 建筑 / 景观", hint: "基地设计、校园复刻、城市与景观建设" },
      { value: "redstone", label: "🔴 红石 / 自动化", hint: "红石机器、农场、仓储与原版自动化" },
      { value: "pvp", label: "⚔️ PVP / 对抗", hint: "竞技、阵营、战斗向玩法" },
      { value: "minigame", label: "🎮 小游戏 / 派对玩法", hint: "小游戏服、跑酷、合作挑战、轻竞技" },
      { value: "magic", label: "🪄 魔法模组", hint: "神秘、植物魔法、血魔法等体系" },
      { value: "adventure", label: "🗺️ 冒险 / RPG", hint: "探索、任务、地牢、Boss、剧情地图" },
      { value: "challenge", label: "💀 高难 / 生存挑战", hint: "专家包、硬核生存、受限资源或高难目标" },
      { value: "development", label: "💻 Mod / 服务端 / 技术开发", hint: "插件、模组、脚本、服务端和工具开发" },
      { value: "social", label: "💬 社交 / 在服里一起待着", hint: "聊天、参观、串门、公共活动和轻松陪伴" }
    ]
  },
  {
    id: "pace",
    field: "pace",
    prompt: "开了一个你很喜欢的新档以后，你通常会用什么节奏推进？",
    context: "我们关注的是长期相处时的推进速度，不是在判断谁更肝。",
    options: [
      { value: "hardcore", label: "🔥 有空就猛推", hint: "喜欢明显推进主线、科技树或大型目标" },
      { value: "steady", label: "⚙️ 稳定推进", hint: "每次上线做一两件事，持续往前走" },
      { value: "burst", label: "⚡ 一阵猛肝，一阵休息", hint: "有兴趣时集中投入，之后可能停几天" },
      { value: "casual", label: "🌱 佛系慢慢玩", hint: "不赶进度，想到什么就做什么" },
      { value: "adaptive", label: "👥 主要看队友节奏", hint: "快慢都能接受，更在意有人一起玩" }
    ]
  },
  {
    id: "availability",
    field: "availability",
    prompt: "正常上课期间，你通常什么时候最容易上线？",
    context: "最多选 3 项。共同时间往往比“兴趣很像”更决定最后能不能真的一起玩。",
    multi: true,
    maxSelections: 3,
    options: [
      { value: "weekday_afternoon", label: "🌤️ 工作日下午", hint: "没课、课间较长或下午空闲" },
      { value: "weekday_evening", label: "🌆 工作日晚上", hint: "大约 18:00–22:00" },
      { value: "late_night", label: "🌙 深夜", hint: "大约 22:00 以后" },
      { value: "weekend_day", label: "☀️ 周末白天", hint: "周六 / 周日上午到傍晚" },
      { value: "weekend_evening", label: "🌃 周末晚上", hint: "周五 / 周六 / 周日晚间" },
      { value: "random", label: "🎲 时间很随机", hint: "很难固定，但看到有人喊可能会上" }
    ]
  },
  {
    id: "duration",
    field: "duration",
    prompt: "如果遇到一个很好玩的档或项目，你希望它大概持续多久？",
    context: "同样喜欢一种玩法，不代表都愿意投入同样长的时间。",
    options: [
      { value: "one_off", label: "🎉 一次活动 / 一两个晚上", hint: "玩完一轮就很满足" },
      { value: "short", label: "🕒 几个晚上到一两周", hint: "短档、短挑战、快速体验整合包" },
      { value: "medium", label: "📅 几周左右", hint: "能持续推进，但不想拖太久" },
      { value: "long", label: "🗓️ 几个月慢慢推进", hint: "愿意长期建设和养成" },
      { value: "very_long", label: "🏡 半年以上也可以", hint: "偏爱长线服务器和持续维护" },
      { value: "flexible", label: "🔄 完全看游戏和队友", hint: "短局长档都能接受" }
    ]
  },
  {
    id: "groupSize",
    field: "groupSize",
    prompt: "找到玩得来的人以后，你最理想的组队规模是什么？",
    context: "是在找一个固定搭子、一个小队，还是希望融进更大的服务器社区。",
    options: [
      { value: "duo", label: "👥 一个固定搭子", hint: "两个人最好协调，也更容易形成默契" },
      { value: "small", label: "👨‍👩‍👧 3–5 人固定小队", hint: "有人分工，也不会太吵" },
      { value: "community", label: "🌐 6 人以上 / 大家一起玩", hint: "喜欢热闹的大服、公共项目和多人活动" },
      { value: "parallel", label: "🏠 同服但平时各玩各的", hint: "偶尔合作、串门，不要求总是一起行动" },
      { value: "flexible", label: "🔄 规模都可以", hint: "更看重具体的人和玩法" }
    ]
  },
  {
    id: "collaboration",
    field: "collaboration",
    prompt: "多人档里，哪种合作方式最让你舒服？",
    context: "这一维度既看相似，也看互补；例如喜欢组织的人和愿意跟队的人可能非常合拍。",
    options: [
      { value: "together", label: "🤝 一起规划、一起推进", hint: "主线和大项目尽量同步完成" },
      { value: "divide", label: "🧩 明确分工，各自负责一块", hint: "科技、建筑、资源、探索各有人负责" },
      { value: "independent", label: "🏠 各玩各的，有需要再合作", hint: "保留个人空间，合作是加分项" },
      { value: "follower", label: "🙋 别人组织我就参加", hint: "不太想负责统筹，但愿意一起行动" },
      { value: "organizer", label: "📣 我喜欢发起和组织", hint: "会主动约人、定目标、拉公共项目" },
      { value: "flexible", label: "🔄 看具体项目", hint: "一起做或分开做都能适应" }
    ]
  },
  {
    id: "roles",
    field: "roles",
    prompt: "新服务器开荒时，你最容易自然承担哪些角色？",
    context: "最多选 2 项。系统会同时考虑共同兴趣和角色互补，而不是要求两个人完全一样。",
    multi: true,
    maxSelections: 2,
    options: [
      { value: "planner", label: "🧠 路线规划 / 查资料", hint: "研究配方、科技树、任务线和发展路线" },
      { value: "technical", label: "⚙️ 机器 / 红石 / 技术", hint: "搭机器、自动化、红石系统和技术设施" },
      { value: "builder", label: "🏗️ 基地 / 建筑", hint: "负责外观、空间、道路、景观和基地设计" },
      { value: "gatherer", label: "⛏️ 挖矿 / 资源收集", hint: "愿意跑资源、刷材料、准备基础物资" },
      { value: "explorer", label: "🗺️ 探索 / 跑图", hint: "找结构、生物群系、据点和新区域" },
      { value: "combat", label: "🗡️ 战斗 / Boss / 副本", hint: "处理战斗目标、地牢、Boss 和危险区域" },
      { value: "logistics", label: "📦 仓储 / 后勤 / 整理", hint: "喜欢做仓储、物流、补给和公共基础设施" },
      { value: "organizer", label: "📢 组织公共项目", hint: "拉人、协调分工、推进大型共同目标" },
      { value: "generalist", label: "🎲 缺什么补什么", hint: "没有固定岗位，愿意补队伍短板" }
    ]
  },
  {
    id: "communication",
    field: "communication",
    prompt: "一起玩的时候，你对语音沟通是什么态度？",
    context: "语音不是必须，但明显不同的沟通习惯很容易在长期组队里形成摩擦。",
    options: [
      { value: "voice", label: "🎙️ 基本都会开语音", hint: "边玩边聊最自然" },
      { value: "listen", label: "🎧 可以听，但不太常说", hint: "能进语音配合，自己更偏安静" },
      { value: "text", label: "💬 更喜欢打字", hint: "群聊 / 游戏内文字就足够" },
      { value: "optional", label: "🔄 看情况，熟了都可以", hint: "语音和文字都能接受" },
      { value: "avoid", label: "🙈 基本不想语音", hint: "希望主要通过文字交流" }
    ]
  },
  {
    id: "sessionStyle",
    field: "sessionStyle",
    prompt: "如果想和搭子一起玩，你更喜欢怎么把这一局约起来？",
    context: "“什么时候有空”解决时间重合；这题解决的是你们习惯怎么真正碰到一起。",
    options: [
      { value: "scheduled", label: "📅 提前约好时间和目标", hint: "例如今晚 8 点一起推进某条线" },
      { value: "ping", label: "📣 群里 / 私聊喊一声，有人就上", hint: "临时约局，但会主动叫人" },
      { value: "dropin", label: "🟢 谁在线就和谁碰头", hint: "不太专门约，在线时自然一起玩" },
      { value: "async", label: "📝 不一定同时在线，也能分工推进", hint: "留言、共享仓库、异步完成各自任务" },
      { value: "flexible", label: "🔄 这些方式都可以", hint: "愿意跟着搭子的习惯调整" }
    ]
  },
  {
    id: "resourceStyle",
    field: "resourceStyle",
    prompt: "多人长期档里，你希望基地和资源怎么管理？",
    context: "这是很常见但容易被忽略的长期摩擦点：有人默认全共享，有人更需要个人边界。",
    options: [
      { value: "shared", label: "🏠 基地、仓库、资源尽量全共享", hint: "更像一个共同团队账户" },
      { value: "core_shared", label: "📦 公共资源共享，个人项目分开", hint: "公共仓库 + 各自的设备、建筑或收藏" },
      { value: "separate", label: "🔐 资源和地盘主要各自管理", hint: "需要时互借或合作，但默认不混在一起" },
      { value: "flexible", label: "🔄 都可以，提前说清楚就行", hint: "共享程度不是决定因素" }
    ]
  },
  {
    id: "research",
    field: "research",
    prompt: "遇到完全不会的新模组或机制，你通常怎么上手？",
    context: "这是较低权重的学习习惯题，用来修正长期合作体验。",
    options: [
      { value: "self", label: "📚 自己查 Wiki / JEI / 攻略", hint: "先研究清楚，再动手" },
      { value: "ask", label: "🙋 直接问懂的人", hint: "有人知道就不重复踩坑" },
      { value: "together", label: "🧪 几个人一起摸索", hint: "边试边讨论本身就是乐趣" },
      { value: "guided", label: "🧭 希望有人带着上手", hint: "跟着做一遍会学得最快" },
      { value: "casual", label: "🌿 不太研究效率，体验为主", hint: "不知道也没关系，慢慢玩" }
    ]
  },
  {
    id: "experienceStyle",
    field: "experienceStyle",
    prompt: "如果队伍里大家对某个玩法的熟练度差很多，你更舒服的是哪种状态？",
    context: "这不是水平测试，而是在判断“带人 / 被带 / 同水平摸索”是不是彼此都舒服。",
    options: [
      { value: "teach", label: "🧑‍🏫 我愿意带新人、解释机制", hint: "看到别人不会时愿意讲和示范" },
      { value: "learn", label: "🎒 我希望有人愿意带我", hint: "有熟悉的人一起会更容易进入状态" },
      { value: "peer", label: "🤝 更喜欢水平接近，一起研究", hint: "希望双方都能独立参与推进" },
      { value: "mixed", label: "🔄 都可以，别有压力就行", hint: "熟练度差异不是问题" }
    ]
  }
];

export const questionByField = Object.fromEntries(
  questions.map((question) => [question.field, question])
) as Record<Question["field"], Question>;
