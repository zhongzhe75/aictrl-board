// scripts/ui.js
export function qs(sel, root = document) { return root.querySelector(sel); }
export function qsa(sel, root = document) { return [...root.querySelectorAll(sel)]; }

export function toast(msg) {
    const el = qs("#toast");
    if (!el) return;
    el.textContent = msg;
    el.classList.add("is-show");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.remove("is-show"), 1800);
}

export function setThemeOnDom(theme) {
    document.documentElement.dataset.theme = theme;
    const btn = qs("#themeToggle");
    if (btn) btn.setAttribute("aria-pressed", theme === "light" ? "true" : "false");
}

export function renderProgress(tasks) {
    const done = tasks.filter(t => t.status === "done").length;
    const total = tasks.length;
    const pct = total === 0 ? 0 : Math.round((done / total) * 100);
    const ring = qs("#progressRing");
    const text = qs("#progressText");
    if (ring) ring.setAttribute("stroke-dasharray", `${pct}, 100`);
    if (text) text.textContent = `${done}/${total}`;
}

/**
 * 渲染来源下拉（固定来源 + 自定义来源 + 自定义入口）
 * - 显示文本用 escapeHtml
 * - value 用 escapeAttr（避免属性注入，同时保持原始语义，不会出现 &amp;）
 */
export function renderSourceOptions(customSources = [], selected = "ChatGPT") {
    const sel = qs("#noteSource");
    if (!sel) return;

    const fixed = ["ChatGPT", "DeepSeek", "Grok", "Gemini", "豆包"];
    const custom = (customSources || []).filter(Boolean).map(String);

    const finalSelected = selected || "ChatGPT";

    const fixedHtml = fixed.map(s =>
        `<option value="${escapeAttr(s)}" ${s === finalSelected ? "selected" : ""}>${escapeHtml(s)}</option>`
    ).join("");

    const customHtml = custom.length
        ? `<optgroup label="自定义">` + custom.map(s =>
            `<option value="${escapeAttr(s)}" ${s === finalSelected ? "selected" : ""}>${escapeHtml(s)}</option>`
        ).join("") + `</optgroup>`
        : "";

    const customEntry = `<option value="__custom__" ${finalSelected === "__custom__" ? "selected" : ""}>自定义…</option>`;

    sel.innerHTML = fixedHtml + customHtml + customEntry;
}

export function renderTaskOptions(tasks, selectedId = "") {
    const sel = qs("#noteTask");
    if (!sel) return;
    const current = selectedId;
    sel.innerHTML = `<option value="">未归档</option>` + tasks.map(t => {
        const s = t.id === current ? "selected" : "";
        return `<option value="${escapeAttr(t.id)}" ${s}>${escapeHtml(t.title)}</option>`;
    }).join("");
}

export function renderTasks(tasks, filters) {
    const list = qs("#taskList");
    const empty = qs("#emptyTasks");
    if (!list || !empty) return;

    const q = (filters?.q || "").trim().toLowerCase();
    const status = filters?.status || "all";
    const prio = filters?.priority || "all";

    let filtered = [...tasks];

    if (status !== "all") filtered = filtered.filter(t => t.status === status);
    if (prio !== "all") filtered = filtered.filter(t => t.priority === prio);
    if (q) {
        filtered = filtered.filter(t =>
            t.title.toLowerCase().includes(q) || (t.desc || "").toLowerCase().includes(q)
        );
    }

    empty.style.display = filtered.length ? "none" : "block";

    list.innerHTML = filtered.map(t => {
        const pTxt = t.priority === "high" ? "🔥 高" : (t.priority === "low" ? "低" : "中");
        const sTxt = t.status === "done" ? "已完成" : (t.status === "doing" ? "进行中" : "待办");
        const desc = t.desc ? escapeHtml(t.desc).slice(0, 140) : "（无描述）";
        return `
      <li>
        <article class="task-card" tabindex="0" aria-labelledby="task-title-${escapeAttr(t.id)}" data-task-id="${escapeAttr(t.id)}">
          <div class="task-card__top">
            <h3 class="task-title" id="task-title-${escapeAttr(t.id)}">${escapeHtml(t.title)}</h3>
            <span class="badge">${pTxt}｜${sTxt}</span>
          </div>
          <p class="task-desc">${desc}</p>
          <div class="task-actions">
            <button class="btn btn--ghost" data-action="toggle" type="button">${t.status === "done" ? "取消完成" : "标记完成"}</button>
            <button class="btn btn--ghost" data-action="edit" type="button">编辑</button>
            <button class="btn btn--ghost" data-action="focus" type="button">执行模式</button>
            <button class="btn btn--danger" data-action="delete" type="button">删除</button>
          </div>
          <div class="hint">预估 ${t.estimateMin}m / 已花 ${t.spentMin}m</div>
        </article>
      </li>
    `;
    }).join("");
}

export function renderNotes(notes, tasks) {
    const list = qs("#noteList");
    const empty = qs("#emptyNotes");
    if (!list || !empty) return;

    empty.style.display = notes.length ? "none" : "block";

    const taskMap = new Map(tasks.map(t => [t.id, t.title]));
    list.innerHTML = notes.slice(0, 30).map(n => {
        const title = n.taskId ? taskMap.get(n.taskId) : null;
        const head = title ? `→ 任务「${escapeHtml(title)}」` : "→ 未归档";
        return `
      <li class="card" data-note-id="${escapeAttr(n.id)}">
        <div class="row" style="justify-content:space-between; margin-top:0">
          <div><strong>${escapeHtml(n.source)}</strong> <span class="hint">${head}</span></div>
          <div class="row" style="margin-top:0">
            <div class="hint">${new Date(n.createdAt).toLocaleString()}</div>
            <button class="btn btn--ghost" data-action="delete-note" type="button" aria-label="删除这条建议">删除</button>
          </div>
        </div>
        <div style="margin-top:10px; color: var(--muted); white-space: pre-wrap;">${escapeHtml(n.content)}</div>
      </li>
    `;
    }).join("");
}

export function setActiveSegButton(groupSelector, dataAttr, value) {
    const btns = qsa(`${groupSelector} [${dataAttr}]`);
    btns.forEach(b => {
        const active = b.getAttribute(dataAttr) === value;
        b.classList.toggle("is-active", active);
        b.setAttribute("aria-selected", active ? "true" : "false");
    });
}

function escapeHtml(str) {
    return String(str)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function escapeAttr(str) {
    // 用于 HTML 属性（value / data-* / id 等）
    return String(str)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}
