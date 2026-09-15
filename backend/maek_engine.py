"""
맥(脈) — 소비로 먼저 읽는 지방소멸 조기경보 서비스
분석 엔진 (Analytics Engine)

제안서 7장 서비스 워크플로우의 1~7단계를 모두 구현한다.

    ① 수집(Ingest)      BC카드 소비데이터 · 행안부 인구통계 · 고용정보원 지수
    ② 정제(Clean)       업종명 정규화 · 코드 타입 고정 · 미상 코드 분리
    ③ 지표 산출(Metrics) 사다리 점수 · 세대이탈지수 · 생활소비 원단위 · 외국인 기여도
    ④ 유형 판정(Classify) 2×2 유형 분류 · 전월 대비 변동 감지
    ⑤ 경보 생성(Alert)   기존 지수 대조 · 선행 경보 / 과소평가 지역 도출
    ⑥ 리포트(Report)     LLM 진단 서술문 · 처방 카드 매핑
    ⑦ 배포(Publish)      산출물 직렬화 · 알림 페이로드 생성

설계 원칙
    - 각 단계는 독립 클래스이며 DataFrame을 주고받는다. 서비스 레이어에서
      단계별로 호출하거나 MaekPipeline으로 일괄 실행할 수 있다.
    - 외부 데이터(인구·소멸위험지수)는 선택적이다. 없으면 해당 지표만
      비워두고 나머지 파이프라인은 정상 동작한다.
    - 모든 지표는 지역 내 비율 또는 존재 여부 기반이다. 카드사 점유율의
      지역 편차가 절대 금액 비교를 왜곡하기 때문이다.

CLI
    python maek_engine.py --card ABP_CONTEST_DATA.csv \
                          --population 행안부인구.csv \
                          --risk-index 소멸위험지수.csv \
                          --out ./output
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import re
import unicodedata
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable

import numpy as np
import pandas as pd

__version__ = "1.0.0"

log = logging.getLogger("maek")


# ════════════════════════════════════════════════════════════════════
#  설정
# ════════════════════════════════════════════════════════════════════

@dataclass(frozen=True)
class BusinessTaxonomy:
    """제공 11개 업종의 계층 분류.

    상권기능 사다리는 실측 위계를 따른다. 255개 시군구 전수 분석 결과
    대형할인점 보유 지역의 일식회집 보유율 100%, 갈비전문점 보유 지역의
    대형할인점 보유율 93.3%로 포함 관계가 확인되었다.

    한정식은 216개 지역(85%)에서 결측이고 갈비전문점과의 동반 출현율이
    53.8%에 그쳐 위계가 성립하지 않는다. 향토음식 도시의 지역 특성
    변수로 판단해 사다리에서 제외한다.
    """

    # 사다리 하위 → 상위 (뒤로 갈수록 먼저 소실)
    LADDER: tuple[str, ...] = ("일식회집", "대형할인점", "갈비전문점")

    # 원정 소비가 없는 근린 필수재 → 실존 인구 프록시
    RETAIL: tuple[str, ...] = ("편의점", "슈퍼마켓")

    # 외식 전체 (세대 갭 산출용)
    DINING: tuple[str, ...] = (
        "갈비전문점", "한정식", "일식회집", "일반한식",
        "중국음식", "스넥", "제과점", "서양음식",
    )

    # 위계에서 제외하되 기록은 남기는 업종
    EXCLUDED_FROM_LADDER: tuple[str, ...] = ("한정식",)

    # ── 소비 구조 4분류 ─────────────────────────────────────────
    # 11개 업종 전부를 상호배타적으로 나눈다. 지역의 소비가 어느 기능에
    # 쏠려 있는지를 전국 평균과 대조하기 위한 축이다.
    SOCIAL_DINING: tuple[str, ...] = ("갈비전문점", "한정식", "일식회집")
    DAILY_DINING: tuple[str, ...] = (
        "일반한식", "중국음식", "스넥", "제과점", "서양음식")
    LARGE_RETAIL: tuple[str, ...] = ("대형할인점",)

    @property
    def COMPOSITION(self) -> dict[str, tuple[str, ...]]:
        return {
            "social_dining": self.SOCIAL_DINING,
            "daily_dining": self.DAILY_DINING,
            "large_retail": self.LARGE_RETAIL,
            "neighborhood": self.RETAIL,
        }

    @property
    def ALL(self) -> tuple[str, ...]:
        return tuple(b for g in self.COMPOSITION.values() for b in g)


COMPOSITION_LABEL = {
    "social_dining": "사회적 외식",
    "daily_dining": "일상 외식",
    "large_retail": "대형 유통",
    "neighborhood": "근린 소매",
}

# 연령 코드 → 표시명. 제공 데이터의 AGE_CD 체계를 그대로 따른다.
AGE_LABEL = {
    "1": "20대 이하", "2": "20대", "3": "30대",
    "4": "40대", "5": "50대", "6": "60대 이상",
}
AGE_ORDER = ("1", "2", "3", "4", "5", "6")


@dataclass
class EngineConfig:
    """엔진 동작 파라미터."""

    # 유형 판정 임계값
    drain_threshold: float = 8.0          # 세대이탈지수 경보선 (%p)
    ladder_deficit_max: int = 1           # 이 값 이하면 상권 기능 결손

    # 경보 판정
    alert_risk_safe_quantile: float = 0.50   # 기존 지수 기준 '안전' 구간
    alert_drain_quantile: float = 0.75       # 소비 기준 '위험' 구간

    # 세대이탈지수 구성
    elder_code: str = "6"                    # 60대 이상
    youth_codes: tuple[str, ...] = ("2", "3")  # 20대, 30대

    # 데이터 처리
    domestic_gender: tuple[str, ...] = ("1", "2")
    foreign_gender: str = "3"
    unknown_token: str = "x"

    # LLM 리포트
    # MAEK_LLM_MODEL 환경변수로 바꿀 수 있다. 기본은 OpenAI 의 mini 모델.
    llm_model: str = os.environ.get("MAEK_LLM_MODEL", "gpt-5-mini")
    llm_enabled: bool = True
    llm_max_tokens: int = 1000

    taxonomy: BusinessTaxonomy = field(default_factory=BusinessTaxonomy)


# 2×2 유형 정의
TYPE_MAINTAIN = "유지형"
TYPE_DRAIN_LEAD = "이탈 선행형"
TYPE_FUNC_LOSS = "기능 결손형"
TYPE_COMPOUND = "복합 소멸형"

TYPE_ORDER = [TYPE_MAINTAIN, TYPE_DRAIN_LEAD, TYPE_FUNC_LOSS, TYPE_COMPOUND]

PRESCRIPTION: dict[str, dict[str, str]] = {
    TYPE_MAINTAIN: {
        "지자체": "현 기능을 유지하며 사다리 점수 하락 여부를 월 단위로 관찰합니다.",
        "창업자": "일반 상권 분석 기준을 적용해도 무방합니다.",
        "카드사": "정상 가맹 관리 구간입니다. 사다리 점수 하락 시점만 감시하면 됩니다.",
        "우선순위": "낮음",
    },
    TYPE_DRAIN_LEAD: {
        "지자체": "청년 이탈 원인 규명이 최우선이다. 상권 기능이 남아 있는 동안의 "
                  "개입이 비용 대비 효과가 가장 큽니다.",
        "창업자": "조건부 진입이며, 잔존 세대를 대상으로 하는 업종으로 한정해야 합니다.",
        "카드사": "가맹점 이탈에 선행하는 구간입니다. 청년 타깃 가맹점의 결제 추이를 "
                  "우선 모니터링 대상으로 편성할 수 있습니다.",
        "우선순위": "최상 (조기경보 핵심)",
    },
    TYPE_FUNC_LOSS: {
        "지자체": "결손된 상위 업종의 유치와 광역 상권 접근성 보장이 필요합니다.",
        "창업자": "공백 업종 진입 여지가 있으나 배후 수요 규모 확인이 선행되어야 합니다.",
        "카드사": "상위 업종이 이미 비어 있어 신규 가맹 확보 여지가 있는 구간입니다.",
        "우선순위": "중간",
    },
    TYPE_COMPOUND: {
        "지자체": "상권 정책보다 생활 인프라·식품 접근권·돌봄 연계가 우선합니다.",
        "창업자": "신규 창업은 권장하지 않으며, 근린 복합형만 제한적으로 검토합니다.",
        "카드사": "신규 가맹 확대보다 잔존 근린 가맹점의 유지가 우선인 구간입니다.",
        "우선순위": "높음 (복지 전환)",
    },
}

AUDIENCE_LABEL = {
    "지자체": "지자체 정책 담당자",
    "창업자": "로컬 창업자",
    "카드사": "제휴 카드사·소상공인 진흥원",
}

# 유형별 핵심 권장 조치. 제안서 F6 처방 카드를 실행 단위로 분해한 것으로,
# 과제의 성격·담당 기능·시기 구간만 규정한다. 소요 예산은 지역 재정 여건에
# 따라 달라지므로 엔진이 산출하지 않는다.
ACTION_MATRIX: dict[str, list[dict[str, str]]] = {
    TYPE_DRAIN_LEAD: [
        {"title": "청년 외식 수요의 역외 유출 경로 실측",
         "detail": "인접 대도시로 빠져나가는 20~30대 외식 소비의 목적지와 시간대를 "
                   "카드 데이터로 특정해 개입 지점을 좁힙니다.",
         "owner": "기획예산실", "horizon": "단기", "rank": "우선과제"},
        {"title": "잔존 세대 대상 상권 앵커 시설 유치",
         "detail": "아직 남아 있는 연령대의 소비를 관내에 묶어두는 시설을 우선 "
                   "배치해 사다리 점수 하락을 지연시킵니다.",
         "owner": "일자리경제과", "horizon": "단기", "rank": "우선과제"},
        {"title": "지역화폐 차등 인센티브 설계",
         "detail": "유출 비중이 큰 업종·요일에 환급률을 차등 적용해 관내 결제 "
                   "전환을 유도하고, 효과를 월 단위 결제 데이터로 검증합니다.",
         "owner": "기획예산실", "horizon": "중기", "rank": "과제"},
        {"title": "월 단위 유형 변동 감시 체계 상설화",
         "detail": "사다리 점수 하락 또는 유형 전이 발생 시 담당 부서에 자동 "
                   "통보되도록 경보 수신 체계를 지정합니다.",
         "owner": "인구정책부서", "horizon": "단기", "rank": "과제"},
    ],
    TYPE_FUNC_LOSS: [
        {"title": "결손 상위 업종 유치 타당성 검토",
         "detail": "소실된 계층의 배후 수요 규모를 먼저 확인하고, 단독 입지가 "
                   "불가능하면 복합형 유치안으로 전환합니다.",
         "owner": "일자리경제과", "horizon": "단기", "rank": "우선과제"},
        {"title": "광역 상권 접근성 보장",
         "detail": "관내에서 충족되지 않는 기능에 대해 인접 거점까지의 교통 "
                   "접근권을 확보해 생활 불편을 완화합니다.",
         "owner": "교통행정과", "horizon": "중기", "rank": "우선과제"},
        {"title": "잔존 근린 기능 유지 지원",
         "detail": "편의점·슈퍼마켓 등 마지막 생활 기능의 폐업을 막는 것이 "
                   "신규 유치보다 비용 대비 효과가 큽니다.",
         "owner": "지역경제과", "horizon": "단기", "rank": "과제"},
    ],
    TYPE_COMPOUND: [
        {"title": "식품 접근권 확보",
         "detail": "근린 소매까지 소실된 구역을 특정해 이동 판매·공동 배송 등 "
                   "대체 수단을 우선 배치합니다.",
         "owner": "주민복지과", "horizon": "단기", "rank": "우선과제"},
        {"title": "돌봄·생활 인프라 연계 전환",
         "detail": "상권 회복을 목표로 하기보다 잔존 고령 세대의 생활 유지로 "
                   "정책 목표를 전환합니다.",
         "owner": "주민복지과", "horizon": "단기", "rank": "우선과제"},
        {"title": "신규 창업 진입 경보 고지",
         "detail": "관내 창업 상담 창구에 유형 진단 결과를 연계해 회복 불가 "
                   "구간에 대한 진입을 사전에 고지합니다.",
         "owner": "지역경제과", "horizon": "중기", "rank": "과제"},
    ],
    TYPE_MAINTAIN: [
        {"title": "월 단위 사다리 점수 모니터링",
         "detail": "현재는 개입 대상이 아니며, 상위 업종 소실이 관측되는 시점을 "
                   "포착하는 것으로 충분합니다.",
         "owner": "인구정책부서", "horizon": "단기", "rank": "과제"},
        {"title": "세대 구성 변화 정기 점검",
         "detail": "세대이탈지수가 경보선에 접근하는지 분기 단위로 확인합니다.",
         "owner": "기획예산실", "horizon": "중기", "rank": "과제"},
    ],
}

REPORT_CONTENTS = [
    "요약 진단 (Executive Summary)",
    "상권기능 사다리 및 세대이탈 지표",
    "연령별 세대 소비 구조 및 외식 유출 분석",
    "정책적 처방 및 단기·중기 로드맵",
    "카드 데이터 통계 근거 및 산출 방법",
]


# ════════════════════════════════════════════════════════════════════
#  ① 수집 (Ingest)
# ════════════════════════════════════════════════════════════════════

SIDO_ALIAS = {
    "강원도": "강원특별자치도", "강원": "강원특별자치도",
    "전라북도": "전북특별자치도", "전북": "전북특별자치도",
    "제주도": "제주특별자치도", "제주": "제주특별자치도",
    "세종시": "세종특별자치시", "세종": "세종특별자치시",
    "서울": "서울특별시", "부산": "부산광역시", "대구": "대구광역시",
    "인천": "인천광역시", "광주": "광주광역시", "대전": "대전광역시",
    "울산": "울산광역시", "경기": "경기도", "충북": "충청북도",
    "충남": "충청남도", "전남": "전라남도", "경북": "경상북도",
    "경남": "경상남도",
}


def _clean_text(s: Any) -> str:
    """공백·행정코드·유니코드 정규화."""
    s = unicodedata.normalize("NFC", str(s))
    s = re.sub(r"\(\d+\)", "", s)
    return re.sub(r"\s+", " ", s).strip()


def _norm_sido(s: Any) -> str:
    s = _clean_text(s)
    return SIDO_ALIAS.get(s, s)


def _read_any(path: str | Path) -> pd.DataFrame:
    """csv/xlsx를 인코딩 자동 판별로 읽는다."""
    path = Path(path)
    if path.suffix.lower() in (".xlsx", ".xls"):
        return pd.read_excel(path, header=None)
    last: Exception | None = None
    for enc in ("utf-8-sig", "cp949", "euc-kr", "utf-8"):
        try:
            return pd.read_csv(path, header=None, encoding=enc)
        except UnicodeDecodeError as e:
            last = e
    raise RuntimeError(f"인코딩 판별 실패: {path}") from last


class Ingest:
    """① 원천 데이터 적재."""

    CARD_COLUMNS = [
        "STRD_YYMM", "SIDO_NM", "CCG_NM", "GENDER_CD",
        "AGE_CD", "TP_BUZ_NO", "TP_BUZ_NM", "amt", "cnt",
    ]

    def __init__(self, cfg: EngineConfig):
        self.cfg = cfg

    def card(self, path: str | Path) -> pd.DataFrame:
        df = pd.read_csv(path, dtype={"GENDER_CD": str, "AGE_CD": str})
        missing = set(self.CARD_COLUMNS) - set(df.columns)
        if missing:
            raise ValueError(f"소비데이터 필수 컬럼 누락: {sorted(missing)}")
        log.info("① 소비데이터 %s행 · %s개월 적재",
                 f"{len(df):,}", df.STRD_YYMM.nunique())
        return df

    def population(self, path: str | Path | None) -> pd.DataFrame | None:
        """행안부 주민등록 인구통계.

        헤더 위치와 컬럼명이 배포본마다 달라 자동 탐색한다.
        반환: SIDO_NM · CCG_NM · population
        """
        if path is None:
            log.warning("① 인구 데이터 미제공 — 생활소비 원단위·공동화 판정을 건너뛴다")
            return None

        raw = _read_any(path)
        header_row = next(
            (i for i in range(min(12, len(raw)))
             if raw.iloc[i].astype(str).str.contains("행정구역").any()),
            0,
        )
        df = raw.iloc[header_row + 1:].copy()
        df.columns = [_clean_text(c) for c in raw.iloc[header_row]]
        df = df.loc[:, ~df.columns.duplicated()]

        region_col = next(c for c in df.columns if "행정구역" in c)
        pop_col = next(
            (c for c in df.columns
             if "총인구" in c or ("인구" in c and "세대" not in c and "당" not in c)),
            None,
        )
        if pop_col is None:
            raise ValueError(f"인구 컬럼 탐색 실패. 후보: {list(df.columns)}")

        out = pd.DataFrame({
            "raw": df[region_col].map(_clean_text),
            "population": pd.to_numeric(
                df[pop_col].astype(str).str.replace(",", "", regex=False),
                errors="coerce",
            ),
        }).dropna(subset=["population"])

        parts = out.raw.str.split(" ")
        out["SIDO_NM"] = parts.str[0].map(_norm_sido)
        out["CCG_NM"] = parts.str[1:].str.join(" ").map(_clean_text)
        # 세종은 시도·시군구가 동일하게 표기된다
        sejong = out.SIDO_NM == "세종특별자치시"
        out.loc[sejong, "CCG_NM"] = "세종특별자치시"
        out = out[out.CCG_NM.astype(bool)]

        out = out.groupby(["SIDO_NM", "CCG_NM"], as_index=False)["population"].max()
        log.info("① 인구 데이터 %s개 시군구 적재", len(out))
        return out

    def risk_index(self, path: str | Path | None) -> pd.DataFrame | None:
        """고용정보원 지방소멸위험지수 (선택).

        반환: SIDO_NM · CCG_NM · risk_index (낮을수록 위험)
        """
        if path is None:
            log.warning("① 소멸위험지수 미제공 — 경보 대조를 내부 분위수로 대체한다")
            return None

        raw = _read_any(path)
        header_row = next(
            (i for i in range(min(12, len(raw)))
             if raw.iloc[i].astype(str).str.contains("지역|행정구역").any()),
            0,
        )
        df = raw.iloc[header_row + 1:].copy()
        df.columns = [_clean_text(c) for c in raw.iloc[header_row]]

        region_col = next(c for c in df.columns if "지역" in c or "행정구역" in c)
        idx_col = next(c for c in df.columns if "지수" in c or "위험" in c)

        out = pd.DataFrame({
            "raw": df[region_col].map(_clean_text),
            "risk_index": pd.to_numeric(df[idx_col], errors="coerce"),
        }).dropna(subset=["risk_index"])
        parts = out.raw.str.split(" ")
        out["SIDO_NM"] = parts.str[0].map(_norm_sido)
        out["CCG_NM"] = parts.str[1:].str.join(" ").map(_clean_text)
        log.info("① 소멸위험지수 %s개 지역 적재", len(out))
        return out[["SIDO_NM", "CCG_NM", "risk_index"]]


# ════════════════════════════════════════════════════════════════════
#  ② 정제 (Clean)
# ════════════════════════════════════════════════════════════════════

class Clean:
    """② 표기 정규화 · 코드 분리 · 무결성 검증."""

    def __init__(self, cfg: EngineConfig):
        self.cfg = cfg
        self.report: dict[str, Any] = {}

    def run(self, card: pd.DataFrame) -> pd.DataFrame:
        df = card.copy()

        # 업종명: '편 의 점' → '편의점'
        df["buz"] = df.TP_BUZ_NM.map(lambda s: str(s).replace(" ", ""))

        # 지역 키
        df["SIDO_NM"] = df.SIDO_NM.map(_norm_sido)
        df["CCG_NM"] = df.CCG_NM.map(_clean_text)
        df["region"] = df.SIDO_NM + " " + df.CCG_NM

        # 코드 타입 고정
        df["GENDER_CD"] = df.GENDER_CD.astype(str).str.lower()
        df["AGE_CD"] = df.AGE_CD.astype(str).str.lower()
        df["STRD_YYMM"] = df.STRD_YYMM.astype(int)

        # 세그먼트 플래그
        u = self.cfg.unknown_token
        df["is_domestic"] = df.GENDER_CD.isin(self.cfg.domestic_gender)
        df["is_foreign"] = df.GENDER_CD == self.cfg.foreign_gender
        df["is_unknown"] = (df.GENDER_CD == u) | (df.AGE_CD == u)

        self.report = self._audit(df)
        log.info("② 정제 완료 — %s개 시군구 · %s개 업종 · 미상 %.1f%%",
                 df.region.nunique(), df.buz.nunique(),
                 self.report["unknown_amt_share"] * 100)
        return df

    def _audit(self, df: pd.DataFrame) -> dict[str, Any]:
        """데이터 품질 감사. 리포트에 그대로 실린다."""
        pairs = df[df.is_domestic].groupby(["region", "buz"]).STRD_YYMM.nunique()
        months = df.STRD_YYMM.nunique()
        return {
            "rows": int(len(df)),
            "nulls": int(df.isna().sum().sum()),
            "months": sorted(df.STRD_YYMM.unique().tolist()),
            "regions": int(df.region.nunique()),
            "business_types": int(df.buz.nunique()),
            "min_cnt": int(df.cnt.min()),          # 비공개 처리 임계 추정
            "complete_pairs": int((pairs == months).sum()),
            "total_pairs": int(len(pairs)),
            "completeness": round(float((pairs == months).mean()), 4),
            "unknown_amt_share": round(
                float(df.loc[df.is_unknown, "amt"].sum() / df.amt.sum()), 4),
            "foreign_amt_share": round(
                float(df.loc[df.is_foreign, "amt"].sum() / df.amt.sum()), 4),
        }


# ════════════════════════════════════════════════════════════════════
#  ③ 지표 산출 (Metrics)
# ════════════════════════════════════════════════════════════════════

class Metrics:
    """③ 지역별 지표 산출.

    산출 지표
        ladder_score      상권기능 사다리 (0~3)
        ladder_pattern    존재 조합 문자열 ('110' 등)
        ladder_conforms   위계 정합 여부
        drain_index       세대이탈지수 (%p)
        gap_age_*         연령대별 세대 갭 (%p)
        living_spend      생활소비 규모 (근린소매 금액)
        spend_per_capita  생활소비 원단위 (인구 결합 시)
        foreign_share     전체 소비 중 외국인 비중 (%)
        youth_foreign_share  20~30대 소비 중 외국인 비중 (%)
        dining_dependency 외식의존도 (보조 지표)
    """

    def __init__(self, cfg: EngineConfig):
        self.cfg = cfg
        self.tx = cfg.taxonomy

    # ── 축 1 ────────────────────────────────────────────────────
    def ladder(self, df: pd.DataFrame) -> pd.DataFrame:
        dom = df[df.is_domestic]
        presence = (
            dom.pivot_table(index="region", columns="buz", values="amt", aggfunc="sum")
            .reindex(columns=list(self.tx.LADDER))
            .notna()
            .astype(int)
        )
        out = pd.DataFrame(index=presence.index)
        out["ladder_score"] = presence.sum(axis=1)
        out["ladder_pattern"] = presence.astype(str).agg("".join, axis=1)
        # 정합 조합: 하위부터 순서대로 채워진 형태만 허용
        conform = {"".join(["1"] * k + ["0"] * (len(self.tx.LADDER) - k))
                   for k in range(len(self.tx.LADDER) + 1)}
        out["ladder_conforms"] = out.ladder_pattern.isin(conform)
        out["missing_tiers"] = presence.apply(
            lambda r: ", ".join([c for c in presence.columns if r[c] == 0]) or "-", axis=1)
        return out

    # ── 축 2 ────────────────────────────────────────────────────
    def generational_gap(self, df: pd.DataFrame) -> pd.DataFrame:
        """근린소매 연령 분포를 실존 인구 구조의 기준선으로 삼는다."""
        u = self.cfg.unknown_token
        d = df[df.is_domestic & (df.AGE_CD != u)]

        def share(types: Iterable[str]) -> pd.DataFrame:
            sub = d[d.buz.isin(list(types))]
            tbl = sub.groupby(["region", "AGE_CD"]).amt.sum().unstack().fillna(0.0)
            return tbl.div(tbl.sum(axis=1).replace(0, np.nan), axis=0)

        dining = share(self.tx.DINING)
        retail = share(self.tx.RETAIL)
        ages = sorted(set(dining.columns) | set(retail.columns))
        gap = (dining.reindex(columns=ages).fillna(0)
               - retail.reindex(columns=ages).fillna(0)) * 100

        out = gap.add_prefix("gap_age_")
        elder = gap.get(self.cfg.elder_code, 0.0)
        youth = sum(gap.get(c, 0.0) for c in self.cfg.youth_codes)
        out["drain_index"] = elder - youth
        return out

    # ── 규모·구성 지표 ──────────────────────────────────────────
    def volume(self, df: pd.DataFrame) -> pd.DataFrame:
        dom = df[df.is_domestic]
        piv = dom.pivot_table(index="region", columns="buz",
                              values="amt", aggfunc="sum").fillna(0.0)
        out = pd.DataFrame(index=piv.index)
        out["living_spend"] = piv.reindex(columns=list(self.tx.RETAIL), fill_value=0).sum(axis=1)
        dining = piv.reindex(columns=list(self.tx.DINING), fill_value=0).sum(axis=1)
        out["dining_spend"] = dining
        out["dining_dependency"] = dining / out.living_spend.replace(0, np.nan)
        out["total_spend"] = piv.sum(axis=1)
        return out

    def composition(self, df: pd.DataFrame) -> pd.DataFrame:
        """소비 구조 4분류 구성비 (%).

        지역 총 소비를 100으로 놓은 내부 구성비다. 카드사 점유율 편차의
        영향을 받지 않으므로 전국 평균과 직접 대조할 수 있다.
        """
        dom = df[df.is_domestic]
        piv = dom.pivot_table(index="region", columns="buz",
                              values="amt", aggfunc="sum").fillna(0.0)
        out = pd.DataFrame(index=piv.index)
        total = piv.reindex(columns=list(self.tx.ALL), fill_value=0).sum(axis=1)
        for key, types in self.tx.COMPOSITION.items():
            grp = piv.reindex(columns=list(types), fill_value=0).sum(axis=1)
            out[f"comp_{key}"] = grp / total.replace(0, np.nan) * 100
            out[f"amt_{key}"] = grp
        return out

    def age_mix(self, df: pd.DataFrame) -> pd.DataFrame:
        """근린소매 기준 연령 구성비 (%) — 지역에 남아 있는 소비 세대.

        외식이 아닌 근린소매를 쓰는 이유는 축 2와 같다. 원정 소비가 없어
        그 자리에 실제로 있었던 사람의 연령 구조를 반영하기 때문이다.
        """
        u = self.cfg.unknown_token
        d = df[df.is_domestic & (df.AGE_CD != u) & df.buz.isin(list(self.tx.RETAIL))]
        tbl = (d.groupby(["region", "AGE_CD"]).amt.sum().unstack()
               .reindex(columns=list(AGE_ORDER)).fillna(0.0))
        share = tbl.div(tbl.sum(axis=1).replace(0, np.nan), axis=0) * 100
        return share.add_prefix("age_share_")

    def foreign(self, df: pd.DataFrame) -> pd.DataFrame:
        total = df.groupby("region").amt.sum()
        foreign = df[df.is_foreign].groupby("region").amt.sum()
        youth = df[df.AGE_CD.isin(self.cfg.youth_codes)]
        youth_total = youth.groupby("region").amt.sum()
        youth_foreign = youth[youth.is_foreign].groupby("region").amt.sum()

        out = pd.DataFrame(index=total.index)
        out["foreign_share"] = (foreign / total * 100).reindex(out.index).fillna(0.0)
        out["youth_foreign_share"] = (
            (youth_foreign / youth_total * 100).reindex(out.index).fillna(0.0))
        return out

    # ── 통합 ────────────────────────────────────────────────────
    def run(self, df: pd.DataFrame,
            population: pd.DataFrame | None = None) -> pd.DataFrame:
        out = (self.ladder(df)
               .join(self.generational_gap(df))
               .join(self.volume(df))
               .join(self.composition(df))
               .join(self.age_mix(df))
               .join(self.foreign(df)))

        keys = df[["region", "SIDO_NM", "CCG_NM"]].drop_duplicates().set_index("region")
        out = keys.join(out)

        if population is not None:
            pop = population.copy()
            pop["region"] = pop.SIDO_NM + " " + pop.CCG_NM
            out = out.join(pop.set_index("region")["population"])
            out["spend_per_capita"] = out.living_spend / out.population
            # 전국 중앙값 = 1 로 정규화한 실존 인구 괴리율
            med = out.spend_per_capita.median()
            out["presence_ratio"] = out.spend_per_capita / med
            matched = int(out.population.notna().sum())
            log.info("③ 인구 결합 %s/%s 매칭", matched, len(out))
            if matched < len(out):
                log.warning("③ 미매칭 지역: %s",
                            ", ".join(out[out.population.isna()].index[:10]))
        else:
            out["population"] = np.nan
            out["spend_per_capita"] = np.nan
            out["presence_ratio"] = np.nan

        log.info("③ 지표 산출 완료 — %s개 지역 × %s개 지표", *out.shape)
        return out


# ════════════════════════════════════════════════════════════════════
#  ④ 유형 판정 (Classify)
# ════════════════════════════════════════════════════════════════════

class Classify:
    """④ 2×2 유형 판정 및 전월 대비 변동 감지."""

    def __init__(self, cfg: EngineConfig):
        self.cfg = cfg

    def run(self, metrics: pd.DataFrame) -> pd.DataFrame:
        out = metrics.copy()
        deficit = out.ladder_score <= self.cfg.ladder_deficit_max
        drained = out.drain_index > self.cfg.drain_threshold

        out["region_type"] = np.select(
            [deficit & drained, deficit & ~drained, ~deficit & drained],
            [TYPE_COMPOUND, TYPE_FUNC_LOSS, TYPE_DRAIN_LEAD],
            default=TYPE_MAINTAIN,
        )

        # 원인 분해 — 인구 결합 시에만 판정 가능
        if out.presence_ratio.notna().any():
            out["cause"] = np.where(
                out.presence_ratio < 0.85, "공동화형",
                np.where(out.presence_ratio > 1.15, "유입형", "유출형"))
        else:
            out["cause"] = "판정불가(인구데이터 필요)"

        out["priority"] = out.region_type.map(
            lambda t: PRESCRIPTION[t]["우선순위"])

        # 전국 내 위치 — 담당자는 절대값보다 '우리가 몇 번째인가'를 먼저 본다.
        # _pctl 은 값의 백분위(클수록 값이 큼), _top_pct 는 위험 순위 백분율
        # (작을수록 위험)이다. 두 방향을 섞지 않도록 이름을 분리해 둔다.
        for col in ("drain_index", "foreign_share", "youth_foreign_share",
                    "ladder_score", "living_spend", "dining_dependency"):
            out[f"{col}_pctl"] = out[col].rank(pct=True).mul(100).round(1)

        for col, higher_is_worse in (("drain_index", True),
                                     ("youth_foreign_share", True),
                                     ("ladder_score", False)):
            rank = out[col].rank(ascending=not higher_is_worse, method="min")
            out[f"{col}_risk_rank"] = rank.astype(int)
            out[f"{col}_top_pct"] = (rank / len(out) * 100).round(1)

        counts = out.region_type.value_counts().reindex(TYPE_ORDER, fill_value=0)
        log.info("④ 유형 판정 — %s",
                 " / ".join(f"{k} {v}" for k, v in counts.items()))
        return out

    @staticmethod
    def detect_transitions(current: pd.DataFrame,
                           previous: pd.DataFrame) -> pd.DataFrame:
        """전월 스냅샷과 비교해 유형 변동·사다리 하락을 잡아낸다."""
        cur = current[["region_type", "ladder_score", "drain_index"]]
        prv = previous[["region_type", "ladder_score", "drain_index"]]
        j = cur.join(prv, lsuffix="_cur", rsuffix="_prev", how="inner")
        changed = j[
            (j.region_type_cur != j.region_type_prev)
            | (j.ladder_score_cur < j.ladder_score_prev)
        ].copy()
        changed["drain_delta"] = (changed.drain_index_cur
                                  - changed.drain_index_prev).round(2)
        changed["severity"] = np.where(
            changed.ladder_score_cur < changed.ladder_score_prev, "상권기능 하락", "유형 변동")
        return changed


# ════════════════════════════════════════════════════════════════════
#  ⑤ 경보 생성 (Alert)
# ════════════════════════════════════════════════════════════════════

@dataclass
class Alert:
    region: str
    kind: str           # 선행 경보 / 과소평가 / 외국인 의존
    severity: str       # 높음 / 중간
    message: str
    evidence: dict[str, Any]


class AlertEngine:
    """⑤ 기존 지수와 소비 진단의 불일치를 경보로 변환."""

    YOUTH_FOREIGN_ALERT = 40.0   # 20~30대 소비의 40% 이상을 외국인이 담당

    def __init__(self, cfg: EngineConfig):
        self.cfg = cfg

    def run(self, classified: pd.DataFrame,
            risk_index: pd.DataFrame | None = None) -> list[Alert]:
        df = classified.copy()

        if risk_index is not None:
            ri = risk_index.copy()
            ri["region"] = ri.SIDO_NM + " " + ri.CCG_NM
            # Store 가 이미 같은 열을 붙여 넘기는 경우가 있어 겹치면 지우고 다시 붙인다
            df = df.drop(columns=["risk_index"], errors="ignore")
            df = df.join(ri.set_index("region")["risk_index"])
        elif "risk_index" not in df.columns:
            df["risk_index"] = np.nan

        alerts: list[Alert] = []
        has_ri = df.risk_index.notna().any()

        if has_ri:
            safe = df.risk_index > df.risk_index.quantile(self.cfg.alert_risk_safe_quantile)
            risky = df.risk_index <= df.risk_index.quantile(0.25)
        else:
            # 외부 지수가 없으면 상권 기능 잔존도를 대리 기준으로 사용한다
            safe = df.ladder_score >= 2
            risky = df.ladder_score <= 1

        drained = df.drain_index > df.drain_index.quantile(self.cfg.alert_drain_quantile)

        # ── 선행 경보: 기존 기준상 정상이나 소비 구조가 이미 이탈 ──
        for r, row in df[safe & drained].iterrows():
            alerts.append(Alert(
                region=r, kind="선행 경보", severity="높음",
                message=(f"상권 기능은 유지되고 있으나 세대이탈지수가 "
                         f"{row.drain_index:.1f}%p로 전국 상위 구간입니다. "
                         f"기존 통계가 위험으로 분류하기 전 단계이며, "
                         f"개입 효과가 가장 큰 구간입니다."),
                evidence={"drain_index": round(float(row.drain_index), 2),
                          "ladder_score": int(row.ladder_score),
                          "region_type": row.region_type,
                          "risk_index": None if pd.isna(row.risk_index)
                                        else round(float(row.risk_index), 3)},
            ))

        # ── 과소평가: 기존 기준상 위험하나 상권이 기능 중 ──
        for r, row in df[risky & ~drained].iterrows():
            alerts.append(Alert(
                region=r, kind="과소평가", severity="중간",
                message=(f"기존 기준으로는 위험 구간이나 세대 구성이 유지되고 "
                         f"있습니다(세대이탈지수 {row.drain_index:.1f}%p). "
                         f"투입 대비 회복 가능성이 높은 우선 지원 대상입니다."),
                evidence={"drain_index": round(float(row.drain_index), 2),
                          "ladder_score": int(row.ladder_score),
                          "region_type": row.region_type},
            ))

        # ── 외국인 의존: 체류 정책 변화가 즉시 상권 리스크로 전이 ──
        for r, row in df[df.youth_foreign_share >= self.YOUTH_FOREIGN_ALERT].iterrows():
            alerts.append(Alert(
                region=r, kind="외국인 의존", severity="중간",
                message=(f"20~30대 소비의 {row.youth_foreign_share:.1f}%를 외국인이 "
                         f"담당합니다(전국 중앙값 대비 현저히 높음). 체류 정책 "
                         f"변화가 지역 상권에 직접 전이될 수 있습니다."),
                evidence={"youth_foreign_share": round(float(row.youth_foreign_share), 1),
                          "foreign_share": round(float(row.foreign_share), 1),
                          "region_type": row.region_type},
            ))

        log.info("⑤ 경보 %s건 (선행 %s · 과소평가 %s · 외국인 %s)",
                 len(alerts),
                 sum(a.kind == "선행 경보" for a in alerts),
                 sum(a.kind == "과소평가" for a in alerts),
                 sum(a.kind == "외국인 의존" for a in alerts))
        return alerts


# ════════════════════════════════════════════════════════════════════
#  ⑥ 리포트 생성 (Report)
# ════════════════════════════════════════════════════════════════════

class ReportGenerator:
    """⑥ 진단 서술문 생성.

    LLM을 쓰되 지표 원본을 함께 실어 담당자가 근거를 검증할 수 있게 한다.
    API 키가 없거나 호출이 실패하면 템플릿 서술로 자동 폴백한다.
    """

    SYSTEM = (
        "당신은 지역 경제 분석 리포트를 작성하는 정책 분석가입니다. "
        "주어진 지표만 근거로 삼고, 주어지지 않은 사실을 추가하지 마십시오. "
        "3~4문장의 한국어 격식체(~합니다) 서술문으로 작성하고, 수치를 반드시 인용하십시오. "
        "지표 값은 따옴표로 감싸지 말고 문장에 자연스럽게 녹이며, "
        "'제시되었다·명시되어 있다' 같은 보고체 대신 지역 상황을 설명하는 문장으로 쓰십시오. "
        "단정적 예측이나 정책 효과 보장은 하지 마십시오."
    )

    def __init__(self, cfg: EngineConfig):
        self.cfg = cfg
        self._client = None
        if cfg.llm_enabled and os.environ.get("OPENAI_API_KEY"):
            try:
                import openai
                self._client = openai.OpenAI()
            except Exception as e:  # noqa: BLE001
                log.warning("⑥ LLM 초기화 실패 — 템플릿으로 폴백 (%s)", e)

    def _facts(self, region: str, row: pd.Series) -> dict[str, Any]:
        f = {
            "지역": region,
            "유형": row.region_type,
            "상권기능_사다리": f"{int(row.ladder_score)}/3",
            "결손_업종": row.missing_tiers,
            "세대이탈지수": f"{row.drain_index:.1f}%p",
            "외국인_소비비중": f"{row.foreign_share:.1f}%",
            "청년소비_외국인비중": f"{row.youth_foreign_share:.1f}%",
        }
        if pd.notna(row.get("presence_ratio")):
            f["실존인구_괴리율"] = f"{row.presence_ratio:.2f}"
            f["원인_유형"] = row.cause
        return f

    def _template(self, region: str, row: pd.Series) -> str:
        parts = [
            f"{region}은 상권기능 사다리 {int(row.ladder_score)}점, "
            f"세대이탈지수 {row.drain_index:.1f}%p로 {row.region_type}에 해당합니다."
        ]
        if row.missing_tiers != "-":
            parts.append(f"결손된 상위 업종은 {row.missing_tiers}입니다.")
        if row.youth_foreign_share >= 30:
            parts.append(
                f"20~30대 소비의 {row.youth_foreign_share:.1f}%를 외국인이 담당하고 있어 "
                f"청년 소비 구조에 대한 별도 관찰이 필요합니다.")
        if pd.notna(row.get("presence_ratio")):
            parts.append(
                f"실존 인구 괴리율은 {row.presence_ratio:.2f}로 {row.cause}으로 분류됩니다.")
        parts.append(PRESCRIPTION[row.region_type]["지자체"])
        return " ".join(parts)

    def narrate(self, region: str, row: pd.Series) -> dict[str, Any]:
        facts = self._facts(region, row)
        text, source = self._template(region, row), "template"

        if self._client is not None:
            try:
                model = self.cfg.llm_model
                kwargs: dict[str, Any] = {
                    "model": model,
                    # gpt-5 계열은 추론 토큰이 같은 예산에서 빠져나가므로 여유를 둔다
                    "max_completion_tokens": max(self.cfg.llm_max_tokens, 1500),
                    "messages": [
                        {"role": "system", "content": self.SYSTEM},
                        {"role": "user", "content":
                         "다음 지표로 진단 서술문을 작성하십시오.\n"
                         + json.dumps(facts, ensure_ascii=False, indent=2)},
                    ],
                }
                if model.startswith(("gpt-5", "o1", "o3", "o4")):
                    kwargs["reasoning_effort"] = "low"   # 짧은 서술문에 깊은 추론은 낭비
                res = self._client.chat.completions.create(**kwargs)
                out = (res.choices[0].message.content or "").strip()
                if not out:
                    raise ValueError("빈 응답")
                text, source = out, f"openai/{model}"
            except Exception as e:  # noqa: BLE001
                log.warning("⑥ LLM 호출 실패 — 템플릿 사용 (%s)", e)

        return {
            "region": region,
            "narrative": text,
            "narrative_source": source,   # 생성 출처를 명시해 검증 가능성을 유지
            "facts": facts,               # 서술의 근거가 된 지표 원본
            "prescription": PRESCRIPTION[row.region_type],
        }

    def run(self, classified: pd.DataFrame,
            regions: Iterable[str] | None = None) -> list[dict[str, Any]]:
        targets = list(regions) if regions is not None else classified.index.tolist()
        out = [self.narrate(r, classified.loc[r]) for r in targets if r in classified.index]
        log.info("⑥ 리포트 %s건 생성", len(out))
        return out

    def dossier(self, region: str, row: pd.Series, *,
                audience: str = "지자체",
                base_month: int | None = None) -> dict[str, Any]:
        """공문서용 처방 묶음 — 진단 총평 · 권장 조치 · 리포트 목차.

        화면의 '처방 및 리포트'가 그대로 소비하는 형태로 만든다. 조치의
        소요 예산은 지역 재정 여건에 좌우되므로 엔진이 산출하지 않는다.
        """
        if audience not in AUDIENCE_LABEL:
            raise KeyError(f"알 수 없는 대상자: {audience}")

        narrative = self.narrate(region, row)
        actions = [dict(a) for a in ACTION_MATRIX.get(row.region_type, [])]
        for i, a in enumerate(actions, start=1):
            a["no"] = f"{i:02d}"
            a["selected"] = a["rank"] == "우선과제"

        return {
            "region": region,
            "region_type": row.region_type,
            "priority": PRESCRIPTION[row.region_type]["우선순위"],
            "audience": audience,
            "audience_label": AUDIENCE_LABEL[audience],
            "audience_options": [
                {"key": k, "label": v,
                 "count": len(ACTION_MATRIX.get(row.region_type, [])) if k == "지자체" else None}
                for k, v in AUDIENCE_LABEL.items()
            ],
            "headline": PRESCRIPTION[row.region_type][audience],
            "narrative": narrative["narrative"],
            "narrative_source": narrative["narrative_source"],
            "facts": narrative["facts"],
            "actions": actions,
            "contents": [{"no": i, "title": t}
                         for i, t in enumerate(REPORT_CONTENTS, start=1)],
            "document_no": self.document_no(region, row, base_month),
            "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        }

    @staticmethod
    def document_no(region: str, row: pd.Series,
                    base_month: int | None = None) -> str:
        """결정적 문서 식별번호. 같은 지역·같은 기준월이면 항상 같은 값이다."""
        month = f"{base_month // 100}-{base_month % 100:02d}" if base_month else "0000-00"
        rank = int(row.get("drain_index_risk_rank", 0) or 0)
        return f"MAEK-{month}-R{rank:03d}"


# ════════════════════════════════════════════════════════════════════
#  창업 적합도 (제안서 6-2 예비 창업자 흐름)
# ════════════════════════════════════════════════════════════════════

@dataclass
class StartupAssessment:
    region: str
    business: str
    score: float                     # 0~100
    verdict: str                     # 권장 / 조건부 권장 / 비권장
    demand_gap_pct: float            # 공급 대비 수요 공백 지수 (%)
    breakdown: dict[str, float]      # 항목별 획득 점수
    findings: list[dict[str, str]]   # 핵심 입지 판정 요약
    age_mix: list[dict[str, Any]]    # 이 지역에 남아 있는 소비 세대
    vacancies: list[dict[str, Any]]  # 상권 내 공백 업종 TOP 3
    region_type: str
    caveat: str


class StartupFit:
    """지역 × 희망 업종의 진입 적합도 판정.

    네 항목을 합산한다. 가중치는 설계값이며, 각 항목의 입력은 모두 제공
    데이터에서 산출한 실측치다.

        공급 공백 (30)  해당 업종 비중이 보유 지역 중앙값에 얼마나 미달하는가
        배후 수요 (25)  근린소매 소비 규모의 전국 백분위
        세대 적합 (20)  지역 잔존 세대와 그 업종의 전국 고객 연령 구성이
                        얼마나 겹치는가
        구조 안정 (25)  2×2 유형이 신규 진입을 버틸 수 있는 구간인가
        외국인 의존 (−10) 체류 정책 변화가 곧 매출 변동으로 전이되는 위험

    두 가지가 설계의 핵심이다.

    첫째, 공백 점수는 배후 수요와 곱해진다. 제안서 F6이 공백 업종 진입에
    "배후 수요 규모 확인이 선행되어야 한다"는 단서를 단 이유가 그대로
    점수 구조에 들어간다. 사람이 없어서 비어 있는 자리는 기회가 아니다.

    둘째, 업종별 고객 연령 구성을 임의로 가정하지 않고 제공 데이터의 전국
    실측 분포에서 가져온다. 외국인 의존 감점도 그 업종이 실제로 청년
    상권인지에 비례해 매긴다. 취향에 대한 통념이 아니라 관측된 결제
    구조가 기준이 된다.
    """

    WEIGHT = {"supply_gap": 30.0, "demand_base": 25.0,
              "cohort_fit": 20.0, "stability": 25.0}
    # 배후 수요가 0이어도 공백 점수의 이만큼은 남겨 둔다. 공백 자체의
    # 정보 가치는 인정하되 단독으로는 진입 근거가 되지 못하게 한다.
    SUPPLY_GAP_FLOOR = 0.35

    FOREIGN_PENALTY_MAX = 10.0
    FOREIGN_PENALTY_FLOOR = 25.0     # 이 비중부터 감점이 시작된다
    FOREIGN_PENALTY_CEIL = 65.0

    STABILITY = {TYPE_MAINTAIN: 1.0, TYPE_FUNC_LOSS: 0.7,
                 TYPE_DRAIN_LEAD: 0.5, TYPE_COMPOUND: 0.2}

    VERDICT_RECOMMEND = 70.0
    VERDICT_CONDITIONAL = 45.0
    # 배후 수요가 이 백분위 미만이면 '권장'까지 올리지 않는다
    THIN_DEMAND_PCTL = 15.0

    CAVEAT = ("본 진단은 시군구·업종 단위 카드 결제 집계에 기반한 참고 지표이며, "
              "개별 점포의 매출이나 창업 성공을 보증하지 않습니다. 세부 입지와 "
              "인허가는 관할 지자체 담당 부서와 확인하시기 바랍니다.")

    def __init__(self, cfg: EngineConfig, clean: pd.DataFrame,
                 classified: pd.DataFrame):
        self.cfg = cfg
        self.tx = cfg.taxonomy
        self.classified = classified

        dom = clean[clean.is_domestic]
        amt = (dom.pivot_table(index="region", columns="buz",
                               values="amt", aggfunc="sum")
               .reindex(columns=list(self.tx.ALL)))
        self.amt = amt.fillna(0.0)
        # 지역 내 업종 구성비 — 카드사 점유율 편차를 제거한 비교 단위
        self.share = self.amt.div(self.amt.sum(axis=1).replace(0, np.nan), axis=0) * 100
        # 기준선은 '그 업종이 존재하는 지역'의 중앙값이다. 전 지역 중앙값을
        # 쓰면 갈비전문점(150개 지역 결손)처럼 절반 이상이 비어 있는 업종의
        # 기준선이 0이 되어, 정작 가장 뚜렷한 공백이 0%로 계산된다.
        present = self.share.where(self.amt > 0)
        self.national_share = present.median()
        self.presence_count = (self.amt > 0).sum()
        self.region_count = int(len(self.amt))

        # 업종별 전국 고객 연령 구성비
        u = cfg.unknown_token
        aged = dom[dom.AGE_CD != u]
        prof = (aged.groupby(["buz", "AGE_CD"]).amt.sum().unstack()
                .reindex(columns=list(AGE_ORDER)).fillna(0.0))
        self.age_profile = prof.div(prof.sum(axis=1).replace(0, np.nan), axis=0)

    # ── 내부 계산 ───────────────────────────────────────────────
    def _demand_gap(self, region: str, buz: str) -> float:
        expected = float(self.national_share.get(buz, np.nan))
        actual = float(self.share.at[region, buz]) if buz in self.share.columns else 0.0
        if not np.isfinite(expected) or expected <= 0:
            return 0.0
        return float(np.clip((expected - actual) / expected * 100, -100.0, 100.0))

    def _cohort_fit(self, region: str, buz: str) -> float:
        """지역 잔존 세대와 업종 고객층의 겹침 정도 (0~1)."""
        if buz not in self.age_profile.index:
            return 0.0
        row = self.classified.loc[region]
        local = np.array([float(row.get(f"age_share_{a}", 0.0) or 0.0)
                          for a in AGE_ORDER]) / 100.0
        target = self.age_profile.loc[buz].to_numpy(dtype=float)
        if local.sum() <= 0 or not np.isfinite(target).all():
            return 0.0
        local = local / local.sum()
        return float(np.minimum(local, target).sum())   # overlap coefficient

    def _vacancies(self, region: str, top: int = 3) -> list[dict[str, Any]]:
        """공백이 큰 순서로 업종을 세운다.

        한정식은 제외한다. 255개 중 216개 지역에서 결측이라 부재 자체가
        결손 신호가 아니라 향토음식 도시의 지역 특성이기 때문이다.
        """
        gaps = []
        for buz in self.tx.ALL:
            if buz in self.tx.EXCLUDED_FROM_LADDER:
                continue
            expected = float(self.national_share.get(buz, np.nan))
            if not np.isfinite(expected) or expected <= 0:
                continue
            actual = float(self.share.at[region, buz])
            absent = float(self.amt.at[region, buz]) <= 0
            gaps.append({
                "business": buz,
                "status": "결손" if absent else "유출",
                "gap_pct": round((expected - actual) / expected * 100, 1),
                "local_share": round(actual, 2),
                "national_share": round(expected, 2),
                "presence": f"{int(self.presence_count[buz])}/{self.region_count}",
                "note": ("관내 결제가 관측되지 않아 해당 수요가 전량 역외로 "
                         "나가고 있습니다." if absent else
                         "관내 결제는 있으나 보유 지역 중앙값에 미달합니다."),
            })
        gaps.sort(key=lambda g: g["gap_pct"], reverse=True)
        return [g for g in gaps if g["gap_pct"] > 0][:top]

    def _age_mix(self, region: str) -> list[dict[str, Any]]:
        row = self.classified.loc[region]
        out = []
        for a in AGE_ORDER:
            v = row.get(f"age_share_{a}")
            out.append({"code": a, "label": AGE_LABEL[a],
                        "share": None if pd.isna(v) else round(float(v), 1)})
        return out

    # ── 판정 ────────────────────────────────────────────────────
    def assess(self, region: str, business: str) -> StartupAssessment:
        if region not in self.classified.index:
            raise KeyError(f"알 수 없는 지역: {region}")
        if business not in self.tx.ALL:
            raise KeyError(f"알 수 없는 업종: {business}")

        row = self.classified.loc[region]
        gap = self._demand_gap(region, business)
        absent = float(self.amt.at[region, business]) <= 0

        # 공백이 클수록 기회지만, 과잉 공급(음수)도 -50%까지만 반영한다
        gap_norm = float(np.clip((gap + 50.0) / 150.0, 0.0, 1.0))
        demand_pctl = float(row.get("living_spend_pctl", 50.0) or 50.0)
        demand = demand_pctl / 100.0
        # 배후 수요와의 곱 — 사람이 없어서 비어 있는 자리는 기회가 아니다
        supply = gap_norm * (self.SUPPLY_GAP_FLOOR
                             + (1.0 - self.SUPPLY_GAP_FLOOR) * demand)
        cohort = self._cohort_fit(region, business)
        stability = self.STABILITY.get(row.region_type, 0.5)

        yfs = float(row.get("youth_foreign_share", 0.0) or 0.0)
        penalty = (self.FOREIGN_PENALTY_MAX
                   * float(np.clip((yfs - self.FOREIGN_PENALTY_FLOOR)
                                   / (self.FOREIGN_PENALTY_CEIL
                                      - self.FOREIGN_PENALTY_FLOOR), 0.0, 1.0))
                   * self._youth_orientation(business))

        breakdown = {
            "supply_gap": round(self.WEIGHT["supply_gap"] * supply, 1),
            "demand_base": round(self.WEIGHT["demand_base"] * demand, 1),
            "cohort_fit": round(self.WEIGHT["cohort_fit"] * cohort, 1),
            "stability": round(self.WEIGHT["stability"] * stability, 1),
            "foreign_risk": -round(penalty, 1),
        }
        score = float(np.clip(sum(breakdown.values()), 0.0, 100.0))

        verdict = ("권장" if score >= self.VERDICT_RECOMMEND else
                   "조건부 권장" if score >= self.VERDICT_CONDITIONAL else "비권장")
        thin = demand_pctl < self.THIN_DEMAND_PCTL
        if thin and verdict == "권장":
            verdict = "조건부 권장"   # 배후 수요 미확인 구간은 권장까지 올리지 않는다

        return StartupAssessment(
            region=region, business=business,
            score=round(score, 1), verdict=verdict,
            demand_gap_pct=round(gap, 1),
            breakdown=breakdown,
            findings=self._findings(region, business, row, gap, absent,
                                    cohort, yfs, demand_pctl, thin),
            age_mix=self._age_mix(region),
            vacancies=self._vacancies(region),
            region_type=row.region_type,
            caveat=self.CAVEAT,
        )

    def _youth_orientation(self, buz: str) -> float:
        """그 업종이 실제로 청년 상권인가 (0~1, 전국 최대치 기준 정규화).

        외국인 의존 감점을 업종과 무관하게 매기면, 고령 세대를 상대하는
        업종까지 청년 외국인 비중 때문에 깎인다. 감점의 크기를 업종의
        실측 청년 고객 비중에 비례시킨다.
        """
        if buz not in self.age_profile.index:
            return 1.0
        youth = self.age_profile[list(self.cfg.youth_codes)].sum(axis=1)
        peak = float(youth.max())
        if peak <= 0:
            return 1.0
        return float(np.clip(youth.loc[buz] / peak, 0.0, 1.0))

    def _findings(self, region: str, business: str, row: pd.Series,
                  gap: float, absent: bool, cohort: float, yfs: float,
                  demand_pctl: float, thin: bool) -> list[dict[str, str]]:
        """판정의 근거를 담당자가 검증할 수 있는 문장으로 편다."""
        out: list[dict[str, str]] = []

        if absent:
            out.append({"tone": "positive", "text":
                        f"관내에 '{business}' 결제가 관측되지 않습니다. 해당 수요가 "
                        f"전량 역외로 나가고 있어 공급 공백이 뚜렷합니다."})
        elif gap > 20:
            out.append({"tone": "positive", "text":
                        f"'{business}' 소비 비중이 해당 업종 보유 지역의 중앙값보다 "
                        f"{gap:.1f}% 낮아 공급 여지가 있습니다."})
        elif gap < -20:
            out.append({"tone": "negative", "text":
                        f"'{business}' 소비 비중이 해당 업종 보유 지역의 중앙값보다 "
                        f"{-gap:.1f}% 높아 이미 공급이 충분한 상권입니다."})
        else:
            out.append({"tone": "neutral", "text":
                        f"'{business}' 소비 비중이 보유 지역 중앙값 수준입니다. 공급 "
                        f"공백을 진입 근거로 삼기는 어렵습니다."})

        top_age = max(AGE_ORDER,
                      key=lambda a: float(row.get(f"age_share_{a}", 0) or 0))
        out.append({"tone": "positive" if cohort >= 0.75 else
                            "neutral" if cohort >= 0.6 else "negative",
                    "text": f"이 지역의 잔존 소비 세대는 {AGE_LABEL[top_age]}가 가장 "
                            f"두텁고, '{business}'의 전국 고객 연령 구성과 "
                            f"{cohort * 100:.0f}% 겹칩니다."})

        if thin:
            out.append({"tone": "negative", "text":
                        f"근린소매 소비 규모가 전국 하위 {demand_pctl:.0f}% 구간입니다. "
                        f"공백이 있더라도 그 자리를 채울 배후 수요 자체가 얇아 "
                        f"진입 판정을 권장까지 올리지 않았습니다."})
        elif yfs >= AlertEngine.YOUTH_FOREIGN_ALERT:
            out.append({"tone": "negative", "text":
                        f"20~30대 소비의 {yfs:.1f}%를 외국인이 담당합니다. 체류 정책이 "
                        f"바뀌면 배후 수요가 곧바로 흔들릴 수 있습니다."})
        else:
            out.append({"tone": "neutral", "text":
                        f"{region}은 {row.region_type}입니다. "
                        f"{PRESCRIPTION[row.region_type]['창업자']}"})
        return out


# ════════════════════════════════════════════════════════════════════
#  ⑦ 배포 (Publish)
# ════════════════════════════════════════════════════════════════════

class Publish:
    """⑦ 산출물 직렬화 및 알림 페이로드 생성."""

    def __init__(self, outdir: str | Path):
        self.outdir = Path(outdir)
        self.outdir.mkdir(parents=True, exist_ok=True)

    def run(self, *, classified: pd.DataFrame, alerts: list[Alert],
            reports: list[dict[str, Any]], audit: dict[str, Any]) -> dict[str, str]:
        stamp = datetime.now(timezone.utc).isoformat(timespec="seconds")
        paths: dict[str, str] = {}

        p = self.outdir / "region_diagnosis.csv"
        classified.to_csv(p, encoding="utf-8-sig")
        paths["diagnosis"] = str(p)

        p = self.outdir / "alerts.json"
        p.write_text(json.dumps([asdict(a) for a in alerts],
                                ensure_ascii=False, indent=2), encoding="utf-8")
        paths["alerts"] = str(p)

        p = self.outdir / "reports.json"
        p.write_text(json.dumps(reports, ensure_ascii=False, indent=2), encoding="utf-8")
        paths["reports"] = str(p)

        summary = {
            "engine_version": __version__,
            "generated_at": stamp,
            "data_audit": audit,
            "type_distribution": classified.region_type.value_counts()
                                 .reindex(TYPE_ORDER, fill_value=0).to_dict(),
            "alert_counts": pd.Series([a.kind for a in alerts])
                            .value_counts().to_dict() if alerts else {},
            "ladder_conformity": round(float(classified.ladder_conforms.mean()), 4),
            "population_matched": int(classified.population.notna().sum()),
            "regions": int(len(classified)),
        }
        p = self.outdir / "run_summary.json"
        p.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
        paths["summary"] = str(p)

        log.info("⑦ 배포 완료 — %s", self.outdir)
        return paths

    @staticmethod
    def notification_payload(alerts: list[Alert],
                             transitions: pd.DataFrame | None = None) -> dict[str, Any]:
        """대시보드·메일 발송용 알림 페이로드."""
        return {
            "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "high_severity": [asdict(a) for a in alerts if a.severity == "높음"],
            "transitions": ([] if transitions is None or transitions.empty
                            else transitions.reset_index()
                                 .to_dict(orient="records")),
        }


# ════════════════════════════════════════════════════════════════════
#  파이프라인
# ════════════════════════════════════════════════════════════════════

class MaekPipeline:
    """①~⑦ 일괄 실행 오케스트레이터.

    사용 예
        pipe = MaekPipeline()
        result = pipe.run(card_path="ABP_CONTEST_DATA.csv",
                          population_path="행안부인구.csv",
                          outdir="./output")
        result["classified"].head()
    """

    def __init__(self, cfg: EngineConfig | None = None):
        self.cfg = cfg or EngineConfig()
        self.ingest = Ingest(self.cfg)
        self.clean = Clean(self.cfg)
        self.metrics = Metrics(self.cfg)
        self.classify = Classify(self.cfg)
        self.alerting = AlertEngine(self.cfg)
        self.reporting = ReportGenerator(self.cfg)

    def run(self, *, card_path: str | Path,
            population_path: str | Path | None = None,
            risk_index_path: str | Path | None = None,
            outdir: str | Path | None = None,
            report_regions: Iterable[str] | None = None) -> dict[str, Any]:

        raw = self.ingest.card(card_path)
        population = self.ingest.population(population_path)
        risk = self.ingest.risk_index(risk_index_path)

        clean = self.clean.run(raw)
        metrics = self.metrics.run(clean, population)
        classified = self.classify.run(metrics)
        alerts = self.alerting.run(classified, risk)

        if report_regions is None:
            # 기본값: 경보 대상만 서술문 생성 (전 지역 생성은 비용이 크다)
            report_regions = sorted({a.region for a in alerts})
        reports = self.reporting.run(classified, report_regions)

        result: dict[str, Any] = {
            "clean": clean,
            "metrics": metrics,
            "classified": classified,
            "alerts": alerts,
            "reports": reports,
            "audit": self.clean.report,
        }

        if outdir is not None:
            pub = Publish(outdir)
            result["paths"] = pub.run(classified=classified, alerts=alerts,
                                      reports=reports, audit=self.clean.report)
            result["notification"] = pub.notification_payload(alerts)

        return result


# ════════════════════════════════════════════════════════════════════
#  CLI
# ════════════════════════════════════════════════════════════════════

def main() -> None:
    ap = argparse.ArgumentParser(
        description="맥(脈) 분석 엔진 — 소비데이터 기반 지방소멸 조기경보")
    ap.add_argument("--card", required=True, help="BC카드 소비데이터 CSV")
    ap.add_argument("--population", default=None, help="행안부 주민등록 인구통계 (선택)")
    ap.add_argument("--risk-index", default=None, help="지방소멸위험지수 (선택)")
    ap.add_argument("--out", default="./output", help="산출물 디렉터리")
    ap.add_argument("--no-llm", action="store_true", help="LLM 서술문 생성 비활성화")
    ap.add_argument("--drain-threshold", type=float, default=8.0)
    ap.add_argument("-v", "--verbose", action="store_true")
    args = ap.parse_args()

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s", datefmt="%H:%M:%S")

    cfg = EngineConfig(drain_threshold=args.drain_threshold,
                       llm_enabled=not args.no_llm)
    result = MaekPipeline(cfg).run(
        card_path=args.card,
        population_path=args.population,
        risk_index_path=args.risk_index,
        outdir=args.out,
    )

    c = result["classified"]
    print("\n" + "=" * 62)
    print(f"  맥(脈) 엔진 v{__version__} — 실행 완료")
    print("=" * 62)
    print(f"  진단 지역      {len(c)}개")
    print(f"  위계 정합도    {c.ladder_conforms.mean() * 100:.1f}%")
    print(f"  경보           {len(result['alerts'])}건")
    print("  유형 분포")
    for t in TYPE_ORDER:
        print(f"    {t:<12} {int((c.region_type == t).sum()):>4}개")
    if "paths" in result:
        print(f"\n  산출물 → {args.out}")
    print("=" * 62)


if __name__ == "__main__":
    main()
