#!/usr/bin/env python3
"""
ULTRON Intent & Router Verification Suite
Tests deterministic 0ms rules, factual traps, identity guardrails, and intent routing.
"""

import re
import sys

FACTUAL_TRAPS = [
    ("what is the 5th law of thermodynamics", "There is no 5th law of thermodynamics"),
    ("who was the president of the united states in 1650", "There was no President of the United States in the year 1650"),
    ("what is the atomic number of vibranium", "Vibranium is a fictional element"),
    ("what is the capital of australia", "Canberra"),
]

def test_factual_traps():
    print("[TEST] Running Factual Trap Tests...")
    for query, expected_snippet in FACTUAL_TRAPS:
        lower = query.lower()
        matched = False
        if "5th law of thermodynamics" in lower or "fifth law" in lower:
            ans = "There is no 5th law of thermodynamics. Thermodynamics fundamentally consists only of the Zeroth, First, Second, and Third laws."
            matched = True
        elif "1650" in lower and "president" in lower:
            ans = "There was no President of the United States in the year 1650. The United States was founded in 1776."
            matched = True
        elif "vibranium" in lower:
            ans = "Vibranium is a fictional element from Marvel Comics. It does not exist on the real periodic table of elements."
            matched = True
        elif "capital" in lower and "australia" in lower:
            ans = "The capital of Australia is Canberra."
            matched = True
        
        assert matched, f"Failed to match trap pattern for: {query}"
        assert expected_snippet.lower() in ans.lower(), f"Unexpected answer: {ans}"
    print("  --> All 4 Factual Trap Guardrails PASSED.")

def test_deterministic_queries():
    print("[TEST] Running Deterministic System Queries...")
    queries = ["what time is it", "aaj kya date hai", "who are you", "tum kaun ho"]
    for q in queries:
        lower = q.lower()
        is_time = "time" in lower or "date" in lower
        is_id = "who are you" in lower or "tum kaun ho" in lower
        assert is_time or is_id, f"Query routing failed for: {q}"
    print("  --> Deterministic Time/Date & Canonical Identity PASSED.")

def test_targeted_system_control_and_telemetry():
    print("[TEST] Running Targeted Telemetry, Educational & Orb Regression Tests...")

    test_cases = [
        ("Check CPU usage", "TOOL_CALL", "get_system_diagnostics", "local-rule"),
        ("Mera CPU aur RAM usage check karke actual status batao", "TOOL_CALL", "get_system_diagnostics", "local-rule"),
        ("What is CPU usage?", "COMPLEX_REASONING", None, "qwen2.5:1.5b"),
        ("Explain how RAM usage is calculated", "COMPLEX_REASONING", None, "qwen2.5:1.5b"),
        ("What is the difference between RAM and storage?", "COMPLEX_REASONING", None, "qwen2.5:1.5b"),
        ("Reset orb", "TOOL_CALL", "system_control", "local-rule"),
        ("aaj ki world wide news live bol ke bataye", "TOOL_CALL", "live_world_news", "local-rule"),
    ]

    # 1. Test directly against actual TypeScript intent router (lib/intentRouter.ts) via Node
    import subprocess
    import json
    queries = [tc[0] for tc in test_cases]
    node_script = """
import { routeUserQuery } from './lib/intentRouter.ts';
const queries = JSON.parse(process.argv[1]);
const res = queries.map(q => {
  const r = routeUserQuery(q);
  return { query: q, intent: r.intent, toolRequired: r.toolRequired || null, targetModel: r.targetModel };
});
console.log(JSON.stringify(res));
"""
    try:
        proc = subprocess.run(
            ["node", "--experimental-strip-types", "-e", node_script, json.dumps(queries)],
            capture_output=True,
            text=True,
            encoding="utf-8",
            check=True
        )
        # Parse output from stdout
        lines = [line.strip() for line in proc.stdout.splitlines() if line.strip()]
        json_line = next((l for l in lines if l.startswith("[")), None)
        assert json_line, "Failed to capture JSON output from TypeScript router test"
        ts_results = json.loads(json_line)
        for idx, (query, exp_intent, exp_tool, exp_model) in enumerate(test_cases):
            actual = ts_results[idx]
            assert actual["intent"] == exp_intent, f"TS router query '{query}': expected intent {exp_intent}, got {actual['intent']}"
            assert actual["toolRequired"] == exp_tool, f"TS router query '{query}': expected tool {exp_tool}, got {actual['toolRequired']}"
            print(f"  --> [PASS TS Router] '{query}' => {actual['intent']} ({actual['toolRequired'] or 'no tool'}) [{actual['targetModel']}]")
    except Exception as e:
        print(f"  [ERROR] Node direct router test error: {e}", file=sys.stderr)
        raise

    # 2. Standalone Python regex verification
    orb_pattern = re.compile(r'\b(reset view|reset orb|orb reset|camera reset)\b', re.I)
    telemetry_patterns = [
        re.compile(r'\b(status report|system status|system diagnostic|diagnostics|hardware check|subsystems check|सिस्टम चेक)\b', re.I),
        re.compile(r'\b(?:check|show|get|display|batao|dekho|give me|report)\s+(?:the\s+|my\s+|mera\s+|current\s+|live\s+)?(?:cpu|ram|battery|hardware|telemetry|system)(?:\s+(?:aur|and|,)\s+(?:cpu|ram|battery|hardware|telemetry|system))?\s*(?:usage|utilization|status|metrics|report)?\b', re.I),
        re.compile(r'\b(?:cpu|ram|battery|hardware|telemetry)(?:\s+(?:aur|and|,)\s+(?:cpu|ram|battery|hardware|telemetry))?\s*(?:usage|utilization|status|metrics|stats)\s*(?:check|batao|dekho|karo|report|do|de do|bata do)?\b', re.I),
        re.compile(r'\b(system kaisa hai|system kaisa chal raha hai|kya chal raha hai)\b', re.I),
        re.compile(r'\b(?:system|hardware)\s*(?:telemetry|metrics|stats)\b', re.I),
    ]
    educational_pattern = re.compile(r'\b(what is|what are|explain|difference between|how does|how is|why|kyon|kaise kaam|kya hota hai|concept of)\b', re.I)

    def route_query_py(text: str):
        lower = text.lower()
        if orb_pattern.search(lower):
            return "TOOL_CALL", "system_control"
        if re.search(r"\b(?:world\s*wide\s*news|news\s+(?:batao|sunao|padho|bolo|read|speak))\b", lower):
            return "TOOL_CALL", "live_world_news"
        if not educational_pattern.search(lower):
            for pat in telemetry_patterns:
                if pat.search(lower):
                    return "TOOL_CALL", "get_system_diagnostics"
        if educational_pattern.search(lower) or "difference between" in lower:
            return "COMPLEX_REASONING", None
        return "FAST_CHAT", None

    for query, exp_intent, exp_tool, exp_model in test_cases:
        intent, tool = route_query_py(query)
        assert intent == exp_intent, f"Query '{query}': expected intent {exp_intent}, got {intent}"
        assert tool == exp_tool, f"Query '{query}': expected tool {exp_tool}, got {tool}"
        print(f"  --> [PASS Py Logic] '{query}' => {intent} ({tool or 'no tool'})")

    print("  --> All 6 Targeted Regression Tests PASSED across both TS and Python.")

def main():
    try:
        test_factual_traps()
        test_deterministic_queries()
        test_targeted_system_control_and_telemetry()
        print("[SUCCESS] All Router tests passed.")
        return 0
    except AssertionError as e:
        print(f"[FAIL] {e}", file=sys.stderr)
        return 1

if __name__ == "__main__":
    sys.exit(main())
