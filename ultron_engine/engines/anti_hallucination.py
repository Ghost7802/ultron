"""20. Anti-Hallucination Engine: grounding, confidence, fake-result prevention."""
import asyncio, time, uuid, re
from typing import Any, Dict
from ..core import BaseEngine, EventBus, SharedState

class AntiHallucinationEngine(BaseEngine):
    name = "anti_hallucination"
    layer = "quality"

    def __init__(self, bus, state):
        super().__init__(bus, state)
        self._lock = asyncio.Lock()

    async def start(self):
        await super().start()
        self.bus.subscribe("anti_hallucination.*", self._on)

    async def _on(self, ev):
        pass

    def ground(self, response, evidence):
        # check each sentence of response is supported by evidence corpus
        corpus = " ".join(str(e) for e in (evidence or [])).lower()
        sents = [s.strip() for s in re.split(r"[.!?]", response or "") if s.strip()]
        unsupported = []
        for s in sents:
            # naive: require at least one keyword (len>4) present in corpus
            words = [w for w in s.lower().split() if len(w) > 4]
            if words and not any(w in corpus for w in words):
                unsupported.append(s)
        grounded = len(unsupported) == 0
        return {"grounded": grounded, "unsupported_claims": unsupported,
                "total_sentences": len(sents)}

    def assess_confidence(self, evidence_count, source_agreement):
        # source_agreement: 0..1
        base = min(1.0, 0.3 + 0.15 * evidence_count)
        conf = base * (0.5 + 0.5 * source_agreement)
        return round(conf, 3)

    def detect_fabrication(self, text, known_sources):
        # check for fabricated URLs/sources
        urls = re.findall(r"https?://\S+", text or "")
        known = set(known_sources or [])
        fabricated = [u for u in urls if u not in known]
        return {"fabricated_urls": fabricated, "has_fabrication": len(fabricated) > 0}

    async def process(self, payload=None):
        if not isinstance(payload, dict):
            payload = {"action": "ground"}
        action = payload.get("action", "ground")
        if action == "ground":
            r = self.ground(payload.get("response", ""), payload.get("evidence", []))
            return {"id": str(uuid.uuid4()), "engine": self.name, "status": "ok", **r}
        if action == "confidence":
            c = self.assess_confidence(payload.get("evidence_count", 0), payload.get("agreement", 0.5))
            return {"id": str(uuid.uuid4()), "engine": self.name, "status": "ok", "confidence": c}
        if action == "fabrication":
            r = self.detect_fabrication(payload.get("text", ""), payload.get("known_sources", []))
            return {"id": str(uuid.uuid4()), "engine": self.name, "status": "ok", **r}
        # default full check
        g = self.ground(payload.get("response", ""), payload.get("evidence", []))
        c = self.assess_confidence(len(payload.get("evidence", [])), payload.get("agreement", 0.5))
        f = self.detect_fabrication(payload.get("response", ""), payload.get("known_sources", []))
        decision = "allow" if (g["grounded"] and c >= 0.6 and not f["has_fabrication"]) else "block"
        return {"id": str(uuid.uuid4()), "engine": self.name, "status": "ok",
                "grounded": g["grounded"], "confidence": c, "fabrication": f["has_fabrication"],
                "decision": decision}

    async def get_state(self):
        return {"name": self.name}

    def health(self):
        return {"name": self.name, "layer": self.layer, "running": self._running}
