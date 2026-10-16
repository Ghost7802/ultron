#!/usr/bin/env python3
"""
ULTRON Synthesized Acoustic Audio STT & End-to-End Pipeline Verification
Feeds synthesized acoustic speech WAV files (generated via Windows SAPI, 16kHz PCM)
to /api/transcribe (Faster-Whisper on port 5001) and traces the resulting transcript
into /api/chat (port 3000).

NOTE: This tests recorded acoustic WAV processing through Faster-Whisper.
It does NOT represent a physical live microphone hardware test with human voice.
"""

import sys
import time
import json
import urllib.request
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

def test_transcribe(wav_path: str):
    t0 = time.perf_counter()
    with open(wav_path, "rb") as f:
        audio_data = f.read()

    req = urllib.request.Request(
        "http://127.0.0.1:3000/api/transcribe",
        data=audio_data,
        headers={"Content-Type": "audio/wav"}
    )
    with urllib.request.urlopen(req, timeout=30) as res:
        data = json.loads(res.read().decode("utf-8"))
        elapsed_ms = round((time.perf_counter() - t0) * 1000, 1)
        return res.status, data.get("text", "").strip(), elapsed_ms

def test_chat(transcript: str):
    t0 = time.perf_counter()
    payload = {
        "messages": [{"role": "user", "content": transcript}],
        "stream": False
    }
    req = urllib.request.Request(
        "http://127.0.0.1:3000/api/chat",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req, timeout=45) as res:
        data = json.loads(res.read().decode("utf-8"))
        elapsed_ms = round((time.perf_counter() - t0) * 1000, 1)
        return res.status, data, elapsed_ms

def main():
    print("=" * 80)
    print("  ULTRON SYNTHESIZED SPEECH AUDIO STT & PIPELINE TRACE (RECORDED SAPI WAV)")
    print("=" * 80)

    test_audios = [
        ("tests/speech_english.wav", "Hello Ultron what time is it"),
        ("tests/speech_status.wav", "Status report"),
        ("tests/speech_ram.wav", "What is the difference between RAM and storage"),
    ]

    all_passed = True
    for wav_file, intended_speech in test_audios:
        print(f"\n[SPEECH TEST] Intended: \"{intended_speech}\"")
        print(f"  Audio File: {wav_file} ({Path(wav_file).stat().st_size} bytes)")

        # Step 1: STT Transcription
        status_stt, transcript, stt_ms = test_transcribe(wav_file)
        print(f"  STT Pipeline : HTTP {status_stt} | Latency: {stt_ms} ms")
        print(f"  Recognized   : \"{transcript}\"")

        # Step 2: Transcript Integrity Check
        normalized_intended = intended_speech.lower().replace(",", "").replace(".", "").replace("?", "").strip()
        normalized_actual = transcript.lower().replace(",", "").replace(".", "").replace("?", "").strip()

        # Word overlap check
        intended_words = set(normalized_intended.split())
        actual_words = set(normalized_actual.split())
        overlap = intended_words.intersection(actual_words)
        match_ratio = len(overlap) / max(1, len(intended_words))

        print(f"  Integrity    : {len(overlap)}/{len(intended_words)} words matched ({round(match_ratio * 100, 1)}%)")

        # Step 3: Forward into Chat API
        status_chat, chat_data, chat_ms = test_chat(transcript)
        reply = chat_data.get("reply", "")
        model = chat_data.get("model", "")
        intent = chat_data.get("route", {}).get("intent", "")

        print(f"  Chat API     : HTTP {status_chat} | Route: {intent} (Model: {model}) | Latency: {chat_ms} ms")
        print(f"  Spoken Output: \"{reply[:120]}...\"")

        if match_ratio >= 0.6 and status_chat == 200 and len(reply) > 0:
            print(f"  [PASS] Speech recognized and routed successfully!")
        else:
            print(f"  [FAIL] Recognition or routing failure!")
            all_passed = False

    print("\n" + "=" * 80)
    if all_passed:
        print("  ALL REAL SPEECH AUDIO PIPELINE TESTS PASSED (100% OK)")
    else:
        print("  ONE OR MORE REAL SPEECH TESTS FAILED")
    print("=" * 80)

if __name__ == "__main__":
    main()

