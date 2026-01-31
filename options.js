// options.js (final cleaned version)

const STORAGE_KEYS = {
  templates: "h2c_templates",
  floatingAction: "h2c_floating_action", // { type: "ask" } OR { type: "template", id: "..." }
};

const PRO_KEY = "h2c_is_pro";
const LAST_KEY = "h2c_last_license_key";

const PRO_PRICE = "$2.99";

const VERIFY_URL =
  "https://uxhblqxzmiobvbntnpsh.functions.supabase.co/verify-license";

// Your Gumroad product URL
const CHECKOUT_URL = "https://rajujutsu.gumroad.com/l/wjptpf";

// Dev gate
const DEV_UNLOCK_KEY = "h2c_dev_unlocked";
const DEV_PASSPHRASE = "2AMinTokyo";

// ---------- small helpers ----------
function proLockedMsg(featureName) {
  setMsg(`${featureName} is a Pro feature. Unlock Pro for $2.99 (one-time).`);
}

function uid() {
  return globalThis.crypto?.randomUUID?.() || String(Date.now()) + Math.random();
}

function setMsg(text) {
  const el = document.getElementById("proMsg");
  if (el) el.textContent = text || "";
}

async function isPro() {
  const data = await chrome.storage.local.get([PRO_KEY]);
  return data[PRO_KEY] === true;
}

async function setProStatus(value) {
  await chrome.storage.local.set({ [PRO_KEY]: !!value });
}

function setStatusUI(pro) {
  const status = document.getElementById("proStatusText");
  if (status) status.textContent = pro ? "Status: PRO (active)" : "Status: FREE";
}

// ---------- dev gate (hidden toggle) ----------
function isDevUrl() {
  return new URLSearchParams(location.search).get("dev") === "1";
}

async function isDevUnlocked() {
  const data = await chrome.storage.local.get([DEV_UNLOCK_KEY]);
  return data[DEV_UNLOCK_KEY] === true;
}

async function setDevUnlocked(value) {
  await chrome.storage.local.set({ [DEV_UNLOCK_KEY]: !!value });
}

async function setupDevGate() {
  const devGate = document.getElementById("devGate");
  const devTools = document.getElementById("devTools");
  const msg = document.getElementById("devGateMsg");
  const passInput = document.getElementById("devPass");
  const btn = document.getElementById("devUnlockBtn");

  // Always start hidden
  if (devGate) devGate.style.display = "none";
  if (devTools) devTools.style.display = "none";

  // Not dev URL? hide everything
  if (!isDevUrl()) return;

  // Already unlocked? show tools
  if (await isDevUnlocked()) {
    if (devTools) devTools.style.display = "block";
    return;
  }

  // Show gate
  if (devGate) devGate.style.display = "block";

  btn?.addEventListener("click", async () => {
    const entered = String(passInput?.value || "").trim();
    if (!entered) {
      if (msg) msg.textContent = "Enter passphrase.";
      return;
    }

    if (entered === DEV_PASSPHRASE) {
      await setDevUnlocked(true);
      if (msg) msg.textContent = "";
      if (devGate) devGate.style.display = "none";
      if (devTools) devTools.style.display = "block";
      return;
    }

    if (msg) msg.textContent = "Nope.";
  });
}

// ---------- templates + floating action ----------
async function loadState() {
  const data = await chrome.storage.sync.get([
    STORAGE_KEYS.templates,
    STORAGE_KEYS.floatingAction,
  ]);
  const templates = Array.isArray(data[STORAGE_KEYS.templates])
    ? data[STORAGE_KEYS.templates]
    : [];
  const floatingAction = data[STORAGE_KEYS.floatingAction] || { type: "ask" };
  return { templates, floatingAction };
}

async function saveTemplates(templates) {
  await chrome.storage.sync.set({ [STORAGE_KEYS.templates]: templates });
}

async function saveFloatingAction(action) {
  await chrome.storage.sync.set({ [STORAGE_KEYS.floatingAction]: action });
}

// If Pro is OFF, force floating action back to Ask (prevents “stuck on template”)
async function ensureFloatingActionAllowed() {
  const pro = await isPro();
  if (pro) return;

  const data = await chrome.storage.sync.get([STORAGE_KEYS.floatingAction]);
  const action = data[STORAGE_KEYS.floatingAction];
  if (action?.type === "template") {
    await chrome.storage.sync.set({ [STORAGE_KEYS.floatingAction]: { type: "ask" } });
  }
}

function renderTemplates(templates, pro) {
  const list = document.getElementById("templateList");
  if (!list) return;

  list.innerHTML = "";

  if (!pro) {
    list.innerHTML =
      `<div class="muted">Templates are a Pro feature. Unlock Pro for ${PRO_PRICE} (one-time).</div>`;
    return;
  }

  if (!templates.length) {
    list.innerHTML = `<div class="muted" style="padding:10px 0;">No templates yet.</div>`;
    return;
  }

  for (const tpl of templates) {
    const row = document.createElement("div");
    row.className = "item";
    row.innerHTML = `
      <div>
        <div><strong>${String(tpl.name || "Untitled").replace(/</g, "&lt;")}</strong></div>
        <div class="muted">${String(tpl.prompt || "").replace(/</g, "&lt;").slice(0, 160)}${
          (tpl.prompt || "").length > 160 ? "…" : ""
        }</div>
      </div>
      <div>
        <button class="btn" data-del="${tpl.id}">Delete</button>
      </div>
    `;
    list.appendChild(row);
  }

  list.querySelectorAll("[data-del]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-del");
      const { templates: current } = await loadState();
      const next = current.filter((t) => t.id !== id);
      await saveTemplates(next);
      chrome.runtime.sendMessage({ type: "H2C_TEMPLATES_UPDATED" });
      await refreshUI();
    });
  });
}

function updateDevToggleButton(isProValue) {
  const btn = document.getElementById("togglePro");
  if (!btn) return;

  btn.classList.toggle("pro-on", isProValue);
  btn.classList.toggle("pro-off", !isProValue);

  updateDevToggleButton(next);

  btn.textContent = isProValue
    ? "Dev: Pro ON (click to turn off)"
    : "Dev: Pro OFF (click to turn on)";
}

function renderFloatingDropdown(templates, floatingAction, pro) {
  const select = document.getElementById("floatingAction");
  if (!select) return;

  select.innerHTML = "";

  const optAsk = document.createElement("option");
  optAsk.value = "ask";
  optAsk.textContent = "Ask (default)";
  select.appendChild(optAsk);

  if (pro && templates.length) {
    const divider = document.createElement("option");
    divider.disabled = true;
    divider.textContent = "──────────";
    select.appendChild(divider);

    for (const tpl of templates) {
      const opt = document.createElement("option");
      opt.value = `template:${tpl.id}`;
      opt.textContent = `Template: ${tpl.name}`;
      select.appendChild(opt);
    }
  }

  if (pro && floatingAction?.type === "template") {
    select.value = `template:${floatingAction.id}`;
  } else {
    select.value = "ask";
  }
}

async function refreshUI() {
  await ensureFloatingActionAllowed();
  const { templates, floatingAction } = await loadState();
  const pro = await isPro();

  renderTemplates(templates, pro);
  renderFloatingDropdown(templates, floatingAction, pro);

  const addBtn = document.getElementById("addTemplate");
  if (addBtn) {
    addBtn.disabled = !pro;
    addBtn.style.opacity = pro ? "1" : "0.5";
    addBtn.style.cursor = pro ? "pointer" : "not-allowed";
  }
}

// ---------- Pro activation ----------
async function verifyAndActivateKey(key) {
  const clean = String(key || "").trim();
  if (!clean) {
    setMsg("Paste a license key first.");
    return;
  }

  setMsg("Verifying…");

  let res;
  try {
    res = await fetch(VERIFY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ license_key: clean }),
    });
  } catch (e) {
    console.error(e);
    setMsg("Network error while verifying. Try again.");
    return;
  }

  if (res.status === 429) {
    setMsg("Too many attempts. Please wait a minute and try again.");
    return;
  }

  if (!res.ok) {
    const raw = await res.text().catch(() => "");
    console.log("verify failed:", res.status, raw);
    setMsg(`Could not verify (status ${res.status}).`);
    return;
  }

  const data = await res.json().catch(() => ({}));

  if (data?.valid === true) {
    await setProStatus(true);
    await chrome.storage.local.set({ [LAST_KEY]: clean });

    setStatusUI(true);
    await refreshUI();

    // Rebuild menus immediately
    chrome.runtime.sendMessage({ type: "H2C_PRO_CHANGED" });
    chrome.runtime.sendMessage({ type: "H2C_TEMPLATES_UPDATED" });

    setMsg(
      `Success! Pro unlocked. If Templates don’t show right away, right-click again or refresh the page.`
    );
    return;
  }

  setMsg("Invalid license key.");
}

// Restore: uses typed key if present, otherwise uses saved key
async function restorePurchase() {
  const input = document.getElementById("licenseKey");
  const typed = String(input?.value || "").trim();

  if (typed) {
    await verifyAndActivateKey(typed);
    return;
  }

  const data = await chrome.storage.local.get([LAST_KEY]);
  const saved = String(data[LAST_KEY] || "").trim();

  if (!saved) {
    setMsg("Paste your license key first, then click Restore.");
    return;
  }

  if (input) input.value = saved;
  await verifyAndActivateKey(saved);
}

// ---------- wire UI ----------
document.addEventListener("DOMContentLoaded", async () => {
  await setupDevGate();

  // Pro card buttons
  document.getElementById("unlockProBtn")?.addEventListener("click", () => {
    chrome.tabs.create({ url: CHECKOUT_URL });
  });

  document.getElementById("activateBtn")?.addEventListener("click", async () => {
    const key = document.getElementById("licenseKey")?.value || "";
    await verifyAndActivateKey(key);
  });

  document.getElementById("restoreBtn")?.addEventListener("click", async () => {
    await restorePurchase();
  });

  // Template add (Pro-only)
  document.getElementById("addTemplate")?.addEventListener("click", async () => {
    const pro = await isPro();
    if (!pro) {
      setMsg(`Templates are a Pro feature. Unlock Pro for ${PRO_PRICE} (one-time).`);
      return;
    }

    const name = String(document.getElementById("tplName")?.value || "").trim();
    const prompt = String(document.getElementById("tplPrompt")?.value || "").trim();
    if (!name || !prompt) return;

    const { templates } = await loadState();
    templates.push({ id: uid(), name, prompt });

    await saveTemplates(templates);
    chrome.runtime.sendMessage({ type: "H2C_TEMPLATES_UPDATED" });

    const nameEl = document.getElementById("tplName");
    const promptEl = document.getElementById("tplPrompt");
    if (nameEl) nameEl.value = "";
    if (promptEl) promptEl.value = "";

    await refreshUI();
  });

  // Save floating action
  document.getElementById("saveFloating")?.addEventListener("click", async () => {
    const value = document.getElementById("floatingAction")?.value || "ask";

    if (value === "ask") {
      await saveFloatingAction({ type: "ask" });
    } else if (value.startsWith("template:")) {
      const id = value.split(":")[1];
      await saveFloatingAction({ type: "template", id });
    }

    await refreshUI();
  });

  // History button
  document.getElementById("openHistory")?.addEventListener("click", () => {
    chrome.tabs.create({ url: chrome.runtime.getURL("history.html") });
  });

  // Dev toggle button (only visible when unlocked via gate)
  document.getElementById("togglePro")?.addEventListener("click", async () => {
    const data = await chrome.storage.local.get([PRO_KEY]);
    const next = !(data[PRO_KEY] === true);
    await chrome.storage.local.set({ [PRO_KEY]: next });

    // saved key stays; we’re only toggling for dev
    setStatusUI(next);
    await refreshUI();
    chrome.runtime.sendMessage({ type: "H2C_PRO_CHANGED" });
  });

  // Initial render
  const pro = await isPro();
  setStatusUI(pro);
  updateDevToggleButton(pro);
  setMsg("");
  await refreshUI();
});

// React instantly when Pro changes elsewhere
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.h2c_is_pro) {
    setStatusUI(changes.h2c_is_pro.newValue === true);
    refreshUI().catch(console.error);
  }
  updateDevToggleButton(changes.h2c_is_pro.newValue === true);
});
