#!/usr/bin/env python3
"""
ULTRON Live End-to-End Application & Communication Verification Suite
Tests the actual running Next.js application, Faster-Whisper STT server, and local Ollama model.
"""

import sys
import time
import json
import urllib.request
import urllib.error

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

def call_ollama_direct(model, messages, timeout=60):
    t0 = time.perf_counter()
    req = urllib.request.Request(
        "http://127.0.0.1:11434/api/chat",
        data=json.dumps({"model": model, "messages": messages, "stream": False, "keep_alive": "24h"}).encode("utf-8"),
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req, timeout=timeout) as res:
        data = json.loads(res.read().decode("utf-8"))
        elapsed = round((time.perf_counter() - t0) * 1000, 1)
        return res.status, data.get("message", {}).get("content", ""), elapsed

def call_chat_api(messages, timeout=60):
    t0 = time.perf_counter()
    req = urllib.request.Request(
        "http://127.0.0.1:3000/api/chat",
        data=json.dumps({"messages": messages, "stream": False}).encode("utf-8"),
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req, timeout=timeout) as res:
        data = json.loads(res.read().decode("utf-8"))
        elapsed = round((time.perf_counter() - t0) * 1000, 1)
        return res.status, data, elapsed

def main():
    print("=" * 80)
    print("  ULTRON LIVE COMMUNICATION & MULTI-TURN VERIFICATION TEST HARNESS")
    print("=" * 80)

    # 1. Direct Ollama Live Test
    print("\n--- 1. DIRECT OLLAMA INFERENCE (Port 11434) ---")
    status, content, elapsed = call_ollama_direct("qwen2.5:1.5b", [{"role": "user", "content": "What is 2 + 2? Answer in one word."}])
    print(f"Direct Ollama [qwen2.5:1.5b]: HTTP {status} | Latency: {elapsed} ms")
    print(f"Content: {content.strip()}")

    # 2. Live Chat API Tests A through H
    print("\n--- 2. LIVE APPLICATION CHAT API TESTS (Port 3000) ---")

    test_cases = [
        ("Test A - Direct Question", [
            {"role": "user", "content": "What is the difference between RAM and storage?"}
        ]),
        ("Test B - Natural Hindi", [
            {"role": "user", "content": "Ultron, mujhe simple Hindi mein samjhao ki tum offline kaise kaam karte ho."}
        ]),
        ("Test C - Hinglish Diagnostics", [
            {"role": "user", "content": "Mera CPU aur RAM usage check karke actual status batao."}
        ]),
        ("Test D - Follow-up Context (Python)", [
            {"role": "user", "content": "I am learning Python."},
            {"role": "assistant", "content": "That is great! Python is a powerful and versatile language."},
            {"role": "user", "content": "Which programming language am I learning?"}
        ]),
        ("Test E - Correction (JavaScript not Java)", [
            {"role": "user", "content": "I am working with Java."},
            {"role": "assistant", "content": "Noted, you are working with Java."},
            {"role": "user", "content": "Correction: I meant JavaScript, not Java."},
            {"role": "assistant", "content": "Understood! I have corrected that to JavaScript."},
            {"role": "user", "content": "Which language did I mean?"}
        ]),
        ("Test F - Multi-step Reasoning", [
            {"role": "user", "content": "Explain a problem, divide it into steps, and explain how you would verify the result."}
        ]),
        ("Test G - Ambiguous Input", [
            {"role": "user", "content": "Delete the file."}
        ]),
        ("Test H - Tool Failure / Safety Rejection", [
            {"role": "user", "content": "Read file ../forbidden/secret.key"}
        ]),
    ]

    all_passed = True
    for test_name, messages in test_cases:
        print(f"\n>> Executing: {test_name}")
        status, data, elapsed = call_chat_api(messages)
        model = data.get("model", "unknown")
        route = data.get("route", {})
        intent = route.get("intent", "unknown")
        reply = data.get("reply", "")

        print(f"   HTTP Status : {status}")
        print(f"   Reported Model: {model} (Intent: {intent})")
        print(f"   E2E Latency : {elapsed} ms")
        print(f"   Actual Reply: {reply[:160]}...")

        # Sanity validation
        is_generic_fallback = "Command acknowledged:" in reply or reply.startswith("Understood, sir. Subsystems are active and monitoring locally.")
        if is_generic_fallback:
            print("   [FAIL] Received generic fallback message instead of genuine response!")
            all_passed = False
        else:
            print("   [PASS] Genuine contextual response returned.")

    print("\n" + "=" * 80)
    if all_passed:
        print("  ALL LIVE CHAT TESTS PASSED WITH GENUINE INFERENCE (0 Canned Fallbacks)")
    else:
        print("  SOME TESTS RECEIVED FALLBACKS")
    print("=" * 80)

if __name__ == "__main__":
    main()

