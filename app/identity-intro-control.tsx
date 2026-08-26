"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { loadCommunityData, saveCommunityProfile } from "@/lib/community-store";

const MAX_INTRO_LENGTH = 120;

export default function IdentityIntroControl() {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [intro, setIntro] = useState("");

  useEffect(() => {
    let cancelled = false;

    loadCommunityData()
      .then((data) => {
        if (!cancelled && data.enabled) setIntro(data.ownIntro ?? "");
      })
      .catch((error) => console.error("Failed to load member intro", error));

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function placeHost() {
      const panel = document.querySelector<HTMLElement>(".identityPanel");
      const privacyChoice = panel?.querySelector<HTMLElement>(".privacyChoice");
      if (!panel || !privacyChoice) {
        setTarget(null);
        return;
      }

      let host = panel.querySelector<HTMLElement>(".identityIntroHost");
      if (!host) {
        host = document.createElement("div");
        host.className = "identityIntroHost";
        panel.insertBefore(host, privacyChoice);
      }
      setTarget(host);
    }

    placeHost();
    const observer = new MutationObserver(placeHost);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!target) return;
    const panel = target.closest<HTMLElement>(".identityPanel");
    const saveButton = panel?.querySelector<HTMLButtonElement>(".mainButton");
    if (!panel || !saveButton) return;

    const currentPanel = panel;

    function saveIntroWithIdentity() {
      const identityInputs = currentPanel.querySelectorAll<HTMLInputElement>(".identityGrid input");
      const name = identityInputs[0]?.value.trim() ?? "";
      const qq = identityInputs[1]?.value.trim() ?? "";
      const showQq = currentPanel.querySelector<HTMLInputElement>(".privacyChoice input[type='checkbox']")?.checked ?? false;

      if (!name || !/^\d{5,12}$/.test(qq)) return;

      window.setTimeout(async () => {
        try {
          const data = await loadCommunityData();
          if (!data.enabled) return;
          await saveCommunityProfile(name, data.ownProfile ?? {}, qq, showQq, intro);
        } catch (error) {
          console.error("Failed to save member intro", error);
        }
      }, 350);
    }

    saveButton.addEventListener("click", saveIntroWithIdentity);
    return () => saveButton.removeEventListener("click", saveIntroWithIdentity);
  }, [target, intro]);

  if (!target) return null;

  return createPortal(
    <label className="introField">
      <span className="introLabelRow">
        <span>简短自我介绍 <small>可选</small></span>
        <b>{intro.length}/{MAX_INTRO_LENGTH}</b>
      </span>
      <textarea
        className="introTextarea"
        value={intro}
        maxLength={MAX_INTRO_LENGTH}
        rows={3}
        onChange={(event) => setIntro(event.target.value)}
        placeholder="介绍一下你最近在玩的整合包、喜欢的玩法、最近想找什么样的搭子……"
      />
      <small className="introHint">这段介绍会展示在其他成员看到的匹配卡片中，建议用 1–3 句话简单介绍自己。</small>
    </label>,
    target
  );
}
