# -*- coding: utf-8 -*-
"""obsidian-annotate 批量下发评论固化脚本（配套 feishu-comment 插件 >= 0.5.0）

用法：
  python post_comments.py --file "<vault相对路径>" < items.json

items.json 为 JSON 数组，每项:
  {"quote": "<原文片段>", "comment": "<评论内容>", "author": "WorkBuddy", "occurrence": 1}

行为：逐条 POST /comment（带 merge:true，同 quote 自动并入同一线程）；
失败项打印 quote 预览便于定位；结束后 GET /comments 回读汇总。
任一失败则退出码 1。
"""
import argparse
import json
import sys
import urllib.request
import urllib.parse

API = "http://127.0.0.1:27240"


def post_comment(file_path, item, author, api):
    body = {
        "file": file_path,
        "quote": item["quote"],
        "comment": item["comment"],
        "author": item.get("author", author),
        "merge": True,
    }
    if item.get("occurrence"):
        body["occurrence"] = int(item["occurrence"])
    if item.get("threadId"):
        body["threadId"] = item["threadId"]
    req = urllib.request.Request(
        api + "/comment",
        data=json.dumps(body).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return resp.status, json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode("utf-8"))


def read_threads(file_path, api):
    q = urllib.parse.quote(file_path, safe="")
    with urllib.request.urlopen(f"{api}/comments?file={q}", timeout=10) as resp:
        return json.loads(resp.read().decode("utf-8"))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--file", required=True, help="vault 内相对路径或文件名")
    ap.add_argument("--author", default="WorkBuddy")
    ap.add_argument("--api", default=API)
    args = ap.parse_args()

    items = json.load(sys.stdin)
    if isinstance(items, dict):
        items = [items]
    if not items:
        print("items 为空，无事可做")
        return 0

    failed = []
    for i, item in enumerate(items, 1):
        quote = item.get("quote", "")
        comment = item.get("comment", "")
        if not quote or not comment:
            print(f"[{i}/{len(items)}] FAIL(400) 缺 quote 或 comment")
            failed.append(i)
            continue
        code, resp = post_comment(args.file, item, args.author, args.api)
        if code == 200 and resp.get("ok"):
            merged = "并入线程" if resp.get("merged") else "新线程"
            print(f"[{i}/{len(items)}] OK({merged}) threadId={resp.get('threadId')} quote={quote[:30]!r}")
        else:
            print(f"[{i}/{len(items)}] FAIL({code}) {resp.get('error', '')} quote={quote[:50]!r}")
            failed.append(i)

    try:
        summary = read_threads(args.file, args.api)
        threads = summary.get("threads", [])
        total_replies = sum(len(t.get("replies", [])) for t in threads)
        print(f"\n回读验证: 文件共 {len(threads)} 个线程 / {total_replies} 条回复")
    except Exception as e:
        print(f"回读失败: {e}")

    if failed:
        print(f"完成，{len(failed)} 条失败: {failed}")
        return 1
    print(f"完成，{len(items)}/{len(items)} 全部成功")
    return 0


if __name__ == "__main__":
    sys.exit(main())
