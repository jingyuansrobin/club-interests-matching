# 方块搭子 · Club Interests Matching

面向高校 Minecraft 社群的渐进式玩家匹配工具。用户不需要一次做完长问卷：先用少量高价值信息得到第一轮推荐，再根据需要逐步完善画像。

当前主版本为 **V2**。完整产品与算法设计见 [`docs/v2-design.md`](docs/v2-design.md)。

## 正式站点

生产环境计划部署在：

```text
https://match.ecnumc.cn/
```

这是独立子域名部署，因此项目继续从站点根路径 `/` 提供服务，**不设置 `/match` basePath**。

管理员入口：

```text
https://match.ecnumc.cn/admin/
```

此前用于内测的 FRP 端口转发不再作为正式部署方案。

## V2 已实现

- 社团昵称、QQ、自我介绍与 QQ 展示意愿
- 可选邮箱绑定 / 6 位 OTP 恢复资料
- 玩法兴趣 0–4 语义强度评分
- 最多 2 项“最近最想玩”短期意图
- 7 天 × 上午 / 下午 / 晚上 / 深夜的上线时间热力图
- 上线时间随机性独立建模
- 三个核心多人游戏习惯轴：推进强度、行动同步、分工程度
- 三核心模块完成后立即生成正式 Top 3
- 五个可选补充模块：队伍与存档、沟通与约局、资源习惯、队伍角色、教学与研究
- Compatibility 与 Confidence 分离
- 服务端 Top 3 匹配与可解释推荐理由
- V1 老用户兼容：旧数据继续参与匹配，未选项不会被误判成“不喜欢”
- 精细 V2 画像仅本人可直接读取；候选人的时间表等数据不下发到其他浏览器
- 匹配反馈与 QQ 复制行为记录
- 管理员 V2 搜索、筛选、排序、反馈概览与 Excel 导出
- Next.js 静态导出，可直接部署到 Nginx 等静态 Web Server

## V2 用户流程

```text
身份资料
  ↓
玩法兴趣 + 最近最想玩
  ↓
一周上线时间热力图
  ↓
三个核心多人游戏习惯轴
  ↓
基础画像 100% + 正式 Top 3
  ↓
可选：让推荐再准一点
  ↓
队伍与存档 / 沟通与约局 / 资源习惯 / 队伍角色 / 教学与研究
```

## 技术路线

- Next.js 15 + React 19 + TypeScript
- `@supabase/supabase-js`
- Supabase Postgres + Anonymous Auth + RLS
- Supabase Edge Function `match-v2` 负责服务端匹配
- 规则型、可解释匹配引擎；当前不依赖机器学习
- 纯 CSS UI，无重量级 UI 框架

## 匹配原则

1. **不是性格测试**：目标是找到真正能一起玩的 Minecraft 搭子。
2. **unknown ≠ 0**：未回答不会扣分；只有明确表达的 0 才代表“不喜欢 / 基本不会”。
3. **近期需求优先**：最近最想玩的内容权重大于长期兴趣，并随时间衰减。
4. **时间看能不能碰到**：重点计算真实共同上线窗口，而不是课表长得是否相似。
5. **相似与互补分开**：兴趣和节奏主要看相似；角色与教学关系可以通过互补加分。
6. **匹配度与了解程度分离**：低 Confidence 的虚高 Compatibility 会在内部排序时向中性值收缩。
7. **先规则后学习**：先积累真实社团反馈，再决定是否校准权重或引入学习排序。

## 本地运行

```bash
npm install
npm run dev
```

打开 `http://localhost:3000`。

## 环境变量

复制：

```bash
cp .env.example .env.local
```

填写：

```env
NEXT_PUBLIC_SITE_URL=https://match.ecnumc.cn
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
```

不要把 `service_role` key 放进浏览器环境变量。Edge Function 在 Supabase 服务端通过平台环境读取服务端凭据。

## Supabase 初始化

新项目按顺序执行：

1. 在 Authentication 中启用 Anonymous Sign-Ins。
2. 在 SQL Editor 执行 `supabase/schema.sql`。
3. 按顺序执行 `supabase/migrations/` 下的迁移。
4. 部署 `supabase/functions/match-v2/index.ts` 为 Edge Function `match-v2`，并保持 JWT 校验开启。
5. Auth Site URL 设置为 `https://match.ecnumc.cn/`，Redirect URLs 至少允许 `https://match.ecnumc.cn/**`。
6. 配置邮件 OTP 模板。

当前 V2 关键表：

- `member_profiles`：昵称、自我介绍、V1 兼容字段、匹配池状态
- `member_contacts`：QQ 与公开意愿
- `member_match_profiles`：V2 精细玩家画像，仅本人通过 RLS 直接读取
- `match_feedback`：匹配反馈 / 行为数据

## 隐私边界

QQ 单独存放在 `member_contacts`；关闭展示时不会作为普通候选资料返回给其他成员。

V2 的精细上线时间、容忍度和后续边界数据存放在 `member_match_profiles`。普通客户端只能直接读取自己的 V2 画像。候选人匹配由 `match-v2` Edge Function 在服务端完成，浏览器只收到展示所需的昵称、自我介绍、匹配度、了解程度、推荐理由以及允许公开的 QQ。

Anonymous Auth 身份保存在浏览器中；用户可以主动绑定邮箱，以便清缓存或换设备后通过 6 位邮箱验证码恢复同一份资料。

## 构建与生产部署

```bash
npm install
npm run build
```

项目使用：

```ts
output: "export"
```

构建产物位于 `out/`。生产服务器只需要将整个 `out/` 目录作为 `match.ecnumc.cn` 的 Web Root；不能只上传 `index.html`，因为 `_next/` 下的 JS/CSS 静态资源同样是运行所必需的。

推荐 Nginx 结构：

```nginx
server {
    listen 80;
    server_name match.ecnumc.cn;

    root /var/www/club-interests-matching/out;
    index index.html;

    location / {
        try_files $uri $uri/ $uri/index.html =404;
    }
}
```

正式环境建议通过 HTTPS 提供服务，并将 80 端口重定向到 HTTPS。

CI 会在 Node.js 22 环境执行安装与构建。Supabase Edge Function 源码位于 `supabase/functions/`，已从 Next.js 浏览器端 TypeScript 检查范围中隔离。

更完整的生产迁移说明见 [`docs/production-deployment.md`](docs/production-deployment.md)。

## 文档

- [`docs/v2-design.md`](docs/v2-design.md)：V2 产品、问卷交互、算法、数据模型、V1 迁移与视觉设计基准
- [`docs/production-deployment.md`](docs/production-deployment.md)：`match.ecnumc.cn` 正式生产部署说明
- [`supabase/migrations/`](supabase/migrations/)：V2 数据库迁移
- [`supabase/functions/match-v2/`](supabase/functions/match-v2/)：服务端匹配引擎
