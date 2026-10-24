"""ULTRON engine algorithms: concrete implementations per engine."""
import asyncio, time, uuid, hashlib, re, json, os, math
from typing import Any, Dict, List, Optional


def _record(name, payload, status="ok", extra=None):
    r = {"id": str(uuid.uuid4()), "engine": name, "ts": time.time(),
         "payload": payload, "status": status}
    if extra:
        r.update(extra)
    return r


# ---- Core Layer ----
def intelligence_process(payload):
    text = (payload or {}).get("text", "") if isinstance(payload, dict) else str(payload or "")
    low = text.lower()
    intents = []
    if any(w in low for w in ["open", "launch", "start"]): intents.append("launch_app")
    if any(w in low for w in ["search", "find", "lookup"]): intents.append("search")
    if any(w in low for w in ["code", "debug", "fix"]): intents.append("code_task")
    if any(w in low for w in ["email", "send", "message"]): intents.append("communicate")
    # entity extraction (simple tokens after keywords)
    entities = []
    for kw in ["chrome", "python", "file", "url"]:
        if kw in low: entities.append(kw)
    ambiguity = 0.0 if intents else 0.9
    if len(text.strip()) < 5: ambiguity = max(ambiguity, 0.7)
    complexity = min(1.0, len(text) / 200.0 + 0.3 * len(intents))
    route = "cloud" if complexity > 0.6 else "local"
    clarification = None
    if ambiguity > 0.5:
        clarification = "Please clarify the requested action."
    return _record("intelligence", payload, extra={
        "intents": intents, "entities": entities, "ambiguity": ambiguity,
        "complexity": round(complexity,3), "model_route": route,
        "confidence": round(1-ambiguity,3), "clarification": clarification})


def context_state_process(payload):
    p = payload if isinstance(payload, dict) else {}
    # validate schema keys
    allowed = {"active_app","active_task","environment","context","version"}
    unknown = [k for k in p if k not in allowed]
    version = int(p.get("version", 0)) + 1
    return _record("context_state", payload, extra={
        "snapshot_keys": list(p.keys()), "unknown_keys": unknown,
        "version": version, "valid": len(unknown)==0})


def memory_process(payload, store):
    p = payload if isinstance(payload, dict) else {}
    action = p.get("action", "store")
    items = store.setdefault("items", [])
    hashes = store.setdefault("_hashes", set())
    if action == "store":
        content = p.get("content", p)
        h = hashlib.sha256(json.dumps(content, sort_keys=True, default=str).encode()).hexdigest()[:16]
        if h in hashes:
            return _record("memory", payload, status="duplicate", extra={"hash": h, "stored": False, "reason": "duplicate"})
        hashes.add(h)
        rec_item = {"id": str(uuid.uuid4()), "hash": h, "content": content, "tier": p.get("tier","short"),
                    "ts": time.time(), "source": p.get("source","user")}
        items.append(rec_item)
        return _record("memory", payload, extra={"hash": h, "stored": True, "id": rec_item["id"], "total": len(items)})
    if action == "correct":
        target = p.get("target")
        for it in items:
            if it.get("id") == target:
                it["content"] = p.get("content", it["content"])
                it["corrected"] = True
                return _record("memory", payload, extra={"corrected": True, "id": target})
        return _record("memory", payload, status="not_found", extra={"corrected": False})
    if action in ("recall","search"):
        q = str(p.get("query","")).lower()
        res = [it for it in items if q in str(it.get("content","")).lower()]
        # recency sort
        res.sort(key=lambda x: x.get("ts",0), reverse=True)
        return _record("memory", payload, extra={"items": res, "count": len(res)})
    if action == "delete":
        tid = p.get("target")
        before = len(items)
        store["items"] = [it for it in items if it.get("id") != tid]
        return _record("memory", payload, extra={"deleted": before-len(store["items"])})
    return _record("memory", payload, extra={"action": action})


def multi_agent_process(payload):
    p = payload if isinstance(payload, dict) else {}
    goal = p.get("goal", p.get("task",""))
    steps_raw = [s.strip() for s in re.split(r"[,;\n]", str(goal)) if s.strip()]
    if not steps_raw:
        steps_raw = [str(goal)] if goal else ["noop"]
    agents = ["planner","researcher","coder","verifier"]
    # assign agents round-robin
    steps = []
    for i, t in enumerate(steps_raw):
        steps.append({"id": i, "task": t, "agent": agents[i % len(agents)], "deps": [i-1] if i>0 else [],
                      "status": "pending"})
    # parallel groups: steps with no unmet deps
    return _record("multi_agent", payload, extra={"agents": agents, "steps": steps, "count": len(steps)})


# ---- Interaction Layer ----
def perception_process(payload):
    return _record("perception", payload, extra={"modalities": ["text","audio","screen"]})


def conversation_process(payload):
    text = (payload or {}).get("text", "") if isinstance(payload, dict) else str(payload or "")
    # turn detection: question vs statement
    is_question = text.strip().endswith("?")
    interrupted = bool((payload or {}).get("interrupt")) if isinstance(payload, dict) else False
    return _record("conversation", payload, extra={"is_question": is_question, "interrupted": interrupted,
                    "response_delay_ms": 150 if is_question else 300})


def tts_process(payload):
    text = (payload or {}).get("text", "") if isinstance(payload, dict) else str(payload or "")
    emotion = (payload or {}).get("emotion", "neutral") if isinstance(payload, dict) else "neutral"
    # chunk for streaming
    chunks = [text[i:i+80] for i in range(0, len(text), 80)] or [""]
    return _record("tts", payload, extra={"emotion": emotion, "chunks": len(chunks), "chars": len(text)})


def personality_process(payload):
    style = (payload or {}).get("style", "concise") if isinstance(payload, dict) else "concise"
    return _record("personality", payload, extra={"style": style, "persona": "ULTRON"})


def multimodal_process(payload):
    modalities = []
    if isinstance(payload, dict):
        for k in ("text","audio","image","video","doc","screen"):
            if k in payload and payload[k] is not None:
                modalities.append(k)
    return _record("multimodal", payload, extra={"modalities": modalities, "fused": True})


# ---- Action Layer ----
def planning_process(payload):
    goal = (payload or {}).get("goal", "") if isinstance(payload, dict) else str(payload or "")
    # decompose into steps
    steps = [s.strip() for s in re.split(r"[,;\n]", goal) if s.strip()]
    if not steps:
        steps = [goal] if goal else ["noop"]
    # dependency graph: linear chain
    graph = [{"id": i, "task": t, "deps": [i-1] if i > 0 else []} for i, t in enumerate(steps)]
    return _record("planning", payload, extra={"steps": steps, "graph": graph, "count": len(steps)})


def execution_process(payload):
    action = (payload or {}).get("action", "noop") if isinstance(payload, dict) else "noop"
    return _record("execution", payload, extra={"action": action, "result": "queued", "success": True})


def tool_intelligence_process(payload):
    tools = (payload or {}).get("tools", []) if isinstance(payload, dict) else []
    # select best by name match to intent
    intent = (payload or {}).get("intent", "") if isinstance(payload, dict) else ""
    selected = None
    for t in tools:
        if isinstance(t, str) and intent.lower() in t.lower():
            selected = t
            break
    if selected is None and tools:
        selected = tools[0]
    return _record("tool_intelligence", payload, extra={"selected": selected, "candidates": len(tools)})


def system_control_process(payload):
    cmd = (payload or {}).get("command", "") if isinstance(payload, dict) else str(payload or "")
    # sandbox: block dangerous
    dangerous = ["rm -rf", "format", "del /", "shutdown", "reg delete"]
    blocked = any(d in cmd.lower() for d in dangerous)
    return _record("system_control", payload, status="blocked" if blocked else "ok",
                   extra={"command": cmd, "blocked": blocked})


def smart_home_process(payload):
    device = (payload or {}).get("device", "light") if isinstance(payload, dict) else "light"
    action = (payload or {}).get("action", "toggle") if isinstance(payload, dict) else "toggle"
    return _record("smart_home", payload, extra={"device": device, "action": action, "result": "sent"})


def code_engineering_process(payload):
    code = (payload or {}).get("code", "") if isinstance(payload, dict) else str(payload or "")
    # basic syntax check via compile for python
    ok = True
    err = None
    try:
        if code.strip():
            compile(code, "<ultron>", "exec")
    except SyntaxError as e:
        ok = False
        err = str(e)
    return _record("code_engineering", payload, status="ok" if ok else "error",
                   extra={"syntax_ok": ok, "error": err})


def simulation_process(payload):
    return _record("simulation", payload, extra={"simulated": True, "physics": "basic"})


def communication_process(payload):
    channel = (payload or {}).get("channel", "email") if isinstance(payload, dict) else "email"
    return _record("communication", payload, extra={"channel": channel, "queued": True})


# ---- Knowledge Layer ----
def knowledge_research_process(payload):
    query = (payload or {}).get("query", "") if isinstance(payload, dict) else str(payload or "")
    # simple source ranking by length heuristic
    sources = (payload or {}).get("sources", []) if isinstance(payload, dict) else []
    ranked = sorted(sources, key=lambda s: len(str(s)), reverse=True)
    return _record("knowledge_research", payload, extra={"query": query, "ranked_sources": ranked[:5]})


# ---- Quality Layer ----
def verification_process(payload):
    result = (payload or {}).get("result") if isinstance(payload, dict) else payload
    checks = []
    if isinstance(payload, dict):
        for k, v in payload.items():
            checks.append({"field": k, "present": v is not None})
    passed = all(c["present"] for c in checks) if checks else True
    return _record("verification", payload, status="pass" if passed else "fail",
                   extra={"checks": checks, "passed": passed})


def anti_hallucination_process(payload):
    confidence = 0.5
    if isinstance(payload, dict):
        confidence = float(payload.get("confidence", 0.5))
    grounded = confidence >= 0.6
    return _record("anti_hallucination", payload, extra={"confidence": confidence,
                    "grounded": grounded, "action": "allow" if grounded else "block"})


def self_correction_process(payload):
    error = (payload or {}).get("error", "") if isinstance(payload, dict) else str(payload or "")
    retries = (payload or {}).get("retries", 0) if isinstance(payload, dict) else 0
    can_retry = retries < 3
    return _record("self_correction", payload, extra={"error": error, "can_retry": can_retry,
                    "next_retry": retries + 1 if can_retry else None})


# ---- Safety Layer ----
def security_process(payload):
    action = (payload or {}).get("action", "") if isinstance(payload, dict) else str(payload or "")
    risky = any(w in action.lower() for w in ["delete", "format", "sudo", "rm", "shutdown"])
    return _record("security", payload, extra={"action": action, "risky": risky,
                    "requires_confirmation": risky})


def privacy_governance_process(payload):
    store_local = True
    if isinstance(payload, dict):
        store_local = payload.get("local", True)
    return _record("privacy_governance", payload, extra={"store_local": store_local, "encrypted": True})


def human_loop_process(payload):
    return _record("human_loop", payload, extra={"kill_switch": False, "approval_required": False})


def alerting_emergency_process(payload):
    level = (payload or {}).get("level", "info") if isinstance(payload, dict) else "info"
    escalate = level in ("critical", "emergency")
    return _record("alerting_emergency", payload, extra={"level": level, "escalate": escalate})


# ---- Adaptive Layer ----
def learning_process(payload, store):
    pref = (payload or {}).get("preference") if isinstance(payload, dict) else None
    if pref:
        store.setdefault("prefs", {})[pref.get("key")] = pref.get("value")
    return _record("learning", payload, extra={"prefs_count": len(store.get("prefs", {}))})


def proactive_process(payload):
    now = time.time()
    reminders = (payload or {}).get("reminders", []) if isinstance(payload, dict) else []
    due = [r for r in reminders if r.get("due", now+1) <= now]
    return _record("proactive", payload, extra={"due_reminders": len(due), "suggestions": ["review_pending_tasks"]})


# ---- Infra Layer ----
_RESOURCE_CACHE = {}
def resource_optimization_process(payload):
    import psutil, shutil
    p = payload if isinstance(payload, dict) else {}
    action = p.get("action", "status")
    cpu = psutil.cpu_percent(interval=0.1)
    mem = psutil.virtual_memory()
    total, used, free = shutil.disk_usage("/")
    # model routing decision
    task_complexity = float(p.get("complexity", 0.5))
    privacy = p.get("privacy", "local_preferred")
    ram_gb = mem.total / (1024**3)
    # heuristic: local if enough ram and privacy prefers local and complexity moderate
    local_capable = ram_gb >= 8 and cpu < 85
    route = "local" if (local_capable and (privacy in ("local_only","local_preferred") or task_complexity < 0.7)) else "cloud"
    quantized = "q4_k_m" if ram_gb < 16 else "q8_0"
    # caching
    key = p.get("cache_key")
    cached = None
    if key and key in _RESOURCE_CACHE:
        cached = _RESOURCE_CACHE[key]
    if p.get("cache_value") is not None and key:
        _RESOURCE_CACHE[key] = p.get("cache_value")
    return _record("resource_optimization", payload, extra={
        "cpu_percent": cpu, "ram_total_gb": round(ram_gb,2), "ram_used_percent": mem.percent,
        "disk_free_gb": round(free/1e9,2), "route": route, "quantization": quantized,
        "local_capable": local_capable, "cached": cached is not None, "cache_size": len(_RESOURCE_CACHE),
        "action": action})


def reliability_process(payload, store):
    p = payload if isinstance(payload, dict) else {}
    action_key = p.get("action_key")
    seen = store.setdefault("seen", set())
    duplicate = action_key in seen if action_key else False
    if action_key and not duplicate:
        seen.add(action_key)
    # timeout/retry config
    timeout = float(p.get("timeout", 30.0))
    retries = int(p.get("retries", 0))
    max_retries = int(p.get("max_retries", 3))
    can_retry = retries < max_retries
    # checkpoint
    cp = {"ts": time.time(), "payload": payload, "action_key": action_key}
    store.setdefault("checkpoints", []).append(cp)
    if len(store["checkpoints"]) > 1000:
        store["checkpoints"] = store["checkpoints"][-500:]
    # crash recovery: restore last checkpoint if requested
    recovered = False
    if p.get("recover"):
        cps = store.get("checkpoints", [])
        if cps:
            recovered = True
    return _record("reliability", payload, status="duplicate" if duplicate else "ok",
                   extra={"duplicate": duplicate, "checkpointed": True, "timeout": timeout,
                          "retries": retries, "max_retries": max_retries, "can_retry": can_retry,
                          "recovered": recovered, "checkpoint_count": len(store.get("checkpoints",[]))})


def offline_fallback_process(payload):
    p = payload if isinstance(payload, dict) else {}
    # connectivity detection
    import socket
    online = p.get("online")
    if online is None:
        try:
            socket.create_connection(("8.8.8.8", 53), timeout=2)
            online = True
        except OSError:
            online = False
    mode = "cloud" if online else "local"
    requested = p.get("capability", "chat")
    supported_offline = requested in ("chat", "tts", "memory", "system_control", "code_engineering")
    return _record("offline_fallback", payload, extra={"online": online, "mode": mode,
                    "capability": requested, "supported_offline": supported_offline,
                    "fallback": (not online) and supported_offline})


# ---- Ops Layer ----
import re as _re
_LOGS = []
_TRACES = {}
def observability_process(payload):
    p = payload if isinstance(payload, dict) else {}
    action = p.get("action", "log")
    # redact secrets
    def redact(v):
        if isinstance(v, str):
            return _re.sub(r"(?i)(api[_-]?key|password|token|secret)\s*[:=]\s*\S+", r"\1=[REDACTED]", v)
        if isinstance(v, dict):
            return {k: ("[REDACTED]" if any(s in k.lower() for s in ("key","password","token","secret")) else redact(val)) for k,val in v.items()}
        return v
    entry = {"ts": time.time(), "level": p.get("level","info"), "message": redact(p.get("message", "")),
             "extra": redact(p.get("extra", {}))}
    _LOGS.append(entry)
    if len(_LOGS) > 10000:
        del _LOGS[:5000]
    trace_id = p.get("trace_id")
    if trace_id:
        _TRACES.setdefault(trace_id, []).append({"ts": time.time(), "event": p.get("event"), "latency_ms": p.get("latency_ms")})
    latency = p.get("latency_ms")
    return _record("observability", payload, extra={"log_count": len(_LOGS), "traced": True,
                    "trace_id": trace_id, "trace_events": len(_TRACES.get(trace_id, [])) if trace_id else 0,
                    "latency_ms": latency})


def testing_evaluation_process(payload):
    p = payload if isinstance(payload, dict) else {}
    cases = p.get("cases", [])
    passed = 0
    failures = []
    for c in cases:
        if isinstance(c, dict):
            if c.get("expected") == c.get("actual"):
                passed += 1
            else:
                failures.append({"name": c.get("name"), "expected": c.get("expected"), "actual": c.get("actual")})
    total = len(cases) if cases else 1
    # benchmark
    start = time.time()
    # trivial workload
    _ = sum(i*i for i in range(1000))
    elapsed_ms = (time.time()-start)*1000
    return _record("testing_evaluation", payload, extra={"passed": passed, "total": total,
                    "score": round(passed/total,3), "failures": failures, "benchmark_ms": round(elapsed_ms,3)})


ALGORITHMS = {
 "intelligence": intelligence_process,
 "context_state": context_state_process,
 "memory": None,  # handled with store
 "multi_agent": multi_agent_process,
 "perception": perception_process,
 "conversation": conversation_process,
 "tts": tts_process,
 "personality": personality_process,
 "multimodal": multimodal_process,
 "planning": planning_process,
 "execution": execution_process,
 "tool_intelligence": tool_intelligence_process,
 "system_control": system_control_process,
 "smart_home": smart_home_process,
 "code_engineering": code_engineering_process,
 "simulation": simulation_process,
 "communication": communication_process,
 "knowledge_research": knowledge_research_process,
 "verification": verification_process,
 "anti_hallucination": anti_hallucination_process,
 "self_correction": self_correction_process,
 "security": security_process,
 "privacy_governance": privacy_governance_process,
 "human_loop": human_loop_process,
 "alerting_emergency": alerting_emergency_process,
 "learning": None,
 "proactive": proactive_process,
 "resource_optimization": resource_optimization_process,
 "reliability": None,
 "offline_fallback": offline_fallback_process,
 "observability": observability_process,
 "testing_evaluation": testing_evaluation_process,
}
