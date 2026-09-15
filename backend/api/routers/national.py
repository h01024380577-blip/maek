"""전국 현황 — 화면 ①."""

from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Query

from api.store import jsonify, store
from maek_engine import TYPE_ORDER

router = APIRouter(prefix="/api/national", tags=["national"])


@router.get("/summary")
def summary() -> dict:
    """상단 KPI 4종과 유형 분포."""
    stats = store.national_stats()
    c = store.classified
    lead = stats["type_counts"].get("이탈 선행형", 0)
    stats["kpi"] = [
        {"key": "regions", "label": "진단 지역 수", "value": stats["regions"],
         "unit": "개 기초지자체", "chip": "전수 조사",
         "note": "전국 시·군·구 100% 모니터링 체계",
         "status": "정상 연동" if stats["sources"]["card"] else "미연동"},
        {"key": "alerts", "label": "활성 경보", "value": stats["alerts"],
         "unit": "건", "chip": None,
         "note": "선행 경보 · 과소평가 · 외국인 의존 합계",
         "status": None, "tone": "alert"},
        {"key": "drain_lead", "label": "이탈 선행형 지역", "value": lead,
         "unit": "개 지역", "chip": "집중 관리 대상",
         "note": "상권은 유지되나 청년 소비가 이미 이탈",
         "status": "골든타임 대응", "tone": "critical"},
        {"key": "conformity", "label": "위계 정합도",
         "value": stats["ladder_conformity"], "unit": "%", "chip": "실측 검증",
         "note": "사다리 정합 조합(000·100·110·111) 비율",
         "status": f"{int(c.ladder_conforms.sum())}/{len(c)}개 지역"},
    ]
    return stats


@router.get("/matrix")
def matrix() -> dict:
    """2×2 사분면 산점도 — 255개 지역 전수."""
    c = store.classified
    points = [
        {
            "region": r,
            "sido": row.SIDO_NM,
            "ccg": row.CCG_NM,
            "x": int(row.ladder_score),
            "y": float(row.drain_index),
            "type": row.region_type,
            "youth_foreign_share": float(row.youth_foreign_share),
        }
        for r, row in c.iterrows()
    ]
    # 사분면마다 그 유형을 가장 잘 대표하는 지역만 라벨로 띄운다.
    # 정렬 기준은 유형을 규정한 방향과 같아야 한다. |세대이탈|로 일괄
    # 정렬하면 기능 결손형에서 임계선 바로 아래 지역이 뽑혀 오해를 부른다.
    key_of = {
        "복합 소멸형": lambda p: -p["y"],            # 이탈이 가장 심한 곳
        "이탈 선행형": lambda p: -p["y"],
        "기능 결손형": lambda p: (p["x"], p["y"]),    # 사다리가 가장 낮은 곳
        "유지형": lambda p: p["y"],                  # 청년 유입이 가장 큰 곳
    }
    labelled: set[str] = set()
    for t in TYPE_ORDER:
        sub = sorted((p for p in points if p["type"] == t), key=key_of[t])
        labelled.update(p["region"] for p in sub[:2])
    for p in points:
        p["labelled"] = p["region"] in labelled

    return jsonify({
        "points": points,
        "thresholds": {"ladder": store.cfg.ladder_deficit_max + 0.5,
                       "drain": store.cfg.drain_threshold},
        "axes": {"x": {"label": "상권기능 사다리 점수", "min": 0, "max": 3},
                 "y": {"label": "세대이탈지수 (%p)"}},
        "quadrants": [
            {"type": "복합 소멸형", "corner": "top-left", "caption": "구조적 붕괴"},
            {"type": "이탈 선행형", "corner": "top-right", "caption": "핵심 집중관리 구역"},
            {"type": "기능 결손형", "corner": "bottom-left", "caption": "인프라 취약"},
            {"type": "유지형", "corner": "bottom-right", "caption": "안정 유지"},
        ],
        "legend": [
            {"type": t,
             "count": int((c.region_type == t).sum()),
             "share": round(float((c.region_type == t).mean()) * 100, 1)}
            for t in TYPE_ORDER
        ],
    })


@router.get("/regions")
def regions(
    type: Optional[str] = Query(None, description="유형 필터"),
    sido: Optional[str] = Query(None),
    limit: int = Query(300, ge=1, le=300),
) -> dict:
    """지도·목록용 전국 지역 배열."""
    c = store.classified
    idx = c.index
    if type:
        idx = idx[c.loc[idx].region_type == type]
    if sido:
        idx = idx[c.loc[idx].SIDO_NM == sido]
    items = [store.region_brief(r) for r in idx[:limit]]
    return {"total": int(len(idx)), "items": items,
            "sido_options": sorted(c.SIDO_NM.unique().tolist())}
