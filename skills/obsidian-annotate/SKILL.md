---
name: obsidian-annotate
description: "通过本地 HTTP API 对 Obsidian 文档做 AI 划词批注（下划线评论，跟随原文）。当用户要求对 Obsidian 里的文档/笔记进行批注、评论、review、给修改意见时使用本 skill，例如「帮我批注这篇文档」「给这份笔记提修改意见」。依赖：Obsidian 运行中且 feishu-comment 插件已启用。"
agent_created: true
---

# Obsidian AI 划词批注

对 Obsidian vault 内的 Markdown 文档下发"划词评论"：评论钉在具体句子上（下划线 + 侧边栏线程），且用户后续编辑文字时评论自动跟随原文。AI 只发 HTTP 请求，不动文档内容。

## 前置检查

先探活，失败则停下告知用户「Obsidian 未运行或 feishu-comment 插件未启用」，不要重试轰炸：

```bash
curl -s -m 3 http://127.0.0.1:27240/health
# 期望: {"ok":true,"plugin":"feishu-comment",...}
```

## API 契约

| 端点 | 说明 |
|---|---|
| `POST /comment` | 对文档局部句子下评论 |
| `GET /comments?file=<路径>` | 读某文档全部评论 |
| `DELETE /comment?file=<路径>&threadId=<id>` | 删除一条评论（发错自纠用） |
| `GET /health` | 探活 |

`POST /comment` body（JSON）：

| 字段 | 必填 | 说明 |
|---|---|---|
| `file` | 否 | vault 内相对路径或文件名（支持模糊匹配）；省略 = 当前活动文件 |
| `quote` | 是 | 要评论的原文片段，必须逐字来自文档 |
| `comment` | 是 | 评论内容 |
| `author` | 否 | 默认 `WorkBuddy` |
| `occurrence` | 否 | quote 出现多次时指定第 N 处（默认 1） |
| `open` | 否 | `true` 时在 Obsidian 中打开该文件 |

成功返回 `{"ok":true,"threadId":"...","from":...,"to":...}`；quote 找不到返回 404 + hint。

## 批注工作流

1. **先读文件**：用 Read 工具读目标 md 的绝对路径（本机默认 vault：`C:\Users\Admin\Documents\鲸鱼的文档\<相对路径>`；其他环境替换为实际 vault 路径）。
2. **逐条下发**：一个修改点一条评论，逐条 curl：

```bash
curl -s -X POST http://127.0.0.1:27240/comment \
  -H "Content-Type: application/json" \
  -d '{"file":"<vault相对路径>","quote":"<原文片段>","comment":"<批注>","author":"WorkBuddy"}'
```

3. **失败处理**：404（quote 未命中）→ 对照原文调整 quote 重试；确认不再需要的错误评论用 DELETE 删除，不要留给用户手动清。
4. **收尾**：汇总批注条数，告知用户在 Obsidian 编辑器看下划线、在右侧「飞书评论」侧边栏回复/标解决。

## 关键规则

- `quote` 必须从 Read 到的内容**逐字复制**（含标点、全半角、空格）；禁止改写、禁止用省略号截断。空白/换行差异与 `&nbsp;` 实体会被自动容忍。
- 批注内容要具体可执行：指出问题 + 给出修改建议，不写「这里不好」式的空话。
- 评论跟随原文：用户随后增删文字，下划线与引用文字自动同步，AI 无需干预；只有文档被外部程序整体改动导致引用失效时，侧边栏会标「原文已变更」。

## 边界

- 服务只绑 `127.0.0.1`：agent 必须与 Obsidian 同机，无鉴权，勿暴露到局域网。
- Obsidian 阅读视图（非编辑模式）看不到下划线，提醒用户切到编辑模式。
- 单条评论、批量批注均逐条调用即可，无需并发。
