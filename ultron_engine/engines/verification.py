"""19. Verification Engine: result checks, assertions, evidence validation."""
import asyncio, time, uuid
from typing import Any, Dict
from ..core import BaseEngine, EventBus, SharedState

class VerificationEngine(BaseEngine):
    name = "verification"
    layer = "quality"

    def __init__(self, bus, state):
        super().__init__(bus, state)
        self._lock = asyncio.Lock()

    async def start(self):
        await super().start()
        self.bus.subscribe("verification.*", self._on)

    async def _on(self, ev):
        pass

    def check_assertions(self, assertions):
        results = []
        for a in assertions:
            # assertion: {"expr": python expr string, "context": dict}
            try:
                ok = bool(eval(a.get("expr", "False"), {}, a.get("context", {})))
            except Exception as e:
                ok = False
                err = str(e)
            else:
                err = None
            results.append({"expr": a.get("expr"), "passed": ok, "error": err})
        return results

    def verify_result(self, result, expected=None, evidence=None):
        checks = []
        # presence
        checks.append({"name": "result_present", "passed": result is not None})
        if expected is not None:
            checks.append({"name": "matches_expected", "passed": result == expected})
        if evidence:
            checks.append({"name": "evidence_present", "passed": len(evidence) > 0})
        passed = all(c["passed"] for c in checks)
        return {"passed": passed, "checks": checks}

    def consistency_check(self, values):
        # all values equal?
        if not values:
            return {"consistent": True, "unique": 0}
        uniq = set(str(v) for v in values)
        return {"consistent": len(uniq) == 1, "unique": len(uniq), "count": len(values)}

    async def process(self, payload=None):
        if not isinstance(payload, dict):
            payload = {"action": "verify"}
        action = payload.get("action", "verify")
        if action == "assertions":
            res = self.check_assertions(payload.get("assertions", []))
            passed = all(r["passed"] for r in res)
            return {"id": str(uuid.uuid4()), "engine": self.name, "status": "pass" if passed else "fail",
                    "results": res, "passed": passed}
        if action == "verify_result":
            r = self.verify_result(payload.get("result"), payload.get("expected"), payload.get("evidence"))
            return {"id": str(uuid.uuid4()), "engine": self.name, "status": "pass" if r["passed"] else "fail", **r}
        if action == "consistency":
            r = self.consistency_check(payload.get("values", []))
            return {"id": str(uuid.uuid4()), "engine": self.name, "status": "pass" if r["consistent"] else "fail", **r}
        # default: verify payload result
        r = self.verify_result(payload.get("result"), payload.get("expected"), payload.get("evidence"))
        return {"id": str(uuid.uuid4()), "engine": self.name, "status": "pass" if r["passed"] else "fail", **r}

    async def get_state(self):
        return {"name": self.name}

    def health(self):
        return {"name": self.name, "layer": self.layer, "running": self._running}
