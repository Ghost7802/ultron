"""ULTRON engine registry: builds orchestrator with all engines registered."""
import importlib
from .core import EventBus, SharedState
from .engines.orchestrator import OrchestratorEngine

ALL_MODULES = [
 "intelligence","context_state","memory","multi_agent",
 "perception","conversation","tts","personality","multimodal",
 "planning","execution","tool_intelligence","system_control","smart_home","code_engineering","simulation","communication",
 "knowledge_research","verification","anti_hallucination","self_correction",
 "security","privacy_governance","human_loop","alerting_emergency",
 "learning","proactive","resource_optimization","reliability","offline_fallback",
 "observability","testing_evaluation",
]

def build_orchestrator():
    bus = EventBus()
    state = SharedState()
    orch = OrchestratorEngine(bus, state)
    for m in ALL_MODULES:
        mod = importlib.import_module(f".{m}", package="ultron_engine.engines")
        cls_name = "".join(w.capitalize() for w in m.split("_")) + "Engine"
        if m == "tts":
            cls_name = "TTSEngine"
        cls = getattr(mod, cls_name)
        orch.register(cls(bus, state))
    orch.add_route("launch_app", "execution")
    orch.add_route("code_task", "multi_agent")
    orch.add_route("planning", "multi_agent")
    orch.add_route("search", "knowledge_research")
    return orch, bus, state
