"""One logical call: Gemini 4 Hydrogen with the exact Qwen task-A prompt.

Follows the ~/workspace/hydrogen-compare/compare.py pattern (dynamic_credentials
surrogate, NoRedirect, read_response_body). Config matches prior Hydrogen
measurements (temperature 0, thinkingLevel high) except maxOutputTokens is
raised to 65536 because this task's expected output is a full game file
(Qwen's was 1,196 lines); transport stalls/5xx are retried per the harness
tradition, but any completed generation is the result and is never re-rolled.
"""
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request

sys.path.insert(0, "/opt/muse/skills/custom-connector-setup/bin")
from dynamic_credentials import add_surrogate_to_request, read_response_body

ALLOWED_HOSTS = ["generativelanguage.googleapis.com"]
BASE = os.path.dirname(os.path.abspath(__file__))
MODEL = "gemini-4-hydrogen"

PROMPT = """単一のHTMLファイルで動くグリッド型ダンジョン探索ゲームを作ってください。
外部ライブラリ・外部ファイルは禁止。コードブロック1つでHTML全体を出力してください。

必須仕様:
1. 10×10マップを毎回ランダム生成（壁・床・出口）
2. 矢印キー/WASDと、スマホ用の画面ボタンで移動
3. 敵3体がプレイヤーの移動後に1マスずつ追跡し、接触するとHP制の戦闘
4. 回復アイテム2個（拾うとHP回復）
5. 出口到達で次の階へ進み、3階クリアでゲームクリア
6. HPが0でゲームオーバー。階層と撃破数のスコアを常時表示
7. リスタートボタン"""

GEN = {
    "maxOutputTokens": 65536,
    "temperature": 0,
    "thinkingConfig": {"thinkingLevel": "high"},
}


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args):
        raise RuntimeError("redirect refused, verify the endpoint")


def main():
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent"
    body = {"contents": [{"parts": [{"text": PROMPT}]}], "generationConfig": GEN}
    payload = json.dumps(body).encode("utf-8")
    start = time.time()
    last_error = None
    for attempt in range(1, 5):
        request = urllib.request.Request(
            url, data=payload, headers={"Content-Type": "application/json"}, method="POST"
        )
        add_surrogate_to_request(request, "custom.gemini", allowed_hosts=ALLOWED_HOSTS)
        try:
            with urllib.request.build_opener(NoRedirect()).open(request, timeout=600) as response:
                raw = read_response_body(response).decode("utf-8", errors="replace")
                status = response.status
            with open(os.path.join(BASE, "hydrogen_raw.json"), "w", encoding="utf-8") as f:
                f.write(raw)
            parsed = json.loads(raw)
            cand = (parsed.get("candidates") or [{}])[0]
            finish = cand.get("finishReason")
            parts = ((cand.get("content") or {}).get("parts")) or []
            text = "".join(p.get("text", "") for p in parts if isinstance(p, dict))
            with open(os.path.join(BASE, "hydrogen_response.txt"), "w", encoding="utf-8") as f:
                f.write(text)
            m = re.search(r"```(?:html)?\s*\n(.*?)```", text, re.S)
            code = m.group(1) if m else None
            if code:
                with open(os.path.join(BASE, "hydrogen_game.html"), "w", encoding="utf-8") as f:
                    f.write(code)
            print(json.dumps({
                "http_status": status,
                "attempt": attempt,
                "wall_seconds_env": round(time.time() - start, 1),
                "finishReason": finish,
                "usage": parsed.get("usageMetadata"),
                "text_chars": len(text),
                "code_extracted": bool(code),
                "code_lines": code.count("\n") + 1 if code else 0,
                "code_bytes": len(code.encode("utf-8")) if code else 0,
            }, ensure_ascii=False, indent=1))
            return
        except (urllib.error.URLError, TimeoutError, ConnectionError, RuntimeError) as e:
            last_error = e
            print(f"attempt {attempt} transport error: {e!r}", flush=True)
            time.sleep(5)
        except urllib.error.HTTPError as e:
            last_error = e
            print(f"attempt {attempt} HTTP {e.code}", flush=True)
            if e.code < 500:
                try:
                    print(e.read().decode("utf-8", errors="replace")[:2000])
                except Exception:
                    pass
                break
            time.sleep(5)
    print("FAILED:", repr(last_error))
    sys.exit(1)


if __name__ == "__main__":
    main()
