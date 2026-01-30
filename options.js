const STORAGE_KEYS = {
  templates: "h2c_templates",
  floatingAction: "h2c_floating_action" // { type: "ask" } OR { type: "template", id: "..." }
};

function uid() {
  return (globalThis.crypto?.randomUUID?.() || String(Date.now()) + Math.random());
}

async function loadState() {
  const data = await chrome.storage.sync.get([STORAGE_KEYS.templates, STORAGE_KEYS.floatingAction]);
  const templates = data[STORAGE_KEYS.templates] || [];
  const floatingAction = data[STORAGE_KEYS.floatingAction] || { type: "ask" };
  return { templates, floatingAction };
}

async function saveTemplates(templates) {
  await chrome.storage.sync.set({ [STORAGE_KEYS.templates]: templates });
}

async function saveFloatingAction(action) {
  await chrome.storage.sync.set({ [STORAGE_KEYS.floatingAction]: action });
}

function renderTemplates(templates) {
  const list = document.getElementById("templateList");
  list.innerHTML = "";

  if (!templates.length) {
    list.innerHTML = `<div class="muted" style="padding:10px 0;">No templates yet.</div>`;
    return;
  }

  for (const tpl of templates) {
    const row = document.createElement("div");
    row.className = "item";
    row.innerHTML = `
      <div>
        <div><strong>${tpl.name}</strong></div>
        <div class="muted">${tpl.prompt.replace(/</g, "&lt;").slice(0, 160)}${tpl.prompt.length > 160 ? "…" : ""}</div>
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
      await refreshUI();
    });
  });
}

function renderFloatingDropdown(templates, floatingAction) {
  const select = document.getElementById("floatingAction");
  select.innerHTML = "";

  const optAsk = document.createElement("option");
  optAsk.value = "ask";
  optAsk.textContent = "Ask (default)";
  select.appendChild(optAsk);

  if (templates.length) {
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

  if (floatingAction.type === "template") {
    select.value = `template:${floatingAction.id}`;
  } else {
    select.value = "ask";
  }
}

async function refreshUI() {
  const { templates, floatingAction } = await loadState();
  renderTemplates(templates);
  renderFloatingDropdown(templates, floatingAction);
}

document.getElementById("copyShortcutsUrl")?.addEventListener("click", async () => {
    const val = document.getElementById("shortcutsUrl")?.value || "chrome://extensions/shortcuts";
    try {
      await navigator.clipboard.writeText(val);
    } catch {
      // fallback: select input so user can copy manually
      const input = document.getElementById("shortcutsUrl");
      if (input) {
        input.focus();
        input.select();
      }
    }
  });
  
document.getElementById("addTemplate").addEventListener("click", async () => {
  const name = document.getElementById("tplName").value.trim();
  const prompt = document.getElementById("tplPrompt").value.trim();

  if (!name || !prompt) return;

  const { templates } = await loadState();
  templates.push({ id: uid(), name, prompt });

  await saveTemplates(templates);

  chrome.runtime.sendMessage({ type: "H2C_TEMPLATES_UPDATED" });

  document.getElementById("tplName").value = "";
  document.getElementById("tplPrompt").value = "";

  await refreshUI();
});

document.getElementById("saveFloating").addEventListener("click", async () => {
  const value = document.getElementById("floatingAction").value;

  if (value === "ask") {
    await saveFloatingAction({ type: "ask" });
  } else if (value.startsWith("template:")) {
    const id = value.split(":")[1];
    await saveFloatingAction({ type: "template", id });
  }

  await refreshUI();
});

document.getElementById("openHistory")?.addEventListener("click", () => {
    chrome.tabs.create({ url: chrome.runtime.getURL("history.html") });
  });
  
refreshUI().catch(console.error);
