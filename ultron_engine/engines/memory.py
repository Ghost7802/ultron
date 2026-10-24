"""3. Memory Engine: short/long-term, episodic, semantic, dedup, correction."""
import asyncio, time, hashlib, json, sqlite3, os
from typing import Any, Dict, List
from ..core import BaseEngine, EventBus, SharedState

DB = os.path.join(os.path.dirname(os.path.dirname(__file__)), "ultron_memory.db")

class MemoryEngine(BaseEngine):
    name = "memory"
    layer = "core"

    def __init__(self, bus, state):
        super().__init__(bus, state)
        self._conn = None
        self._lock = asyncio.Lock()
        self._short = []  # short-term ring buffer
        self.SHORT_CAP = 50

    async def start(self):
        await super().start()
        self._conn = sqlite3.connect(DB, check_same_thread=False)
        self._conn.execute("""CREATE TABLE IF NOT EXISTS memory(
            id TEXT PRIMARY KEY, tier TEXT, content TEXT, hash TEXT,
            ts REAL, meta TEXT)""")
        self._conn.commit()
        self.bus.subscribe("memory.*", self._on_mem)

    async def _on_mem(self, ev):
        pass

    def _hash(self, content):
        s = json.dumps(content, sort_keys=True, default=str) if not isinstance(content, str) else content
        return hashlib.sha256(s.encode()).hexdigest()

    async def store(self, content, tier="long", meta=None):
        h = self._hash(content)
        # dedup
        cur = self._conn.execute("SELECT id FROM memory WHERE hash=?", (h,))
        if cur.fetchone():
            return {"stored": False, "reason": "duplicate", "hash": h}
        mid = str(__import__("uuid").uuid4())
        self._conn.execute("INSERT INTO memory VALUES (?,?,?,?,?,?)",
            (mid, tier, json.dumps(content, default=str), h, time.time(), json.dumps(meta or {})))
        self._conn.commit()
        if tier == "short":
            self._short.append({"id": mid, "content": content, "ts": time.time()})
            if len(self._short) > self.SHORT_CAP:
                self._short = self._short[-self.SHORT_CAP:]
        await self.bus.publish("memory.stored", {"id": mid, "tier": tier}, source=self.name)
        return {"stored": True, "id": mid, "tier": tier, "hash": h}

    async def recall(self, query="", tier=None, limit=20):
        sql = "SELECT id,tier,content,hash,ts,meta FROM memory"
        params = []
        if tier:
            sql += " WHERE tier=?"
            params.append(tier)
        sql += " ORDER BY ts DESC LIMIT ?"
        params.append(limit)
        rows = self._conn.execute(sql, params).fetchall()
        out = []
        for r in rows:
            try:
                content = json.loads(r[2])
            except Exception:
                content = r[2]
            if query and query.lower() not in str(content).lower():
                continue
            out.append({"id": r[0], "tier": r[1], "content": content, "hash": r[3], "ts": r[4]})
        # include short-term
        if not tier or tier == "short":
            for s in reversed(self._short):
                if query and query.lower() not in str(s["content"]).lower():
                    continue
                out.append(s)
        return out[:limit]

    async def correct(self, target_id, new_content):
        cur = self._conn.execute("SELECT id FROM memory WHERE id=?", (target_id,))
        if not cur.fetchone():
            return {"corrected": False, "reason": "not_found"}
        h = self._hash(new_content)
        self._conn.execute("UPDATE memory SET content=?, hash=? WHERE id=?", (json.dumps(new_content, default=str), h, target_id))
        self._conn.commit()
        await self.bus.publish("memory.corrected", {"id": target_id}, source=self.name)
        return {"corrected": True, "id": target_id}

    async def delete(self, target_id=None, tier=None):
        if target_id:
            self._conn.execute("DELETE FROM memory WHERE id=?", (target_id,))
        elif tier:
            self._conn.execute("DELETE FROM memory WHERE tier=?", (tier,))
        self._conn.commit()
        return {"deleted": True}

    async def process(self, payload=None):
        if not isinstance(payload, dict):
            payload = {"action": "store", "content": payload}
        action = payload.get("action", "store")
        if action == "store":
            return {"id": __import__("uuid").uuid4().__str__(), "engine": self.name, "status": "ok",
                    **(await self.store(payload.get("content"), payload.get("tier", "long"), payload.get("meta")))}
        if action == "recall":
            items = await self.recall(payload.get("query", ""), payload.get("tier"), payload.get("limit", 20))
            return {"id": __import__("uuid").uuid4().__str__(), "engine": self.name, "status": "ok",
                    "items": items, "count": len(items)}
        if action == "correct":
            return {"id": __import__("uuid").uuid4().__str__(), "engine": self.name, "status": "ok",
                    **(await self.correct(payload.get("target"), payload.get("content")))}
        if action == "delete":
            return {"id": __import__("uuid").uuid4().__str__(), "engine": self.name, "status": "ok",
                    **(await self.delete(payload.get("target"), payload.get("tier")))}
        return {"id": __import__("uuid").uuid4().__str__(), "engine": self.name, "status": "ok", "action": action}

    async def get_state(self):
        cur = self._conn.execute("SELECT tier, COUNT(*) FROM memory GROUP BY tier").fetchall()
        return {"name": self.name, "counts": {r[0]: r[1] for r in cur}, "short_term": len(self._short)}

    def health(self):
        return {"name": self.name, "layer": self.layer, "running": self._running,
                "db": DB, "short_term": len(self._short)}
