function findComposer() {
  return (
    document.querySelector("textarea") ||
    document.querySelector('[role="textbox"][contenteditable="true"]') ||
    document.querySelector('div[contenteditable="true"]')
  );
}

function setComposerText(el, text) {
  el.focus();

  if ("value" in el) {
    el.value = text;
  } else {
    el.textContent = text;
  }

  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

async function getFreshSelection() {
  const { lastSelection, lastSelectionTs, lastSelectionNonce } =
    await chrome.storage.local.get(["lastSelection", "lastSelectionTs", "lastSelectionNonce"]);

  if (!lastSelection) return null;

  // Only insert if it's recent (5 minutes)
  const age = Date.now() - (lastSelectionTs || 0);
  if (age > 5 * 60 * 1000) return null;

  return { lastSelection, lastSelectionNonce };
}

async function insertLatest() {
  const payload = await getFreshSelection();
  if (!payload) return;

  const { lastSelection } = payload;

  let tries = 0;
  const maxTries = 80;

  const timer = setInterval(async () => {
    tries++;

    const composer = findComposer();
    if (composer) {
      setComposerText(composer, lastSelection);

      // Do NOT remove storage here — removing is what makes “only once” bugs common.
      // Leaving it lets you re-trigger insertion if needed.
      clearInterval(timer);
    }

    if (tries >= maxTries) clearInterval(timer);
  }, 200);
}

// Insert on initial load
insertLatest();

// Also respond to background “poke”
chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === "PULL_AND_INSERT") insertLatest();
});

// ChatGPT is a SPA; URL changes without reload
let lastHref = location.href;
new MutationObserver(() => {
  if (location.href !== lastHref) {
    lastHref = location.href;
    insertLatest();
  }
}).observe(document, { childList: true, subtree: true });

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === "PING") return; // just proves we're injected
});
