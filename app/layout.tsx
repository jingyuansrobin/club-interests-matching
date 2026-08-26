import type { Metadata } from "next";
import RestartMatchControl from "./restart-match-control";
import "./globals.css";
import "./background.css";
import "./mobile-ux.css";
import "./restart-match.css";

export const metadata: Metadata = {
  title: "方块搭子 · 社团兴趣匹配",
  description: "回答一个问题，找到更适合一起玩 Minecraft 的社员。",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>
        {children}
        <RestartMatchControl />
      </body>
    </html>
  );
}
