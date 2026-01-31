// background.js (Manifest V3 service worker)

const MENU_ID = "ask-chatgpt";
const TOOLS_PARENT = "chatgpt-tools";
const TEMPLATES_PARENT = "chatgpt-templates";
const TEMPLATE_ITEM_PREFIX = "tpl:";

// Built-in tool IDs
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

const PRO_KEY = "h2c_is_pro";

let refreshTimer = null;
let menuBuildInProgress = false;
let menuBuildPending = false;

function scheduleRefreshMenus() {
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => {
    refreshTimer = null;
    refreshMenus();
  }, 150);
}

function refreshMenus() {
  if (menuBuildInProgress) {
    menuBuildPending = true;
    return;
  }

  menuBuildInProgress = true;

  chrome.contextMenus.removeAll(() => {
    setupContextMenuBase(); // always rebuild the base menus
    addTemplateMenuItems(); // adds template items only if Pro

    menuBuildInProgress = false;

    if (menuBuildPending) {
      menuBuildPending = false;
      refreshMenus();
    }
  });
}

async function isProUser() {
  const data = await chrome.storage.local.get([PRO_KEY]);
  return data[PRO_KEY] === true;
}

async function setProUser(value) {
  await chrome.storage.local.set({ [PRO_KEY]: !!value });
}

// History
const HISTORY_KEY = "h2c_history";
const HISTORY_MAX_FREE = 200;
const HISTORY_MAX_PRO = 1000;

async function addToHistory(entry) {
  try {
    const data = await chrome.storage.local.get([HISTORY_KEY]);
    const items = Array.isArray(data[HISTORY_KEY]) ? data[HISTORY_KEY] : [];
    items.unshift(entry);
    const pro = await isProUser(); // you already added isProUser()
    const cap = pro ? HISTORY_MAX_PRO : HISTORY_MAX_FREE;
    if (items.length > cap) items.length = cap;
    await chrome.storage.local.set({ [HISTORY_KEY]: items });
  } catch (e) {
    console.error("History save failed:", e);
  }
}

async function getActiveTabInfo() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return { pageUrl: tab?.url || "", pageTitle: tab?.title || "" };
}

function labelForBuiltIn(id) {
  const map = {
    [REWRITE_CLEARER_ID]: "Rewrite (clearer)",
    [SUMMARIZE_BULLETS_ID]: "Summarize (bullets)",
    [SUMMARIZE_TLDR_ID]: "Summarize (TL;DR)",
    [EXPLAIN_12_ID]: "Explain like I'm 12",
    [EXPLAIN_EXPERT_ID]: "Explain like an expert",
    [EXPLAIN_LAWYER_ID]: "Explain like a lawyer",
    [REWRITE_SHORTER_ID]: "Rewrite (shorter)",
    [REWRITE_FORMAL_ID]: "Rewrite (more formal)",
    [REWRITE_SARCASTIC_ID]: "Rewrite (sarcastic)",
    [TO_EMAIL_ID]: "Turn into email",
    [TO_TWEET_ID]: "Turn into tweet",
    [TO_NOTES_ID]: "Turn into notes",
    [TO_CODE_COMMENTS_ID]: "Turn into code comments",
  };
  return map[id] || "Tool";
}

function setupContextMenuBase() {
  chrome.contextMenus.create({
    id: MENU_ID,
    title: 'Ask ChatGPT about: "%s"',
    contexts: ["selection"],
  });

  chrome.contextMenus.create({
    id: TOOLS_PARENT,
    title: "ChatGPT Tools",
    contexts: ["selection"],
  });

  chrome.contextMenus.create({
    id: TEMPLATES_PARENT,
    parentId: TOOLS_PARENT,
    title: "Templates",
    contexts: ["selection"],
  });

  // Built-in tools
  chrome.contextMenus.create({
    id: REWRITE_CLEARER_ID,
    parentId: TOOLS_PARENT,
    title: "Rewrite (clearer)",
    contexts: ["selection"],
  });

  chrome.contextMenus.create({
    id: SUMMARIZE_BULLETS_ID,
    parentId: TOOLS_PARENT,
    title: "Summarize (bullets)",
    contexts: ["selection"],
  });
  chrome.contextMenus.create({
    id: SUMMARIZE_TLDR_ID,
    parentId: TOOLS_PARENT,
    title: "Summarize (TL;DR)",
    contexts: ["selection"],
  });

  chrome.contextMenus.create({
    id: EXPLAIN_12_ID,
    parentId: TOOLS_PARENT,
    title: "Explain like I'm 12",
    contexts: ["selection"],
  });
  chrome.contextMenus.create({
    id: EXPLAIN_EXPERT_ID,
    parentId: TOOLS_PARENT,
    title: "Explain like an expert",
    contexts: ["selection"],
  });
  chrome.contextMenus.create({
    id: EXPLAIN_LAWYER_ID,
    parentId: TOOLS_PARENT,
    title: "Explain like a lawyer",
    contexts: ["selection"],
  });

  chrome.contextMenus.create({
    id: REWRITE_SHORTER_ID,
    parentId: TOOLS_PARENT,
    title: "Rewrite (shorter)",
    contexts: ["selection"],
  });
  chrome.contextMenus.create({
    id: REWRITE_FORMAL_ID,
    parentId: TOOLS_PARENT,
    title: "Rewrite (more formal)",
    contexts: ["selection"],
  });
  chrome.contextMenus.create({
    id: REWRITE_SARCASTIC_ID,
    parentId: TOOLS_PARENT,
    title: "Rewrite (sarcastic)",
    contexts: ["selection"],
  });

  chrome.contextMenus.create({
    id: TO_EMAIL_ID,
    parentId: TOOLS_PARENT,
    title: "Turn into email",
    contexts: ["selection"],
  });
  chrome.contextMenus.create({
    id: TO_TWEET_ID,
    parentId: TOOLS_PARENT,
    title: "Turn into tweet",
    contexts: ["selection"],
  });
  chrome.contextMenus.create({
    id: TO_NOTES_ID,
    parentId: TOOLS_PARENT,
    title: "Turn into notes",
    contexts: ["selection"],
  });
  chrome.contextMenus.create({
    id: TO_CODE_COMMENTS_ID,
    parentId: TOOLS_PARENT,
    title: "Turn into code comments",
    contexts: ["selection"],
  });
}

function addTemplateMenuItems() {
  // Only show template items if Pro
  chrome.storage.local.get(["h2c_is_pro"], (proData) => {
    const pro = proData.h2c_is_pro === true;
    if (!pro) return;

    chrome.storage.sync.get(["h2c_templates"], (data) => {
      const templates = Array.isArray(data.h2c_templates)
        ? data.h2c_templates
        : [];
      const seen = new Set();

      for (const tpl of templates) {
        if (!tpl?.id) continue;

        const id = TEMPLATE_ITEM_PREFIX + tpl.id;
        if (seen.has(id)) continue;
        seen.add(id);

        chrome.contextMenus.create(
          {
            id,
            parentId: TEMPLATES_PARENT,
            title: tpl.name || "Untitled template",
            contexts: ["selection"],
          },
          () => void chrome.runtime.lastError
        );
      }
    });
  });
}

function refreshMenus() {
  if (menuBuildInProgress) {
    menuBuildPending = true;
    return;
  }

  menuBuildInProgress = true;

  chrome.contextMenus.removeAll(() => {
    setupContextMenuBase();

    chrome.storage.sync.get(["h2c_templates"], (data) => {
      const templates = Array.isArray(data.h2c_templates)
        ? data.h2c_templates
        : [];
      const seen = new Set();

      for (const tpl of templates) {
        if (!tpl?.id) continue;

        const id = TEMPLATE_ITEM_PREFIX + tpl.id;
        if (seen.has(id)) continue;
        seen.add(id);

        chrome.contextMenus.create(
          {
            id,
            parentId: TEMPLATES_PARENT,
            title: tpl.name || "Untitled template",
            contexts: ["selection"],
          },
          () => {
            // swallow runtime.lastError to avoid noisy logs
            void chrome.runtime.lastError;
          }
        );
      }

      menuBuildInProgress = false;

      if (menuBuildPending) {
        menuBuildPending = false;
        refreshMenus();
      }
    });
  });
}

// Built-in prompts
function buildPrompt(actionId, text) {
  const t = (text || "").trim();

  switch (actionId) {
    case REWRITE_CLEARER_ID:
      return `Rewrite the following to be clearer and more concise. Preserve the original meaning.\n\n${t}`;
    case SUMMARIZE_BULLETS_ID:
      return `Summarize the following into bullet points. Include the key takeaways.\n\n${t}`;
    case SUMMARIZE_TLDR_ID:
      return `Give a 1-2 sentence TL;DR of the following.\n\n${t}`;
    case EXPLAIN_12_ID:
      return `Explain the following like I'm 12 years old. Use simple words and a relatable example.\n\n${t}`;
    case EXPLAIN_EXPERT_ID:
      return `Explain the following at an expert level. Be precise and include important nuance.\n\n${t}`;
    case EXPLAIN_LAWYER_ID:
      return `Explain the following like a lawyer. Clarify definitions, implications, and any risks or ambiguities.\n\n${t}`;
    case REWRITE_SHORTER_ID:
      return `Rewrite the following to be shorter while keeping all important meaning.\n\n${t}`;
    case REWRITE_FORMAL_ID:
      return `Rewrite the following in a more formal, professional tone.\n\n${t}`;
    case REWRITE_SARCASTIC_ID:
      return `Rewrite the following with a sarcastic tone (keep it readable, not offensive).\n\n${t}`;
    case TO_EMAIL_ID:
      return `Turn the following into a clear, professional email. Add a subject line and a polite closing.\n\n${t}`;
    case TO_TWEET_ID:
      return `Turn the following into a tweet. Keep it punchy. Include 1-2 relevant hashtags.\n\n${t}`;
    case TO_NOTES_ID:
      return `Turn the following into structured notes with headings and bullet points.\n\n${t}`;
    case TO_CODE_COMMENTS_ID:
      return `Convert the following into clear code comments (concise, developer-friendly). If it reads like requirements, format as TODOs.\n\n${t}`;
    default:
      return t;
  }
}

// Templates (used by floating button + template menu items)
async function buildCustomPrompt(action, selectedText) {
  const text = (selectedText || "").trim();
  if (!text) return "";

  if (!action || action.type === "ask") return text;

  if (action.type === "template") {
    const data = await chrome.storage.sync.get(["h2c_templates"]);
    const templates = Array.isArray(data.h2c_templates)
      ? data.h2c_templates
      : [];
    const tpl = templates.find((t) => t.id === action.id);
    if (!tpl) return text;

    const prompt = (tpl.prompt || "").trim();
    if (!prompt) return text;

    return prompt.includes("{{text}}")
      ? prompt.replaceAll("{{text}}", text)
      : `${prompt}\n\n${text}`;
  }

  return text;
}

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

  const nonce =
    globalThis.crypto?.randomUUID?.() || String(Date.now()) + Math.random();

  const tab = await chrome.tabs.create({ url: "https://chatgpt.com/" });
  const tabId = tab.id;

  const listener = async (updatedTabId, changeInfo) => {
    if (updatedTabId !== tabId || changeInfo.status !== "complete") return;
    chrome.tabs.onUpdated.removeListener(listener);

    try {
      await injectPaste(tabId, text, nonce);
      setTimeout(() => {
        injectPaste(tabId, text, nonce).catch(() => {});
      }, 1500);
    } catch (e) {
      console.error("Paste inject failed:", e);
    }
  };

  chrome.tabs.onUpdated.addListener(listener);
}

// Init menus + init Pro flag
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({ h2c_is_pro: false });
  scheduleRefreshMenus();
});

chrome.runtime.onStartup.addListener(() => {
  scheduleRefreshMenus();
});

scheduleRefreshMenus();

// Context menu click handler
chrome.contextMenus.onClicked.addListener(async (info) => {
  const selected = (info.selectionText || "").trim();
  if (!selected) return;

  const pageUrl = info.pageUrl || "";
  let pageTitle = "";
  try {
    if (info.tabId) {
      const tab = await chrome.tabs.get(info.tabId);
      pageTitle = tab?.title || "";
    }
  } catch {}

  if (
    typeof info.menuItemId === "string" &&
    info.menuItemId.startsWith(TEMPLATE_ITEM_PREFIX)
  ) {
    const selected = (info.selectionText || "").trim();
    if (!selected) return;

    const pro = await isProUser();
    if (!pro) {
      // Open Options page (we'll show the upgrade message there)
      chrome.tabs.create({
        url: chrome.runtime.getURL("options.html#upgrade"),
      });
      return;
    }

    const templateId = info.menuItemId.slice(TEMPLATE_ITEM_PREFIX.length);
    const action = { type: "template", id: templateId };
    const prompt = await buildCustomPrompt(action, selected);
    if (prompt) await openChatGPTAndInject(prompt);
    return;
  }

  // Top-level Ask
  if (info.menuItemId === MENU_ID) {
    await addToHistory({
      ts: Date.now(),
      actionLabel: "Ask",
      pageUrl,
      pageTitle,
      selectedText: selected,
      prompt: selected,
    });
    await openChatGPTAndInject(selected);
    return;
  }

  // Dynamic template items
  if (
    typeof info.menuItemId === "string" &&
    info.menuItemId.startsWith(TEMPLATE_ITEM_PREFIX)
  ) {
    const templateId = info.menuItemId.slice(TEMPLATE_ITEM_PREFIX.length);
    const action = { type: "template", id: templateId };

    const prompt = await buildCustomPrompt(action, selected);

    await addToHistory({
      ts: Date.now(),
      actionLabel: "Template",
      pageUrl,
      pageTitle,
      selectedText: selected,
      prompt,
    });

    if (prompt) await openChatGPTAndInject(prompt);
    return;
  }

  // Built-in tools
  const builtIns = new Set([
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
    TO_CODE_COMMENTS_ID,
  ]);

  if (builtIns.has(info.menuItemId)) {
    const prompt = buildPrompt(info.menuItemId, selected);
    await addToHistory({
      ts: Date.now(),
      actionLabel: labelForBuiltIn(info.menuItemId),
      pageUrl,
      pageTitle,
      selectedText: selected,
      prompt,
    });
    await openChatGPTAndInject(prompt);
  }
});

// Messages: floating button + template updates
chrome.runtime.onMessage.addListener((msg) => {
  if (!msg) return;

  if (msg.type === "H2C_TEMPLATES_UPDATED") {
    scheduleRefreshMenus();
    return;
  }

  if (msg.type === "H2C_RUN" && msg.text) {
    (async () => {
      // If the action is a template, require Pro
      if (msg.action?.type === "template") {
        const pro = await isProUser();
        if (!pro) {
          chrome.tabs.create({
            url: chrome.runtime.getURL("options.html#upgrade"),
          });
          return;
        }
      }
      const { pageUrl, pageTitle } = await getActiveTabInfo();
      const prompt = await buildCustomPrompt(msg.action, String(msg.text));

      await addToHistory({
        ts: Date.now(),
        actionLabel: "Floating/Run",
        pageUrl,
        pageTitle,
        selectedText: String(msg.text),
        prompt,
      });

      if (prompt) await openChatGPTAndInject(prompt);
    })().catch(console.error);
  }
});

// Keyboard shortcut
chrome.commands.onCommand.addListener((command) => {
  if (command !== "ask-chatgpt") return;

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs?.[0];
    if (!tab?.id) return;

    const url = tab.url || "";
    const blocked =
      url.startsWith("chrome://") ||
      url.startsWith("chrome-extension://") ||
      url.startsWith("edge://") ||
      url.startsWith("about:") ||
      url.startsWith("view-source:");
    if (blocked) return;

    // Ask content script for the selection (no host permission needed)
    chrome.tabs.sendMessage(
      tab.id,
      { type: "H2C_GET_SELECTION" },
      async (res) => {
        if (chrome.runtime.lastError) return;

        const selected = (res?.text || "").trim();
        if (!selected) return;

        await addToHistory({
          ts: Date.now(),
          actionLabel: "Shortcut Ask",
          pageUrl: tab.url || "",
          pageTitle: tab.title || "",
          selectedText: selected,
          prompt: selected,
        });

        await openChatGPTAndInject(selected);
      }
    );
  });
});
