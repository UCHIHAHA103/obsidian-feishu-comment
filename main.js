"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => FeishuCommentPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian3 = require("obsidian");

// src/types.ts
var DEFAULT_AUTHOR = "\u6211";

// src/storage.ts
var CommentStore = class {
  constructor(plugin) {
    this.plugin = plugin;
    this.db = {};
  }
  async load(saved) {
    if (saved && typeof saved === "object" && !Array.isArray(saved)) {
      this.db = saved;
    } else {
      this.db = {};
    }
  }
  async save() {
    await this.plugin.saveData(this.db);
  }
  getThreads(notePath) {
    return this.db[notePath] || [];
  }
  async addThread(notePath, thread) {
    if (!this.db[notePath]) this.db[notePath] = [];
    this.db[notePath].push(thread);
    await this.save();
  }
  async updateThread(notePath, threadId, updates) {
    const threads = this.db[notePath];
    if (!threads) return;
    const idx = threads.findIndex((t) => t.id === threadId);
    if (idx === -1) return;
    threads[idx] = { ...threads[idx], ...updates };
    await this.save();
  }
  async deleteThread(notePath, threadId) {
    const threads = this.db[notePath];
    if (!threads) return;
    this.db[notePath] = threads.filter((t) => t.id !== threadId);
    if (this.db[notePath].length === 0) delete this.db[notePath];
    await this.save();
  }
  async addReply(notePath, threadId, reply) {
    const threads = this.db[notePath];
    if (!threads) return;
    const thread = threads.find((t) => t.id === threadId);
    if (!thread) return;
    thread.replies.push(reply);
    await this.save();
  }
  async deleteReply(notePath, threadId, replyId) {
    const threads = this.db[notePath];
    if (!threads) return;
    const t = threads.find((x) => x.id === threadId);
    if (!t) return;
    t.replies = t.replies.filter((r) => r.id !== replyId);
    if (t.replies.length === 0) {
      this.db[notePath] = this.db[notePath].filter((x) => x.id !== threadId);
      if (this.db[notePath].length === 0) delete this.db[notePath];
    }
    await this.save();
  }
};

// src/comment-modal.ts
var import_obsidian = require("obsidian");
var CommentInputModal = class extends import_obsidian.Modal {
  constructor(app, onSubmit, title = "\u6DFB\u52A0\u8BC4\u8BBA", placeholder = "\u8F93\u5165\u8BC4\u8BBA\u5185\u5BB9...", submitOnEnter = true, initialValue = "") {
    super(app);
    this.onSubmit = onSubmit;
    this.title = title;
    this.placeholder = placeholder;
    this.submitOnEnter = submitOnEnter;
    this.initialValue = initialValue;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.addClass("feishu-comment-modal");
    contentEl.createEl("h3", { text: this.title });
    this.textarea = contentEl.createEl("textarea");
    this.textarea.placeholder = this.placeholder;
    this.textarea.style.width = "100%";
    this.textarea.style.height = "100px";
    this.textarea.style.marginBottom = "8px";
    this.textarea.style.padding = "8px";
    this.textarea.style.borderRadius = "4px";
    this.textarea.style.fontFamily = "var(--font-text)";
    this.textarea.style.fontSize = "13px";
    this.textarea.style.resize = "vertical";
    this.textarea.style.background = "var(--background-primary)";
    this.textarea.style.color = "var(--text-normal)";
    this.textarea.style.border = "1px solid var(--background-modifier-border)";
    this.textarea.addEventListener("focus", () => {
      this.textarea.style.borderColor = "var(--interactive-accent)";
      this.textarea.style.outline = "none";
    });
    this.textarea.addEventListener("blur", () => {
      this.textarea.style.borderColor = "var(--background-modifier-border)";
    });
    if (this.submitOnEnter) {
      this.textarea.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          this.submit();
        }
        if (e.key === "Escape") {
          this.close();
        }
      });
    }
    this.hint = contentEl.createEl("div", {
      cls: "feishu-comment-modal-hint",
      text: "Enter \u63D0\u4EA4 \xB7 Shift+Enter \u6362\u884C \xB7 Esc \u53D6\u6D88"
    });
    this.hint.style.fontSize = "11px";
    this.hint.style.color = "var(--text-faint)";
    this.hint.style.marginBottom = "12px";
    new import_obsidian.Setting(contentEl).addButton(
      (btn) => btn.setButtonText("\u63D0\u4EA4").setCta().onClick(() => this.submit())
    ).addButton(
      (btn) => btn.setButtonText("\u53D6\u6D88").onClick(() => this.close())
    );
    if (this.initialValue) {
      this.textarea.value = this.initialValue;
    }
    this.captureFocus();
  }
  // 焦点健壮化: 多阶段重试 focus + blur 守卫 + 点空白聚焦, 防焦点被 Obsidian 内部流程抢走
  captureFocus() {
    const focusNow = () => {
      try {
        if (this.textarea && this.textarea.isConnected) {
          this.textarea.focus();
          if (this.initialValue) {
            const L = this.textarea.value.length;
            this.textarea.setSelectionRange(L, L);
          }
        }
      } catch (e) {
      }
    };
    focusNow();
    requestAnimationFrame(() => focusNow());
    setTimeout(focusNow, 100);
    setTimeout(focusNow, 400);
    const focusIsOutside = () => {
      const ae = document.activeElement;
      if (ae === this.textarea) return false;
      if (ae && this.modalEl && this.modalEl.contains(ae)) return false;
      return true;
    };
    this.focusGuard = () => {
      setTimeout(() => {
        if (!this.textarea || !this.textarea.isConnected) return;
        if (!focusIsOutside()) return;
        focusNow();
      }, 120);
    };
    this.textarea.addEventListener("blur", this.focusGuard);
    // 守护2: 打开期间周期检查, 焦点被抢到弹窗外则拉回 (覆盖 textarea 从未聚焦成功→无 blur 事件的盲区)
    this.focusTimer = window.setInterval(() => {
      if (!this.textarea || !this.textarea.isConnected) return;
      if (!focusIsOutside()) return;
      focusNow();
    }, 500);
    // 守护3: 键盘兜底 - 弹窗外按键时先拉回焦点, 让字符落在输入框
    this.keyGuard = (e) => {
      if (!e.key || e.key.length !== 1) return;
      if (!this.textarea || !this.textarea.isConnected) return;
      if (!focusIsOutside()) return;
      focusNow();
    };
    document.addEventListener("keydown", this.keyGuard, true);
    this.contentEl.addEventListener("mousedown", (e) => {
      if (e.target === this.contentEl || e.target === this.modalEl) {
        e.preventDefault();
        focusNow();
      }
    });
  }
  submit() {
    const text = this.textarea.value.trim();
    if (!text) {
      this.textarea.focus();
      return;
    }
    this.onSubmit(text);
    this.close();
  }
  onClose() {
    if (this.keyGuard) {
      document.removeEventListener("keydown", this.keyGuard, true);
      this.keyGuard = null;
    }
    if (this.focusTimer) {
      clearInterval(this.focusTimer);
      this.focusTimer = null;
    }
    if (this.textarea && this.focusGuard) {
      this.textarea.removeEventListener("blur", this.focusGuard);
      this.focusGuard = null;
    }
    this.contentEl.empty();
  }
};

// Obsidian 风格确认框: 替代原生 confirm()/alert() (Electron 中原生阻塞对话框会损坏窗口焦点状态,
// 导致后续 modal 无法聚焦输入, 直到窗口焦点被外部扰动才恢复)
var ConfirmModal = class extends import_obsidian.Modal {
  constructor(app, message, onResult) {
    super(app);
    this.message = message;
    this.onResult = onResult;
    this.confirmed = false;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.addClass("feishu-comment-confirm");
    contentEl.createEl("p", {
      cls: "feishu-comment-confirm-message",
      text: this.message
    });
    const btns = contentEl.createEl("div", { cls: "feishu-comment-confirm-buttons" });
    btns.createEl("button", { text: "\u786E\u5B9A", cls: "mod-cta" }).addEventListener("click", () => {
      this.confirmed = true;
      this.close();
    });
    btns.createEl("button", { text: "\u53D6\u6D88" }).addEventListener("click", () => {
      this.close();
    });
  }
  onClose() {
    this.onResult(this.confirmed);
    this.contentEl.empty();
  }
};
function showConfirm(app, message) {
  return new Promise((resolve) => {
    new ConfirmModal(app, message, (ok) => resolve(ok)).open();
  });
}

// src/comment-view.ts
var import_obsidian2 = require("obsidian");

// src/underline-extension.ts
var import_view = require("@codemirror/view");
var import_state = require("@codemirror/state");
var bumpVersion = import_state.StateEffect.define();
var versionField = import_state.StateField.define({
  create: () => 0,
  update: (value, tr) => {
    for (const e of tr.effects) {
      if (e.is(bumpVersion)) return value + 1;
    }
    return value;
  }
});
var flashThreadEffect = import_state.StateEffect.define();
var flashField = import_state.StateField.define({
  create: () => null,
  update: (value, tr) => {
    for (const e of tr.effects) {
      if (e.is(flashThreadEffect)) return e.value;
    }
    return value;
  }
});
function lineChToOffset(doc, pos) {
  if (pos.line < 0) return 0;
  if (pos.line >= doc.lines) return doc.length;
  const line = doc.line(pos.line + 1);
  return line.from + Math.min(Math.max(0, pos.ch), line.length);
}
function offsetToLineCh(doc, offset) {
  const line = doc.lineAt(Math.min(Math.max(0, offset), doc.length));
  return { line: line.number - 1, ch: offset - line.from };
}
// 重锚定(对齐飞书): 编辑锚定内文字时区间随 ChangeSet 平移/缩放, 引用文字同步为新内容;
// 区间被整体删除时 text 置空; 未被触碰的评论不更新。返回被更新的 threadId 列表
function reanchorAnchors(oldDoc, newDoc, changes, threads) {
  const touched = [];
  for (const t of threads) {
    const a = t.anchor;
    if (!a || typeof a.text !== "string") continue;
    const oldFrom = lineChToOffset(oldDoc, a.from);
    const oldTo = lineChToOffset(oldDoc, a.to);
    const newFrom = changes.mapPos(oldFrom, 1);
    const newTo = changes.mapPos(oldTo, -1);
    if (newFrom === oldFrom && newTo === oldTo) continue;
    a.from = offsetToLineCh(newDoc, newFrom);
    a.to = offsetToLineCh(newDoc, newTo);
    a.text = newFrom < newTo ? newDoc.sliceString(newFrom, newTo) : "";
    touched.push(t.id);
  }
  return touched;
}
function createUnderlineExtension(opts) {
  const decoPlugin = import_view.ViewPlugin.fromClass(
    class {
      constructor(view) {
        this.decorations = this.build(view);
      }
      update(update) {
        const newVersion = update.state.field(versionField);
        const oldVersion = update.startState.field(versionField);
        const newFlash = update.state.field(flashField);
        const oldFlash = update.startState.field(flashField);
        if (update.docChanged) {
          this.reanchor(update);
        }
        if (update.docChanged || newVersion !== oldVersion || newFlash !== oldFlash) {
          this.decorations = this.build(update.view);
        }
      }
      reanchor(update) {
        if (!opts.onAnchorsShifted) return;
        const touched = reanchorAnchors(update.startState.doc, update.state.doc, update.changes, opts.getThreads(update.view));
        if (touched.length) opts.onAnchorsShifted(touched);
      }
      build(view) {
        const threads = opts.getThreads(view);
        if (threads.length === 0) return import_view.Decoration.none;
        const doc = view.state.doc;
        const flashedId = view.state.field(flashField);
        const sorted = threads.map((t) => {
          const pos = resolveAnchorOffsets(doc, t.anchor);
          return { thread: t, from: pos.start, to: pos.end, found: pos.found };
        }).filter((x) => x.found && x.from < x.to && x.from <= doc.length).sort((a, b) => a.from - b.from);
        const builder = new import_state.RangeSetBuilder();
        for (const { thread, from, to } of sorted) {
          const safeTo = Math.min(to, doc.length);
          let cls = `feishu-comment-underline feishu-comment-underline-${thread.status}`;
          if (thread.id === flashedId) {
            cls += " feishu-comment-underline-flashed";
          }
          builder.add(
            from,
            safeTo,
            import_view.Decoration.mark({
              class: cls,
              attributes: { "data-thread-id": thread.id }
            })
          );
        }
        return builder.finish();
      }
    },
    {
      decorations: (v) => v.decorations
    }
  );
  const clickHandler = import_view.EditorView.domEventHandlers({
    click(e, view) {
      const target = e.target;
      const el = target?.closest("[data-thread-id]");
      if (el) {
        const id = el.getAttribute("data-thread-id");
        if (id) {
          e.preventDefault();
          opts.onClickThread(id);
          return true;
        }
      }
      return false;
    }
  });
  return [versionField, flashField, decoPlugin, clickHandler];
}
function bumpAllEditorsVersion(app) {
  for (const leaf of app.workspace.getLeavesOfType("markdown")) {
    const view = leaf.view;
    if (view?.editor?.cm) {
      try {
        view.editor.cm.dispatch({ effects: bumpVersion.of(null) });
      } catch (e) {
      }
    }
  }
}
function flashThread(app, threadId, durationMs = 800) {
  for (const leaf of app.workspace.getLeavesOfType("markdown")) {
    const view = leaf.view;
    if (view?.editor?.cm) {
      try {
        view.editor.cm.dispatch({ effects: flashThreadEffect.of(threadId) });
        setTimeout(() => {
          try {
            view.editor.cm.dispatch({ effects: flashThreadEffect.of(null) });
          } catch {
          }
        }, durationMs);
      } catch (e) {
      }
    }
  }
}

// src/comment-view.ts
var VIEW_TYPE_FEISHU_COMMENTS = "feishu-comment-sidebar-view";
var CommentSidebarView = class extends import_obsidian2.ItemView {
  constructor(leaf, store, plugin) {
    super(leaf);
    this.store = store;
    this.plugin = plugin;
  }
  getViewType() {
    return VIEW_TYPE_FEISHU_COMMENTS;
  }
  getDisplayText() {
    return "\u98DE\u4E66\u8BC4\u8BBA";
  }
  getIcon() {
    return "message-square";
  }
  async onOpen() {
    this.registerEvent(
      this.app.workspace.on("file-open", () => this.render())
    );
    this.registerEvent(
      this.app.workspace.on("layout-change", () => this.render())
    );
    this.render();
  }
  async render() {
    const container = this.contentEl;
    container.empty();
    const activeFile = this.app.workspace.getActiveFile();
    if (!activeFile || activeFile.extension !== "md") {
      this.renderEmpty(container, "\u6253\u5F00 Markdown \u6587\u4EF6\u67E5\u770B\u8BC4\u8BBA");
      return;
    }
    const threads = this.store.getThreads(activeFile.path);
    let fileContent = null;
    try {
      fileContent = await this.app.vault.cachedRead(activeFile);
    } catch (e) {
    }
    const header = container.createEl("div", { cls: "feishu-comment-header" });
    header.createEl("h4", { text: "\u98DE\u4E66\u8BC4\u8BBA" });
    if (threads.length > 0) {
      const openCount = threads.filter((t) => t.status !== "resolved").length;
      header.createEl("span", {
        cls: "feishu-comment-count",
        text: `${openCount} \u672A\u89E3\u51B3 / ${threads.length} \u603B\u8BA1`
      });
    }
    if (threads.length === 0) {
      this.renderEmpty(container, "\u6682\u65E0\u8BC4\u8BBA", "\u9009\u4E2D\u6587\u5B57\u53F3\u952E\u5373\u53EF\u6DFB\u52A0");
      return;
    }
    const list = container.createEl("div", { cls: "feishu-comment-list" });
    const sorted = [...threads].sort((a, b) => {
      if (a.status === "resolved" && b.status !== "resolved") return 1;
      if (a.status !== "resolved" && b.status === "resolved") return -1;
      return b.createdAt.localeCompare(a.createdAt);
    });
    for (const thread of sorted) {
      this.renderThread(list, thread, activeFile.path, fileContent);
    }
  }
  renderEmpty(container, title, subtitle) {
    const empty = container.createEl("div", { cls: "feishu-comment-empty" });
    const icon = empty.createEl("div", {
      cls: "feishu-comment-empty-icon"
    });
    icon.innerHTML = '<svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>';
    empty.createEl("div", { text: title });
    if (subtitle) {
      const sub = empty.createEl("div", { text: subtitle });
      sub.style.fontSize = "11px";
      sub.style.marginTop = "4px";
    }
  }
  renderThread(parent, thread, notePath, fileContent) {
    const card = parent.createEl("div", {
      cls: `feishu-comment-thread status-${thread.status}`
    });
    card.setAttribute("data-thread-id", thread.id);
    const anchorText = typeof thread.anchor.text === "string" ? thread.anchor.text : "";
    const quote = card.createEl("div", { cls: "feishu-comment-quote" });
    if (anchorText.trim() === "") {
      quote.addClass("feishu-comment-deleted");
      quote.setText("\u539F\u6587\u5DF2\u5220\u9664");
    } else {
      const anchorLost = fileContent !== null && listMatches(fileContent, anchorText).length === 0;
      const text = anchorText.length > 60 ? anchorText.slice(0, 60) + "..." : anchorText;
      quote.setText(text);
      if (anchorLost) {
        quote.createSpan({ cls: "feishu-comment-lost", text: "\u539F\u6587\u5DF2\u53D8\u66F4" });
      }
    }
    quote.addEventListener(
      "click",
      () => this.jumpToAnchor(thread.anchor, thread.id)
    );
    const body = card.createEl("div", { cls: "feishu-comment-body" });
    for (const reply of thread.replies) {
      this.renderReplyItem(body, reply, notePath, thread);
    }
    const actions = card.createEl("div", { cls: "feishu-comment-actions" });
    this.iconBtn(
      actions,
      '<polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/>',
      "\u56DE\u590D"
    ).addEventListener("click", () => {
      new CommentInputModal(
        this.app,
        async (text2) => {
          await this.store.addReply(notePath, thread.id, {
            id: `rp_${Date.now()}`,
            author: "\u6211",
            content: text2,
            createdAt: (/* @__PURE__ */ new Date()).toISOString()
          });
          this.render();
        },
        "\u56DE\u590D\u8BC4\u8BBA",
        "\u8F93\u5165\u56DE\u590D\u5185\u5BB9...",
        true
      ).open();
    });
    const isResolved = thread.status === "resolved";
    const toggleTitle = isResolved ? "\u91CD\u5F00" : "\u89E3\u51B3";
    const togglePath = isResolved ? '<polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>' : '<polyline points="20 6 9 17 4 12"/>';
    this.iconBtn(actions, togglePath, toggleTitle).addEventListener("click", async () => {
      const newStatus = isResolved ? "reopened" : "resolved";
      await this.store.updateThread(notePath, thread.id, { status: newStatus });
      this.render();
    });
    this.iconBtn(
      actions,
      '<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/>',
      "\u5220\u9664",
      true
    ).addEventListener("click", async () => {
      if (await showConfirm(this.app, "\u5220\u9664\u6574\u4E2A\u8BC4\u8BBA\u7EBF\u7A0B\uFF1F\u6B64\u64CD\u4F5C\u4E0D\u53EF\u6062\u590D\u3002")) {
        await this.store.deleteThread(notePath, thread.id);
        this.render();
      }
    });
  }
  iconBtn(parent2, svgPath, title, danger = false) {
    const btn = parent2.createEl("button");
    btn.setAttribute("title", title);
    btn.setAttribute("aria-label", title);
    if (danger) btn.addClass("feishu-btn-danger");
    btn.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${svgPath}</svg>`;
    return btn;
  }
  renderReplyItem(parent, reply, notePath, thread) {
    const item = parent.createEl("div", { cls: "feishu-comment-reply" });
    item.createEl("span", {
      cls: "feishu-comment-time",
      text: this.formatTime(reply.createdAt)
    });
    item.createEl("div", {
      cls: "feishu-comment-content" + (reply.resolved ? " feishu-comment-reply-resolved" : ""),
      text: reply.content
    });
    const actions = item.createEl("div", { cls: "feishu-comment-reply-actions" });
    this.iconBtn(
      actions,
      '<path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10"/><path d="M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>',
      "\u66FF\u6362\u8FDB\u539F\u6587"
    ).addEventListener("click", async () => {
      if (!(await showConfirm(this.app, "\u5C06\u539F\u6587\u66FF\u6362\u4E3A\u8BE5\u8BC4\u8BBA\u5185\u5BB9\uFF1F\u6B64\u64CD\u4F5C\u4F1A\u4FEE\u6539\u6587\u6863\uFF08\u7F16\u8F91\u5668\u5185\u53EF\u64A4\u9500\uFF09\u3002"))) return;
      const res = await this.plugin.replaceOriginal(notePath, thread, reply);
      if (!res.ok) {
        new import_obsidian2.Notice(res.error);
        return;
      }
      this.render();
    });
    const rTitle = reply.resolved ? "\u91CD\u65B0\u6253\u5F00" : "\u6807\u8BB0\u5DF2\u89E3\u51B3";
    const rPath = reply.resolved ? '<polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>' : '<polyline points="20 6 9 17 4 12"/>';
    this.iconBtn(actions, rPath, rTitle).addEventListener("click", async () => {
      reply.resolved = !reply.resolved;
      await this.plugin.store.save();
      this.render();
    });
    this.iconBtn(
      actions,
      '<path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>',
      "\u7F16\u8F91\u8BC4\u8BBA"
    ).addEventListener("click", () => {
      new CommentInputModal(
        this.app,
        async (text) => {
          const t = text.trim();
          if (!t) return;
          reply.content = t;
          await this.plugin.store.save();
          this.render();
        },
        "\u7F16\u8F91\u8BC4\u8BBA",
        "\u8F93\u5165\u8BC4\u8BBA\u5185\u5BB9...",
        true,
        reply.content
      ).open();
    });
    this.iconBtn(
      actions,
      '<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/>',
      "\u5220\u9664",
      true
    ).addEventListener("click", async () => {
      if (await showConfirm(this.app, "\u5220\u9664\u8BE5\u6761\u8BC4\u8BBA\uFF1F")) {
        await this.plugin.store.deleteReply(notePath, thread.id, reply.id);
        this.render();
      }
    });
  }
  jumpToAnchor(anchor, threadId) {
    const tag = "[\u98DE\u4E66\u8BC4\u8BBA jumpToAnchor]";
    console.log(tag, "\u951A\u70B9:", JSON.stringify(anchor), "threadId:", threadId);
    const activeFile = this.app.workspace.getActiveFile();
    console.log(tag, "\u6D3B\u52A8\u6587\u4EF6:", activeFile?.path);
    const leaves = this.app.workspace.getLeavesOfType("markdown");
    console.log(tag, "\u6253\u5F00\u7684 markdown leaves:", leaves.length);
    const target = leaves.find(
      (l) => l.view?.file?.path === activeFile?.path
    );
    let view = null;
    if (target) {
      console.log(tag, "\u627E\u5230\u76EE\u6807 leaf, revealLeaf");
      this.app.workspace.revealLeaf(target);
      view = target.view;
    } else {
      console.warn(tag, "\u6CA1\u627E\u5230\u5339\u914D\u7684 markdown leaf, \u5C1D\u8BD5 getActiveViewOfType");
      view = this.app.workspace.getActiveViewOfType(import_obsidian2.MarkdownView);
    }
    if (!view?.editor) {
      console.warn(tag, "\u6CA1\u6709 editor");
      return;
    }
    console.log(tag, "\u5F97\u5230 editor, \u8BBE\u9009\u533A:", anchor.from, anchor.to);
    const editor = view.editor;
    let fromPos = { line: anchor.from.line, ch: anchor.from.ch };
    let toPos = { line: anchor.to.line, ch: anchor.to.ch };
    try {
      const pos = resolveAnchorOffsets(editor.cm.state.doc, anchor);
      fromPos = editor.offsetToPos(pos.start);
      toPos = editor.offsetToPos(pos.end);
    } catch (e) {
      console.warn(tag, "text anchor resolve failed, fallback to line/ch:", e);
    }
    try {
      editor.setSelection(fromPos, toPos);
      console.log(tag, "setSelection \u5B8C\u6210");
    } catch (e) {
      console.error(tag, "setSelection \u5931\u8D25:", e);
    }
    const doScroll = (label) => {
      try {
        editor.scrollIntoView(
          {
            from: fromPos,
            to: toPos
          },
          true
        );
        console.log(tag, `${label} scrollIntoView \u5B8C\u6210`);
      } catch (e) {
        console.error(tag, `${label} scrollIntoView \u5931\u8D25:`, e);
      }
    };
    doScroll("\u7ACB\u5373");
    setTimeout(() => doScroll("\u91CD\u8BD5"), 50);
    setTimeout(() => doScroll("\u91CD\u8BD52"), 200);
    if (threadId) {
      flashThread(this.app, threadId, 800);
    }
  }
  formatTime(iso) {
    try {
      const d = new Date(iso);
      const now = /* @__PURE__ */ new Date();
      const diff = now.getTime() - d.getTime();
      const mins = Math.floor(diff / 6e4);
      const hours = Math.floor(diff / 36e5);
      const days = Math.floor(diff / 864e5);
      if (mins < 1) return "\u521A\u521A";
      if (mins < 60) return `${mins} \u5206\u949F\u524D`;
      if (hours < 24) return `${hours} \u5C0F\u65F6\u524D`;
      if (days < 7) return `${days} \u5929\u524D`;
      return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
    } catch {
      return iso;
    }
  }
  async onClose() {
    this.contentEl.empty();
  }
  // 聚焦指定线程: 滚动到视图 + 临时高亮
  focusThread(threadId) {
    const card = this.contentEl.querySelector(
      `[data-thread-id="${threadId}"]`
    );
    if (!card) {
      this.render();
      setTimeout(() => this.focusThread(threadId), 50);
      return;
    }
    card.scrollIntoView({ behavior: "smooth", block: "center" });
    card.classList.add("feishu-comment-focused");
    setTimeout(() => card.classList.remove("feishu-comment-focused"), 1800);
  }
};

// src/http-api.ts
function offsetToPos(content, offset) {
  const before = content.slice(0, offset);
  const line = (before.match(/\n/g) || []).length;
  const lastNL = before.lastIndexOf("\n");
  return { line, ch: offset - (lastNL + 1) };
}
function normalizeWithMap(s) {
  let norm = "";
  const map = [];
  let inWs = false;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "&" && /^&nbsp;/i.test(s.slice(i, i + 6))) {
      if (!inWs) {
        norm += " ";
        map.push(i);
        inWs = true;
      }
      i += 5;
      continue;
    }
    const c = s[i];
    if (/\s/.test(c)) {
      if (!inWs) {
        norm += " ";
        map.push(i);
        inWs = true;
      }
    } else {
      norm += c;
      map.push(i);
      inWs = false;
    }
  }
  return { norm, map };
}
// 定位 quote: 先精确匹配, 失败则空白归一化匹配(容忍换行/多空格差异); 返回全部匹配位置
function listMatches(content, quote) {
  const results = [];
  let i = content.indexOf(quote);
  while (i !== -1) {
    results.push({ start: i, end: i + quote.length });
    i = content.indexOf(quote, i + 1);
  }
  if (results.length === 0) {
    const q = quote.replace(/&nbsp;/gi, " ").replace(/\s+/g, " ").trim();
    if (q) {
      const { norm, map } = normalizeWithMap(content);
      let j = norm.indexOf(q);
      while (j !== -1) {
        results.push({ start: map[j], end: map[j + q.length - 1] + 1 });
        j = norm.indexOf(q, j + 1);
      }
    }
  }
  return results;
}
function locateQuote(content, quote, occurrence) {
  return listMatches(content, quote)[occurrence - 1] || null;
}
function pickNearest(matches, aroundOffset) {
  if (!matches.length) return null;
  let best = matches[0];
  let bd = Math.abs(matches[0].start - aroundOffset);
  for (const m of matches) {
    const d = Math.abs(m.start - aroundOffset);
    if (d < bd) {
      bd = d;
      best = m;
    }
  }
  return best;
}
// 锚点解析: 优先按引用原文在当前文档中搜索(文档编辑后坐标漂移也能跟住文字)。
// found: true=按text定位成功(或无text走坐标); false=text存在但原文已变更(调用方不应画线, 避免贴错位置)
function resolveAnchorOffsets(doc, anchor) {
  const fallback = {
    start: lineChToOffset(doc, anchor.from),
    end: lineChToOffset(doc, anchor.to),
    found: true
  };
  const text = anchor && typeof anchor.text === "string" ? anchor.text : "";
  if (!text.trim()) return fallback;
  const matches = listMatches(doc.toString(), text);
  if (!matches.length) {
    return { start: fallback.start, end: fallback.end, found: false };
  }
  const best = pickNearest(matches, fallback.start);
  return { start: best.start, end: best.end, found: true };
}
// 替换核心: 在 content 中定位 anchor 引用文字并用 newText 替换, 返回新内容与新锚点坐标
function applyReplacement(content, anchor, newText) {
  const text = anchor && typeof anchor.text === "string" ? anchor.text : "";
  if (!text.trim()) return { ok: false, error: "\u951A\u70B9\u6587\u672C\u4E22\u5931\uFF0C\u65E0\u6CD5\u66FF\u6362" };
  const matches = listMatches(content, text);
  if (!matches.length) return { ok: false, error: "\u5F15\u7528\u539F\u6587\u672A\u5728\u6587\u6863\u4E2D\u627E\u5230\uFF0C\u65E0\u6CD5\u66FF\u6362" };
  const around = (() => {
    const ls = content.split("\n");
    let off = 0;
    for (let i = 0; i < ls.length; i++) {
      if (i === anchor.from.line) return off + Math.min(Math.max(0, anchor.from.ch), ls[i].length);
      off += ls[i].length + 1;
    }
    return 0;
  })();
  const m = pickNearest(matches, around);
  const newContent = content.slice(0, m.start) + newText + content.slice(m.end);
  return {
    ok: true,
    newContent,
    matchStart: m.start,
    matchEnd: m.end,
    start: m.start,
    end: m.start + newText.length,
    from: offsetToPos(newContent, m.start),
    to: offsetToPos(newContent, m.start + newText.length)
  };
}

// src/main.ts
var FeishuCommentPlugin = class extends import_obsidian3.Plugin {
  async onload() {
    this.store = new CommentStore(this);
    await this.store.load(await this.loadData());
    this.registerView(VIEW_TYPE_FEISHU_COMMENTS, (leaf) => {
      return new CommentSidebarView(leaf, this.store, this);
    });
    this.registerEditorExtension(
      createUnderlineExtension({
        getThreads: (view) => {
          let f = null;
          try {
            const info = view?.state?.facet(import_obsidian3.editorInfoField);
            if (info && info.file) f = info.file;
          } catch (e) {
          }
          if (!f) f = this.app.workspace.getActiveFile();
          if (!f || f.extension !== "md") return [];
          return this.store.getThreads(f.path);
        },
        onAnchorsShifted: (threadIds) => {
          this.schedulePersist();
          this.scheduleSidebarRefresh();
        },
        onClickThread: (threadId) => {
          void this.handleThreadClick(threadId);
        }
      })
    );
    this.registerEvent(
      this.app.workspace.on("editor-menu", (menu, editor) => {
        const sel = editor.getSelection();
        if (!sel) return;
        menu.addItem(
          (item) => item.setTitle("\u8BC4\u8BBA").setIcon("message-square").onClick(() => {
            const from = editor.getCursor("from");
            const to = editor.getCursor("to");
            new CommentInputModal(
              this.app,
              async (text) => {
                const thread = {
                  id: `ct_${Date.now()}`,
                  anchor: {
                    from: { line: from.line, ch: from.ch },
                    to: { line: to.line, ch: to.ch },
                    text: sel
                  },
                  status: "open",
                  createdAt: (/* @__PURE__ */ new Date()).toISOString(),
                  createdBy: DEFAULT_AUTHOR,
                  replies: [
                    {
                      id: `rp_${Date.now()}`,
                      author: DEFAULT_AUTHOR,
                      content: text,
                      createdAt: (/* @__PURE__ */ new Date()).toISOString()
                    }
                  ]
                };
                const file = this.app.workspace.getActiveFile();
                if (file) {
                  await this.store.addThread(file.path, thread);
                  this.bumpAndRefresh();
                }
              },
              "\u6DFB\u52A0\u8BC4\u8BBA",
              "\u8F93\u5165\u8BC4\u8BBA\u5185\u5BB9...",
              true
            ).open();
          })
        );
      })
    );
    this.registerEvent(
      this.app.workspace.on("active-leaf-change", () => {
        bumpAllEditorsVersion(this.app);
        this.refreshSidebar();
      })
    );
    this.registerEvent(
      this.app.workspace.on("file-open", () => {
        bumpAllEditorsVersion(this.app);
      })
    );
    this.addRibbonIcon("message-square", "\u98DE\u4E66\u8BC4\u8BBA", () => {
      this.activateSidebar();
    });
    this.addCommand({
      id: "open-feishu-comments-sidebar",
      name: "\u6253\u5F00\u8BC4\u8BBA\u4FA7\u8FB9\u680F",
      callback: () => this.activateSidebar()
    });
    this.addCommand({
      id: "add-comment-to-selection",
      name: "\u5BF9\u9009\u4E2D\u6587\u672C\u6DFB\u52A0\u8BC4\u8BBA",
      editorCallback: (editor) => {
        const sel = editor.getSelection();
        if (!sel) {
          new CommentInputModal(
            this.app,
            () => {
            },
            "\u8BF7\u5148\u9009\u4E2D\u6587\u5B57",
            "\u8BF7\u5148\u5728\u7F16\u8F91\u5668\u4E2D\u9009\u4E2D\u6587\u5B57\uFF0C\u518D\u6267\u884C\u6B64\u547D\u4EE4",
            false
          ).open();
          return;
        }
        const from = editor.getCursor("from");
        const to = editor.getCursor("to");
        new CommentInputModal(
          this.app,
          async (text) => {
            const thread = {
              id: `ct_${Date.now()}`,
              anchor: {
                from: { line: from.line, ch: from.ch },
                to: { line: to.line, ch: to.ch },
                text: sel
              },
              status: "open",
              createdAt: (/* @__PURE__ */ new Date()).toISOString(),
              createdBy: DEFAULT_AUTHOR,
              replies: [
                {
                  id: `rp_${Date.now()}`,
                  author: DEFAULT_AUTHOR,
                  content: text,
                  createdAt: (/* @__PURE__ */ new Date()).toISOString()
                }
              ]
            };
            const file = this.app.workspace.getActiveFile();
            if (file) {
              await this.store.addThread(file.path, thread);
              this.bumpAndRefresh();
            }
          },
          "\u6DFB\u52A0\u8BC4\u8BBA",
          "\u8F93\u5165\u8BC4\u8BBA\u5185\u5BB9...",
          true
        ).open();
      }
    });
    this.startServer();
  }
  // store 变化后: 触发装饰重建 + 刷新侧边栏
  bumpAndRefresh() {
    bumpAllEditorsVersion(this.app);
    this.refreshSidebar();
  }
  // 编辑触发的锚点平移: 节流写盘 + 节流刷新侧边栏(引用文字实时跟随)
  schedulePersist() {
    if (this.persistTimer) clearTimeout(this.persistTimer);
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null;
      void this.store.save();
    }, 800);
  }
  scheduleSidebarRefresh() {
    if (this.sidebarTimer) clearTimeout(this.sidebarTimer);
    this.sidebarTimer = setTimeout(() => {
      this.sidebarTimer = null;
      this.refreshSidebar();
    }, 300);
  }
  // 点击带下划线的文字: 打开侧边栏 + 聚焦线程 + flash 原文
  async handleThreadClick(threadId) {
    await this.activateSidebar();
    setTimeout(() => {
      const view = this.getSidebarView();
      if (view) view.focusThread(threadId);
    }, 80);
    flashThread(this.app, threadId, 800);
  }
  getSidebarView() {
    for (const leaf of this.app.workspace.getLeavesOfType(
      VIEW_TYPE_FEISHU_COMMENTS
    )) {
      const v = leaf.view;
      if (v instanceof CommentSidebarView) return v;
    }
    return null;
  }
  async activateSidebar() {
    const existing = this.app.workspace.getLeavesOfType(
      VIEW_TYPE_FEISHU_COMMENTS
    );
    if (existing.length > 0) {
      this.app.workspace.revealLeaf(existing[0]);
      return;
    }
    const leaf = this.app.workspace.getRightLeaf(false);
    if (leaf) {
      await leaf.setViewState({
        type: VIEW_TYPE_FEISHU_COMMENTS,
        active: true
      });
      this.app.workspace.revealLeaf(leaf);
    }
  }
  refreshSidebar() {
    for (const leaf of this.app.workspace.getLeavesOfType(
      VIEW_TYPE_FEISHU_COMMENTS
    )) {
      const view = leaf.view;
      if (view instanceof CommentSidebarView) {
        view.render();
      }
    }
  }
  startServer() {
    try {
      const http = require("http");
      const self = this;
      this.server = http.createServer(function(req, res) {
        self.handleRequest(req, res).catch((e) => {
          console.error("[feishu-comment] request error:", e);
          try {
            res.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
            res.end(JSON.stringify({ ok: false, error: String(e && e.message || e) }));
          } catch (e2) {
          }
        });
      });
      this.server.on("error", (e) => {
        console.error("[feishu-comment] HTTP server error:", e.message);
      });
      this.server.listen(27240, "127.0.0.1", () => {
        console.log("[feishu-comment] API ready: http://127.0.0.1:27240");
      });
    } catch (e) {
      console.error("[feishu-comment] failed to start HTTP server:", e);
    }
  }
  async handleRequest(req, res) {
    const sendJson = (code, obj) => {
      res.writeHead(code, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify(obj));
    };
    let url;
    try {
      url = new URL(req.url, "http://127.0.0.1");
    } catch {
      return sendJson(400, { ok: false, error: "bad url" });
    }
    if (req.method === "GET" && url.pathname === "/health") {
      return sendJson(200, { ok: true, plugin: "feishu-comment", version: "0.6.0" });
    }
    if (req.method === "GET" && url.pathname === "/comments") {
      const f = url.searchParams.get("file") || "";
      const file = this.resolveFile(f);
      if (!file) return sendJson(404, { ok: false, error: "file not found: " + f });
      return sendJson(200, { ok: true, file: file.path, threads: this.store.getThreads(file.path) });
    }
    if (req.method === "POST" && url.pathname === "/comment") {
      let raw = "";
      req.on("data", (c) => {
        raw += c;
      });
      req.on("end", () => {
        try {
          const body = JSON.parse(raw || "{}");
          void this.handleAddComment(body, sendJson);
        } catch (e) {
          sendJson(400, { ok: false, error: "bad json: " + e.message });
        }
      });
      return;
    }
    if (req.method === "DELETE" && url.pathname === "/comment") {
      const f = url.searchParams.get("file") || "";
      const threadId = url.searchParams.get("threadId") || "";
      const file = this.resolveFile(f);
      if (!file) return sendJson(404, { ok: false, error: "file not found: " + f });
      if (!threadId) return sendJson(400, { ok: false, error: "threadId is required" });
      const threads = this.store.getThreads(file.path);
      if (!threads.some((t) => t.id === threadId)) {
        return sendJson(404, { ok: false, error: "thread not found: " + threadId + " in " + file.path });
      }
      await this.store.deleteThread(file.path, threadId);
      this.bumpAndRefresh();
      return sendJson(200, { ok: true, file: file.path, deleted: threadId });
    }
    if (req.method === "PATCH" && url.pathname === "/thread") {
      const f = url.searchParams.get("file") || "";
      const threadId = url.searchParams.get("threadId") || "";
      const status = url.searchParams.get("status") || "";
      const file = this.resolveFile(f);
      if (!file) return sendJson(404, { ok: false, error: "file not found: " + f });
      const threads = this.store.getThreads(file.path);
      if (!threads.some((t) => t.id === threadId)) {
        return sendJson(404, { ok: false, error: "thread not found: " + threadId + " in " + file.path });
      }
      if (status !== "resolved" && status !== "reopened") {
        return sendJson(400, { ok: false, error: "status must be resolved or reopened" });
      }
      await this.store.updateThread(file.path, threadId, { status });
      this.bumpAndRefresh();
      return sendJson(200, { ok: true, file: file.path, threadId, status });
    }
    if (req.method === "DELETE" && url.pathname === "/reply") {
      const f = url.searchParams.get("file") || "";
      const threadId = url.searchParams.get("threadId") || "";
      const replyId = url.searchParams.get("replyId") || "";
      const file = this.resolveFile(f);
      if (!file) return sendJson(404, { ok: false, error: "file not found: " + f });
      const thread = this.store.getThreads(file.path).find((t) => t.id === threadId);
      if (!thread) return sendJson(404, { ok: false, error: "thread not found: " + threadId + " in " + file.path });
      if (!thread.replies.some((r) => r.id === replyId)) {
        return sendJson(404, { ok: false, error: "reply not found: " + replyId });
      }
      await this.store.deleteReply(file.path, threadId, replyId);
      this.bumpAndRefresh();
      return sendJson(200, { ok: true, file: file.path, threadId, deleted: replyId });
    }
    if ((req.method === "PATCH" && url.pathname === "/reply") || (req.method === "POST" && url.pathname === "/replace")) {
      let raw = "";
      req.on("data", (c) => {
        raw += c;
      });
      req.on("end", () => {
        try {
          const body = JSON.parse(raw || "{}");
          void this.handleReplyOp(req.method === "PATCH" ? "PATCH" : "REPLACE", body, sendJson);
        } catch (e) {
          sendJson(400, { ok: false, error: "bad json: " + e.message });
        }
      });
      return;
    }
    sendJson(404, { ok: false, error: "not found" });
  }
  async handleReplyOp(op, body, sendJson) {
    const file = this.resolveFile(typeof body.file === "string" ? body.file : "");
    if (!file) return sendJson(404, { ok: false, error: "file not found: " + (body.file || "<active file>") });
    const threadId = typeof body.threadId === "string" ? body.threadId.trim() : "";
    const replyId = typeof body.replyId === "string" ? body.replyId.trim() : "";
    const thread = this.store.getThreads(file.path).find((t) => t.id === threadId);
    if (!thread) return sendJson(404, { ok: false, error: "thread not found: " + threadId + " in " + file.path });
    const reply = thread.replies.find((r) => r.id === replyId);
    if (!reply) return sendJson(404, { ok: false, error: "reply not found: " + replyId + " in thread " + threadId });
    if (op === "PATCH") {
      const hasContent = typeof body.content === "string" && body.content.trim();
      if (!hasContent && typeof body.resolved !== "boolean") {
        return sendJson(400, { ok: false, error: "content or resolved is required" });
      }
      if (hasContent) reply.content = body.content.trim();
      if (typeof body.resolved === "boolean") reply.resolved = body.resolved;
      await this.store.save();
      this.bumpAndRefresh();
      return sendJson(200, { ok: true, file: file.path, threadId, replyId });
    }
    const res = await this.replaceOriginal(file.path, thread, reply);
    if (!res.ok) return sendJson(400, { ok: false, error: res.error });
    this.bumpAndRefresh();
    return sendJson(200, { ok: true, file: file.path, threadId, replyId, replacedWith: (reply.content || "").replace(/\s+$/, "") });
  }
  async handleAddComment(body, sendJson) {
    const quote = typeof body.quote === "string" ? body.quote.trim() : "";
    const comment = typeof body.comment === "string" ? body.comment.trim() : "";
    if (!quote) return sendJson(400, { ok: false, error: "quote is required" });
    if (!comment) return sendJson(400, { ok: false, error: "comment is required" });
    const file = this.resolveFile(typeof body.file === "string" ? body.file : "");
    if (!file) return sendJson(404, { ok: false, error: "file not found: " + (body.file || "<active file>") });
    const content = await this.app.vault.read(file);
    const occ = Math.max(1, parseInt(body.occurrence, 10) || 1);
    const match = locateQuote(content, quote, occ);
    if (!match) {
      return sendJson(404, { ok: false, error: "quote not found in " + file.path + " (occurrence " + occ + ")", hint: "quote must be a verbatim snippet from the file" });
    }
    const from = offsetToPos(content, match.start);
    const to = offsetToPos(content, match.end);
    const anchorText = content.slice(match.start, match.end);
    const author = typeof body.author === "string" && body.author.trim() ? body.author.trim() : "WorkBuddy";
    const now = new Date().toISOString();
    const wantThreadId = typeof body.threadId === "string" ? body.threadId.trim() : "";
    if (wantThreadId || body.merge === true) {
      const threads = this.store.getThreads(file.path);
      let target = null;
      if (wantThreadId) {
        target = threads.find((t) => t.id === wantThreadId) || null;
        if (!target) return sendJson(404, { ok: false, error: "thread not found: " + wantThreadId + " in " + file.path });
      } else {
        target = threads.find((t) => t.status !== "resolved" && t.anchor.text === anchorText) || null;
      }
      if (target) {
        const reply = { id: "rp_" + Date.now(), author, content: comment, createdAt: now };
        await this.store.addReply(file.path, target.id, reply);
        this.bumpAndRefresh();
        return sendJson(200, { ok: true, file: file.path, threadId: target.id, merged: true });
      }
    }
    const thread = {
      id: "ct_" + Date.now(),
      anchor: { from, to, text: anchorText },
      status: "open",
      createdAt: now,
      createdBy: author,
      replies: [{ id: "rp_" + Date.now(), author, content: comment, createdAt: now }]
    };
    await this.store.addThread(file.path, thread);
    this.bumpAndRefresh();
    if (body.open === true) {
      try {
        const leaf = this.app.workspace.getLeaf(false);
        if (leaf) {
          await leaf.openFile(file);
          this.bumpAndRefresh();
        }
      } catch (e) {
      }
    }
    sendJson(200, { ok: true, file: file.path, threadId: thread.id, from, to });
  }
  resolveFile(fileStr) {
    const s = (fileStr || "").trim();
    if (!s) return this.app.workspace.getActiveFile();
    let f = this.app.vault.getAbstractFileByPath(s);
    if (f && "stat" in f) return f;
    if (!s.toLowerCase().endsWith(".md")) {
      f = this.app.vault.getAbstractFileByPath(s + ".md");
      if (f && "stat" in f) return f;
    }
    const lower = s.toLowerCase().replace(/\.md$/, "");
    const all = this.app.vault.getMarkdownFiles();
    return all.find((p) => p.path.toLowerCase().replace(/\.md$/, "") === lower) || all.find((p) => p.basename.toLowerCase().replace(/\.md$/, "") === lower) || all.find((p) => p.path.toLowerCase().endsWith("/" + lower)) || null;
  }
  // 把评论内容替换进原文锚点位置 (AI 修改示意 → 人工确认 → 落文)
  async replaceOriginal(filePath, thread, reply) {
    const newText = (reply.content || "").replace(/\s+$/, "");
    if (!newText.trim()) return { ok: false, error: "\u8BC4\u8BBA\u5185\u5BB9\u4E3A\u7A7A\uFF0C\u65E0\u6CD5\u66FF\u6362" };
    try {
      const leaf = this.app.workspace.getLeavesOfType("markdown").find((l) => l.view?.file?.path === filePath);
      const editor = leaf?.view?.editor;
      if (editor) {
        const doc = editor.cm.state.doc;
        const r = applyReplacement(doc.toString(), thread.anchor, newText);
        if (!r.ok) return r;
        editor.replaceRange(newText, editor.offsetToPos(r.matchStart), editor.offsetToPos(r.matchEnd));
        thread.anchor.from = editor.offsetToPos(r.start);
        thread.anchor.to = editor.offsetToPos(r.end);
        thread.anchor.text = newText;
        this.bumpAndRefresh();
      } else {
        const file = this.app.vault.getAbstractFileByPath(filePath);
        if (!file) return { ok: false, error: "\u627E\u4E0D\u5230\u6587\u4EF6: " + filePath };
        const content = await this.app.vault.read(file);
        const r = applyReplacement(content, thread.anchor, newText);
        if (!r.ok) return r;
        await this.app.vault.modify(file, r.newContent);
        thread.anchor.from = r.from;
        thread.anchor.to = r.to;
        thread.anchor.text = newText;
        this.bumpAndRefresh();
      }
      await this.store.save();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: String(e && e.message || e) };
    }
  }
  async onunload() {
    if (this.persistTimer) {
      clearTimeout(this.persistTimer);
      this.persistTimer = null;
      try {
        await this.store.save();
      } catch (e) {
      }
    }
    if (this.sidebarTimer) {
      clearTimeout(this.sidebarTimer);
      this.sidebarTimer = null;
    }
    if (this.server) {
      try {
        this.server.close();
      } catch (e) {
      }
    }
  }
};
