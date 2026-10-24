"""9. Multimodal Engine: combine text, audio, image, video, docs, screen."""
import asyncio, time, hashlib
from typing import Any, Dict, List
from ..core import BaseEngine, EventBus, SharedState

class MultimodalEngine(BaseEngine):
    name = "multimodal"
    layer = "interaction"

    def __init__(self, bus, state):
        super().__init__(bus, state)
        self._lock = asyncio.Lock()

    async def start(self):
        await super().start()
        self.bus.subscribe("multimodal.*", self._on)

    async def _on(self, ev):
        pass

    def fuse(self, inputs: dict) -> dict:
        modalities = []
        fused_text_parts = []
        for k in ("text", "audio", "image", "video", "doc", "screen"):
            v = inputs.get(k)
            if v is not None:
                modalities.append(k)
                if isinstance(v, str):
                    fused_text_parts.append(v)
                elif isinstance(v, dict) and "text" in v:
                    fused_text_parts.append(str(v["text"]))
        fused_text = " ".join(fused_text_parts)
        # simple confidence: more modalities -> higher
        confidence = min(1.0, 0.4 + 0.12 * len(modalities))
        return {"modalities": modalities, "modality_count": len(modalities),
                "fused_text": fused_text, "confidence": round(confidence, 3)}

    async def process(self, payload=None):
        if not isinstance(payload, dict):
            payload = {"text": str(payload or "")}
        action = payload.get("action", "fuse")
        async with self._lock:
            if action == "fuse":
                res = self.fuse(payload)
            else:
                res = {"ok": True}
            await self.bus.publish("multimodal.processed", res, source=self.name)
            await self.state.set("multimodal", res)
            return {"id": __import__("uuid").uuid4().__str__(), "engine": self.name, "status": "ok", **res}

    async def get_state(self):
        async with self._lock:
            return {"name": self.name}

    def health(self):
        return {"name": self.name, "layer": self.layer, "running": self._running}
