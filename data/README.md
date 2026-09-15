# 데이터 디렉터리

엔진은 BC카드 소비데이터 하나만 있어도 전 공정이 돌아갑니다. 나머지 셋은
선택이며, 없으면 해당 지표만 비고 화면에는 "미연동"으로 표시됩니다.

| 파일 | 필수 | 현재 | 없을 때 비는 것 |
|---|---|---|---|
| `ABP_CONTEST_DATA.csv` | **필수** | 있음 | — |
| `population.csv` | 선택 | 2026-06 연동 | 생활소비 원단위, 실존 인구 괴리율, 공동화형/유출형/유입형 원인 분해 |
| `risk_index.csv` | 선택 | 2026-06 연동 | 기존 지수 대조. 경보가 내부 분위수 기준으로 대체됨 |
| `decline_areas.csv` | 선택 | 89곳 연동 | 인구감소지역 지정 여부 대조, 미지정 지역 우선 검토 대상 추출 |

LLM 진단 서술문은 데이터가 아니라 API 키로 켭니다. `backend/.env.example` 을
`backend/.env` 로 복사해 `OPENAI_API_KEY` 를 채운 뒤 `POST /api/reload` 를
호출하면 재기동 없이 붙습니다.

파일을 넣은 뒤 `POST /api/reload` 를 호출하거나 API 서버를 재기동하면
반영됩니다.

---

## `ABP_CONTEST_DATA.csv` (제공 데이터)

공모전 제공 원본을 그대로 둡니다. 필수 컬럼은 다음과 같습니다.

```
STRD_YYMM, SIDO_NM, CCG_NM, GENDER_CD, AGE_CD, TP_BUZ_NO, TP_BUZ_NM, amt, cnt
```

- `GENDER_CD` — `1` 남 / `2` 여 / `3` 외국인 / `x` 미상
- `AGE_CD` — `1` 20대 이하 / `2` 20대 / `3` 30대 / `4` 40대 / `5` 50대 / `6` 60대 이상 / `x` 미상
- `cnt` 11건 미만 셀은 비공개 처리되어 행 자체가 없습니다. 엔진은 이 결측을
  오류가 아니라 신호로 다룹니다.

## `population.csv` — 행정안전부 주민등록 인구통계

[주민등록 인구통계](https://jumin.mois.go.kr) 에서 시군구 단위로 내려받습니다.

배포본마다 헤더 위치와 컬럼명이 달라 엔진이 자동 탐색합니다.

- 앞 12행 안에 `행정구역` 을 포함한 행이 있으면 그 행을 헤더로 잡습니다.
- 인구 컬럼은 `총인구` 를 포함하거나, `인구` 를 포함하되 `세대`·`당` 이 없는
  컬럼을 씁니다.
- 지역명은 `시도 시군구 (행정코드)` 형태를 가정하며 괄호 안 코드는 제거합니다.
  세종특별자치시처럼 시군구가 비어 있는 표기도 처리합니다.

```csv
행정구역,총인구수,세대수,세대당 인구
전라남도 영암군 (4683000000),"52,430",0,0
```

> 제목 행이 데이터 행보다 열 수가 적으면 CSV 파서가 중단됩니다. 엑셀에서
> 내보내면 보통 빈 칸으로 채워지지만, 그렇지 않다면 제목 행을 지우고 넣으세요.

### 터미널에서 바로 내려받기

사이트의 "전체시군구현황 → csv" 버튼이 보내는 요청을 그대로 재현한 것입니다.
연·월(`searchYear*`, `searchMonth*`)만 카드 데이터 기준월에 맞춰 바꾸면 됩니다.
응답은 CP949 라 UTF-8 로 바꿔 저장합니다. 2026-09-15 기준 2026년 6월분으로
`population.csv` 를 채웠고, 255개 시군구가 모두 매칭됐습니다.

```bash
curl -s -L -A "Mozilla/5.0" -c /tmp/jumin.txt -o /dev/null https://jumin.mois.go.kr/statMonth.do
curl -s -L -A "Mozilla/5.0" -b /tmp/jumin.txt -e https://jumin.mois.go.kr/statMonth.do \
  -d "sltOrgType=1&sltOrgLvl1=A&sltOrgLvl2=&gender=gender&genderPer=genderPer&generation=generation" \
  -d "sltUndefType=&searchYearStart=2026&searchMonthStart=06&searchYearEnd=2026&searchMonthEnd=06" \
  -d "sltOrderType=1&sltOrderValue=ASC&category=month&state=2" \
  "https://jumin.mois.go.kr/downloadCsv.do?searchYearMonth=month&xlsStats=2" \
  | iconv -f cp949 -t utf-8 > data/population.csv
curl -s -X POST http://localhost:8000/api/reload
```

시 아래 구(`수원시 장안구` 등)와 `○○출장소` 행도 함께 내려오지만, 소비데이터의
지역 키와 이름이 같은 행만 결합되므로 그대로 두어도 됩니다.

## `risk_index.csv` — 한국고용정보원 지방소멸위험지수

```csv
지역,소멸위험지수
전라남도 영암군,0.241
```

### 현재 채워진 값 (2026-09-15)

고용정보원이 발표하는 지수는 보고서 표로만 공개되어 기계가 읽을 수 있는
파일이 없습니다. 그래서 같은 산식을 행안부 주민등록 연령별 인구통계에 그대로
적용해 255개 시군구를 계산했습니다.

> 소멸위험지수 = 20~39세 여성 인구 ÷ 65세 이상 인구 (이상호, 2016)

- 원천: [주민등록 연령별 인구현황](https://jumin.mois.go.kr/ageStatMonth.do), 2026년 6월, 5세 단위·성별
- 세종특별자치시는 시도 행과 시군구 행이 같은 값으로 두 번 내려와 하나만 씁니다.
- 결과 분포: 최소 0.074(대구 군위군) · 중앙값 0.413 · 최대 2.024. 0.2 미만(고위험) 71곳.
- 산출에 쓴 원본(UTF-8 변환본)은 `raw/jumin_age_2026_06.csv` 에 그대로 두었습니다.
- 파일에는 산출 근거로 `여성_20_39세`·`65세_이상`·`기준월`·`산식` 열을 같이 두었습니다.
  엔진은 `지역`·`소멸위험지수` 두 열만 읽습니다.

```bash
curl -s -L -A "Mozilla/5.0" -c /tmp/jumin.txt -o /dev/null https://jumin.mois.go.kr/ageStatMonth.do
curl -s -L -A "Mozilla/5.0" -b /tmp/jumin.txt -e https://jumin.mois.go.kr/ageStatMonth.do \
  -d "sltOrgType=1&sltOrgLvl1=A&sltOrgLvl2=&gender=gender&sum=sum&sltUndefType=" \
  -d "searchYearStart=2026&searchMonthStart=06&searchYearEnd=2026&searchMonthEnd=06" \
  -d "sltOrderType=1&sltOrderValue=ASC&sltArgTypes=5&sltArgTypeA=0&sltArgTypeB=100&category=month&state=2" \
  "https://jumin.mois.go.kr/downloadCsvAge.do?searchYearMonth=month&xlsStats=2" \
  | iconv -f cp949 -t utf-8 > /tmp/age.csv
# 여성 20~24·25~29·30~34·35~39세 열의 합 ÷ 계 65세 이상 8개 열의 합 → risk_index.csv
```

연동 후 경보 판정 기준이 `외부 지수 연동`으로 바뀌며, 경보 수가 63건(내부
분위수)에서 41건(선행 경보 7 · 과소평가 25 · 외국인 의존 9)으로 조정됐습니다.

- 지역 컬럼은 이름에 `지역` 또는 `행정구역` 이 들어가면 됩니다.
- 지수 컬럼은 이름에 `지수` 또는 `위험` 이 들어가면 됩니다.
- 값이 낮을수록 위험합니다.

연동하면 경보 판정 기준이 내부 분위수에서 실제 지수 대조로 바뀝니다.
선행 경보(기존 지수상 안전하나 소비 구조상 이탈)와 과소평가(기존 지수상
위험하나 상권 기능 유지)가 본래 의미대로 산출됩니다.

## `decline_areas.csv` — 행정안전부 인구감소지역 지정 현황

공식 고시 목록이라 엔진이 임의로 생성하지 않습니다. 행정안전부 고시에서
지정된 시군구를 옮겨 적으세요.

```csv
SIDO_NM,CCG_NM
전라남도,영암군
경상북도,의성군
```

`SIDO_NM`·`CCG_NM` 은 소비데이터의 표기와 같아야 합니다. 이 파일은 API 의
Store 가 문자열을 그대로 결합해 대조하므로 `강원특별자치도`·`전북특별자치도`
처럼 소비데이터의 현행 명칭으로 적으세요.

### 현재 채워진 값 (2026-09-15)

[행정안전부 인구감소지역 지정 결과(89개)](https://www.mois.go.kr/frt/sub/a06/b06/populationDecline/screen.do)
페이지의 목록을 옮겨 적었습니다. 2021년 10월 최초 지정, 5년 주기 갱신.
`region_keys_255.csv` 와 대조해 89곳 모두 소비데이터 키와 일치함을 확인했습니다.
관심지역 18곳(대전 동구·인천 동구·부산 중구 등)은 지정 지역이 아니므로 넣지
않았습니다. `구분`·`출처` 열은 기록용이며 엔진은 읽지 않습니다.

## `region_keys_255.csv`

소비데이터에서 추출한 255개 시군구 키 목록입니다. 외부 데이터의 지역명을
맞출 때 대조용으로 쓰세요. 엔진이 직접 읽지는 않습니다.
