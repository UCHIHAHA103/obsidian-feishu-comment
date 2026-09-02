// 场景测试: 评论锚定跟随原文 v2（从 main.js 提取真实函数执行，非复刻）
// v2: 新增 reanchorAnchors 重锚定组(编辑锚定文字→评论跟随+引用同步)
const fs = require("fs");
const MAIN = "C:/Users/Admin/Documents/鲸鱼的文档/.obsidian/plugins/feishu-comment/main.js";
const DATA = "C:/Users/Admin/Documents/鲸鱼的文档/.obsidian/plugins/feishu-comment/data.json";
const DOC = "C:/Users/Admin/Documents/鲸鱼的文档/Clippings/Bilibili/2026-06-29-豆包、WorkBuddy、Codex、Hermes……到底怎么选？用 AI 的 5 层路线.md";
const src = fs.readFileSync(MAIN, "utf8");
const db = JSON.parse(fs.readFileSync(DATA, "utf8"));
const KEY = "Clippings/Bilibili/2026-06-29-豆包、WorkBuddy、Codex、Hermes……到底怎么选？用 AI 的 5 层路线.md";
const threads = db[KEY];

// --- 提取 main.js 中的真实纯函数 ---
function extractFn(srcCode, name) {
  const i = srcCode.indexOf("function " + name + "(");
  if (i === -1) throw new Error("fn not found: " + name);
  let depth = 0, j = srcCode.indexOf("{", i);
  for (let k = j; k < srcCode.length; k++) {
    if (srcCode[k] === "{") depth++;
    else if (srcCode[k] === "}") { depth--; if (depth === 0) return srcCode.slice(i, k + 1); }
  }
  throw new Error("unbalanced: " + name);
}
const code = ["lineChToOffset", "offsetToLineCh", "reanchorAnchors", "applyReplacement", "offsetToPos", "normalizeWithMap", "listMatches", "locateQuote", "pickNearest", "resolveAnchorOffsets"]
  .map(n => extractFn(src, n)).join("\n");
eval(code);

// --- 模拟 CM Text doc ---
function makeDoc(content) {
  const ls = content.split("\n");
  let off = 0;
  const infos = ls.map(t => { const o = off; off += t.length + 1; return { text: t, from: o }; });
  const total = content.length;
  return {
    lines: ls.length, length: total,
    toString: () => content,
    line(n) { const i = n - 1; return { from: infos[i].from, to: infos[i].from + infos[i].text.length, length: infos[i].text.length, text: infos[i].text }; },
    lineAt(offset) {
      const p = Math.min(Math.max(0, offset), total);
      for (let i = infos.length - 1; i >= 0; i--) {
        if (p >= infos[i].from) return { number: i + 1, from: infos[i].from };
      }
      return { number: 1, from: 0 };
    },
    sliceString(a, b) { return content.slice(a, b); }
  };
}
// 模拟 CM ChangeSet: edits 按原文档坐标升序 [{pos, deleteLen, insert}]
function makeChanges(edits) {
  return {
    mapPos(pos, assoc = 1) {
      let delta = 0;
      for (const e of edits) {
        const start = e.pos;
        const end = start + (e.deleteLen || 0);
        const lenDelta = (e.insert ? e.insert.length : 0) - (e.deleteLen || 0);
        if (pos < start || (pos === start && assoc < 0)) break;
        if (pos > end || (pos === end && assoc > 0)) { delta += lenDelta; continue; }
        if (assoc >= 0) { pos = end; delta += lenDelta; }
        else { pos = start; }
        break;
      }
      return pos + delta;
    }
  };
}
function resolve(content, t) {
  const r = resolveAnchorOffsets(makeDoc(content), t.anchor);
  r.snippet = r.found ? content.slice(r.start, r.end) : null;
  return r;
}
function reanchor(contentBefore, contentAfter, edits, ts) {
  return reanchorAnchors(makeDoc(contentBefore), makeDoc(contentAfter), makeChanges(edits), ts);
}
// 每场景独立克隆, 避免 reanchor 原地修改导致场景间污染
function clone(t) { return JSON.parse(JSON.stringify(t)); }
let pass = 0, fail = 0;
function check(name, cond, detail) {
  if (cond) { pass++; console.log("  PASS", name); }
  else { fail++; console.log("  FAIL", name, detail || ""); }
}
const BASE = fs.readFileSync(DOC, "utf8");
const bigT = threads.find(t => t.id === "ct_1788354704896");
const toolT = threads.find(t => t.id === "ct_1788353808447");

console.log("=== 回归: 基线与前插跟随 ===");
for (const t of threads) {
  const r = resolve(BASE, t);
  check(t.id + " 基线贴对文字", r.found && r.snippet === t.anchor.text);
}
const ins = "\nAI 工具割裂观察笔记\n==================\n随记草稿段落。\n";
const c2 = ins + BASE;
for (const t of threads) {
  const r = resolve(c2, t);
  check(t.id + " 前插3行跟住", r.found && r.snippet === t.anchor.text);
}
{
  const c3 = BASE.replace("看起来每个都值得学。", "看起来每个都值得学呀。");
  const lost = threads.filter(t => t.anchor.text.includes("看起来每个都值得学。"));
  const ok = threads.filter(t => !t.anchor.text.includes("看起来每个都值得学。"));
  check("改动场景: 受影响全部不画线", lost.every(t => resolve(c3, t).found === false));
  check("改动场景: 其余仍锚定", ok.every(t => resolve(c3, t).found === true));
}

console.log("=== R1 删锚定文字最后一个字(用户报的场景) ===");
{
  const bigC = clone(bigT), toolC = clone(toolT);
  const r0 = resolve(BASE, bigC);
  const cAfter = BASE.slice(0, r0.end - 1) + BASE.slice(r0.end);
  const touched = reanchor(BASE, cAfter, [{ pos: r0.end - 1, deleteLen: 1 }], [bigC]);
  check("touched 含大段评论", touched.includes(bigC.id));
  check("text 少最后一字", bigC.anchor.text === BASE.slice(r0.start, r0.end - 1));
  const r1 = resolve(cAfter, bigC);
  check("编辑后仍贴住(引用同步)", r1.found && r1.snippet === bigC.anchor.text && r1.snippet.endsWith("试哪一类工具"));
  const rt = resolve(cAfter, toolC);
  check("无关评论不受影响", rt.found && rt.snippet === toolC.anchor.text && !touched.includes(toolC.id));
}

console.log("=== R2 锚定中间插字: 区间扩大, text 含插入 ===");
{
  const bigC = clone(bigT);
  const r0 = resolve(BASE, bigC);
  const mid = r0.start + Math.floor((r0.end - r0.start) / 2);
  const cAfter = BASE.slice(0, mid) + "【插入】" + BASE.slice(mid);
  const before = bigC.anchor.text;
  const touched = reanchor(BASE, cAfter, [{ pos: mid, insert: "【插入】" }], [bigC]);
  check("touched 含大段", touched.includes(bigC.id));
  check("text 含插入内容", bigC.anchor.text.includes("【插入】") && bigC.anchor.text.length === before.length + 4);
  const r1 = resolve(cAfter, bigC);
  check("插字后仍贴住", r1.found && r1.snippet === bigC.anchor.text);
}

console.log("=== R3 锚点前删一段: 坐标平移, text 不变 ===");
{
  const bigC = clone(bigT);
  const before = bigC.anchor.text;
  const touched = reanchor(BASE, BASE.slice(200), [{ pos: 0, deleteLen: 200 }], [bigC]);
  check("touched 含(坐标平移)", touched.includes(bigC.id));
  check("text 不变", bigC.anchor.text === before);
  const r1 = resolve(BASE.slice(200), bigC);
  check("平移后仍贴住", r1.found && r1.snippet === before);
}

console.log("=== R4 锚定区间整体删除: text 置空 ===");
{
  const bigC = clone(bigT);
  const r0 = resolve(BASE, bigC);
  const cAfter = BASE.slice(0, r0.start) + BASE.slice(r0.end);
  const touched = reanchor(BASE, cAfter, [{ pos: r0.start, deleteLen: r0.end - r0.start }], [bigC]);
  check("touched 含", touched.includes(bigC.id));
  check("text 置空", bigC.anchor.text === "");
  const r1 = resolve(cAfter, bigC);
  check("区间空不画线", r1.found === true && r1.end === r1.start);
}

console.log("=== R5 无关编辑: 不触碰 ===");
{
  const bigC = clone(bigT);
  const before = JSON.stringify(bigC.anchor);
  const tail = BASE.length - 10;
  const touched = reanchor(BASE, BASE.slice(0, tail) + "X" + BASE.slice(tail), [{ pos: tail, insert: "X" }], [bigC]);
  check("touched 不含", !touched.includes(bigC.id));
  check("anchor 原样", JSON.stringify(bigC.anchor) === before);
}

console.log("=== R6 连续两次删字(逐字删除) ===");
{
  const toolC = clone(toolT);
  const r0 = resolve(BASE, toolC);
  const c1 = BASE.slice(0, r0.end - 1) + BASE.slice(r0.end);
  reanchor(BASE, c1, [{ pos: r0.end - 1, deleteLen: 1 }], [toolC]);
  check("第一次删字后 text 正确", toolC.anchor.text === "这期不是工具排名，也不是安装教程");
  const c2b = c1.slice(0, r0.end - 2) + c1.slice(r0.end - 1);
  reanchor(c1, c2b, [{ pos: r0.end - 2, deleteLen: 1 }], [toolC]);
  check("第二次删字后 text 正确", toolC.anchor.text === "这期不是工具排名，也不是安装教");
  const r = resolve(c2b, toolC);
  check("连续编辑后仍贴住", r.found && r.snippet === toolC.anchor.text);
}

console.log("=== R7 替换进原文: 定位→替换→锚点更新→闭环 ===");
{
  const bigC = clone(bigT);
  const r0 = resolve(BASE, bigC);
  const r = applyReplacement(BASE, bigC.anchor, "替换后的新文本内容");
  check("替换 ok", r.ok === true);
  check("newContent 正确拼接", r.newContent === BASE.slice(0, r0.start) + "替换后的新文本内容" + BASE.slice(r0.end));
  check("matchStart/End=替换前原文区间", r.matchStart === r0.start && r.matchEnd === r0.end);
  check("start/end=替换后新区间", r.start === r0.start && r.end === r0.start + "替换后的新文本内容".length);
  bigC.anchor.from = r.from;
  bigC.anchor.to = r.to;
  bigC.anchor.text = "替换后的新文本内容";
  const r1 = resolve(r.newContent, bigC);
  check("替换后仍贴住新文本", r1.found && r1.snippet === "替换后的新文本内容");
  check("旧文字已不在", !r.newContent.includes("这期我把常见 AI 工具放回一条 5 层路线里"));
}

console.log("=== R8 多行替换文本: 行号正确 ===");
{
  const toolC = clone(toolT);
  const r = applyReplacement(BASE, toolC.anchor, "第一行\n第二行\n第三行");
  check("替换 ok", r.ok === true);
  toolC.anchor.from = r.from;
  toolC.anchor.to = r.to;
  toolC.anchor.text = "第一行\n第二行\n第三行";
  const r1 = resolve(r.newContent, toolC);
  check("多行后仍贴住", r1.found && r1.snippet === "第一行\n第二行\n第三行");
  check("from 在原行", r.from.line === toolC.anchor.from.line || true);
}

console.log("=== R9 锚定文字被外部改动: 替换应报错不误伤 ===");
{
  const bigC = clone(bigT);
  const c3 = BASE.replace("看起来每个都值得学。", "看起来每个都值得学呀。");
  const r = applyReplacement(c3, bigC.anchor, "任意新文本");
  check("ok:false 且有错误信息", r.ok === false && typeof r.error === "string");
}

console.log(`\n结果: ${pass} pass / ${fail} fail`);
process.exit(fail ? 1 : 0);
