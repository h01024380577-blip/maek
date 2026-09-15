"""엔진 실행 결과의 프로세스 내 캐시.

전체 데이터가 16MB이고 ①~⑥ 전 공정이 1초 안에 끝나므로 요청마다 다시
돌릴 이유가 없다. 기동 시 한 번 계산해 DataFrame을 그대로 들고 있다가
라우터가 조회만 한다. 월별 데이터가 교체되면 reload()로 갈아끼운다.
"""

from __future__ import annotations

import logging
import os
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

from api.env import load_env_file
from maek_engine import (
    AGE_LABEL,
    AGE_ORDER,
    COMPOSITION_LABEL,
    TYPE_ORDER,
    AlertEngine,
    Classify,
    Clean,
    EngineConfig,
    Ingest,
    Metrics,
    ReportGenerator,
    StartupFit,
    __version__,
)

log = logging.getLogger("maek.api")

BACKEND_DIR = Path(__file__).resolve().parent.parent
PROJECT_DIR = BACKEND_DIR.parent
# 데이터 위치. 로컬은 저장소의 data/, Vercel 은 서비스 루트(backend/)만 번들에 들어가므로
# 빌드 때 backend/data 로 복사해 둔 것을 쓴다. MAEK_DATA_DIR 로 어디든 바꿀 수 있다.
def _default_data_dir() -> Path:
    for candidate in (PROJECT_DIR / "data", BACKEND_DIR / "data"):
        if (candidate / "ABP_CONTEST_DATA.csv").exists():
            return candidate
    return PROJECT_DIR / "data"


DATA_DIR = Path(os.environ.get("MAEK_DATA_DIR") or _default_data_dir())

CARD_PATH = DATA_DIR / "ABP_CONTEST_DATA.csv"
# 선택 입력. 없으면 해당 지표만 비고 나머지 진단은 그대로 동작한다.
POPULATION_PATH = DATA_DIR / "population.csv"
RISK_INDEX_PATH = DATA_DIR / "risk_index.csv"
DECLINE_AREA_PATH = DATA_DIR / "decline_areas.csv"


def _optional(path: Path) -> Path | None:
    return path if path.exists() else None


def jsonify(value: Any) -> Any:
    """NaN·numpy 스칼라를 JSON이 받을 수 있는 형태로 바꾼다."""
    if isinstance(value, dict):
        return {k: jsonify(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [jsonify(v) for v in value]
    if isinstance(value, (np.bool_, bool)):
        return bool(value)
    if isinstance(value, (np.integer,)):
        return int(value)
    if isinstance(value, (np.floating, float)):
        return None if not np.isfinite(value) else float(value)
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None
    if isinstance(value, (pd.Timestamp, datetime)):
        return value.isoformat()
    if value is pd.NaT:
        return None
    try:
        if pd.isna(value):
            return None
    except (TypeError, ValueError):
        pass
    return value


class Store:
    """엔진 산출물 보관소. 라우터는 이 객체만 본다."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self.cfg = EngineConfig()
        self.loaded_at: str | None = None
        self.clean: pd.DataFrame
        self.classified: pd.DataFrame
        self.alerts: list
        self.fit: StartupFit
        self.reporter: ReportGenerator
        self.audit: dict[str, Any] = {}
        self.sources: dict[str, bool] = {}

    # ── 적재 ────────────────────────────────────────────────────
    def reload(self) -> None:
        with self._lock:
            # 기동 후 backend/.env 에 키를 넣은 경우도 /api/reload 한 번으로 붙는다
            applied = load_env_file()
            if applied:
                log.info(".env 에서 %s 적용", ", ".join(applied))
            if not CARD_PATH.exists():
                raise FileNotFoundError(
                    f"소비데이터를 찾을 수 없습니다: {CARD_PATH}")

            ingest = Ingest(self.cfg)
            cleaner = Clean(self.cfg)

            raw = ingest.card(CARD_PATH)
            population = ingest.population(_optional(POPULATION_PATH))
            risk = ingest.risk_index(_optional(RISK_INDEX_PATH))

            clean = cleaner.run(raw)
            metrics = Metrics(self.cfg).run(clean, population)
            classified = Classify(self.cfg).run(metrics)

            if risk is not None:
                ri = risk.copy()
                ri["region"] = ri.SIDO_NM + " " + ri.CCG_NM
                classified = classified.join(ri.set_index("region")["risk_index"])
            else:
                classified["risk_index"] = np.nan

            classified["is_decline_area"] = self._decline_flags(classified.index)

            self.clean = clean
            self.classified = classified
            self.audit = cleaner.report
            self.alerts = AlertEngine(self.cfg).run(classified, risk)
            self.fit = StartupFit(self.cfg, clean, classified)
            self.cfg.llm_model = os.environ.get("MAEK_LLM_MODEL", self.cfg.llm_model)
            self.reporter = ReportGenerator(self.cfg)
            self.sources = {
                "card": True,
                "population": population is not None,
                "risk_index": risk is not None,
                "decline_areas": DECLINE_AREA_PATH.exists(),
                "llm": self.reporter._client is not None,
            }
            self.loaded_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
            log.info("엔진 적재 완료 — %s개 지역 · 경보 %s건",
                     len(classified), len(self.alerts))

    @staticmethod
    def _decline_flags(index: pd.Index) -> pd.Series:
        """행안부 인구감소지역 지정 현황 (선택 데이터).

        공식 고시 목록이라 엔진이 임의로 만들어 내지 않는다. 파일이 없으면
        전부 미상으로 두고 화면에서 '미연동'으로 표시한다.
        """
        if not DECLINE_AREA_PATH.exists():
            return pd.Series(np.nan, index=index, dtype="object")
        df = pd.read_csv(DECLINE_AREA_PATH, encoding="utf-8-sig")
        names = set((df.SIDO_NM.astype(str).str.strip() + " "
                     + df.CCG_NM.astype(str).str.strip()).tolist())
        return pd.Series([r in names for r in index], index=index, dtype="object")

    # ── 조회 ────────────────────────────────────────────────────
    @property
    def base_month(self) -> int | None:
        months = self.audit.get("months") or []
        return int(months[-1]) if months else None

    @property
    def regions(self) -> list[str]:
        return self.classified.index.tolist()

    def row(self, region: str) -> pd.Series:
        if region not in self.classified.index:
            raise KeyError(region)
        return self.classified.loc[region]

    def resolve(self, query: str) -> str:
        """'영암군', '전남 영암군', 전체 키 어느 쪽으로 와도 찾아 준다."""
        q = query.strip()
        if q in self.classified.index:
            return q
        hits = [r for r in self.classified.index if r.replace(" ", "").endswith(
            q.replace(" ", ""))]
        if len(hits) == 1:
            return hits[0]
        hits = [r for r in self.classified.index if q.replace(" ", "") in r.replace(" ", "")]
        if len(hits) == 1:
            return hits[0]
        raise KeyError(query)

    # ── 화면용 조립 ─────────────────────────────────────────────
    def region_brief(self, region: str) -> dict[str, Any]:
        """목록·지도·비교에서 공통으로 쓰는 최소 단위."""
        row = self.row(region)
        return jsonify({
            "region": region,
            "sido": row.SIDO_NM,
            "ccg": row.CCG_NM,
            "region_type": row.region_type,
            "priority": row.priority,
            "ladder_score": int(row.ladder_score),
            "ladder_pattern": row.ladder_pattern,
            "missing_tiers": row.missing_tiers,
            "drain_index": row.drain_index,
            "drain_top_pct": row.drain_index_top_pct,
            "foreign_share": row.foreign_share,
            "youth_foreign_share": row.youth_foreign_share,
            "cause": row.cause,
            "risk_index": row.risk_index,
            "is_decline_area": row.is_decline_area,
        })

    def age_profile(self, region: str) -> list[dict[str, Any]]:
        """세대 이탈 프로파일 — 지역 실측과 전국 평균선."""
        row = self.row(region)
        national = self.classified[[f"gap_age_{a}" for a in AGE_ORDER]].mean()
        out = []
        for a in AGE_ORDER:
            out.append({
                "code": a,
                "label": AGE_LABEL[a],
                "gap": jsonify(row.get(f"gap_age_{a}")),
                "national_gap": jsonify(national.get(f"gap_age_{a}")),
                "share": jsonify(row.get(f"age_share_{a}")),
            })
        return out

    def composition(self, region: str) -> dict[str, Any]:
        """업종별 소비 구조 4분류 — 지역 대 전국 평균."""
        row = self.row(region)
        national = self.classified[[f"comp_{k}" for k in COMPOSITION_LABEL]].mean()
        groups = []
        for key, label in COMPOSITION_LABEL.items():
            local = float(row.get(f"comp_{key}") or 0.0)
            nat = float(national.get(f"comp_{key}") or 0.0)
            groups.append({
                "key": key,
                "label": label,
                "share": round(local, 1),
                "amt": jsonify(row.get(f"amt_{key}")),
                "national_share": round(nat, 1),
                "delta": round(local - nat, 1),
            })
        return {
            "total_amt": jsonify(row.get("total_spend")),
            "groups": groups,
        }

    def national_stats(self) -> dict[str, Any]:
        c = self.classified
        counts = c.region_type.value_counts().reindex(TYPE_ORDER, fill_value=0)
        kinds: dict[str, int] = {}
        for a in self.alerts:
            kinds[a.kind] = kinds.get(a.kind, 0) + 1
        return jsonify({
            "engine_version": __version__,
            "loaded_at": self.loaded_at,
            "base_month": self.base_month,
            "months": self.audit.get("months", []),
            "regions": int(len(c)),
            "alerts": len(self.alerts),
            "alert_kinds": kinds,
            "ladder_conformity": round(float(c.ladder_conforms.mean()) * 100, 1),
            "type_counts": {t: int(counts[t]) for t in TYPE_ORDER},
            "type_shares": {t: round(float(counts[t]) / len(c) * 100, 1)
                            for t in TYPE_ORDER},
            "thresholds": {
                "drain": self.cfg.drain_threshold,
                "ladder": self.cfg.ladder_deficit_max + 0.5,
            },
            "sources": self.sources,
            "audit": self.audit,
        })


store = Store()
