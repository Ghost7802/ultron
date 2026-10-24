"""Engine: offline_fallback (infra)."""
import asyncio, time, uuid
from typing import Any, Dict, List
from ..core import BaseEngine, EventBus, SharedState
from ..algorithms import *

class OfflineFallbackEngine(BaseEngine):
    name = "offline_fallback"
    layer = "infra"

    def __init__(self, bus: EventBus, state: SharedState):
        super().__init__(bus, state)
        self._store = {}
        self._history = []
        self._lock = asyncio.Lock()

    async def start(self):
        await super().start()
        self.bus.subscribe(self.name + ".*", self._on_event)

    async def _on_event(self, ev):
        pass

    async def process(self, payload=None):
        async with self._lock:
            if self.name == "memory":
                rec = memory_process(payload, self._store)
            elif self.name == "learning":
                rec = learning_process(payload, self._store)
            elif self.name == "reliability":
                rec = reliability_process(payload, self._store)
            else:
                fn = globals().get(self.name + "_process")
                rec = fn(payload) if fn else {"id": str(uuid.uuid4()), "engine": self.name, "ts": time.time(), "payload": payload, "status": "ok"}
            self._history.append(rec)
            if len(self._history) > 5000:
                self._history = self._history[-2500:]
            await self.bus.publish(self.name + ".processed", rec, source=self.name)
            return rec

    async def get_state(self):
        async with self._lock:
            return {"name": self.name, "store": self._store, "history_len": len(self._history)}

    def health(self):
        return {"name": self.name, "layer": self.layer, "running": self._running,
                "history_len": len(self._history)}
