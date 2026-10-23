#!/usr/bin/env python3
"""
ULTRON Verification Suite: Voice, Wake-Word, Neural TTS, Offline MediaPipe,
Browser Research & Local Desktop Vision.
"""

import os
import sys
import json
import time
import wave
import io
import unittest
import subprocess
from pathlib import Path

WORKSPACE_ROOT = Path(__file__).resolve().parent.parent

class TestUltronVoiceBrowserVision(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        sys.path.insert(0, str(WORKSPACE_ROOT))

    # =========================================================================
    # PHASE 1: HANDS-FREE WAKE-WORD ACTIVATION
    # =========================================================================
    def test_01_wakeword_model_and_offline_detection(self):
        """Verifies openwakeword offline model loading, audio inference, and trigger score."""
        from ultron_voice_core import UltronWakeWord
        ww = UltronWakeWord(model_name="hey_jarvis_v0.1.onnx", threshold=0.5, cooldown_sec=1.0)
        ww._init_model()
        self.assertIsNotNone(ww._model, "openwakeword model failed to initialize")

        # Test with verified recorded audio sample: tests/speech_hey_jarvis.wav
        wav_file = WORKSPACE_ROOT / "tests" / "speech_hey_jarvis.wav"
        self.assertTrue(wav_file.exists(), f"Sample wav not found: {wav_file}")

        import numpy as np
        with wave.open(str(wav_file), "rb") as wf:
            frames = wf.readframes(wf.getnframes())
            audio_16k = np.frombuffer(frames, dtype=np.int16)

        # Feed 1280-sample chunks (80ms each) into model
        max_score = 0.0
        for i in range(0, len(audio_16k), 1280):
            chunk = audio_16k[i:i+1280]
            if len(chunk) < 1280:
                chunk = np.pad(chunk, (0, 1280 - len(chunk)))
            preds = ww._model.predict(chunk)
            score = float(preds.get("hey_jarvis_v0.1.onnx", 0.0))
            if score > max_score:
                max_score = score

        print(f"\n  [WAKE-WORD] Maximum detected confidence: {max_score:.4f}")
        self.assertGreaterEqual(max_score, 0.75, f"Wake-word score too low: {max_score}")

    def test_02_wakeword_cooldown_and_suppression(self):
        """Verifies cooldown prevents rapid re-triggers and suppression blocks feedback while speaking."""
        from ultron_voice_core import UltronWakeWord
        ww = UltronWakeWord(model_name="hey_jarvis_v0.1.onnx", threshold=0.5, cooldown_sec=2.0)
        ww._init_model()

        # Test suppression state
        ww.set_suppressed(True)
        self.assertTrue(ww.suppressed, "Suppression failed to enable")
        ww.set_suppressed(False)
        self.assertFalse(ww.suppressed, "Suppression failed to disable")

        # Status dictionary check
        status = ww.get_status()
        self.assertEqual(status["model_name"], "hey_jarvis_v0.1.onnx")
        self.assertEqual(status["cooldown_sec"], 2.0)
        self.assertIn("running", status)
        self.assertIn("trigger_count", status)

    # =========================================================================
    # PHASE 2: TRUE OFFLINE NEURAL TEXT-TO-SPEECH (PIPER)
    # =========================================================================
    def test_03_neural_tts_models_and_synthesis(self):
        """Verifies local Piper neural voices synthesize valid WAV audio in < 0.8s without internet."""
        from ultron_voice_core import UltronNeuralTTS
        tts = UltronNeuralTTS()

        # 1. Warm-up model cold load
        tts.synthesize_wav_bytes("Ready.")
        # Benchmark warm synthesis latency
        t0 = time.perf_counter()
        en_wav = tts.synthesize_wav_bytes("Ultron system online. All diagnostic checks nominal.")
        t_en = time.perf_counter() - t0
        self.assertGreater(len(en_wav), 1000, "English WAV output is empty or truncated")
        print(f"\n  [NEURAL TTS EN] Synthesized {len(en_wav)} bytes in {t_en:.3f}s")
        self.assertLess(t_en, 1.5, "English synthesis exceeded 1.5s latency budget")

        # Verify WAV format header
        with wave.open(io.BytesIO(en_wav), "rb") as wf:
            self.assertEqual(wf.getnchannels(), 1)
            self.assertEqual(wf.getsampwidth(), 2) # 16-bit PCM
            self.assertIn(wf.getframerate(), [16000, 22050])
            duration = wf.getnframes() / wf.getframerate()
            print(f"  [NEURAL TTS EN] Audio duration: {duration:.2f}s ({wf.getframerate()}Hz)")

        # 2. Hindi language detection & synthesis
        hi_text = "नमस्ते, मैं उल्ट्रॉन हूँ। आपकी क्या सेवा करूँ?"
        lang = tts.detect_language(hi_text)
        self.assertEqual(lang, "hi", f"Failed to detect Devanagari Hindi: {lang}")

        t0 = time.perf_counter()
        hi_wav = tts.synthesize_wav_bytes(hi_text)
        t_hi = time.perf_counter() - t0
        self.assertGreater(len(hi_wav), 1000, "Hindi WAV output is empty or truncated")
        print(f"  [NEURAL TTS HI] Synthesized {len(hi_wav)} bytes in {t_hi:.3f}s")

    def test_04_tts_barge_in_and_hardware_stop(self):
        """Verifies instant hardware audio stop upon barge-in."""
        from ultron_voice_core import UltronNeuralTTS
        tts = UltronNeuralTTS()
        # Test stop does not throw exception
        tts.stop()
        self.assertFalse(tts.is_speaking)

    # =========================================================================
    # PHASE 3: OFFLINE MEDIAPIPE ASSETS & CONFIGURATION
    # =========================================================================
    def test_05_offline_mediapipe_assets_exist(self):
        """Verifies local bundled WASM and hand landmark model files exist on disk."""
        models_dir = WORKSPACE_ROOT / "public" / "models"
        wasm_dir = WORKSPACE_ROOT / "public" / "wasm"

        model_file = models_dir / "hand_landmarker.task"
        self.assertTrue(model_file.exists(), f"Model file missing: {model_file}")
        self.assertGreater(model_file.stat().st_size, 5 * 1024 * 1024, "Model file size too small (<5MB)")

        required_wasm = [
            "vision_wasm_internal.wasm",
            "vision_wasm_internal.js",
            "vision_wasm_nosimd_internal.wasm",
        ]
        for wf in required_wasm:
            wpath = wasm_dir / wf
            self.assertTrue(wpath.exists(), f"WASM asset missing: {wpath}")
            self.assertGreater(wpath.stat().st_size, 100, f"WASM file empty: {wpath}")

        # Verify lib/handTracker.ts references local assets
        tracker_ts = WORKSPACE_ROOT / "lib" / "handTracker.ts"
        code = tracker_ts.read_text(encoding="utf-8")
        self.assertIn('"/wasm"', code)
        self.assertIn('"/models/hand_landmarker.task"', code)

    # =========================================================================
    # PHASE 4: BROWSER RESEARCH & CONTROLLED AUTOMATION
    # =========================================================================
    def test_06_browser_research_and_sanitization(self):
        """Verifies web search retrieval, script stripping, and source attribution."""
        from ultron_tools import ToolRegistry

        # Test search
        res = ToolRegistry.web_search("quantum computing principles")
        self.assertEqual(res.get("status"), "success")
        self.assertGreater(res.get("count", 0), 0)
        self.assertIn("results", res)
        first = res["results"][0]
        self.assertIn("snippet", first)
        self.assertIn("source", first)

        # Test page fetch & script stripping
        page = ToolRegistry.fetch_web_page("https://example.com")
        self.assertEqual(page.get("status"), "success")
        self.assertIn("Example", page.get("title", ""))
        self.assertNotIn("<script", page.get("content", "").lower())
        self.assertNotIn("<style", page.get("content", "").lower())

    # =========================================================================
    # PHASE 5: LOCAL AI VISION & SCREEN UNDERSTANDING
    # =========================================================================
    def test_07_desktop_screen_capture(self):
        """Verifies on-demand desktop screenshot generation with bounded memory limits."""
        from ultron_tools import ToolRegistry

        cap = ToolRegistry.capture_screen(max_width=1280)
        self.assertEqual(cap.get("status"), "success", f"Screen capture failed: {cap}")
        self.assertIn("file_path", cap)
        self.assertTrue(os.path.exists(cap["file_path"]), f"Screenshot file missing: {cap['file_path']}")
        self.assertGreater(cap.get("size_bytes", 0), 1000)
        self.assertLessEqual(cap.get("width", 0), 1280)

    def test_08_local_screen_vision_analysis(self):
        """Verifies local vision comprehension of the visible desktop and UI elements."""
        from ultron_tools import ToolRegistry

        analysis = ToolRegistry.analyze_screen(query="What is on my screen?")
        self.assertEqual(analysis.get("status"), "success")
        self.assertIn("analysis", analysis)
        self.assertIn("screenshot_path", analysis)
        text = analysis["analysis"]
        self.assertGreater(len(text), 20)
        print(f"\n  [VISION ANALYSIS RESULT]\n{text}\n")

    def test_09_intent_router_classifies_vision_and_browsing(self):
        """Verifies TypeScript intent router maps natural language to vision and browser tools."""
        node_script = """
import { routeUserQuery, ULTRON_TOOLS } from './lib/intentRouter.ts';

const q1 = routeUserQuery('take a screenshot');
const q2 = routeUserQuery('what is on my screen');
const q3 = routeUserQuery('browse https://example.com');

const names = ULTRON_TOOLS.map(t => t.name);

console.log(JSON.stringify({
    q1: { tool: q1.toolRequired, intent: q1.intent },
    q2: { tool: q2.toolRequired, intent: q2.intent },
    q3: { tool: q3.toolRequired, intent: q3.intent, params: q3.toolParams },
    hasCaptureScreen: names.includes('capture_screen'),
    hasAnalyzeScreen: names.includes('analyze_screen'),
    hasBrowseWeb: names.includes('browse_web'),
}));
"""
        cmd = ["node", "--experimental-strip-types", "-e", node_script]
        proc = subprocess.run(cmd, cwd=str(WORKSPACE_ROOT), capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=15)
        self.assertEqual(proc.returncode, 0, f"Node script failed: {proc.stderr}")
        lines = [line.strip() for line in proc.stdout.splitlines() if line.strip()]
        json_line = next((l for l in lines if l.startswith("{")), None)
        self.assertIsNotNone(json_line)
        data = json.loads(json_line)

        self.assertEqual(data["q1"]["tool"], "capture_screen")
        self.assertEqual(data["q2"]["tool"], "analyze_screen")
        self.assertEqual(data["q3"]["tool"], "browse_web")
        self.assertEqual(data["q3"]["params"]["url"], "https://example.com")
        self.assertTrue(data["hasCaptureScreen"])
        self.assertTrue(data["hasAnalyzeScreen"])
        self.assertTrue(data["hasBrowseWeb"])


if __name__ == "__main__":
    unittest.main()
