#!/usr/bin/env python3
"""
ULTRON Phase 4: Local AI Brain Benchmark & Hardware Profiling
Benchmarks qwen2.5:1.5b vs qwen2.5:0.5b on local Ollama daemon (127.0.0.1:11434).
Measures First-Token Latency (TTFT), Total Generation Latency, Eval Count, Tokens/Sec,
and Host RAM/CPU impact on Intel Core i5-8365U.
"""

import sys
import time
import json
import urllib.request
import psutil

OLLAMA_CHAT_URL = "http://127.0.0.1:11434/api/chat"
MODELS_TO_BENCHMARK = ["qwen2.5:1.5b", "qwen2.5:0.5b"]
BENCHMARK_PROMPT = "Explain the difference between a process and a thread in 2 short bullet points."

def profile_model(model_name: str):
    print(f"\n--- Benchmarking Model: {model_name} ---")
    payload = {
        "model": model_name,
        "messages": [{"role": "user", "content": BENCHMARK_PROMPT}],
        "stream": True,
        "options": {
            "temperature": 0.1,
            "num_predict": 128
        }
    }

    req = urllib.request.Request(
        OLLAMA_CHAT_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"}
    )

    mem_before = psutil.virtual_memory()
    cpu_before = psutil.cpu_percent(interval=0.2)
    start_time = time.perf_counter()
    first_token_time = None
    accumulated_text = ""
    token_count = 0
    total_eval_duration_ns = 0

    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            for line in response:
                if not line:
                    continue
                decoded = line.decode("utf-8").strip()
                if not decoded:
                    continue
                chunk = json.loads(decoded)
                msg = chunk.get("message", {}).get("content", "")
                if msg:
                    if first_token_time is None:
                        first_token_time = time.perf_counter()
                    accumulated_text += msg
                    token_count += 1
                if chunk.get("done"):
                    total_eval_duration_ns = chunk.get("eval_duration", 0)

        end_time = time.perf_counter()
        mem_after = psutil.virtual_memory()
        cpu_after = psutil.cpu_percent(interval=0.2)

        ttft_ms = round((first_token_time - start_time) * 1000, 2) if first_token_time else 0
        total_time_ms = round((end_time - start_time) * 1000, 2)
        tok_per_sec = round(token_count / ((end_time - first_token_time) if first_token_time else 1), 2)

        metrics = {
            "model": model_name,
            "ttft_ms": ttft_ms,
            "total_latency_ms": total_time_ms,
            "tokens_generated": token_count,
            "tokens_per_sec": tok_per_sec,
            "ram_used_gb": round(mem_after.used / (1024**3), 2),
            "ram_available_gb": round(mem_after.available / (1024**3), 2),
            "ram_percent": mem_after.percent,
            "sample_output": accumulated_text.strip()[:160] + "..."
        }

        print(f"  TTFT (First Token): {metrics['ttft_ms']} ms")
        print(f"  Total Duration:     {metrics['total_latency_ms']} ms")
        print(f"  Tokens Generated:   {metrics['tokens_generated']}")
        print(f"  Generation Speed:   {metrics['tokens_per_sec']} tokens/sec")
        print(f"  Host RAM Used:      {metrics['ram_used_gb']} GB ({metrics['ram_percent']}%)")
        print(f"  Sample Text:        {metrics['sample_output']}")

        return metrics
    except Exception as e:
        print(f"  [ERROR] Benchmark failed for {model_name}: {e}")
        return {"model": model_name, "error": str(e)}

def main():
    print("=" * 72)
    print("   ULTRON LOCAL AI BRAIN BENCHMARK (INTEL CORE i5-8365U CPU)")
    print("=" * 72)
    print(f"Host CPU: {psutil.cpu_count(logical=False)} physical cores / {psutil.cpu_count(logical=True)} logical threads")
    print(f"Host Total RAM: {round(psutil.virtual_memory().total / (1024**3), 2)} GB")

    results = []
    for m in MODELS_TO_BENCHMARK:
        res = profile_model(m)
        results.append(res)

    out_file = "scratch/local_brain_benchmark_results.json"
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)
    print(f"\n[BENCHMARK COMPLETE] Saved results to {out_file}")

if __name__ == "__main__":
    main()
