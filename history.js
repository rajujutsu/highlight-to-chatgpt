const KEY = "h2c_history";
const PRO_PRICE = "$2.99";

async function isPro() {
  const data = await chrome.storage.local.get(["h2c_is_pro"]);
  return data.h2c_is_pro === true;
}

function fmtTime(ts) {
  try { return new Date(ts).toLocaleString(); } catch { return String(ts); }
}

function safeDateStamp() {
  const d = new Date();
  const yyyy = String(d.getFullYear());
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function downloadText(filename, text, mime) {
  const blob = new Blob([text], { type: mime || "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
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
  ].filter(Boolean).join("\n").toLowerCase();
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
    const host = (() => { try { return new URL(safeUrl).host; } catch { return ""; } })();

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

// CSV helpers
function csvEscape(value) {
  const s = String(value ?? "");
  const escaped = s.replace(/"/g, '""');
  if (/[",\n\r]/.test(escaped)) return `"${escaped}"`;
  return escaped;
}
function toCsv(items) {
  const headers = ["ts","actionLabel","pageTitle","pageUrl","selectedText","prompt"];
  const lines = [headers.join(",")];
  for (const e of items) {
    const row = [
      e.ts ?? "",
      e.actionLabel ?? "",
      e.pageTitle ?? "",
      e.pageUrl ?? "",
      e.selectedText ?? "",
      e.prompt ?? ""
    ].map(csvEscape);
    lines.push(row.join(","));
  }
  return lines.join("\n");
}

// Markdown helpers
function mdEscape(text) {
  return String(text ?? "").replace(/\\/g, "\\\\").replace(/`/g, "\\`");
}
function toMarkdown(items) {
  const lines = [];
  lines.push("# Highlight → Ask ChatGPT — History");
  lines.push(`_Exported: ${new Date().toLocaleString()}_`);
  lines.push("");

  for (const e of items) {
    const ts = e.ts ? new Date(e.ts).toLocaleString() : "";
    const action = e.actionLabel || "Ask";
    const title = e.pageTitle || "(no title)";
    const url = e.pageUrl || "";

    lines.push(`## ${mdEscape(action)} — ${mdEscape(title)}`);
    if (ts) lines.push(`- **Time:** ${mdEscape(ts)}`);
    if (url) lines.push(`- **Page:** ${url}`);
    lines.push("");
    lines.push("**Selected text:**");
    lines.push("```");
    lines.push(String(e.selectedText ?? ""));
    lines.push("```");
    lines.push("");
    lines.push("**Prompt sent to ChatGPT:**");
    lines.push("```");
    lines.push(String(e.prompt ?? ""));
    lines.push("```");
    lines.push("");
  }

  return lines.join("\n");
}

// UI lock helpers (IMPORTANT: we do NOT disable buttons, so the popup can show)
function setLocked(el, locked) {
  if (!el) return;
  el.classList.toggle("locked", locked);
}

async function refresh() {
  const pro = await isPro();

  const input = document.getElementById("q");
  if (input) {
    input.disabled = !pro;
    input.placeholder = pro
      ? "Search highlights, prompts, actions, or site…"
      : `Search is Pro (${PRO_PRICE} one-time)`;
  }

  // lock export buttons visually (but still clickable so we can show popup)
  setLocked(document.getElementById("exportJson"), !pro);
  setLocked(document.getElementById("exportCsv"), !pro);
  setLocked(document.getElementById("exportMd"), !pro);

  const query = pro ? (input.value || "").trim() : "";
  const items = await loadHistory();
  render(items, query);
}

// Events
document.getElementById("q").addEventListener("input", () => refresh());

document.getElementById("clear").addEventListener("click", async () => {
  if (!confirm("Clear all history?")) return;
  await saveHistory([]);
  await refresh();
});

document.getElementById("exportJson").addEventListener("click", async () => {
  const pro = await isPro();
  if (!pro) {
    alert(`Export is a Pro feature. Unlock Pro for ${PRO_PRICE} (one-time).`);
    return;
  }
  const items = await loadHistory();
  downloadText(`h2c-history-${safeDateStamp()}.json`, JSON.stringify(items, null, 2), "application/json");
});

document.getElementById("exportCsv").addEventListener("click", async () => {
  const pro = await isPro();
  if (!pro) {
    alert(`Export is a Pro feature. Unlock Pro for ${PRO_PRICE} (one-time).`);
    return;
  }
  const items = await loadHistory();
  downloadText(`h2c-history-${safeDateStamp()}.csv`, toCsv(items), "text/csv");
});

document.getElementById("exportMd").addEventListener("click", async () => {
  const pro = await isPro();
  if (!pro) {
    alert(`Export is a Pro feature. Unlock Pro for ${PRO_PRICE} (one-time).`);
    return;
  }
  const items = await loadHistory();
  downloadText(`h2c-history-${safeDateStamp()}.md`, toMarkdown(items), "text/markdown");
});

// Update History instantly when Pro toggles
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.h2c_is_pro) {
    refresh().catch(console.error);
  }
});

refresh().catch(console.error);
