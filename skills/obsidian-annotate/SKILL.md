---
name: obsidian-annotate
description: "通过本地 HTTP API 对 Obsidian 文档做 AI 建议式批注（划词评论，跟随原文）。AI 阅读文档后不直接修改原文，而是给出修改建议和可直接替换落文的修改示意，用户人工判断后一键替换。当用户要求对 Obsidian 里的文档/笔记进行批注、评论、review、给修改意见时使用本 skill，例如「帮我批注这篇文档」「给这份笔记提修改意见」。依赖：Obsidian 运行中且 feishu-comment 插件已启用。"
agent_created: true
---

# Obsidian AI 建议式批注

对 Obsidian vault 内的 Markdown 文档下发"划词评论"。**核心原则：AI 不直接修改原文**——阅读全文后给出建议，每个修改点由「1 条说明 + 1~3 条修改示意」组成，用户人工判断后点示意图的「替换进原文」一键落文（不达标可先「编辑」示意再替换）。

## 前置检查

先探活，失败则停下告知用户「Obsidian 未运行或 feishu-comment 插件未启用」，不要重试轰炸：

```bash
curl -s -m 3 http://127.0.0.1:27240/health
# 期望: {"ok":true,"plugin":"feishu-comment",...}
```

## API 契约（插件 >= 0.6.0）

| 端点 | 说明 |
|---|---|
| `POST /comment` | 下发评论（body 可带 `threadId`/`merge` 并入已有线程） |
| `GET /comments?file=<路径>` | 读某文档全部线程（含 anchor/status/replies） |
| `DELETE /comment?file=<路径>&threadId=<id>` | 删除整条评论线程（发错自纠用） |
| `PATCH /thread?file=<路径>&threadId=<id>&status=resolved\|reopened` | 解决 / 重开线程 |
| `PATCH /reply` | 编辑回复：body `{file, threadId, replyId, content?, resolved?}`（content 与 resolved 至少一项） |
| `DELETE /reply?file=<路径>&threadId=<id>&replyId=<rid>` | 删除单条回复 |
| `POST /replace` | 替换进原文：body `{file, threadId, replyId}`，把该回复内容落文（等同 UI 的「替换进原文」） |
| `GET /health` | 探活（返回插件版本号） |

`POST /comment` body（JSON）：

| 字段 | 必填 | 说明 |
|---|---|---|
| `file` | 否 | vault 内相对路径或文件名（支持模糊匹配）；省略 = 当前活动文件 |
| `quote` | 是 | 要评论的原文片段，必须逐字来自文档 |
| `comment` | 是 | 评论内容 |
| `author` | 否 | 默认 `WorkBuddy` |
| `occurrence` | 否 | quote 出现多次时指定第 N 处（默认 1） |
| `open` | 否 | `true` 时在 Obsidian 中打开该文件 |
| `merge` | 否 | `true` 时若同文件同 quote 同 occurrence 已有未解决线程，自动追加为该线程的回复；不存在则新建线程 |
| `threadId` | 否 | 显式指定追加到的线程 ID（优先级高于 merge） |

成功返回 `{"ok":true,"threadId":"...","from":...,"to":...}`；合并到已有线程时额外返回 `"merged":true`。quote 找不到返回 404 + hint。

## 评论管理操作（curl 速查）

```bash
# 解决 / 重开线程
curl -s -X PATCH "http://127.0.0.1:27240/thread?file=<file>&threadId=<tid>&status=resolved"

# 编辑回复内容 / 标记已解决
curl -s -X PATCH http://127.0.0.1:27240/reply -H "Content-Type: application/json" \
  -d '{"file":"<file>","threadId":"<tid>","replyId":"<rid>","content":"新内容","resolved":true}'

# 删除单条回复
curl -s -X DELETE "http://127.0.0.1:27240/reply?file=<file>&threadId=<tid>&replyId=<rid>"

# 替换进原文（把回复内容落文）
curl -s -X POST http://127.0.0.1:27240/replace -H "Content-Type: application/json" \
  -d '{"file":"<file>","threadId":"<tid>","replyId":"<rid>"}'
```

管理操作规范：
- 发错评论自纠优先级：改内容用 PATCH /reply，单条作废用 DELETE /reply，整组作废用 DELETE /comment。不要留给用户手动清。
- `POST /replace` 会**直接修改原文**。建议式批注工作流中 AI **不得主动调用**——替换落文是用户人工判断后的动作；仅当用户明确指示（如"把第 N 条示意落文"）才可执行。

## 批注工作流（建议式）

整体流程：**AI 阅读全文 → 每个修改点下发「说明 + 修改示意」→ 用户人工判断 → 点示意图的「替换进原文」落文**。AI 全程不改原文。

1. **先读文件**：用 Read 工具读目标 md 的绝对路径（本机默认 vault：`C:\Users\Admin\Documents\鲸鱼的文档\<相对路径>`；其他环境替换为实际 vault 路径）。
2. **通读找修改点**：定位需要改进的句子/段落。是"找问题"，不是全文重写；没问题的地方不要硬凑建议。
3. **每个修改点下发一组评论**（同一段原文共用一个线程：同 quote 同 occurrence，带 `merge:true` 自动并入同一线程成为多条回复）：
   - **第 1 条：说明**（给人看的）——直接写这段话有什么问题、应该怎么改（可含理由与方向），不加前缀、不加包裹。
   - **第 2 条起：修改示意**（可落文的）——**纯正文**，直接放修改后的内容，用户会点这条的「替换进原文」逐字写入原文。
4. **批量下发**（推荐固化脚本，自动 merge + 404 定位 + 回读验证）：

```bash
# items 为 JSON 数组：[{"quote":"...","comment":"..."},...]（可选 author/occurrence 字段）
"C:/Users/Admin/.workbuddy/binaries/python/versions/3.13.12/python.exe" \
  "C:/Users/Admin/.workbuddy/skills/obsidian-annotate/scripts/post_comments.py" \
  --file "<vault相对路径>" < items.json
```

或逐条 curl（注意带 `merge:true`，否则同 quote 会散成多个独立线程）：

```bash
curl -s -X POST http://127.0.0.1:27240/comment \
  -H "Content-Type: application/json" \
  -d '{"file":"<vault相对路径>","quote":"<原文片段>","comment":"<评论内容>","author":"WorkBuddy","merge":true}'
```

5. **失败处理**：404（quote 未命中）→ 对照原文调整 quote 重试；确认不再需要的错误评论用 DELETE 删除，不要留给用户手动清。
6. **收尾**：汇总修改点数量与方案分布（如"3 处修改点，其中 1 处给了 2 个方案"），提示用户在「飞书评论」侧边栏：点示意图的「替换进原文」落文（原文字段级替换、下划线跟随新文本、编辑器内可撤销）；不达标先点「编辑」改示意再替换；处理完点「解决」归档。

## 回复结构规范

一个修改点的评论组（同 quote 同 occurrence，先后 POST）。标准样例（转写稿错别字修改场景）：

```
评论 1: 此次有错别字，建议删减，同时语气可以委婉一下，和前文呼应
评论 2: **说话人7**： 偶有简短，测试一下
评论 3: **说话人7**： 现场比较激烈，测试一下
```

- 评论 1 = 修改说明：直接写这段话有什么问题、应该怎么改（可含理由与方向），**不加前缀、不加包裹**。
- 评论 2/3 = 修改示意：**纯正文**，用户点「替换进原文」时逐字写入原文；严禁「以下是修改示意」「修改示意：」「新的表述：」等任何包裹语。
- 示意保留原文 md 结构：样例中 `**说话人7**： ` 粗体说话人前缀原样保留，只改正文部分。
- 示意最多 3 条（即方案 1/2/3）；单方案时「1 说明 + 1 示意」两条即可。

## 示意正文规范（替换即落文）

- **保留 md 源码语法**：Read 到的是源码，示意必须用同样的源码语法。例：原文是 `**测试：** 第一次测试`，结构为「粗体结论：具体内容」，则示意必须写成 `**测试：** <新内容>`——粗体、冒号、结构原样保留，只换需要换的词句。
- **无损修改**：框架、列表层级、语气、标点风格与原文一致；结合上下文语义衔接，改完读起来像原文自己的话，不破坏原结构。
- **与 quote 对齐**：示意是 quote 那段文字的改写版，二者结构一一对应；quote 只圈需要改的最小片段（一句话/一小段），不要把无关内容圈进来。
- 示意若含换行（多段落改写），替换会连段落结构一起写入，确保这正是用户想要的。

## 关键规则

- `quote` 必须从 Read 到的内容**逐字复制**（含标点、全半角、空格、md 标记）；禁止改写、禁止用省略号截断。空白/换行差异与 `&nbsp;` 实体会被自动容忍。
- 说明要具体可执行：指出问题 + 给出方向，不写「这里不好」式的空话；AI 的判断标注为建议，最终以用户判断为准。
- 评论跟随原文：用户随后增删文字，下划线与引用文字自动同步，AI 无需干预；只有文档被外部程序整体改动导致引用失效时，侧边栏会标「原文已变更」。
- 同 quote 带 `merge:true` 的多条评论自动合并为一个线程（1 条原文下挂多条回复）；若线程已全部被「解决」，后续评论会新建线程。

## 边界

- 服务只绑 `127.0.0.1`：agent 必须与 Obsidian 同机，无鉴权，勿暴露到局域网。
- Obsidian 阅读视图（非编辑模式）看不到下划线，提醒用户切到编辑模式。
- 单条评论、批量批注均逐条调用即可，无需并发。
