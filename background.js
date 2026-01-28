// background.js (Manifest V3 service worker)

const MENU_ID = "ask-chatgpt";

function setupContextMenu() {
  // MV3 service worker can unload/reload; recreate menu reliably
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_ID,
      title: 'Ask ChatGPT about: "%s"',
      contexts: ["selection"]
    });
  });
}

// Create menu on install/update
chrome.runtime.onInstalled.addListener(() => {
  setupContextMenu();
});

// Create menu when Chrome starts
chrome.runtime.onStartup.addListener(() => {
  setupContextMenu();
});

// Also run immediately when service worker loads (covers reloads)
setupContextMenu();

async function injectPaste(tabId, selectedText) {
  // Put the selected text on the page as a global var
  await chrome.scripting.executeScript({
    target: { tabId },
    func: (t) => {
      window.__H2C_SELECTED_TEXT__ = t;
    },
    args: [selectedText]
  });

  // Then run inject.js inside that page (it waits for the composer)
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ["inject.js"]
  });
}

chrome.contextMenus.onClicked.addListener(async (info) => {
  if (info.menuItemId !== MENU_ID) return;

  const selected = (info.selectionText || "").trim();
  if (!selected) return;

  // ✅ ALWAYS open a NEW tab
  const tab = await chrome.tabs.create({ url: "https://chatgpt.com/" });
  const tabId = tab.id;

  // Wait for it to finish loading before injecting
  const listener = async (updatedTabId, changeInfo) => {
    if (updatedTabId !== tabId || changeInfo.status !== "complete") return;

    chrome.tabs.onUpdated.removeListener(listener);

    try {
      // First inject when tab reports complete
      await injectPaste(tabId, selected);

      // Backup inject shortly after (covers late SPA hydration)
      setTimeout(() => {
        injectPaste(tabId, selected).catch(() => {});
      }, 1500);
    } catch (e) {
      console.error("Paste inject failed:", e);
    }
  };

  chrome.tabs.onUpdated.addListener(listener);
});
