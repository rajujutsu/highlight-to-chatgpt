const KEY = "h2c_history";

function fmtTime(ts) {
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return String(ts);
  }
}

async function loadHistory() {
  const data = await chrome.storage.local.get([KEY]);
  return Array.isArray(data[KEY]) ? data[KEY] : [];
}

async function saveHistory(items) {
  await chrome.storage.local.set({ [KEY]: items });
}

function matches(entry, query) {
  if (!query) return true;
  const q = query.toLowerCase();

  const hay = [
    entry.actionLabel,
    entry.pageTitle,
    entry.pageUrl,
    entry.selectedText,
    entry.prompt
  ]
    .filter(Boolean)
    .join("\n")
    .toLowerCase();

  return hay.includes(q);
}

function render(items, query) {
  const list = document.getElementById("list");
  list.innerHTML = "";

  const filtered = items.filter((e) => matches(e, query));

  if (!filtered.length) {
    list.innerHTML = `<div class="muted">No history yet.</div>`;
    return;
  }

  for (const e of filtered) {
    const div = document.createElement("div");
    div.className = "card";

    const safeUrl = e.pageUrl || "";
    const host = (() => {
      try { return new URL(safeUrl).host; } catch { return ""; }
    })();

    div.innerHTML = `
      <div class="meta">
        <span>${fmtTime(e.ts)}</span>
        <span>${e.actionLabel || "Ask"}</span>
        ${host ? `<span>${host}</span>` : ""}
        ${safeUrl ? `<span><a href="${safeUrl}" target="_blank" rel="noreferrer">Open page</a></span>` : ""}
      </div>
      <div class="title">${e.pageTitle ? e.pageTitle.replace(/</g, "&lt;") : "(no title)"}</div>

      <div class="muted">Selected text</div>
      <div class="mono">${(e.selectedText || "").replace(/</g, "&lt;")}</div>

      <div class="muted" style="margin-top:10px;">Prompt sent to ChatGPT</div>
      <div class="mono">${(e.prompt || "").replace(/</g, "&lt;")}</div>
    `;

    list.appendChild(div);
  }
}

async function refresh() {
  const q = document.getElementById("q").value.trim();
  const items = await loadHistory();
  render(items, q);
}

document.getElementById("q").addEventListener("input", () => refresh());

document.getElementById("clear").addEventListener("click", async () => {
  if (!confirm("Clear all history?")) return;
  await saveHistory([]);
  await refresh();
});

refresh().catch(console.error);
