"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { loadCommunityData, saveCommunityProfile } from "@/lib/community-store";

export default function RestartMatchControl() {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [resetting, setResetting] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    function findTarget() {
      const nextTarget = document.querySelector<HTMLElement>(".completeCard > div");
      setTarget(nextTarget);
    }

    findTarget();
    const observer = new MutationObserver(findTarget);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, []);

  async function restartMatching() {
    try {
      setResetting(true);
      setMessage("");

      const data = await loadCommunityData();
      if (!data.enabled) {
        setMessage("演示模式下刷新页面即可重新开始。");
        setResetting(false);
        return;
      }

      if (!data.ownName || !data.ownQq) {
        throw new Error("没有找到当前身份资料，请先重新填写昵称和 QQ。");
      }

      await saveCommunityProfile(
        data.ownName,
        {},
        data.ownQq,
        data.ownShowQq ?? false
      );

      window.location.reload();
    } catch (error) {
      console.error(error);
      setMessage(error instanceof Error ? error.message : "重新开始失败，请稍后重试。");
      setResetting(false);
    }
  }

  if (!target) return null;

  return createPortal(
    <div className="restartMatchArea">
      <button className="restartMatchButton" onClick={restartMatching} disabled={resetting}>
        <span>↻</span>
        {resetting ? "正在重置画像…" : "重新寻找搭子"}
      </button>
      <small>保留昵称、QQ 和隐私设置，只重新回答游戏偏好。</small>
      {message && <div className="restartMatchMessage">{message}</div>}
    </div>,
    target
  );
}
