"""4. Multi-Agent Engine: coder, researcher, planner agents + coordinator."""
import asyncio, time, uuid
from typing import Any, Dict, List
from ..core import BaseEngine, EventBus, SharedState

class Agent:
    def __init__(self, name, role):
        self.name = name
        self.role = role
        self._tasks = []

    async def run(self, task: str, context: dict = None) -> dict:
        ctx = context or {}
        if self.role == "planner":
            steps = [s.strip() for s in task.replace(";", ",").split(",") if s.strip()]
            if not steps:
                steps = [task]
            return {"agent": self.name, "role": self.role, "plan": steps,
                    "graph": [{"id": i, "task": s, "deps": [i-1] if i else []} for i, s in enumerate(steps)]}
        if self.role == "researcher":
            # simulate evidence gathering
            evidence = [{"source": f"src{i}", "score": round(0.9 - i*0.1, 2)} for i in range(3)]
            return {"agent": self.name, "role": self.role, "query": task,
                    "evidence": evidence, "summary": f"Researched: {task[:60]}"}
        if self.role == "coder":
            # basic code generation stub that returns a fenced snippet
            return {"agent": self.name, "role": self.role, "task": task,
                    "code": f"# solution for: {task}\nprint('ok')",
                    "tests": ["basic"]}
        return {"agent": self.name, "role": self.role, "task": task, "result": "done"}

class MultiAgentEngine(BaseEngine):
    name = "multi_agent"
    layer = "core"

    def __init__(self, bus, state):
        super().__init__(bus, state)
        self.agents = {
            "planner": Agent("planner-1", "planner"),
            "researcher": Agent("researcher-1", "researcher"),
            "coder": Agent("coder-1", "coder"),
        }
        self._lock = asyncio.Lock()
        self._runs = []

    async def start(self):
        await super().start()
        self.bus.subscribe("multi_agent.*", self._on)

    async def _on(self, ev):
        pass

    async def coordinate(self, goal: str, context: dict = None) -> dict:
        ctx = context or {}
        # planner first
        plan_res = await self.agents["planner"].run(goal, ctx)
        steps = plan_res.get("plan", [goal])
        # run researcher + coder in parallel per step
        async def handle_step(step):
            r_task = self.agents["researcher"].run(step, ctx)
            c_task = self.agents["coder"].run(step, ctx)
            r, c = await asyncio.gather(r_task, c_task)
            return {"step": step, "research": r, "code": c}
        results = await asyncio.gather(*[handle_step(s) for s in steps])
        out = {"goal": goal, "plan": plan_res, "steps": results,
               "agents_used": list(self.agents.keys()), "ts": time.time()}
        async with self._lock:
            self._runs.append(out)
        await self.bus.publish("multi_agent.completed", out, source=self.name)
        return out

    async def process(self, payload=None):
        if not isinstance(payload, dict):
            payload = {"goal": str(payload or "")}
        goal = payload.get("goal") or payload.get("task", "")
        ctx = payload.get("context", {})
        if payload.get("action") == "list_agents":
            return {"id": str(uuid.uuid4()), "engine": self.name, "status": "ok",
                    "agents": [{"name": a.name, "role": a.role} for a in self.agents.values()]}
        res = await self.coordinate(goal, ctx)
        return {"id": str(uuid.uuid4()), "engine": self.name, "status": "ok", **res}

    async def get_state(self):
        async with self._lock:
            return {"name": self.name, "runs": len(self._runs), "agents": list(self.agents.keys())}

    def health(self):
        return {"name": self.name, "layer": self.layer, "running": self._running,
                "agents": len(self.agents), "runs": len(self._runs)}
