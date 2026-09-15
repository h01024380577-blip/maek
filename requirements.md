# 실행 환경과 의존성 안내

맥(脈)은 Python 백엔드와 Node 프론트엔드, 두 프로세스로 동작합니다. 이 문서는
어떤 버전에서 검증됐고, 무엇을 설치해야 하며, 자주 걸리는 문제를 어떻게 푸는지
정리한 것입니다. 빠른 실행 절차는 [README](README.md)를 보세요.

## 검증된 조합

| 항목 | 검증 버전 | 최소 요구 | 비고 |
|---|---|---|---|
| OS | macOS 15 (Apple Silicon) | macOS · Linux · Windows 10+ | Windows 는 PowerShell 기준으로 경로만 다릅니다 |
| Python | 3.9.6 | 3.9 이상, 3.12 이하 권장 | 3.13 은 pandas 휠이 늦게 나와 빌드에 실패할 수 있습니다 |
| pip | 26.0 | 23 이상 | `python3 -m pip install --upgrade pip` |
| Node.js | 24.14 | 18 이상 (20 LTS 이상 권장) | Vite 5 는 Node 16 이하에서 실행되지 않습니다 |
| npm | 11.9 | 9 이상 | `package-lock.json` 을 쓰려면 `npm ci` |

## 백엔드 (Python)

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python3 -m uvicorn api.main:app --port 8000
```

| 패키지 | 범위 | 검증 버전 | 역할 |
|---|---|---|---|
| pandas | ≥ 2.0 | 2.3.3 | 24만 행 소비데이터 정제·지표 산출 |
| numpy | ≥ 1.24 | 2.0.2 | 수치 연산 (pandas 2.3 은 numpy 2 와 호환) |
| fastapi | ≥ 0.110 | 0.128.8 | Service Layer |
| uvicorn[standard] | ≥ 0.27 | 0.39.0 | ASGI 서버 |
| openai | ≥ 1.50 | 2.28.0 | ⑥ 진단 서술문 생성 (선택, 키 없으면 템플릿 폴백) |
| python-dotenv | ≥ 1.0 | 1.2.1 | `backend/.env` 읽기 |
| openpyxl | ≥ 3.1 | 3.1.5 | 인구·지수를 xlsx 로 받을 때만 |

범위 지정 설치가 어긋나면 정확한 버전이 박힌 파일로 설치하세요.

```bash
pip install -r requirements-lock.txt
```

### 외부 서비스

- **OpenAI API (선택).** `backend/.env.example` 을 `backend/.env` 로 복사해
  `OPENAI_API_KEY` 를 채우면 서술문을 `gpt-5-mini` 가 씁니다. 키가 없거나
  호출이 실패하면 규칙 기반 템플릿으로 자동 폴백하고, 화면의 `narrative_source`
  에 어느 쪽인지 표시됩니다. 모델은 `MAEK_LLM_MODEL` 로 바꿉니다.
- 그 밖의 외부 호출은 없습니다. 데이터는 전부 로컬 CSV 입니다.

## 프론트엔드 (Node)

```bash
cd frontend
npm ci            # package-lock.json 그대로 설치. npm install 도 됩니다
npm run dev       # http://localhost:5173
npm run build     # dist/ 산출 (정적 파일)
```

| 패키지 | 범위 | 검증 버전 | 역할 |
|---|---|---|---|
| react · react-dom | ^18.3 | 18.3.1 | UI |
| react-router-dom | ^6.26 | 6.30.6 | 6개 화면 라우팅 |
| vite | ^5.4 | 5.4.21 | 개발 서버·번들 · `/api` 프록시 |
| @vitejs/plugin-react | ^4.3 | 4.7.0 | JSX |
| tailwindcss | ^3.4 | 3.4.19 | 디자인 토큰 (`tailwind.config.js`) |
| postcss · autoprefixer | ^8.4 · ^10.4 | 8.5.28 · 10.6.0 | Tailwind 빌드 |

차트 라이브러리는 쓰지 않습니다. 모든 그림은 SVG·CSS 로 직접 그립니다.

### 인터넷이 필요한 부분

글꼴(IBM Plex Sans · Pretendard · Material Symbols)을 Google Fonts 와 jsDelivr
에서 받습니다. 오프라인이면 시스템 글꼴로 대체되어 동작에는 문제가 없고
아이콘만 글자로 보입니다.

## 데이터 파일

| 파일 | 필수 | 저장소 포함 | 출처 |
|---|---|---|---|
| `data/ABP_CONTEST_DATA.csv` | **필수** | 예 (16MB) | 공모전 제공 BC카드 소비데이터 2026.01~06 |
| `data/population.csv` | 선택 | 예 | 행안부 주민등록 인구통계 2026-06 |
| `data/risk_index.csv` | 선택 | 예 | 같은 자료로 산출한 지방소멸위험지수 |
| `data/decline_areas.csv` | 선택 | 예 | 행안부 인구감소지역 지정 89곳 |
| `data/raw/jumin_age_2026_06.csv` | 기록용 | 예 | 소멸위험지수 산출에 쓴 행안부 연령별 인구 원본 |

선택 파일이 없으면 해당 지표만 "미연동"으로 표시되고 나머지는 동작합니다.
형식과 갱신 방법은 [data/README.md](data/README.md) 에 있습니다.

## 자주 걸리는 문제

**`uvicorn: command not found`.** pip 가 `--user` 로 설치해 실행 파일이 PATH 에
없는 경우입니다. `python3 -m uvicorn api.main:app --port 8000` 으로 모듈 실행하면
됩니다. 가상환경을 쓰면 생기지 않습니다.

**pandas 설치가 소스 빌드로 넘어가며 실패.** Python 3.13 이거나 pip 가 오래된
경우입니다. Python 3.12 이하를 쓰거나 pip 를 올린 뒤 다시 설치하세요.

**`/api/health` 가 503.** 기동 직후 엔진이 적재 중입니다. 1~2초 뒤 200 으로
바뀝니다. 계속 503 이면 백엔드 로그에서 `ABP_CONTEST_DATA.csv` 경로를 확인하세요.

**프론트가 "데이터를 불러오지 못했습니다".** 백엔드가 8000 번에 없거나 다른
포트에 떠 있습니다. `vite.config.js` 의 프록시 대상은 `http://127.0.0.1:8000`
입니다. 백엔드 포트를 바꿨다면 여기도 같이 바꾸세요.

**포트 충돌.** `lsof -iTCP:8000 -sTCP:LISTEN` (Windows: `netstat -ano | findstr 8000`)
로 점유 프로세스를 찾아 종료하거나 `--port` 를 바꾸세요.

**한글이 깨진 CSV.** 행안부 사이트가 주는 파일은 CP949 입니다. 엔진은 UTF-8
(BOM 허용)만 읽으므로 `iconv -f cp949 -t utf-8` 로 바꿔 저장하세요.
`data/README.md` 의 curl 예시가 이 변환을 포함합니다.

**`.env` 에 키를 넣었는데 LLM 이 안 붙음.** `POST /api/reload` 를 한 번
호출하세요. 재기동 없이 반영됩니다. 빈 값(`OPENAI_API_KEY=`)은 무시되므로
등호 뒤에 실제 키가 있어야 합니다.

**`anthropic` 관련 오류.** 이전 버전이 쓰던 패키지이며 지금은 필요 없습니다.
`requirements.txt` 를 다시 설치하면 됩니다.

**Node 16 이하에서 `npm run dev` 실패.** Vite 5 는 Node 18 이상이 필요합니다.
`nvm install 20 && nvm use 20`.

**`npm ci` 가 lock 불일치로 실패.** Node 버전이 크게 다를 때 생깁니다. Node 20
이상에서 다시 시도하거나 `npm install` 로 lock 을 갱신하세요.

## 버전 정책

- `backend/requirements.txt` 는 하한만 두어 최신 보안 패치를 받습니다.
  재현이 우선이면 `requirements-lock.txt` 를 쓰세요.
- `frontend/package-lock.json` 은 저장소에 포함되어 `npm ci` 로 동일 트리를
  얻습니다.
- 데이터 스키마와 화면 토큰의 변경 이력은 각각 `data/README.md`,
  `frontend/design_ref/stitch_/DESIGN.md` 에 적습니다.
