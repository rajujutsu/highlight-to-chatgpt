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

    // Better styling
    btn.style.position = "fixed";
    btn.style.left = `${x}px`;
    btn.style.top = `${y}px`;
    btn.style.zIndex = "2147483647";

    btn.style.display = "inline-flex";
    btn.style.alignItems = "center";
    btn.style.justifyContent = "center";
    btn.style.gap = "6px";

    btn.style.height = "32px";
    btn.style.minWidth = "56px";
    btn.style.padding = "0 12px";
    btn.style.borderRadius = "999px";
    btn.style.opacity = "0";
    btn.style.transition = "opacity 120ms ease, transform 120ms ease";

    requestAnimationFrame(() => {
      btn.style.opacity = "1";
    });

    // Always readable on dark/black screens
    btn.style.background = "rgba(0,0,0,0.9)";
    btn.style.color = "#fff";
    btn.style.border = "1px solid rgba(255,255,255,0.25)";

    btn.style.cursor = "pointer";
    btn.style.userSelect = "none";
    btn.style.fontSize = "12px";
    btn.style.fontWeight = "600";
    btn.style.lineHeight = "1";
    btn.style.letterSpacing = "0.2px";
    btn.style.boxShadow = "0 6px 20px rgba(0,0,0,0.25)";

    btn.addEventListener("mouseenter", () => {
      btn.style.transform = "translateY(-1px)";
    });
    btn.addEventListener("mouseleave", () => {
      btn.style.transform = "translateY(0)";
    });

    btn.addEventListener("click", () => {
      if (!lastText) return;
      chrome.runtime.sendMessage({ type: "H2C_ASK", text: lastText });
      removeBtn();
    });

    document.documentElement.appendChild(btn);
  }

  function onSelectionChange() {
    const text = (window.getSelection?.().toString?.() || "").trim();

    if (!text) {
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

  document.addEventListener("mouseup", () => setTimeout(onSelectionChange, 0));
  document.addEventListener("keyup", () => setTimeout(onSelectionChange, 0));
  document.addEventListener("scroll", () => removeBtn(), true);

  document.addEventListener("mousedown", (e) => {
    if (btn && e.target === btn) return;
    removeBtn();
  });
})();
