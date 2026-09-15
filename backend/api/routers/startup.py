"""창업 적합도 — 화면 ⑤."""

from __future__ import annotations

from dataclasses import asdict

from fastapi import APIRouter, HTTPException, Query

from api.store import jsonify, store
from maek_engine import COMPOSITION_LABEL

router = APIRouter(prefix="/api/startup", tags=["startup"])


@router.get("/businesses")
def businesses() -> dict:
    """희망 업종 셀렉트박스. 어느 기능군에 속하는지도 함께 준다."""
    tx = store.cfg.taxonomy
    group_of = {b: key for key, types in tx.COMPOSITION.items() for b in types}
    fit = store.fit
    items = []
    for b in tx.ALL:
        items.append({
            "business": b,
            "group": group_of[b],
            "group_label": COMPOSITION_LABEL[group_of[b]],
            "presence": int(fit.presence_count[b]),
            "total": fit.region_count,
            "in_ladder": b in tx.LADDER,
        })
    return {"items": items}


@router.get("/assess")
def assess(region: str = Query(...), business: str = Query(...)) -> dict:
    try:
        resolved = store.resolve(region)
    except KeyError:
        raise HTTPException(404, f"알 수 없는 지역: {region}")

    try:
        result = store.fit.assess(resolved, business)
    except KeyError as e:
        raise HTTPException(404, str(e))

    payload = asdict(result)
    payload["weights"] = {
        "supply_gap": {"label": "공급 공백", "max": store.fit.WEIGHT["supply_gap"]},
        "demand_base": {"label": "배후 수요", "max": store.fit.WEIGHT["demand_base"]},
        "cohort_fit": {"label": "세대 적합", "max": store.fit.WEIGHT["cohort_fit"]},
        "stability": {"label": "구조 안정", "max": store.fit.WEIGHT["stability"]},
        "foreign_risk": {"label": "외국인 의존 감점",
                         "max": -store.fit.FOREIGN_PENALTY_MAX},
    }
    payload["thresholds"] = {
        "recommend": store.fit.VERDICT_RECOMMEND,
        "conditional": store.fit.VERDICT_CONDITIONAL,
    }
    payload["region_detail"] = store.region_brief(resolved)
    return jsonify(payload)
