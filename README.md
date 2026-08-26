# Club Interests Matching

一个面向高校 Minecraft 社群的渐进式兴趣匹配 MVP：用户每回答一道题，系统都会即时更新最可能一起玩的社员，而不是要求一次完成长问卷。

## 已实现

- 回答第一道题后立即出现潜在同好
- 每回答一道题实时重算匹配度与了解度
- 根据当前候选人的分歧自动选择下一道最有价值的问题
- 展示共同点、排名与匹配变化，强化即时反馈
- Supabase 真实成员池（可选）
- Supabase Anonymous Auth：无需邮箱/密码即可获得独立身份
- RLS：成员只能修改自己的画像
- 未配置 Supabase 时自动回退到本地 mock 数据

## 技术路线

- Next.js + React + TypeScript
- `@supabase/supabase-js`
- 纯 TypeScript 可解释匹配引擎
- 无额外状态管理库、无 AI 依赖、无重量级 UI 框架

## 本地运行

```bash
npm install
npm run dev
```

打开 `http://localhost:3000`。

没有配置 Supabase 时，网站会自动运行在演示模式。

## 启用真实成员池

### 1. 创建 Supabase 项目

创建一个 Supabase 项目后，在 **Authentication** 设置中启用 **Anonymous Sign-Ins**。

### 2. 创建数据表和 RLS

打开 Supabase SQL Editor，运行：

`supabase/schema.sql`

该脚本会创建 `member_profiles` 表，并限制每个登录用户只能修改自己的画像。

### 3. 配置环境变量

复制：

```bash
cp .env.example .env.local
```

然后填写：

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
```

重启 `npm run dev`。顶部状态变为 **真实成员池** 即表示连接成功。

## 数据与隐私边界

当前 `member_profiles` 只适合存放社团昵称 / MC ID 和游戏偏好。第一版不要在该表存手机号、QQ、微信、邮箱等联系方式。连接功能会在后续单独设计权限和双方确认机制。

Anonymous Auth 的身份会保存在当前浏览器中；如果用户主动登出、清除浏览器数据或更换设备，第一版不会自动找回原来的匿名身份。

## 当前产品原则

1. **不是做性格测试**：目标是找到最适合一起玩 Minecraft 的人。
2. **渐进式画像**：未知信息保持 unknown，不把“未回答”误判成“不喜欢”。
3. **匹配度与了解度分离**：高匹配但低了解度只表示“目前很有潜力”。
4. **动态下一题**：优先询问能最大程度区分当前 Top 候选人的字段。
5. **先规则后 AI**：先用可解释规则跑真实数据，再根据反馈调权重或引入模型。

## 复用说明

前期调研参考了 Roomie Finder、Duolicious、FriendMatching-HackMesa 等公开项目的产品思路。由于部分仓库许可证不明确，本仓库当前实现不直接复制其代码，只复用通用产品/算法思想。
