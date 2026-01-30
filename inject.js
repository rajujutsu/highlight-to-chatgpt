// inject.js
// Runs inside https://chatgpt.com/ and pastes window.__H2C_SELECTED_TEXT__ into the composer.

(() => {
  const payload = window.__H2C_PAYLOAD__ || null;
  const text = (payload?.text || "").trim();
  const nonce = payload?.nonce || "";

  if (!text) return;

  // If we already processed this exact request in this tab, do nothing
  if (nonce && window.__H2C_LAST_NONCE__ === nonce) return;
  if (nonce) window.__H2C_LAST_NONCE__ = nonce;

  // Clear payload so re-runs don't reuse stale text
  try {
    delete window.__H2C_PAYLOAD__;
  } catch {}

  const isVisible = (el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };

  const findComposer = () => {
    const candidates = [
      document.querySelector("textarea"),
      document.querySelector('[role="textbox"][contenteditable="true"]'),
      document.querySelector('div[contenteditable="true"]'),
    ].filter(Boolean);

    return candidates.find(isVisible) || candidates[0] || null;
  };

  const setTextareaReactSafe = (el, value) => {
    el.focus();

    const proto = Object.getPrototypeOf(el);
    const desc = Object.getOwnPropertyDescriptor(proto, "value");
    if (desc?.set) desc.set.call(el, value);
    else el.value = value;

    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  };

  const setContentEditable = (el, value) => {
    el.focus();

    const ok =
      document.execCommand && document.execCommand("insertText", false, value);
    if (!ok) el.textContent = value;

    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  };

  function showToast(message) {
    try {
      const el = document.createElement("div");
      el.textContent = message;

      el.style.position = "fixed";
      el.style.left = "50%";
      el.style.bottom = "18px";
      el.style.transform = "translateX(-50%)";
      el.style.zIndex = "2147483647";

      el.style.padding = "10px 12px";
      el.style.borderRadius = "999px";
      el.style.background = "rgba(17, 24, 39, 0.92)";
      el.style.color = "#F9FAFB";
      el.style.border = "1px solid rgba(255,255,255,0.18)";
      el.style.boxShadow = "0 10px 30px rgba(0,0,0,0.28)";
      el.style.backdropFilter = "blur(6px)";
      el.style.webkitBackdropFilter = "blur(6px)";

      el.style.fontSize = "12px";
      el.style.fontWeight = "600";
      el.style.opacity = "0";
      el.style.transition = "opacity 140ms ease";

      document.documentElement.appendChild(el);
      requestAnimationFrame(() => (el.style.opacity = "1"));

      setTimeout(() => {
        el.style.opacity = "0";
        setTimeout(() => el.remove(), 200);
      }, 1200);
    } catch {}
  }

  const tryInsertOnce = () => {
    const composer = findComposer();
    // Guard: don't overwrite if user already has text in the composer
    const existing = (
      "value" in composer ? composer.value : composer.textContent || ""
    ).trim();
    if (existing) {
      showToast("ChatGPT composer already has text");
      return true;
    }

    if (!composer) return false;

    if ("value" in composer) setTextareaReactSafe(composer, text);
    else setContentEditable(composer, text);

    showToast("Inserted into ChatGPT");

    return true;
  };

  // 1) Try immediately
  if (tryInsertOnce()) return;

  // 2) Retry loop (covers late hydration)
  let tries = 0;
  const maxTries = 120; // ~24s at 200ms

  const retryTimer = setInterval(() => {
    tries++;
    if (tryInsertOnce() || tries >= maxTries) {
      clearInterval(retryTimer);
      if (observer) observer.disconnect();
    }
  }, 200);

  // 3) MutationObserver for SPA DOM swaps
  const observer = new MutationObserver(() => {
    if (tryInsertOnce()) {
      clearInterval(retryTimer);
      observer.disconnect();
    }
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
})();
