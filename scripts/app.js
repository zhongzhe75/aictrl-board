// scripts/app.js
import { Store, downloadText } from "./store.js";
import {
    qs, qsa, toast, setThemeOnDom,
    renderTasks, renderNotes, renderTaskOptions, renderProgress,
    setActiveSegButton, renderSourceOptions
} from "./ui.js";

const store = new Store();

let lastFocusEl = null;
let currentFocusTaskId = null;

const QUOTES = [
    "已完成一小步，就领先昨天的你一大步。",
    "别追求完美，先让它可用。",
    "把下一步写清楚，执行就会变简单。",
    "你只需要开始，后面会自己长出来。",
    "完成 > 完美。"
];

function randomQuote() {
    return QUOTES[Math.floor(Math.random() * QUOTES.length)];
}

/* =========================
   Task Modal (new/edit)
========================= */
let taskModalCleanup = null;

function openTaskModal(mode, task, triggerEl) {
    const modal = qs("#taskModal");
    if (!modal) return;

    lastFocusEl = triggerEl || document.activeElement;

    qs("#taskModalTitle").textContent = mode === "edit" ? "编辑任务" : "新建任务";
    qs("#taskId").value = task?.id || "";
    qs("#taskTitle").value = task?.title || "";
    qs("#taskDesc").value = task?.desc || "";
    qs("#taskPriority").value = task?.priority || "medium";
    qs("#taskEstimate").value = String(task?.estimateMin ?? 30);
    qs("#taskFormLive").textContent = "";

    modal.hidden = false;
    trapFocus(modal, qs("#taskTitle"));

    function onClickMask(e) {
        if (e.target?.dataset?.close === "true") closeTaskModal();
    }
    modal.addEventListener("click", onClickMask);
    taskModalCleanup = () => modal.removeEventListener("click", onClickMask);

    setTimeout(() => qs("#taskTitle")?.focus(), 0);
}

function closeTaskModal() {
    const modal = qs("#taskModal");
    if (!modal) return;
    modal.hidden = true;

    taskModalCleanup?.();
    taskModalCleanup = null;

    releaseTrapFocus();

    const el = lastFocusEl;
    if (el && typeof el.focus === "function") el.focus();
}

/* =========================
   Confirm Modal (replace confirm())
========================= */
let confirmResolver = null;

function confirmDialog({ title = "确认操作", message = "确定继续吗？", okText = "确定", cancelText = "取消" }) {
    const modal = qs("#confirmModal");
    if (!modal) return Promise.resolve(false);

    qs("#confirmTitle").textContent = title;
    qs("#confirmMessage").textContent = message;

    const btnOk = qs("#btnConfirmOk");
    const btnCancel = qs("#btnConfirmCancel");

    btnOk.textContent = okText;
    btnCancel.textContent = cancelText;

    lastFocusEl = document.activeElement;
    modal.hidden = false;

    trapFocus(modal, btnCancel); // 默认聚焦取消更安全

    return new Promise((resolve) => {
        confirmResolver = resolve;
        setTimeout(() => btnCancel?.focus?.(), 0);
    });
}

function closeConfirmModal(result) {
    const modal = qs("#confirmModal");
    if (!modal) return;

    modal.hidden = true;
    releaseTrapFocus();

    const resolve = confirmResolver;
    confirmResolver = null;
    resolve?.(result);

    lastFocusEl?.focus?.();
}

/* =========================
   Sources Modal (manage custom sources)
========================= */
function renderSourcesManager() {
    const list = qs("#sourcesList");
    const empty = qs("#sourcesEmpty");
    if (!list || !empty) return;

    const sources = store.getCustomSources();
    empty.style.display = sources.length ? "none" : "block";

    // 这里用 textContent 更安全，所以不直接拼 escape，采用 data-source + 后续读取
    list.innerHTML = sources.map(s => `
    <li class="card sources-item" data-source="${s}">
      <div style="font-weight:700;">${s}</div>
      <button class="btn btn--danger btn--xs" type="button" data-action="remove-source">删除</button>
    </li>
  `).join("");
}

function openSourcesModal(triggerEl) {
    const modal = qs("#sourcesModal");
    if (!modal) return;

    lastFocusEl = triggerEl || document.activeElement;

    renderSourcesManager();
    modal.hidden = false;
    trapFocus(modal, qs("#btnCloseSources"));
}

function closeSourcesModal() {
    const modal = qs("#sourcesModal");
    if (!modal) return;

    modal.hidden = true;
    releaseTrapFocus();

    lastFocusEl?.focus?.();
}

/* =========================
   Focus Mode (execution)
========================= */
function openFocusMode(taskId, triggerEl) {
    const modal = qs("#focusModal");
    if (!modal) return;

    const task = store.getTask(taskId);
    if (!task) return;

    lastFocusEl = triggerEl || document.activeElement;
    currentFocusTaskId = taskId;

    qs("#focusTaskMeta").innerHTML = `
    <div class="card">
      <div style="display:flex; justify-content:space-between; gap:10px;">
        <div>
          <div style="font-weight:700; font-size:16px;">${task.title}</div>
          <div class="hint">优先级：${task.priority} ｜ 状态：${task.status}</div>
        </div>
        <div class="hint">预估 ${task.estimateMin}m / 已花 ${task.spentMin}m</div>
      </div>
      <div style="margin-top:10px; color: var(--muted); white-space: pre-wrap;">${task.desc || "（无描述）"}</div>
    </div>
  `;

    qs("#focusNext").value = "";
    modal.hidden = false;

    trapFocus(modal, qs("#focusNext"));
}

function closeFocusMode() {
    const modal = qs("#focusModal");
    if (!modal) return;

    modal.hidden = true;
    releaseTrapFocus();

    const el = lastFocusEl;
    lastFocusEl = null;
    currentFocusTaskId = null;

    if (el && typeof el.focus === "function") el.focus();
}

/* =========================
   Focus Trap (shared)
========================= */
let trapCleanup = null;

function trapFocus(modal, initialEl) {
    releaseTrapFocus();

    const focusable = () =>
        qsa('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])', modal)
            .filter(el => !el.hasAttribute("disabled") && !el.getAttribute("aria-disabled"));

    function onKeyDown(e) {
        if (e.key === "Escape") {
            e.preventDefault();

            const confirmM = qs("#confirmModal");
            const sourcesM = qs("#sourcesModal");
            const taskM = qs("#taskModal");
            const focusM = qs("#focusModal");

            if (confirmM && !confirmM.hidden) return closeConfirmModal(false);
            if (sourcesM && !sourcesM.hidden) return closeSourcesModal();
            if (taskM && !taskM.hidden) return closeTaskModal();
            if (focusM && !focusM.hidden) return closeFocusMode();
            return;
        }

        // Enter：如果确认框开着，就当“确定”
        if (e.key === "Enter") {
            const confirmM = qs("#confirmModal");
            if (confirmM && !confirmM.hidden) {
                e.preventDefault();
                closeConfirmModal(true);
                return;
            }
        }

        if (e.key !== "Tab") return;

        const els = focusable();
        if (!els.length) return;

        const first = els[0];
        const last = els[els.length - 1];
        const active = document.activeElement;

        if (e.shiftKey && active === first) {
            e.preventDefault();
            last.focus();
        } else if (!e.shiftKey && active === last) {
            e.preventDefault();
            first.focus();
        }
    }

    function onClickMask(e) {
        if (e.target?.dataset?.close !== "true") return;

        const confirmM = qs("#confirmModal");
        const sourcesM = qs("#sourcesModal");
        const taskM = qs("#taskModal");
        const focusM = qs("#focusModal");

        if (confirmM && !confirmM.hidden) return closeConfirmModal(false);
        if (sourcesM && !sourcesM.hidden) return closeSourcesModal();
        if (taskM && !taskM.hidden) return closeTaskModal();
        if (focusM && !focusM.hidden) return closeFocusMode();
    }

    document.addEventListener("keydown", onKeyDown);
    modal.addEventListener("click", onClickMask);

    trapCleanup = () => {
        document.removeEventListener("keydown", onKeyDown);
        modal.removeEventListener("click", onClickMask);
    };

    setTimeout(() => (initialEl || modal)?.focus?.(), 0);
}

function releaseTrapFocus() {
    if (trapCleanup) trapCleanup();
    trapCleanup = null;
}

/* =========================
   UI Sync
========================= */
function syncUI() {
    const tasks = store.listTasks();
    const notes = store.listNotes();

    setThemeOnDom(store.state.ui.theme);

    renderTasks(tasks, store.state.ui.filters);
    renderTaskOptions(tasks, qs("#noteTask")?.value || "");
    renderNotes(notes, tasks);
    renderProgress(tasks);

    // 先缓存当前来源选择，避免 renderSourceOptions 重绘导致抖动
    const currentSource = qs("#noteSource")?.value || "ChatGPT";
    renderSourceOptions(store.getCustomSources(), currentSource);

    // 控制自定义来源输入框显示
    const wrap = qs("#customSourceWrap");
    if (wrap) wrap.hidden = currentSource !== "__custom__";

    setActiveSegButton(".sidebar__section:nth-of-type(1) .seg", "data-filter-status", store.state.ui.filters.status);
    setActiveSegButton(".sidebar__section:nth-of-type(2) .seg", "data-filter-priority", store.state.ui.filters.priority);
}

function isTypingInInput() {
    const el = document.activeElement;
    if (!el) return false;
    const tag = el.tagName?.toLowerCase();
    return tag === "input" || tag === "textarea" || tag === "select" || el.isContentEditable;
}

/* =========================
   Events
========================= */
function wireEvents() {
    // theme
    qs("#themeToggle")?.addEventListener("click", () => {
        const next = store.state.ui.theme === "dark" ? "light" : "dark";
        store.setTheme(next);
        toast(next === "light" ? "已切换浅色主题" : "已切换暗色主题");
        syncUI();
    });

    // import button
    qs("#btnImport")?.addEventListener("click", () => qs("#fileImport")?.click());

    // open sources manager modal
    qs("#btnManageSources")?.addEventListener("click", (e) => openSourcesModal(e.currentTarget));
    qs("#btnCloseSources")?.addEventListener("click", closeSourcesModal);

    // delete a custom source
    qs("#sourcesList")?.addEventListener("click", async (e) => {
        const btn = e.target.closest('button[data-action="remove-source"]');
        if (!btn) return;

        const item = e.target.closest("[data-source]");
        const name = item?.dataset?.source;
        if (!name) return;

        const ok = await confirmDialog({
            title: "删除自定义来源",
            message: `确定删除「${name}」吗？`,
            okText: "删除",
            cancelText: "取消"
        });
        if (!ok) return;

        store.removeCustomSource(name);

        // 如果当前来源选中的是被删项，切回 ChatGPT
        const current = qs("#noteSource")?.value;
        if (current && current.toLowerCase() === String(name).toLowerCase()) {
            qs("#noteSource").value = "ChatGPT";
            const wrap = qs("#customSourceWrap");
            if (wrap) wrap.hidden = true;
        }

        toast("已删除自定义来源");
        renderSourcesManager();
        syncUI();
    });

    // search shortcut
    document.addEventListener("keydown", (e) => {
        if (e.key === "/" && !isTypingInInput()) {
            e.preventDefault();
            qs("#globalSearch")?.focus();
        }
    });

    // search input
    qs("#globalSearch")?.addEventListener("input", (e) => {
        store.setFilters({ q: e.target.value || "" });
        syncUI();
    });

    // segmented filters
    qsa("[data-filter-status]").forEach(btn => {
        btn.addEventListener("click", () => {
            store.setFilters({ status: btn.getAttribute("data-filter-status") });
            syncUI();
        });
    });
    qsa("[data-filter-priority]").forEach(btn => {
        btn.addEventListener("click", () => {
            store.setFilters({ priority: btn.getAttribute("data-filter-priority") });
            syncUI();
        });
    });

    // new task
    qs("#btnNewTask")?.addEventListener("click", () => {
        openTaskModal("new", null, qs("#btnNewTask"));
    });

    // task list actions
    qs("#taskList")?.addEventListener("click", async (e) => {
        const btn = e.target.closest("button[data-action]");
        if (!btn) return;
        const card = e.target.closest("[data-task-id]");
        const id = card?.dataset?.taskId;
        if (!id) return;

        const action = btn.dataset.action;

        try {
            if (action === "toggle") {
                const t = store.toggleDone(id);
                toast(t.status === "done" ? `完成！${randomQuote()}` : "已取消完成");
            } else if (action === "edit") {
                const existing = store.getTask(id);
                openTaskModal("edit", existing, btn);
                return;
            } else if (action === "delete") {
                const ok = await confirmDialog({
                    title: "删除任务",
                    message: "确定删除这个任务吗？\n删除后无法恢复。",
                    okText: "删除",
                    cancelText: "取消"
                });
                if (!ok) return;
                store.removeTask(id);
                toast("已删除任务");
            } else if (action === "focus") {
                openFocusMode(id, btn);
                return;
            }
            syncUI();
        } catch (err) {
            toast(err.message || "操作失败");
        }
    });

    // open focus mode button
    qs("#btnFocusMode")?.addEventListener("click", () => {
        const tasks = store.listTasks();
        const t = tasks.find(x => x.status !== "done") || tasks[0];
        if (!t) return toast("暂无任务可执行");
        openFocusMode(t.id, qs("#btnFocusMode"));
    });

    // focus modal buttons
    qs("#btnCloseFocus")?.addEventListener("click", closeFocusMode);

    qs("#btnSaveNext")?.addEventListener("click", () => {
        if (!currentFocusTaskId) return;
        const text = (qs("#focusNext").value || "").trim();
        if (!text) return toast("先写下你的下一步");
        const t = store.getTask(currentFocusTaskId);
        const merged = t.desc ? `${t.desc}\n\n下一步：${text}` : `下一步：${text}`;
        store.updateTask(currentFocusTaskId, { desc: merged });
        toast("已写入任务描述");
        syncUI();
    });

    qs("#btnMarkDoneInFocus")?.addEventListener("click", () => {
        if (!currentFocusTaskId) return;
        store.toggleDone(currentFocusTaskId);
        toast(`完成！${randomQuote()}`);
        syncUI();
    });

    // source select change -> toggle custom input
    qs("#noteSource")?.addEventListener("change", () => {
        const v = qs("#noteSource").value;
        const wrap = qs("#customSourceWrap");
        if (wrap) wrap.hidden = v !== "__custom__";
        if (v === "__custom__") qs("#noteSourceCustom")?.focus();
    });

    // notes
    qs("#btnClearNote")?.addEventListener("click", () => {
        qs("#noteContent").value = "";
        qs("#noteLive").textContent = "已清空";
    });

    // note submit
    qs("#noteForm")?.addEventListener("submit", (e) => {
        e.preventDefault();

        let source = qs("#noteSource").value;
        const taskId = qs("#noteTask").value || null;
        const content = qs("#noteContent").value || "";

        // 自定义来源
        if (source === "__custom__") {
            const custom = (qs("#noteSourceCustom")?.value || "").trim();
            if (!custom) {
                toast("请填写自定义来源");
                qs("#noteSourceCustom")?.focus();
                return;
            }
            source = custom;
            store.addCustomSource(custom);
        }

        try {
            store.addNote({ source, taskId, content });

            // 清空输入
            qs("#noteContent").value = "";
            const customInput = qs("#noteSourceCustom");
            if (customInput) customInput.value = "";

            // 保存后回到默认来源 & 收起自定义框（体验更顺）
            const noteSourceSel = qs("#noteSource");
            if (noteSourceSel) noteSourceSel.value = "ChatGPT";
            const wrap2 = qs("#customSourceWrap");
            if (wrap2) wrap2.hidden = true;

            qs("#noteLive").textContent = "建议已保存";
            toast("建议已归档");
            syncUI();
        } catch (err) {
            toast(err.message || "保存失败");
        }
    });

    // delete note
    qs("#noteList")?.addEventListener("click", async (e) => {
        const btn = e.target.closest('button[data-action="delete-note"]');
        if (!btn) return;
        const card = e.target.closest("[data-note-id]");
        const id = card?.dataset?.noteId;
        if (!id) return;

        const ok = await confirmDialog({
            title: "删除建议",
            message: "确定删除这条建议吗？",
            okText: "删除",
            cancelText: "取消"
        });
        if (!ok) return;

        try {
            store.removeNote(id);
            toast("已删除建议");
            syncUI();
        } catch (err) {
            toast(err.message || "删除失败");
        }
    });

    // export
    qs("#btnExportJson")?.addEventListener("click", () => {
        const text = store.exportJSON();
        downloadText("echo-commandcore-backup.json", text, "application/json");
        toast("已导出 JSON");
    });

    qs("#btnExportMd")?.addEventListener("click", () => {
        const text = store.exportMarkdown();
        downloadText("echo-commandcore-report.md", text, "text/markdown");
        toast("已导出 Markdown");
    });

    // import
    qs("#fileImport")?.addEventListener("change", async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const text = await file.text();
            store.importJSON(text);
            toast("导入成功");
            syncUI();
        } catch (err) {
            toast(err.message || "导入失败");
        } finally {
            e.target.value = "";
        }
    });

    // task modal close buttons
    qs("#btnCloseTaskModal")?.addEventListener("click", closeTaskModal);
    qs("#btnCancelTaskModal")?.addEventListener("click", closeTaskModal);

    // task modal submit
    qs("#taskForm")?.addEventListener("submit", (e) => {
        e.preventDefault();

        const id = (qs("#taskId").value || "").trim();
        const title = (qs("#taskTitle").value || "").trim();
        const desc = qs("#taskDesc").value || "";
        const priority = qs("#taskPriority").value || "medium";
        const estimateMin = Number(qs("#taskEstimate").value || 0);

        try {
            if (!title) throw new Error("任务标题不能为空");

            if (id) {
                store.updateTask(id, { title, desc, priority, estimateMin });
                toast("已更新任务");
            } else {
                store.addTask({ title, desc, priority, estimateMin });
                toast("任务已创建");
            }

            closeTaskModal();
            syncUI();
        } catch (err) {
            qs("#taskFormLive").textContent = err.message || "保存失败";
            toast(err.message || "保存失败");
        }
    });

    // confirm modal buttons (click)
    qs("#btnCloseConfirm")?.addEventListener("click", () => closeConfirmModal(false));
    qs("#btnConfirmCancel")?.addEventListener("click", () => closeConfirmModal(false));
    qs("#btnConfirmOk")?.addEventListener("click", () => closeConfirmModal(true));

    // click mask to close confirm
    qs("#confirmModal")?.addEventListener("click", (e) => {
        if (e.target?.dataset?.close === "true") closeConfirmModal(false);
    });
}

// init
syncUI();
wireEvents();
toast("欢迎使用指挥台：新建任务开始吧");
