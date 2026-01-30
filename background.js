// background.js (Manifest V3 service worker)

const MENU_ID = "ask-chatgpt";
const TOOLS_PARENT = "chatgpt-tools";

const REWRITE_CLEARER_ID = "rewrite_clearer";

const SUMMARIZE_BULLETS_ID = "summarize_bullets";
const SUMMARIZE_TLDR_ID = "summarize_tldr";
const EXPLAIN_12_ID = "explain_12";
const EXPLAIN_EXPERT_ID = "explain_expert";
const EXPLAIN_LAWYER_ID = "explain_lawyer";

const REWRITE_SHORTER_ID = "rewrite_shorter";
const REWRITE_FORMAL_ID = "rewrite_formal";
const REWRITE_SARCASTIC_ID = "rewrite_sarcastic";

const TO_EMAIL_ID = "to_email";
const TO_TWEET_ID = "to_tweet";
const TO_NOTES_ID = "to_notes";
const TO_CODE_COMMENTS_ID = "to_code_comments";


function buildPrompt(actionId, text) {
  const t = (text || "").trim();

  switch (actionId) {
    case "rewrite_clearer":
      return `Rewrite the following to be clearer and more concise. Preserve the original meaning.\n\n${t}`;

    case "summarize_bullets":
      return `Summarize the following into bullet points. Include the key takeaways.\n\n${t}`;

    case "summarize_tldr":
      return `Give a 1-2 sentence TL;DR of the following.\n\n${t}`;

    case "explain_12":
      return `Explain the following like I'm 12 years old. Use simple words and a relatable example.\n\n${t}`;

    case "explain_expert":
      return `Explain the following at an expert level. Be precise and include important nuance.\n\n${t}`;

    case "explain_lawyer":
      return `Explain the following like a lawyer. Clarify definitions, implications, and any risks or ambiguities.\n\n${t}`;

    case "rewrite_shorter":
      return `Rewrite the following to be shorter while keeping all important meaning.\n\n${t}`;

    case "rewrite_formal":
      return `Rewrite the following in a more formal, professional tone.\n\n${t}`;

    case "rewrite_sarcastic":
      return `Rewrite the following with a sarcastic tone (keep it readable, not offensive).\n\n${t}`;

    case "to_email":
      return `Turn the following into a clear, professional email. Add a subject line and a polite closing.\n\n${t}`;

    case "to_tweet":
      return `Turn the following into a tweet. Keep it punchy. Include 1-2 relevant hashtags.\n\n${t}`;

    case "to_notes":
      return `Turn the following into structured notes with headings and bullet points.\n\n${t}`;

    case "to_code_comments":
      return `Convert the following into clear code comments (concise, developer-friendly). If it reads like requirements, format as TODOs.\n\n${t}`;

    default:
      return t;
  }
}


function setupContextMenu() {
  chrome.contextMenus.removeAll(() => {
    // Top-level fast action
    chrome.contextMenus.create({
      id: MENU_ID,
      title: 'Ask ChatGPT about: "%s"',
      contexts: ["selection"],
    });

    // Submenu parent
    chrome.contextMenus.create({
      id: TOOLS_PARENT,
      title: "ChatGPT Tools",
      contexts: ["selection"],
    });

    // Submenu item (example; currently same behavior as Ask)
    chrome.contextMenus.create({
      id: REWRITE_CLEARER_ID,
      parentId: TOOLS_PARENT,
      title: "Rewrite (clearer)",
      contexts: ["selection"],
    });
    // Summaries
chrome.contextMenus.create({
  id: SUMMARIZE_BULLETS_ID,
  parentId: TOOLS_PARENT,
  title: "Summarize (bullets)",
  contexts: ["selection"]
});
chrome.contextMenus.create({
  id: SUMMARIZE_TLDR_ID,
  parentId: TOOLS_PARENT,
  title: "Summarize (TL;DR)",
  contexts: ["selection"]
});

// Explain modes
chrome.contextMenus.create({
  id: EXPLAIN_12_ID,
  parentId: TOOLS_PARENT,
  title: "Explain like I'm 12",
  contexts: ["selection"]
});
chrome.contextMenus.create({
  id: EXPLAIN_EXPERT_ID,
  parentId: TOOLS_PARENT,
  title: "Explain like an expert",
  contexts: ["selection"]
});
chrome.contextMenus.create({
  id: EXPLAIN_LAWYER_ID,
  parentId: TOOLS_PARENT,
  title: "Explain like a lawyer",
  contexts: ["selection"]
});

// Rewrite styles
chrome.contextMenus.create({
  id: REWRITE_SHORTER_ID,
  parentId: TOOLS_PARENT,
  title: "Rewrite (shorter)",
  contexts: ["selection"]
});
chrome.contextMenus.create({
  id: REWRITE_FORMAL_ID,
  parentId: TOOLS_PARENT,
  title: "Rewrite (more formal)",
  contexts: ["selection"]
});
chrome.contextMenus.create({
  id: REWRITE_SARCASTIC_ID,
  parentId: TOOLS_PARENT,
  title: "Rewrite (sarcastic)",
  contexts: ["selection"]
});

// Transformations
chrome.contextMenus.create({
  id: TO_EMAIL_ID,
  parentId: TOOLS_PARENT,
  title: "Turn into email",
  contexts: ["selection"]
});
chrome.contextMenus.create({
  id: TO_TWEET_ID,
  parentId: TOOLS_PARENT,
  title: "Turn into tweet",
  contexts: ["selection"]
});
chrome.contextMenus.create({
  id: TO_NOTES_ID,
  parentId: TOOLS_PARENT,
  title: "Turn into notes",
  contexts: ["selection"]
});
chrome.contextMenus.create({
  id: TO_CODE_COMMENTS_ID,
  parentId: TOOLS_PARENT,
  title: "Turn into code comments",
  contexts: ["selection"]
});
  });
}

chrome.runtime.onInstalled.addListener(() => setupContextMenu());
chrome.runtime.onStartup.addListener(() => setupContextMenu());
setupContextMenu();

async function injectPaste(tabId, selectedText, nonce) {
  const payload = { text: selectedText, nonce };

  await chrome.scripting.executeScript({
    target: { tabId },
    func: (p) => {
      window.__H2C_PAYLOAD__ = p;
    },
    args: [payload],
  });

  await chrome.scripting.executeScript({
    target: { tabId },
    files: ["inject.js"],
  });
}

async function openChatGPTAndInject(selectedText) {
  const text = (selectedText || "").trim();
  if (!text) return;

  // One nonce per user action (reused for backup inject)
  const nonce =
    globalThis.crypto?.randomUUID?.() || String(Date.now()) + Math.random();

  const tab = await chrome.tabs.create({ url: "https://chatgpt.com/" });
  const tabId = tab.id;

  const listener = async (updatedTabId, changeInfo) => {
    if (updatedTabId !== tabId || changeInfo.status !== "complete") return;

    chrome.tabs.onUpdated.removeListener(listener);

    try {
      await injectPaste(tabId, text, nonce);

      // Backup inject (same nonce, so inject.js will ignore duplicates)
      setTimeout(() => {
        injectPaste(tabId, text, nonce).catch(() => {});
      }, 1500);
    } catch (e) {
      console.error("Paste inject failed:", e);
    }
  };

  chrome.tabs.onUpdated.addListener(listener);
}

chrome.contextMenus.onClicked.addListener(async (info) => {
  const selected = (info.selectionText || "").trim();
  if (!selected) return;

  // Free action
  if (info.menuItemId === MENU_ID) {
    await openChatGPTAndInject(selected);
    return;
  }

  // Tool actions (submenu)
  const toolIds = new Set([
    REWRITE_CLEARER_ID,
    SUMMARIZE_BULLETS_ID,
    SUMMARIZE_TLDR_ID,
    EXPLAIN_12_ID,
    EXPLAIN_EXPERT_ID,
    EXPLAIN_LAWYER_ID,
    REWRITE_SHORTER_ID,
    REWRITE_FORMAL_ID,
    REWRITE_SARCASTIC_ID,
    TO_EMAIL_ID,
    TO_TWEET_ID,
    TO_NOTES_ID,
    TO_CODE_COMMENTS_ID
  ]);

  if (!toolIds.has(info.menuItemId)) return;

  const prompt = buildPrompt(info.menuItemId, selected);
  await openChatGPTAndInject(prompt);
});



// Floating button sends this message
chrome.runtime.onMessage.addListener((msg) => {
  if (msg && msg.type === "H2C_ASK" && msg.text) {
    openChatGPTAndInject(String(msg.text));
  }
});

// Keyboard shortcut: highlight text, press Ctrl+Shift+G (Cmd+Shift+G on Mac)
chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "ask-chatgpt") return;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;

  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => window.getSelection?.().toString?.() || "",
  });

  const selected = (results?.[0]?.result || "").trim();
  if (!selected) return;

  await openChatGPTAndInject(selected);
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "ask-chatgpt") return;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;

  const url = tab.url || "";

  // Block pages Chrome doesn't allow extensions to access
  const blocked =
    url.startsWith("chrome://") ||
    url.startsWith("chrome-extension://") ||
    url.startsWith("edge://") ||
    url.startsWith("about:") ||
    url.startsWith("view-source:");

  if (blocked) {
    console.warn("Highlight→Ask ChatGPT: Cannot run on this page:", url);
    return;
  }

  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => window.getSelection?.().toString?.() || "",
  });

  const selected = (results?.[0]?.result || "").trim();
  if (!selected) return;

  await openChatGPTAndInject(selected);
});
