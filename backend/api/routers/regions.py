"""지역 진단(화면 ②)과 지역 비교(화면 ③)."""

from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, HTTPException, Query

from api.store import jsonify, store
from maek_engine import AGE_LABEL, AGE_ORDER, PRESCRIPTION

router = APIRouter(prefix="/api/regions", tags=["regions"])

MAX_COMPARE = 3


def _resolve(region: str) -> str:
    try:
        return store.resolve(region)
    except KeyError:
        raise HTTPException(404, f"알 수 없는 지역: {region}")


def _ladder_steps(row) -> list[dict]:
    """사다리 3단계의 잔존 여부. 패턴 문자열은 LADDER 순서와 같다."""
    ladder = store.cfg.taxonomy.LADDER
    pattern = str(row.ladder_pattern)
    return [
        {"step": i + 1, "business": b,
         "present": pattern[i] == "1",
         "state": "정상 유지" if pattern[i] == "1" else "결손"}
        for i, b in enumerate(ladder)
    ]


def _diagnosis(region: str) -> dict:
    row = store.row(region)
    months = max(1, len(store.audit.get("months") or [1]))

    return jsonify({
        **store.region_brief(region),
        "base_month": store.base_month,
        "ladder": {
            "score": int(row.ladder_score),
            "max": len(store.cfg.taxonomy.LADDER),
            "pattern": row.ladder_pattern,
            "conforms": bool(row.ladder_conforms),
            "steps": _ladder_steps(row),
            "missing": row.missing_tiers,
            "top_pct": row.ladder_score_top_pct,
        },
        "drain": {
            "index": row.drain_index,
            "threshold": store.cfg.drain_threshold,
            "exceeded": bool(row.drain_index > store.cfg.drain_threshold),
            "top_pct": row.drain_index_top_pct,
            "rank": row.drain_index_risk_rank,
            "total": int(len(store.classified)),
        },
        "cause": {
            "verdict": row.cause,
            "presence_ratio": row.presence_ratio,
            "population": row.population,
            "spend_per_capita": row.spend_per_capita,
            "available": bool(store.sources.get("population")),
            "note": ("생활소비 원단위를 전국 중앙값과 대조해 공동화와 유출을 "
                     "분리합니다." if store.sources.get("population") else
                     "행정안전부 주민등록 인구통계가 연동되지 않아 원인 분해를 "
                     "판정할 수 없습니다."),
        },
        "foreign": {
            "share": row.foreign_share,
            "youth_share": row.youth_foreign_share,
            "youth_median": round(float(
                store.classified.youth_foreign_share.median()), 1),
            "top_pct": row.youth_foreign_share_top_pct,
        },
        "volume": {
            "living_spend": row.living_spend,
            "dining_spend": row.dining_spend,
            "total_spend": row.total_spend,
            "monthly_dining": float(row.dining_spend) / months,
            "dining_dependency": row.dining_dependency,
            "living_spend_pctl": row.living_spend_pctl,
        },
        "age_profile": store.age_profile(region),
        "composition": store.composition(region),
        "prescription": PRESCRIPTION[row.region_type],
    })


@router.get("")
def list_regions(q: Optional[str] = Query(None, description="지역명 검색어"),
                 limit: int = Query(50, ge=1, le=300)) -> dict:
    """검색창·셀렉트박스용 지역 목록."""
    c = store.classified
    idx = list(c.index)
    if q:
        needle = q.replace(" ", "")
        idx = [r for r in idx if needle in r.replace(" ", "")]
    items = [{"region": r, "sido": c.at[r, "SIDO_NM"], "ccg": c.at[r, "CCG_NM"],
              "region_type": c.at[r, "region_type"]} for r in idx[:limit]]
    return {"total": len(idx), "items": items}


@router.get("/compare")
def compare(regions: List[str] = Query(..., description="비교 대상 (최대 3개)")) -> dict:
    """다중 지자체 교차 진단 — 화면 ③."""
    if not 2 <= len(regions) <= MAX_COMPARE:
        raise HTTPException(
            400, f"비교 지역은 2~{MAX_COMPARE}개여야 합니다 (요청 {len(regions)}개)")

    resolved = [_resolve(r) for r in regions]
    if len(set(resolved)) != len(resolved):
        raise HTTPException(400, "같은 지역을 중복해 비교할 수 없습니다")

    cols = [_diagnosis(r) for r in resolved]

    def values(path: list[str]):
        out = []
        for c in cols:
            cur = c
            for p in path:
                cur = cur.get(p) if isinstance(cur, dict) else None
            out.append(cur)
        return out

    def divergent(path: list[str], tol: float = 0.0) -> bool:
        vals = [v for v in values(path) if isinstance(v, (int, float))]
        return len(vals) > 1 and (max(vals) - min(vals)) > tol

    rows = [
        {"key": "region_type", "label": "진단 유형", "sub": "정밀 역학 분류",
         "kind": "badge", "values": values(["region_type"]),
         "divergent": len(set(values(["region_type"]))) > 1},
        {"key": "ladder", "label": "상권기능 사다리 점수", "sub": "생활밀착 인프라 3단계 검증",
         "kind": "ladder", "values": [c["ladder"] for c in cols],
         "divergent": divergent(["ladder", "score"])},
        {"key": "drain", "label": "세대이탈지수", "sub": "청년 유출 위험도 순위",
         "kind": "drain", "values": [c["drain"] for c in cols],
         "divergent": divergent(["drain", "index"], tol=2.0)},
        {"key": "missing", "label": "결손 상위 업종", "sub": "부재 시 이탈 유발 인프라",
         "kind": "tags", "values": [c["ladder"]["missing"] for c in cols],
         "divergent": len(set(values(["ladder", "missing"]))) > 1},
        {"key": "foreign", "label": "20~30대 외국인 소비 비중", "sub": "지역 청년 경제 실질 소비 주체",
         "kind": "percent", "values": values(["foreign", "youth_share"]),
         "divergent": divergent(["foreign", "youth_share"], tol=10.0)},
        {"key": "prescription", "label": "맞춤 정책 처방", "sub": "지자체 소멸방지 권고안",
         "kind": "text", "values": [c["prescription"]["지자체"] for c in cols],
         "divergent": False},
    ]

    national = store.classified[[f"gap_age_{a}" for a in AGE_ORDER]].mean()

    return jsonify({
        "regions": cols,
        "rows": rows,
        "profiles": [
            {"region": c["region"], "points": c["age_profile"]} for c in cols
        ],
        "national_profile": [
            {"code": a, "label": AGE_LABEL[a],
             "gap": float(national[f"gap_age_{a}"])}
            for a in AGE_ORDER
        ],
        "max_compare": MAX_COMPARE,
    })


@router.get("/{region}")
def diagnosis(region: str) -> dict:
    """단일 지역 정밀 진단 — 화면 ②."""
    return _diagnosis(_resolve(region))
