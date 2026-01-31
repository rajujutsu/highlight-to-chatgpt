// content.js
(() => {
  let btn = null;
  let lastText = "";

  function removeBtn() {
    if (btn) btn.remove();
    btn = null;
  }

  function createBtn(x, y) {
    removeBtn();

    btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = "Ask";

    // Layout + position
    btn.style.position = "fixed";
    btn.style.left = `${x}px`;
    btn.style.top = `${y}px`;
    btn.style.zIndex = "2147483647";

    btn.style.display = "inline-flex";
    btn.style.alignItems = "center";
    btn.style.justifyContent = "center";
    btn.style.gap = "6px";

    // Size + shape
    btn.style.height = "32px";
    btn.style.minWidth = "56px";
    btn.style.padding = "0 12px";
    btn.style.borderRadius = "999px";

    // Fade-in
    btn.style.opacity = "0";
    btn.style.transition = "opacity 120ms ease, transform 120ms ease";
    requestAnimationFrame(() => {
      if (btn) btn.style.opacity = "1";
    });

    // Always readable
    btn.style.background = "rgba(0,0,0,0.9)";
    btn.style.color = "#fff";
    btn.style.border = "1px solid rgba(255,255,255,0.25)";
    btn.style.boxShadow = "0 6px 20px rgba(0,0,0,0.25)";

    // Text
    btn.style.cursor = "pointer";
    btn.style.userSelect = "none";
    btn.style.fontSize = "12px";
    btn.style.fontWeight = "600";
    btn.style.lineHeight = "1";
    btn.style.letterSpacing = "0.2px";

    btn.addEventListener("mouseenter", () => {
      if (btn) btn.style.transform = "translateY(-1px)";
    });
    btn.addEventListener("mouseleave", () => {
      if (btn) btn.style.transform = "translateY(0)";
    });

    btn.addEventListener("click", async () => {
      const t = (lastText || "").trim();
      if (!t) return;

      let action = { type: "ask" };

      try {
        const [syncData, localData] = await Promise.all([
          chrome.storage.sync.get(["h2c_floating_action"]),
          chrome.storage.local.get(["h2c_is_pro"])
        ]);

        const isPro = localData.h2c_is_pro === true;
        const saved = syncData.h2c_floating_action;

        if (saved && typeof saved === "object") {
          // If user is NOT Pro, never allow template action from floating button
          if (!isPro && saved.type === "template") {
            action = { type: "ask" };
          } else {
            action = saved;
          }
        }
      } catch (e) {
        action = { type: "ask" };
      }

      try {
        chrome.runtime.sendMessage({ type: "H2C_RUN", action, text: t });
      } catch (e) {
        // do nothing
      }

      removeBtn();
    });

    // IMPORTANT: append button to page (outside click handler)
    document.documentElement.appendChild(btn);
  }

  function onSelectionChange() {
    const text = (window.getSelection?.().toString?.() || "").trim();

    if (!text) {
      lastText = "";
      removeBtn();
      return;
    }

    // Guard: ignore tiny selections
    if (text.length < 10) {
      lastText = "";
      removeBtn();
      return;
    }

    if (text === lastText) return;
    lastText = text;

    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;

    const rect = sel.getRangeAt(0).getBoundingClientRect();
    const x = Math.min(window.innerWidth - 60, rect.right + 8);
    const y = Math.max(8, rect.top - 36);

    createBtn(x, y);
  }

  // Used by keyboard shortcut: background asks content script for selection
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type === "H2C_GET_SELECTION") {
      const text = (window.getSelection?.().toString?.() || "").trim();
      sendResponse({ text });
      return true;
    }
  });

  document.addEventListener("mouseup", () => setTimeout(onSelectionChange, 0));
  document.addEventListener("keyup", () => setTimeout(onSelectionChange, 0));
  document.addEventListener("scroll", () => removeBtn(), true);

  document.addEventListener("mousedown", (e) => {
    if (btn && e.target === btn) return;
    removeBtn();
  });
})();
