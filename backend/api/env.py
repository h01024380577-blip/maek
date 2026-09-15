"""backend/.env 를 환경변수로 올린다.

python-dotenv 의 load_dotenv 는 이미 존재하는 변수를 건드리지 않는데, 빈 값
(`OPENAI_API_KEY=`)도 '존재'로 본다. 기동 때 빈 줄을 읽어 두면 나중에 키를
채우고 /api/reload 를 해도 빈 값이 남아 붙지 않는다. 그래서 값이 있는 항목만
넣고, 셸에 이미 값이 있으면 그쪽을 우선한다.
"""

from __future__ import annotations

import os
from pathlib import Path

ENV_PATH = Path(__file__).resolve().parent.parent / ".env"


def load_env_file(path: Path = ENV_PATH) -> list[str]:
    """올린 변수 이름 목록을 돌려준다 (로그용)."""
    try:
        from dotenv import dotenv_values
    except ImportError:  # python-dotenv 미설치 — 셸 환경변수만 쓴다
        return []
    if not path.exists():
        return []
    applied: list[str] = []
    for key, value in (dotenv_values(path) or {}).items():
        if value and not os.environ.get(key):
            os.environ[key] = value
            applied.append(key)
    return applied
