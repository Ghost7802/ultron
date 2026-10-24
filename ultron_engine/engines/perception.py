"""5. Perception Engine: wake word, STT, speaker ID, camera, screen, environment."""
import asyncio, time, hashlib, math
from typing import Any, Dict, List
from ..core import BaseEngine, EventBus, SharedState

class PerceptionEngine(BaseEngine):
    name = "perception"
    layer = "interaction"

    def __init__(self, bus, state):
        super().__init__(bus, state)
        self._lock = asyncio.Lock()
        self._buffer = []
        self._wake_phrases = ["ultron", "hey ultron", "ok ultron"]
        self._speakers = {}

    async def start(self):
        await super().start()
        self.bus.subscribe("perception.*", self._on)

    async def _on(self, ev):
        pass

    def detect_wake_word(self, text: str) -> dict:
        low = (text or "").lower()
        detected = any(w in low for w in self._wake_phrases)
        confidence = 0.95 if detected else 0.0
        return {"detected": detected, "confidence": confidence, "phrase": next((w for w in self._wake_phrases if w in low), None)}

    def stt_normalize(self, text: str) -> dict:
        # basic cleanup: trim, collapse spaces, lowercase first char handling
        t = " ".join((text or "").split())
        return {"text": t, "chars": len(t), "words": len(t.split()) if t else 0}

    def identify_speaker(self, audio_features: dict) -> dict:
        # hash-based pseudo speaker id from features
        key = str(sorted((audio_features or {}).items()))
        sid = hashlib.sha256(key.encode()).hexdigest()[:12]
        self._speakers.setdefault(sid, {"count": 0})
        self._speakers[sid]["count"] += 1
        return {"speaker_id": sid, "seen_before": self._speakers[sid]["count"] > 1, "count": self._speakers[sid]["count"]}

    def analyze_frame(self, frame_meta: dict) -> dict:
        # camera/screen: brightness, motion heuristic from metadata
        brightness = (frame_meta or {}).get("brightness", 0.5)
        motion = (frame_meta or {}).get("motion", 0.0)
        env = "bright" if brightness > 0.6 else "dim"
        return {"brightness": brightness, "motion": motion, "environment": env, "has_face": (frame_meta or {}).get("face", False)}

    async def process(self, payload=None):
        if not isinstance(payload, dict):
            payload = {"action": "perceive", "text": str(payload or "")}
        action = payload.get("action", "perceive")
        async with self._lock:
            if action == "wake":
                res = self.detect_wake_word(payload.get("text", ""))
            elif action == "stt":
                res = self.stt_normalize(payload.get("text", ""))
            elif action == "speaker":
                res = self.identify_speaker(payload.get("features", {}))
            elif action == "frame":
                res = self.analyze_frame(payload.get("meta", {}))
            elif action == "environment":
                res = {"ambient": payload.get("ambient", "unknown"), "ts": time.time()}
            else:
                res = {"perceived": True, "text": payload.get("text", "")}
            self._buffer.append({"action": action, "ts": time.time()})
            if len(self._buffer) > 1000:
                self._buffer = self._buffer[-500:]
            await self.bus.publish("perception.processed", res, source=self.name)
            await self.state.set("last_perception", res)
            return {"id": __import__("uuid").uuid4().__str__(), "engine": self.name, "status": "ok", **res}

    async def get_state(self):
        async with self._lock:
            return {"name": self.name, "buffer_len": len(self._buffer), "speakers": len(self._speakers)}

    def health(self):
        return {"name": self.name, "layer": self.layer, "running": self._running}
