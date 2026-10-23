"""
ULTRON Local Voice Core: Real-Time Wake-Word Detection & Offline Neural TTS
- Wake-Word: openwakeword (hey_jarvis / alexa / custom ONNX)
- Neural TTS: Piper (en_US-lessac-low / hi_IN-pratham-medium)
- Barge-in & Feedback Prevention: Automatic suppression while speaking
- 100% Offline, Privacy-Preserving, Zero Cloud Cost
"""

import os
import sys
import time
import queue
import threading
import wave
import io
import re
from pathlib import Path
from typing import Optional, Callable, Dict, Any, List

import numpy as np
import sounddevice as sd

# Silence non-critical warnings
os.environ["OMP_NUM_THREADS"] = "4"

WORKSPACE_ROOT = Path(__file__).resolve().parent
PIPER_MODELS_DIR = WORKSPACE_ROOT / "models" / "piper"
DEFAULT_EN_VOICE = PIPER_MODELS_DIR / "en_US-lessac-low.onnx"
DEFAULT_HI_VOICE = PIPER_MODELS_DIR / "hi_IN-pratham-medium.onnx"

class UltronWakeWord:
    def __init__(
        self,
        model_name: str = "hey_jarvis_v0.1.onnx",
        threshold: float = 0.5,
        cooldown_sec: float = 3.0,
        input_device: Optional[int] = None,
        on_wake: Optional[Callable[[Dict[str, Any]], None]] = None,
    ):
        self.model_name = model_name
        self.threshold = threshold
        self.cooldown_sec = cooldown_sec
        self.input_device = input_device
        self.on_wake = on_wake

        self.running = False
        self.suppressed = False
        self.last_trigger_time = 0.0
        self.trigger_count = 0
        self.last_score = 0.0
        self.thread: Optional[threading.Thread] = None
        self.events_queue: queue.Queue = queue.Queue(maxsize=50)

        self._model = None

    def _init_model(self):
        if self._model is not None:
            return
        from openwakeword.model import Model
        self._model = Model(wakeword_models=[self.model_name], inference_framework="onnx")
        print(f"[WAKEWORD] Initialized openwakeword engine with model '{self.model_name}'", flush=True)

    def start(self):
        if self.running:
            return
        self._init_model()
        self.running = True
        self.thread = threading.Thread(target=self._listen_loop, name="ultron-wakeword-thread", daemon=True)
        self.thread.start()
        print("[WAKEWORD] Continuous background listener started.", flush=True)

    def stop(self):
        self.running = False
        if self.thread and self.thread.is_alive():
            self.thread.join(timeout=2.0)
        self.thread = None
        print("[WAKEWORD] Background listener stopped.", flush=True)

    def set_suppressed(self, suppressed: bool):
        """Mutes wake-word detection while Ultron is actively speaking through speakers."""
        self.suppressed = suppressed

    def get_status(self) -> Dict[str, Any]:
        return {
            "running": self.running,
            "suppressed": self.suppressed,
            "model_name": self.model_name,
            "threshold": self.threshold,
            "cooldown_sec": self.cooldown_sec,
            "trigger_count": self.trigger_count,
            "last_trigger_time": self.last_trigger_time,
            "last_score": round(self.last_score, 4),
        }

    def poll_event(self) -> Optional[Dict[str, Any]]:
        try:
            return self.events_queue.get_nowait()
        except queue.Empty:
            return None

    def _listen_loop(self):
        sample_rate = 16000
        block_size = 1280  # 80ms per chunk

        while self.running:
            try:
                with sd.InputStream(
                    samplerate=sample_rate,
                    channels=1,
                    dtype="int16",
                    blocksize=block_size,
                    device=self.input_device,
                ) as stream:
                    while self.running:
                        audio_chunk, overflowed = stream.read(block_size)
                        if self.suppressed:
                            time.sleep(0.04)
                            continue

                        # Audio is 2D (1280, 1), flatten to 1D
                        chunk_1d = audio_chunk.flatten()
                        preds = self._model.predict(chunk_1d)
                        score = float(preds.get(self.model_name, 0.0))
                        self.last_score = score

                        now = time.time()
                        if score >= self.threshold and (now - self.last_trigger_time) > self.cooldown_sec:
                            self.last_trigger_time = now
                            self.trigger_count += 1
                            event = {
                                "type": "WAKE_WORD_DETECTED",
                                "model": self.model_name,
                                "score": round(score, 4),
                                "timestamp": now,
                                "count": self.trigger_count,
                            }
                            print(f"[WAKEWORD TRIGGERED] Wake phrase detected! Score: {score:.4f} (Event #{self.trigger_count})", flush=True)
                            try:
                                self.events_queue.put_nowait(event)
                            except queue.Full:
                                pass

                            if self.on_wake:
                                try:
                                    self.on_wake(event)
                                except Exception as cb_err:
                                    print(f"[WAKEWORD] Callback error: {cb_err}", flush=True)

            except Exception as stream_err:
                if self.running:
                    print(f"[WAKEWORD ERROR] Audio input stream error: {stream_err}. Retrying in 3s...", flush=True)
                    time.sleep(3.0)


class UltronNeuralTTS:
    def __init__(self, prewarm: bool = True):
        self.en_voice = None
        self.hi_voice = None
        self.is_speaking = False
        self._lock = threading.Lock()
        self._active_stream = None
        if prewarm:
            # Pre-load ONNX voice models in background thread to eliminate 15s cold-start latency
            threading.Thread(target=self._prewarm_voices, name="tts-prewarm", daemon=True).start()

    def _prewarm_voices(self):
        try:
            self._load_voice("en")
            if DEFAULT_HI_VOICE.exists():
                self._load_voice("hi")
            print("[TTS] Neural voice models pre-warmed. Instant sub-second synthesis ready.", flush=True)
        except Exception as e:
            print(f"[TTS WARNING] Voice pre-warm failed: {e}", flush=True)

    def _load_voice(self, lang: str = "en"):
        if lang == "hi":
            if self.hi_voice is None and DEFAULT_HI_VOICE.exists():
                from piper import PiperVoice
                self.hi_voice = PiperVoice.load(str(DEFAULT_HI_VOICE))
                print(f"[TTS] Loaded Hindi neural voice: {DEFAULT_HI_VOICE.name}", flush=True)
            return self.hi_voice or self._load_voice("en")
        else:
            if self.en_voice is None and DEFAULT_EN_VOICE.exists():
                from piper import PiperVoice
                self.en_voice = PiperVoice.load(str(DEFAULT_EN_VOICE))
                print(f"[TTS] Loaded English neural voice: {DEFAULT_EN_VOICE.name}", flush=True)
            return self.en_voice

    def detect_language(self, text: str) -> str:
        # Detect Devanagari script for Hindi
        if re.search(r"[\u0900-\u097F]", text):
            return "hi"
        return "en"

    def synthesize_wav_bytes(self, text: str) -> bytes:
        lang = self.detect_language(text)
        voice = self._load_voice(lang)
        if voice is None:
            return b""

        buf = io.BytesIO()
        with wave.open(buf, "wb") as wav_out:
            voice.synthesize_wav(text, wav_out)
        return buf.getvalue()

    def speak(self, text: str, on_done: Optional[Callable[[], None]] = None) -> bool:
        """Speaks the text aloud via sounddevice asynchronously with instant barge-in support."""
        with self._lock:
            # Stop any ongoing playback first
            self.stop()
            self.is_speaking = True

        def _worker():
            try:
                lang = self.detect_language(text)
                voice = self._load_voice(lang)
                if not voice:
                    return

                # Sentence chunk streaming
                for chunk in voice.synthesize(text):
                    if not self.is_speaking:
                        break
                    # sounddevice plays float32 array directly
                    sd.play(chunk.audio_float_array, chunk.sample_rate)
                    sd.wait()

            except Exception as e:
                print(f"[TTS ERROR] Speech synthesis error: {e}", flush=True)
            finally:
                with self._lock:
                    self.is_speaking = False
                if on_done:
                    try:
                        on_done()
                    except Exception:
                        pass

        th = threading.Thread(target=_worker, name="ultron-tts-speaker", daemon=True)
        th.start()
        return True

    def stop(self):
        """Instant barge-in cancellation: stops audio hardware playback immediately."""
        self.is_speaking = False
        try:
            sd.stop()
        except Exception:
            pass

