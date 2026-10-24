"""0. Orchestrator / Kernel: coordinates all engines via event bus."""
import asyncio, time
from typing import Dict, List
from ..core import BaseEngine, EventBus, SharedState


class OrchestratorEngine(BaseEngine):
    name = "orchestrator"
    layer = "core"

    def __init__(self, bus, state):
        super().__init__(bus, state)
        self.engines: Dict[str, BaseEngine] = {}
        self._routes: Dict[str, List[str]] = {}
        self._lock = asyncio.Lock()

    def register(self, engine):
        self.engines[engine.name] = engine
        self.bus.subscribe(f"{engine.name}.*", self._on_engine_event)

    async def _on_engine_event(self, ev):
        await self.bus.publish("orchestrator.event", {"topic": ev.topic, "source": ev.source}, source=self.name)

    async def start(self):
        await super().start()
        for e in self.engines.values():
            await e.start()
        await self.bus.publish("orchestrator.ready", {"engines": list(self.engines)}, source=self.name)

    async def stop(self):
        for e in reversed(list(self.engines.values())):
            await e.stop()
        await super().stop()

    async def dispatch(self, intent, payload=None):
        payload = payload or {}
        await self.state.set("active_task", {"intent": intent, "payload": payload, "ts": time.time()})
        await self.bus.publish("intent.dispatch", {"intent": intent, "payload": payload}, source=self.name)
        # route to engines by intent
        targets = self._routes.get(intent, [])
        results = []
        for t in targets:
            e = self.engines.get(t)
            if e:
                try:
                    results.append(await e.process(payload))
                except Exception as ex:
                    results.append({"error": str(ex), "engine": t})
        return {"status": "dispatched", "intent": intent, "results": results}

    def add_route(self, intent, engine_name):
        self._routes.setdefault(intent, []).append(engine_name)

    async def broadcast_health(self):
        return {n: e.health() for n, e in self.engines.items()}

    def health(self):
        return {"name": self.name, "layer": self.layer, "running": self._running,
                "registered": len(self.engines), "routes": len(self._routes)}
