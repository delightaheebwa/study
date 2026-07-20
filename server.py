import json, os, re, time, subprocess, threading
from pathlib import Path
from datetime import datetime, timedelta, timezone
from flask import Flask, request, jsonify, send_from_directory, Response as FlaskResponse
from flask_cors import CORS
import requests
import yaml
from dotenv import load_dotenv

load_dotenv()

BASE = Path(__file__).parent
GO_API_BASE = "https://opencode.ai/zen/go/v1"
GO_API_KEY = os.environ.get("OPENCODE_GO_KEY", "")
DEFAULT_MODEL = "deepseek-v4-flash"

# Hardcoded catalog: protocol type, context window, pricing per 1M tokens
HARDCODED_CATALOG = {
    "grok-4.5":           {"endpoint": "openai", "ctx": 131072, "price_in": 2.00, "price_out": 6.00},
    "glm-5.2":            {"endpoint": "openai", "ctx": 131072, "price_in": 1.40, "price_out": 4.40},
    "glm-5.1":            {"endpoint": "openai", "ctx": 131072, "price_in": 1.40, "price_out": 4.40},
    "kimi-k3":            {"endpoint": "openai", "ctx": 131072, "price_in": 3.00, "price_out": 15.00},
    "kimi-k2.7-code":     {"endpoint": "openai", "ctx": 131072, "price_in": 0.95, "price_out": 4.00},
    "kimi-k2.6":          {"endpoint": "openai", "ctx": 131072, "price_in": 0.95, "price_out": 4.00},
    "deepseek-v4-pro":    {"endpoint": "openai", "ctx": 131072, "price_in": 0.435, "price_out": 0.87},
    "deepseek-v4-flash":  {"endpoint": "openai", "ctx": 131072, "price_in": 0.14, "price_out": 0.28},
    "mimo-v2.5":          {"endpoint": "openai", "ctx": 131072, "price_in": 0.14, "price_out": 0.28},
    "mimo-v2.5-pro":      {"endpoint": "openai", "ctx": 131072, "price_in": 0.435, "price_out": 0.87},
    "minimax-m3":         {"endpoint": "anthropic", "ctx": 131072, "price_in": 0.30, "price_out": 1.20},
    "minimax-m2.7":       {"endpoint": "anthropic", "ctx": 131072, "price_in": 0.30, "price_out": 1.20},
    "minimax-m2.5":       {"endpoint": "anthropic", "ctx": 131072, "price_in": 0.30, "price_out": 1.20},
    "qwen3.7-max":        {"endpoint": "anthropic", "ctx": 131072, "price_in": 2.50, "price_out": 7.50},
    "qwen3.7-plus":       {"endpoint": "anthropic", "ctx": 262144, "price_in": 0.40, "price_out": 1.60},
    "qwen3.6-plus":       {"endpoint": "anthropic", "ctx": 262144, "price_in": 0.50, "price_out": 3.00},
}

def is_anthropic(model):
    return HARDCODED_CATALOG.get(model, {}).get("endpoint") == "anthropic"

# Live catalog cache: fetched from OpenCode API on startup
_live_catalog = {}
_live_catalog_ts = 0
_CATALOG_TTL = 21600  # 6 hours

def _fetch_live_catalog():
    global _live_catalog, _live_catalog_ts
    if not GO_API_KEY or GO_API_KEY == "test":
        return
    try:
        url = f"{GO_API_BASE}/models"
        headers = {"Authorization": f"Bearer {GO_API_KEY}"}
        resp = requests.get(url, headers=headers, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            _live_catalog = {}
            for m in data if isinstance(data, list) else data.get("data", data.get("models", [])):
                mid = m.get("id", m.get("name", ""))
                if mid:
                    _live_catalog[mid] = {
                        "endpoint": is_anthropic(mid),
                        "ctx": m.get("context_window", m.get("max_context", 131072)),
                        "price_in": m.get("pricing", {}).get("input", HARDCODED_CATALOG.get(mid, {}).get("price_in", 0)),
                        "price_out": m.get("pricing", {}).get("output", HARDCODED_CATALOG.get(mid, {}).get("price_out", 0)),
                    }
            _live_catalog_ts = time.time()
    except Exception:
        pass

def _get_catalog():
    if time.time() - _live_catalog_ts > _CATALOG_TTL:
        _fetch_live_catalog()
    return _live_catalog if _live_catalog else HARDCODED_CATALOG

# Start background catalog fetch
threading.Thread(target=_fetch_live_catalog, daemon=True).start()

DOMAIN_ADJACENCY = {
    "llm-fundamentals": ["rag", "transformers", "classical-ml", "multimodal", "eval"],
    "rag": ["llm-fundamentals", "multimodal", "eval", "agents"],
    "agents": ["rag", "llm-fundamentals", "safety", "mcp", "voice"],
    "classical-ml": ["eval", "rag", "llm-fundamentals", "rl"],
    "rl": ["classical-ml", "llm-fundamentals", "safety"],
    "multimodal": ["rag", "llm-fundamentals", "vision", "voice"],
    "safety": ["agents", "rag", "rl", "llm-fundamentals"],
    "eval": ["classical-ml", "rag", "llm-fundamentals"],
    "mcp": ["agents", "tools"],
    "voice": ["multimodal", "agents", "llm-fundamentals"]
}

app = Flask(__name__, static_folder=str(BASE))
CORS(app)

# ---- helpers ----

def load_json(path):
    if path.exists():
        return json.loads(path.read_text())
    return {}

def save_json(path, data):
    path.write_text(json.dumps(data, indent=2))

def now_iso():
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

def today_str():
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")

def slugify(s):
    return re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')

# ---- routes ----

@app.route("/")
def index():
    return send_from_directory(str(BASE), "index.html")

@app.route("/lessons/<path:path>")
def lesson(path):
    return send_from_directory(str(BASE / "lessons"), path)

@app.route("/assets/<path:path>")
def asset(path):
    return send_from_directory(str(BASE / "assets"), path)

@app.route("/reference/<path:path>")
def reference(path):
    return send_from_directory(str(BASE / "reference"), path)

@app.route("/api/models", methods=["GET"])
def api_models():
    cat = _get_catalog()
    models = [{"id": k, "ctx": v["ctx"], "price_in": v["price_in"], "price_out": v["price_out"]} for k, v in cat.items()]
    return jsonify({"models": models, "default": DEFAULT_MODEL})

# ---- chat proxy ----

# Simple response templates for demo mode (no API key)
DEMO_RESPONSES = [
    "That's a great question! Let's break it down step by step.\n\nConsider this analogy: **tokenization is like deciding how to cut a pizza** — too few slices and each piece is awkwardly large (words), too many slices and you can't hold them all (characters). BPE finds the *right size* by looking at which pairs of toppings appear together most often.\n\nGiven that, what do you think determines the *first* merge BPE makes on a new corpus?",
    "Nice thinking! Let me ask you a follow-up.\n\nWhen we count pair frequencies, we get numbers like `('l','o'): 5`. But the merge table is ordered by frequency. If two pairs have the same count, which one wins?\n\nWhat happens to the tokenizer if we break ties by picking the *first* pair alphabetically vs the *last*?",
    "Good point. Let me connect this to something you already know.\n\nYou've used LLM APIs — every time you send a prompt, the model's tokenizer splits your text into IDs before the transformer sees it. If the tokenizer splits \"tokenizer\" into [\"token\", \"izer\"] while another splits it into [\"to\", \"ken\", \"izer\"], the model learns different patterns.\n\nHow do you think the tokenizer's choice of splits affects the model's ability to understand misspellings?",
    "You're getting it. Let's try a concrete exercise.\n\nTake the corpus: `[\"hello world\", \"help wanted\", \"world help\"]`. \n\nWhat is the first BPE merge? *Run through the steps mentally:*\n1. Split into characters with </w> markers\n2. Count every adjacent pair\n3. Find the most common pair\n4. Merge it\n\nWhat do you get?",
    "Excellent question about the implementation! Here's the key insight.\n\nThe merge function has to scan the entire sequence and replace every occurrence of the pair. This is O(n) per merge, and we do V merges where V is the vocabulary size. That's O(n×V) — not great for large corpora!\n\nModern tokenizers use a **priority queue** or **heap** to track which pair is most frequent without rescanning everything.\n\nWhat data structure would you use to avoid the O(n) rescan step?"
]

import random

@app.route("/api/chat", methods=["POST"])
def api_chat():
    data = request.get_json()
    model = data.get("model", DEFAULT_MODEL)
    messages = data.get("messages", [])
    stream = data.get("stream", False)

    if not GO_API_KEY or GO_API_KEY == "test":
        user_msg = messages[-1].get("content", "") if messages else ""
        prompt_chars = sum(len(m.get("content", "")) for m in messages)
        prompt_tokens = max(10, prompt_chars // 3)
        reply = DEMO_RESPONSES[hash(user_msg) % len(DEMO_RESPONSES)]
        completion_tokens = max(10, len(reply) // 3)
        mock_usage = {"prompt_tokens": prompt_tokens, "completion_tokens": completion_tokens, "total_tokens": prompt_tokens + completion_tokens}

        if stream:
            def gen():
                chunks = [reply[i:i+30] for i in range(0, len(reply), 30)]
                for chunk in chunks:
                    yield f"data: {json.dumps({'choices': [{'delta': {'content': chunk}}], 'usage': mock_usage})}\n\n"
                    time.sleep(0.02)
                yield f"data: {json.dumps({'usage': mock_usage})}\n\n"
                yield "data: [DONE]\n\n"
            return FlaskResponse(gen(), mimetype="text/event-stream")
        return jsonify({"choices": [{"message": {"content": reply}}], "usage_est": mock_usage})

    headers = {
        "Authorization": f"Bearer {GO_API_KEY}",
        "Content-Type": "application/json"
    }

    cat = _get_catalog()
    model_info = cat.get(model, cat.get(DEFAULT_MODEL, {}))
    ctx = model_info.get("ctx", 131072)

    # Cut messages to fit context window (leave room for completion)
    MAX_CTX = int(ctx * 0.85)
    kept = []
    total_chars = 0
    for m in reversed(messages):
        c = len(m.get("content", ""))
        if total_chars + c > MAX_CTX: break
        kept.insert(0, m)
        total_chars += c

    prompt_tokens_est = total_chars // 3  # crude estimate

    if model_info.get("endpoint") == "anthropic":
        system_msgs = [m for m in kept if m.get("role") == "system"]
        chat_msgs = [m for m in kept if m.get("role") != "system"]
        body = {
            "model": model,
            "system": system_msgs[0]["content"] if system_msgs else "You are a helpful tutor.",
            "messages": chat_msgs,
            "max_tokens": 4096,
            "stream": stream
        }
        resp = requests.post(f"{GO_API_BASE}/messages", headers=headers, json=body)
    else:
        body = {
            "model": model,
            "messages": kept,
            "max_tokens": 4096,
            "stream": stream
        }
        url = f"{GO_API_BASE}/chat/completions"
        if stream:
            upstream = requests.post(url, headers=headers, json=body, stream=True)
            def proxy_stream():
                for line in upstream.iter_lines():
                    if line:
                        decoded = line.decode()
                        yield decoded + "\n"
                yield "data: [DONE]\n\n"
            return FlaskResponse(proxy_stream(), mimetype="text/event-stream")
        else:
            resp = requests.post(url, headers=headers, json=body)

    if resp.status_code != 200:
        return jsonify({"error": resp.text}), resp.status_code

    result = resp.json()
    usage = result.get("usage", {}) or {}
    if not usage:
        usage = {"prompt_tokens": prompt_tokens_est, "completion_tokens": 0, "total_tokens": prompt_tokens_est}
    result["usage_est"] = usage
    return jsonify(result)

# ---- end session pipeline ----

@app.route("/api/end-session", methods=["POST"])
def api_end_session():
    data = request.get_json()
    lesson_name = data.get("lesson", "unknown")
    domain = data.get("domain", "llm-fundamentals")
    chat_history = data.get("chat_history", [])
    quiz_scores = data.get("quiz_scores", [])

    ts = now_iso()
    td = today_str()
    slug = slugify(lesson_name)

    # 1. Generate learning record
    rec_num = len(list((BASE / "learning-records").glob("*.md"))) + 1
    rec = _make_learning_record(rec_num, lesson_name, slug, domain, chat_history, ts)
    (BASE / "learning-records" / f"{rec_num:04d}-{slug}.md").write_text(rec)

    # 2. Update OKF wiki
    _update_knowledge_wiki(lesson_name, slug, domain, chat_history, ts, td)

    # 3. Update review schedule
    _update_review_schedule(slug, lesson_name, domain, quiz_scores, td)

    # 4. Generate interleaving plan
    interleave = _generate_interleaving(slug, domain, td)

    # 5. Git commit and push
    _git_commit_push(lesson_name)

    return jsonify({
        "status": "ok",
        "learning_record": f"{rec_num:04d}-{slug}.md",
        "interleaving": interleave,
        "message": f"Session '{lesson_name}' saved. Review scheduled. Knowledge wiki updated."
    })

# ---- learning record ----

def _make_learning_record(num, name, slug, domain, chat_history, ts):
    summary = "Completed lesson."
    if chat_history:
        last = chat_history[-1].get("content", "") if isinstance(chat_history[-1], dict) else ""
        summary = last[:200] if last else summary

    return f"""# Learning Record {num:04d}: {name}

**Date:** {ts[:10]}
**Lesson:** {slug}
**Domain:** {domain}

## Context
{summary}

## Key Insights
- (To be filled by tutor review)

## Challenges
- (To be filled by tutor review)

## Next Steps
- Review in 1, 3, 7, 14, 30, 60 days (spaced repetition)
"""

# ---- knowledge wiki (OKF v0.1) ----

def _update_knowledge_wiki(name, slug, domain, chat_history, ts, td):
    domain_dir = BASE / "knowledge-wiki" / domain
    domain_dir.mkdir(parents=True, exist_ok=True)

    # concept file
    concept_path = domain_dir / f"{slug}.md"
    if not concept_path.exists():
        desc = f"Lesson: {name}"
        if chat_history:
            first_msg = chat_history[0].get("content", "") if isinstance(chat_history[0], dict) else ""
            desc = first_msg[:150] if first_msg else desc

        frontmatter = {
            "type": "Concept",
            "title": name,
            "description": desc,
            "tags": [domain, slug],
            "timestamp": ts
        }
        content = "---\n" + yaml.dump(frontmatter, default_flow_style=False).strip() + "\n---\n\n"
        content += f"# {name}\n\nLesson completed on {td}.\n\n"
        concept_path.write_text(content)

    # index.md for domain
    index_path = domain_dir / "index.md"
    if not index_path.exists():
        index_path.write_text(f"# {domain}\n\nConcepts in this domain:\n\n- [{name}]({slug}.md)\n")
    else:
        existing = index_path.read_text()
        if f"({slug}.md)" not in existing:
            index_path.write_text(existing.strip() + f"\n- [{name}]({slug}.md)\n")

    # log.md (root knowledge-wiki)
    log_path = BASE / "knowledge-wiki" / "log.md"
    if not log_path.exists():
        log_path.write_text(f"# Knowledge Wiki Log\n\n## {td}\n- Completed `{slug}` ({domain})\n")
    else:
        existing = log_path.read_text()
        if f"## {td}" not in existing:
            log_path.write_text(existing.strip() + f"\n## {td}\n- Completed `{slug}` ({domain})\n")
        else:
            log_path.write_text(existing.strip() + f"\n- Completed `{slug}` ({domain})\n")

    # root index.md
    root_idx = BASE / "knowledge-wiki" / "index.md"
    if not root_idx.exists():
        root_idx.write_text(f"""---
okf_version: "0.1"
---

# PBL Knowledge Wiki

AI Engineering concepts in OKF v0.1 format.

## Domains
""")

# ---- review schedule (SM-2 inspired) ----

def _update_review_schedule(slug, name, domain, quiz_scores, td):
    path = BASE / "review-schedule.json"
    sched = load_json(path)

    INTERVALS = [1, 3, 7, 14, 30, 60, 120]

    if slug in sched.get("lessons", {}):
        entry = sched["lessons"][slug]
        avg_score = sum(quiz_scores) / len(quiz_scores) if quiz_scores else 0.7
        entry["review_history"].append({"date": td, "score": round(avg_score, 2), "type": "review"})
        history = entry["review_history"]
        recent = [h["score"] for h in history[-3:]]
        avg = sum(recent) / len(recent)

        if avg >= 0.8:
            entry["interval_index"] = min(entry["interval_index"] + 1, len(INTERVALS) - 1)
        elif avg < 0.5:
            entry["interval_index"] = 0
        # else stay at current index

        idx = entry["interval_index"]
        next_days = INTERVALS[idx]
        entry["next_review"] = (datetime.now(timezone.utc) + timedelta(days=next_days)).strftime("%Y-%m-%d")
        entry["mastery_score"] = round(avg, 2)
    else:
        entry = {
            "title": name,
            "completed": td,
            "review_history": [{"date": td, "score": 0.85, "type": "initial"}],
            "next_review": (datetime.now(timezone.utc) + timedelta(days=1)).strftime("%Y-%m-%d"),
            "interval_index": 0,
            "intervals": INTERVALS,
            "mastery_score": 0.85,
            "domain": domain,
            "tags": [domain, slug]
        }
        if "lessons" not in sched:
            sched["lessons"] = {}
        sched["lessons"][slug] = entry

    # ensure domain exists in adjacency graph
    if "domains" not in sched:
        sched["domains"] = {k: {"related_domains": v, "lessons": []} for k, v in DOMAIN_ADJACENCY.items()}
    if domain in sched["domains"]:
        if slug not in sched["domains"][domain]["lessons"]:
            sched["domains"][domain]["lessons"].append(slug)

    sched.setdefault("global_stats", {})["total_lessons_completed"] = len(sched["lessons"])
    sched["global_stats"]["last_interleaving_check"] = td

    # compute due reviews
    due = 0
    for lslug, le in sched.get("lessons", {}).items():
        if le.get("next_review", "") <= td:
            due += 1
    sched["global_stats"]["lessons_due_review"] = due

    save_json(path, sched)

# ---- interleaving ----

def _generate_interleaving(current_slug, current_domain, td):
    path = BASE / "interleaving-plan.json"
    plan = load_json(path)
    sched = load_json(BASE / "review-schedule.json")

    lessons = sched.get("lessons", {})
    adjacency = DOMAIN_ADJACENCY.get(current_domain, [])
    related = [d for d in adjacency if d != current_domain]

    candidates = []
    for lslug, entry in lessons.items():
        if lslug == current_slug:
            continue
        d = entry.get("domain", "")
        if d in related or d == current_domain:
            if entry.get("next_review", "") <= td:
                candidates.append({
                    "lesson": lslug,
                    "title": entry.get("title", lslug),
                    "domain": d,
                    "type": "review"
                })

    # mix in one concept from a slightly distant domain if available
    distant = [d for d in adjacency if d not in [current_domain] + related]
    for lslug, entry in lessons.items():
        if len(candidates) >= 4:
            break
        if lslug == current_slug:
            continue
        d = entry.get("domain", "")
        if d in distant:
            candidates.append({
                "lesson": lslug,
                "title": entry.get("title", lslug),
                "domain": d,
                "type": "stretch"
            })

    mix = {
        "date": td,
        "current_lesson": current_slug,
        "current_domain": current_domain,
        "mix": candidates[:4],
        "rationale": f"Connect {current_domain} concepts with related domains: {', '.join(related[:3])}"
    }

    plans = plan.get("interleaving_schedule", [])
    plans.append(mix)
    plan["interleaving_schedule"] = plans
    save_json(path, plan)

    return mix

# ---- git ----

def _git_commit_push(lesson_name):
    try:
        repo_dir = str(BASE)
        subprocess.run(["git", "-C", repo_dir, "add", "-A"], capture_output=True)
        msg = f"session: {slugify(lesson_name)} — {now_iso()[:16]}Z"
        subprocess.run(["git", "-C", repo_dir, "commit", "-m", msg], capture_output=True)
        subprocess.run(["git", "-C", repo_dir, "push", "origin", "main"], capture_output=True)
    except Exception as e:
        print(f"[git] {e}")

# ---- reviews endpoint ----

@app.route("/api/reviews", methods=["GET"])
def api_reviews():
    path = BASE / "review-schedule.json"
    sched = load_json(path)
    td = today_str()
    due = []
    for slug, entry in sched.get("lessons", {}).items():
        if entry.get("next_review", "") <= td:
            due.append({"slug": slug, "title": entry["title"], "domain": entry.get("domain", "unknown")})
    return jsonify({"due": due, "total": len(sched.get("lessons", {})), "global_stats": sched.get("global_stats", {})})

if __name__ == "__main__":
    print(f"PBL Server running at http://localhost:8001")
    print(f"Chat API proxied to {GO_API_BASE}")
    app.run(host="0.0.0.0", port=8001, debug=True)
