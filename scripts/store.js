// scripts/store.js
const STORAGE_KEY = "ecc_store_v1";

function now() { return Date.now(); }
function uid(prefix) {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

const DEFAULT_STATE = {
    version: 1,
    updatedAt: 0,
    project: { title: "AI 学习任务指挥台", goal: "" },
    tasks: [],
    notes: [],
    ui: {
        theme: "dark",
        filters: { status: "all", priority: "all", q: "" },
        customSources: []
    }
};

function safeParse(json) {
    try { return JSON.parse(json); } catch { return null; }
}

function normalizeState(raw) {
    const s = raw && typeof raw === "object" ? raw : {};
    const merged = structuredClone(DEFAULT_STATE);

    if (typeof s.version === "number") merged.version = s.version;

    if (s.project && typeof s.project === "object") {
        merged.project = { ...merged.project, ...s.project };
    }

    if (Array.isArray(s.tasks)) {
        merged.tasks = s.tasks.map(t => normalizeTask(t)).filter(Boolean);
    }

    if (Array.isArray(s.notes)) {
        merged.notes = s.notes.map(n => normalizeNote(n)).filter(Boolean);
    }

    if (s.ui && typeof s.ui === "object") {
        merged.ui = { ...merged.ui, ...s.ui };
    }

    if (s.ui?.filters && typeof s.ui.filters === "object") {
        merged.ui.filters = { ...merged.ui.filters, ...s.ui.filters };
    }

    // ✅ customSources: trim + 去重（忽略大小写）+ 限制数量
    if (Array.isArray(s.ui?.customSources)) {
        const cleaned = s.ui.customSources
            .filter(Boolean)
            .map(x => String(x).trim())
            .filter(Boolean);

        const uniq = [];
        for (const x of cleaned) {
            if (!uniq.some(u => u.toLowerCase() === x.toLowerCase())) uniq.push(x);
        }
        merged.ui.customSources = uniq.slice(0, 20);
    }

    merged.updatedAt = now();
    return merged;
}

function normalizeTask(t) {
    if (!t || typeof t !== "object") return null;
    const id = typeof t.id === "string" ? t.id : uid("t");

    return {
        id,
        title: typeof t.title === "string" ? t.title : "",
        desc: typeof t.desc === "string" ? t.desc : "",
        priority: ["low", "medium", "high"].includes(t.priority) ? t.priority : "medium",
        status: ["todo", "doing", "done"].includes(t.status) ? t.status : "todo",
        estimateMin: Number.isFinite(t.estimateMin) ? Math.max(0, t.estimateMin) : 0,
        spentMin: Number.isFinite(t.spentMin) ? Math.max(0, t.spentMin) : 0,
        createdAt: Number.isFinite(t.createdAt) ? t.createdAt : now(),
        updatedAt: Number.isFinite(t.updatedAt) ? t.updatedAt : now()
    };
}

// ✅ 支持自定义来源：只要是非空字符串就保留
function normalizeNote(n) {
    if (!n || typeof n !== "object") return null;
    const id = typeof n.id === "string" ? n.id : uid("n");

    let source = (typeof n.source === "string" ? n.source : "").trim();
    if (!source) source = "ChatGPT";

    return {
        id,
        taskId: typeof n.taskId === "string" ? n.taskId : null,
        source,
        content: typeof n.content === "string" ? n.content : "",
        createdAt: Number.isFinite(n.createdAt) ? n.createdAt : now()
    };
}

export class Store {
    constructor() {
        this.state = this.load();
    }

    load() {
        const raw = safeParse(localStorage.getItem(STORAGE_KEY));
        return normalizeState(raw);
    }

    save() {
        this.state.updatedAt = now();
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    }

    // ---------- Theme ----------
    setTheme(theme) {
        this.state.ui.theme = theme === "light" ? "light" : "dark";
        this.save();
    }

    // ---------- Filters ----------
    setFilters(patch) {
        this.state.ui.filters = { ...this.state.ui.filters, ...patch };
        this.save();
    }

    // ---------- Custom Sources ----------
    getCustomSources() {
        return Array.isArray(this.state.ui.customSources) ? [...this.state.ui.customSources] : [];
    }

    addCustomSource(name) {
        const v = String(name || "").trim();
        if (!v) return;

        const list = Array.isArray(this.state.ui.customSources) ? this.state.ui.customSources : [];
        const exists = list.some(x => String(x).toLowerCase() === v.toLowerCase());

        if (!exists) {
            list.unshift(v);
            this.state.ui.customSources = list.slice(0, 20);
            this.save();
        }
    }

    // ✅ 新增：删除自定义来源（忽略大小写）
    removeCustomSource(name) {
        const v = String(name || "").trim();
        if (!v) return;

        this.state.ui.customSources = (this.state.ui.customSources || []).filter(
            x => String(x).toLowerCase() !== v.toLowerCase()
        );
        this.save();
    }

    // ---------- Tasks ----------
    listTasks() {
        return [...this.state.tasks];
    }

    getTask(id) {
        return this.state.tasks.find(t => t.id === id) || null;
    }

    addTask(data) {
        const task = normalizeTask({
            id: uid("t"),
            title: (data?.title || "").trim(),
            desc: (data?.desc || "").trim(),
            priority: data?.priority || "medium",
            status: data?.status || "todo",
            estimateMin: Number(data?.estimateMin || 0),
            spentMin: Number(data?.spentMin || 0),
            createdAt: now(),
            updatedAt: now()
        });

        if (!task.title) throw new Error("任务标题不能为空");
        this.state.tasks.unshift(task);
        this.save();
        return task;
    }

    updateTask(id, patch) {
        const t = this.getTask(id);
        if (!t) throw new Error("任务不存在");

        if (patch.title != null) t.title = String(patch.title).trim();
        if (patch.desc != null) t.desc = String(patch.desc);
        if (patch.priority && ["low", "medium", "high"].includes(patch.priority)) t.priority = patch.priority;
        if (patch.status && ["todo", "doing", "done"].includes(patch.status)) t.status = patch.status;
        if (patch.estimateMin != null) t.estimateMin = Math.max(0, Number(patch.estimateMin) || 0);
        if (patch.spentMin != null) t.spentMin = Math.max(0, Number(patch.spentMin) || 0);

        t.updatedAt = now();
        if (!t.title) throw new Error("任务标题不能为空");

        this.save();
        return t;
    }

    toggleDone(id) {
        const t = this.getTask(id);
        if (!t) throw new Error("任务不存在");
        t.status = t.status === "done" ? "todo" : "done";
        t.updatedAt = now();
        this.save();
        return t;
    }

    removeTask(id) {
        const idx = this.state.tasks.findIndex(t => t.id === id);
        if (idx === -1) throw new Error("任务不存在");

        this.state.tasks.splice(idx, 1);

        // 绑定到该任务的 notes 变成未归档
        for (const n of this.state.notes) {
            if (n.taskId === id) n.taskId = null;
        }

        this.save();
    }

    // ---------- Notes ----------
    listNotes() {
        return [...this.state.notes].sort((a, b) => b.createdAt - a.createdAt);
    }

    addNote(data) {
        const note = normalizeNote({
            id: uid("n"),
            taskId: data?.taskId || null,
            source: data?.source || "ChatGPT",
            content: (data?.content || "").trim(),
            createdAt: now()
        });

        if (!note.content) throw new Error("建议内容不能为空");
        this.state.notes.unshift(note);
        this.save();
        return note;
    }

    removeNote(id) {
        const idx = this.state.notes.findIndex(n => n.id === id);
        if (idx === -1) throw new Error("建议不存在");
        this.state.notes.splice(idx, 1);
        this.save();
    }

    // ---------- Export / Import ----------
    exportJSON() {
        const payload = {
            ...this.state,
            exportedAt: new Date().toISOString()
        };
        return JSON.stringify(payload, null, 2);
    }

    importJSON(jsonText) {
        const raw = safeParse(jsonText);
        if (!raw) throw new Error("JSON 格式不正确");
        this.state = normalizeState(raw);
        this.save();
    }

    exportMarkdown() {
        const { project, tasks, notes } = this.state;
        const lines = [];

        lines.push(`# ${project?.title || "AI 学习任务指挥台"}`);
        if (project?.goal) lines.push(`\n> 目标：${project.goal}\n`);

        const byStatus = {
            todo: tasks.filter(t => t.status === "todo"),
            doing: tasks.filter(t => t.status === "doing"),
            done: tasks.filter(t => t.status === "done")
        };

        function taskLine(t) {
            const p = t.priority === "high" ? "🔥高" : (t.priority === "low" ? "低" : "中");
            const time = `预估 ${t.estimateMin}m / 已花 ${t.spentMin}m`;
            return `- [${t.status === "done" ? "x" : " "}] **${t.title}**（${p}｜${time}）\n  - ${t.desc ? t.desc.replace(/\n/g, "\n  - ") : "（无描述）"}`;
        }

        lines.push(`\n## 待办\n`);
        lines.push(byStatus.todo.length ? byStatus.todo.map(taskLine).join("\n") : `- （空）`);

        lines.push(`\n## 进行中\n`);
        lines.push(byStatus.doing.length ? byStatus.doing.map(taskLine).join("\n") : `- （空）`);

        lines.push(`\n## 已完成\n`);
        lines.push(byStatus.done.length ? byStatus.done.map(taskLine).join("\n") : `- （空）`);

        lines.push(`\n## AI 建议归档\n`);
        if (!notes.length) {
            lines.push(`- （空）`);
        } else {
            for (const n of notes.sort((a, b) => b.createdAt - a.createdAt)) {
                const t = n.taskId ? tasks.find(x => x.id === n.taskId) : null;
                const head = `- **${n.source}** → ${t ? `任务「${t.title}」` : "未归档"}（${new Date(n.createdAt).toLocaleString()}）`;
                lines.push(head);
                lines.push(`  - ${n.content.replace(/\n/g, "\n  - ")}`);
            }
        }

        return lines.join("\n");
    }
}

// ---- helpers: download file ----
export function downloadText(filename, text, mime = "text/plain") {
    const blob = new Blob([text], { type: `${mime};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}
