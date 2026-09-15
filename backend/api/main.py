"""맥(脈) 서비스 API.

제안서 9장 아키텍처의 Service Layer에 해당한다. Analytics Engine
(maek_engine)을 기동 시 한 번 돌려 놓고, 화면이 필요로 하는 형태로
조회만 시켜 준다.

실행
    cd backend && uvicorn api.main:app --reload --port 8000
"""

from __future__ import annotations

import logging
import sys
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

# backend/.env 가 있으면 환경변수로 올린다 (OPENAI_API_KEY, MAEK_LLM_MODEL 등).
# 셸에 이미 있는 값이 우선하고, 파일이 없으면 조용히 넘어간다.
from api.env import load_env_file  # noqa: E402

load_env_file()

from api.routers import alerts, national, regions, reports, startup  # noqa: E402
from api.store import store  # noqa: E402
from maek_engine import __version__  # noqa: E402

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s", datefmt="%H:%M:%S")
log = logging.getLogger("maek.api")


@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("엔진 적재 중…")
    store.reload()
    yield


app = FastAPI(
    title="맥(脈) 진단 API",
    version=__version__,
    description="소비데이터 기반 지방소멸 조기경보 서비스의 Service Layer",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

app.include_router(national.router)
app.include_router(regions.router)
app.include_router(alerts.router)
app.include_router(startup.router)
app.include_router(reports.router)


@app.get("/api/health", tags=["meta"])
def health() -> JSONResponse:
    ready = store.loaded_at is not None
    return JSONResponse(
        status_code=200 if ready else 503,
        content={
            "ok": ready,
            "engine_version": __version__,
            "loaded_at": store.loaded_at,
            "regions": len(store.regions) if ready else 0,
            "sources": store.sources,
        },
    )


@app.post("/api/reload", tags=["meta"])
def reload_engine() -> dict:
    """월별 데이터 교체 후 재적재. ①~⑤ 공정을 다시 돌린다."""
    store.reload()
    return {"ok": True, "loaded_at": store.loaded_at,
            "regions": len(store.regions), "alerts": len(store.alerts)}
