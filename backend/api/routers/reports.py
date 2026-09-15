"""처방 및 공문서 리포트 — 화면 ⑥."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from api.store import jsonify, store
from maek_engine import AUDIENCE_LABEL

router = APIRouter(prefix="/api/reports", tags=["reports"])


@router.get("/{region}")
def dossier(region: str,
            audience: str = Query("지자체", description="지자체 / 창업자 / 카드사")) -> dict:
    if audience not in AUDIENCE_LABEL:
        raise HTTPException(
            400, f"알 수 없는 대상자: {audience} (가능: {list(AUDIENCE_LABEL)})")
    try:
        resolved = store.resolve(region)
    except KeyError:
        raise HTTPException(404, f"알 수 없는 지역: {region}")

    row = store.row(resolved)
    payload = store.reporter.dossier(
        resolved, row, audience=audience, base_month=store.base_month)

    payload["base_month"] = store.base_month
    payload["summary"] = jsonify({
        "youth_drain": row.drain_index,
        "drain_top_pct": row.drain_index_top_pct,
        "ladder_score": int(row.ladder_score),
        "ladder_max": len(store.cfg.taxonomy.LADDER),
        "youth_foreign_share": row.youth_foreign_share,
        "risk_index": row.risk_index,
        "risk_index_available": bool(store.sources.get("risk_index")),
        "is_decline_area": row.is_decline_area,
        "decline_area_available": bool(store.sources.get("decline_areas")),
    })
    payload["region_detail"] = store.region_brief(resolved)
    payload["budget_note"] = (
        "조치별 소요 예산은 지역 재정 여건과 사업 범위에 따라 달라지므로 "
        "진단 엔진이 산출하지 않습니다. 담당 부서의 예산 추계가 필요합니다.")
    return jsonify(payload)
