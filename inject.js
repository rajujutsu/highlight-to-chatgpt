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
  try { delete window.__H2C_PAYLOAD__; } catch {}

  const isVisible = (el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };

  const findComposer = () => {
    const candidates = [
      document.querySelector("textarea"),
      document.querySelector('[role="textbox"][contenteditable="true"]'),
      document.querySelector('div[contenteditable="true"]')
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

    const ok = document.execCommand && document.execCommand("insertText", false, value);
    if (!ok) el.textContent = value;

    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  };

  const tryInsertOnce = () => {
    const composer = findComposer();
    if (!composer) return false;

    if ("value" in composer) setTextareaReactSafe(composer, text);
    else setContentEditable(composer, text);

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

  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
