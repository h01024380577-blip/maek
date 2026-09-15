"""경보 센터 — 화면 ④."""

from __future__ import annotations

from typing import List, Optional

import csv
import io
from dataclasses import asdict

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse

from api.store import jsonify, store

router = APIRouter(prefix="/api/alerts", tags=["alerts"])

KIND_ORDER = ("선행 경보", "과소평가", "외국인 의존")


def _filtered(kind: str | None, severity: str | None,
              sido: str | None, q: str | None) -> list[dict]:
    out = []
    for a in store.alerts:
        if kind and a.kind != kind:
            continue
        if severity and a.severity != severity:
            continue
        row = store.row(a.region)
        if sido and row.SIDO_NM != sido:
            continue
        if q:
            needle = q.replace(" ", "")
            if needle not in a.region.replace(" ", "") and needle not in a.message:
                continue
        item = asdict(a)
        item.update({
            "sido": row.SIDO_NM,
            "ccg": row.CCG_NM,
            "region_type": row.region_type,
            "ladder_score": int(row.ladder_score),
            "missing_tiers": row.missing_tiers,
            "drain_index": float(row.drain_index),
            "drain_threshold": store.cfg.drain_threshold,
            "youth_foreign_share": float(row.youth_foreign_share),
            "youth_foreign_median": round(
                float(store.classified.youth_foreign_share.median()), 1),
            "foreign_share": float(row.foreign_share),
        })
        out.append(item)
    # 심각도 높은 순 → 세대이탈지수 큰 순
    out.sort(key=lambda x: (x["severity"] != "높음", -x["drain_index"]))
    return jsonify(out)


@router.get("")
def list_alerts(
    kind: Optional[str] = Query(None),
    severity: Optional[str] = Query(None),
    sido: Optional[str] = Query(None),
    q: Optional[str] = Query(None),
) -> dict:
    items = _filtered(kind, severity, sido, q)
    counts = {k: 0 for k in KIND_ORDER}
    for a in store.alerts:
        counts[a.kind] = counts.get(a.kind, 0) + 1

    high = sum(1 for a in store.alerts if a.severity == "높음")
    return {
        "items": items,
        "total": len(items),
        "tabs": [{"key": None, "label": "전체", "count": len(store.alerts)}]
                + [{"key": k, "label": k, "count": counts.get(k, 0)}
                   for k in KIND_ORDER],
        "severity_options": ["높음", "중간"],
        "sido_options": sorted(store.classified.SIDO_NM.unique().tolist()),
        "high_severity": high,
        "base_month": store.base_month,
        "criteria": ("외부 지수 연동" if store.sources.get("risk_index")
                     else "내부 분위수 기준 (외부 지수 미연동)"),
    }


@router.get("/export.csv")
def export_csv(
    kind: Optional[str] = Query(None),
    severity: Optional[str] = Query(None),
    sido: Optional[str] = Query(None),
    q: Optional[str] = Query(None),
) -> StreamingResponse:
    items = _filtered(kind, severity, sido, q)
    if not items:
        raise HTTPException(404, "내보낼 경보가 없습니다")

    cols = ["region", "sido", "ccg", "kind", "severity", "region_type",
            "ladder_score", "missing_tiers", "drain_index",
            "foreign_share", "youth_foreign_share", "message"]
    buf = io.StringIO()
    buf.write("﻿")          # 엑셀에서 한글이 깨지지 않도록 BOM
    w = csv.DictWriter(buf, fieldnames=cols, extrasaction="ignore")
    w.writeheader()
    w.writerows(items)
    buf.seek(0)

    name = f"maek_alerts_{store.base_month or 'latest'}.csv"
    return StreamingResponse(
        iter([buf.getvalue()]), media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{name}"'})
