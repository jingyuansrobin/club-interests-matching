import type { Metadata } from "next";
import AccountControl from "./account-control";
import "./globals.css";
import "./background.css";
import "./mobile-ux.css";
import "./account-control.css";
import "./v2.css";
import "./v2-interest-ux.css";

export const metadata: Metadata = {
  title: "方块搭子 · 水杉方块社玩家匹配",
  description: "用玩法兴趣、上线时间和多人游戏习惯，找到真正能一起玩的 Minecraft 搭子。",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>
        {children}
        <AccountControl />
      </body>
    </html>
  );
}
