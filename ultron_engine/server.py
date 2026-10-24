"""FastAPI service exposing ULTRON engines to the Electron/Next UI."""
import asyncio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .registry import build_orchestrator

app = FastAPI(title="ULTRON Engine Service")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

orch, bus, state = build_orchestrator()


@app.on_event("startup")
async def startup():
    await orch.start()


@app.on_event("shutdown")
async def shutdown():
    await orch.stop()


@app.get("/health")
async def health():
    return await orch.broadcast_health()


@app.post("/dispatch")
async def dispatch(body: dict):
    return await orch.dispatch(body.get("intent", ""), body.get("payload", {}))


@app.get("/state")
async def get_state():
    return await state.snapshot()


@app.post("/engine/{name}/process")
async def process(name: str, body: dict):
    e = orch.engines.get(name)
    if not e:
        return {"error": "unknown engine"}
    return await e.process(body.get("payload"))
