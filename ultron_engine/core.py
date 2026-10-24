"""ULTRON Core: EventBus, SharedState, BaseEngine with persistence hooks."""
import asyncio, time, uuid, sqlite3, os, json, hashlib
from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List, Optional

DB_PATH = os.path.join(os.path.dirname(__file__), "ultron_state.db")


@dataclass
class Event:
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    topic: str = ""
    payload: Any = None
    source: str = ""
    ts: float = field(default_factory=time.time)
    priority: int = 0


class EventBus:
    def __init__(self, max_history=50000):
        self._subs: Dict[str, List[Callable]] = {}
        self._history: List[Event] = []
        self._lock = asyncio.Lock()
        self._max = max_history
        self._metrics = {"published": 0, "delivered": 0, "errors": 0}

    def subscribe(self, topic, handler):
        self._subs.setdefault(topic, []).append(handler)

    def unsubscribe(self, topic, handler):
        if topic in self._subs:
            self._subs[topic] = [h for h in self._subs[topic] if h is not handler]

    async def publish(self, topic, payload=None, source="", priority=0):
        ev = Event(topic=topic, payload=payload, source=source, priority=priority)
        async with self._lock:
            self._history.append(ev)
            if len(self._history) > self._max:
                self._history = self._history[-self._max // 2:]
            self._metrics["published"] += 1
        handlers = list(self._subs.get(topic, [])) + list(self._subs.get("*", []))
        for h in handlers:
            try:
                r = h(ev)
                if asyncio.iscoroutine(r):
                    await r
                self._metrics["delivered"] += 1
            except Exception as e:
                self._metrics["errors"] += 1
                await self.publish("engine.error", {"error": str(e), "topic": topic}, source="eventbus")
        return ev

    def history(self, limit=100, topic=None):
        h = self._history if topic is None else [e for e in self._history if e.topic == topic]
        return h[-limit:]

    def metrics(self):
        return dict(self._metrics)


class SharedState:
    def __init__(self):
        self._data = {"active_app": None, "active_task": None, "environment": {},
                      "history": [], "user_prefs": {}, "context": {}}
        self._lock = asyncio.Lock()
        self._subscribers = []

    async def get(self, key, default=None):
        async with self._lock:
            return self._data.get(key, default)

    async def set(self, key, value):
        async with self._lock:
            old = self._data.get(key)
            self._data[key] = value
            entry = {"key": key, "old": old, "new": value, "ts": time.time()}
            self._data["history"].append(entry)
            if len(self._data["history"]) > 10000:
                self._data["history"] = self._data["history"][-5000:]
        for cb in list(self._subscribers):
            try:
                r = cb(key, value, old)
                if asyncio.iscoroutine(r):
                    await r
            except Exception:
                pass

    async def snapshot(self):
        async with self._lock:
            return {k: (list(v) if isinstance(v, list) else (dict(v) if isinstance(v, dict) else v))
                    for k, v in self._data.items()}

    async def push_history(self, entry):
        async with self._lock:
            self._data["history"].append(entry)

    def subscribe(self, cb):
        self._subscribers.append(cb)

    async def update_context(self, patch: dict):
        async with self._lock:
            self._data["context"].update(patch)


class BaseEngine:
    name = "base"
    layer = "core"

    def __init__(self, bus, state):
        self.bus = bus
        self.state = state
        self._running = False
        self._started_at = None

    async def start(self):
        self._running = True
        self._started_at = time.time()
        await self.bus.publish(f"{self.name}.started", {}, source=self.name)

    async def stop(self):
        self._running = False
        await self.bus.publish(f"{self.name}.stopped", {}, source=self.name)

    def health(self):
        return {"name": self.name, "layer": self.layer, "running": self._running,
                "uptime": (time.time() - self._started_at) if self._started_at else 0}
