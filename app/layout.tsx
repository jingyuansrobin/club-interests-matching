import type { Metadata } from "next";
import "./globals.css";
import "./background.css";

export const metadata: Metadata = {
  title: "方块搭子 · 社团兴趣匹配",
  description: "回答一个问题，找到更适合一起玩 Minecraft 的社员。",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
