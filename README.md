# 트릭컬 리바이브 PvE 상위권 덱 리포트

게임 내 PvE 순위 화면의 상위권 덱을 직접 기록하고, 사도 채용률·티어·메타를 정리한 사이트입니다.

상단 탭: **PvE 기록 분석**(`index.html`) / **글로벌 PvE 분석**(`global.html`, 준비 중) / **전투 메커니즘**(`mechanics.html` — 스킬 판정표·사도 카드·보스 기믹·아이콘 사전·상태·용어 사전·검증 사례·실험 기록·정정 기록) / **덱 계산기**(`calculator.html` — 편성 판·고급 옵션) / 업데이트 기록(`changelog.html`)
콘텐츠(대충돌, 프론티어 등)가 끝날 때마다 시즌 단위로 데이터를 쌓고, 같은 콘텐츠의 이전 시즌과 채용률 변화를 자동으로 비교합니다.

## 파일 구성
- `index.html` — PvE 기록 분석 페이지 (수정할 필요 없음)
- `global.html`, `mechanics.html`, `calculator.html` — 나머지 탭 페이지
- `assets/site.css`, `assets/common.js` — 새 탭 공통 스타일·CSV 읽기·덱 계산 규칙
- `data/battle/skills.csv` — 사도 스킬 판정표 (효과 1개 = 1줄, 게임 원문 제외) — 2026-10-24 기준 사도 128명 · 효과 1,690줄
- `data/battle/terms.csv` — 상태·용어 사전 (123개)
- `data/battle/sado_info.csv` — 사도별 성격·열·역할·공격 타입·얼굴 이미지 파일명
- `data/battle/gimmicks.csv`, `gimmick_tags.csv` — 보스 기믹과 대응 태그별 사도 (엑셀에서 자동 계산된 값)
- `data/battle/icons.csv` — 버프·디버프 아이콘 사전 (아카라이브 「버프/디버프 총 정리」 + DB 연결 메모)
- `data/battle/growth.csv` — 스킬 성장 대조 (게임 중간 레벨·Lv10 vs 나무위키)
- `data/battle/checks.csv` — 스킬 설명 점검 묶음 (손으로 관리)
- `data/changelog.csv` — 업데이트 기록 (손으로 관리)
- `assets/sado/<사도명>.png` — 사도 얼굴 아이콘 96×96 (없으면 성격 색 이니셜로 표시)
- `data/battle/experiments.csv` — 실험 기록 (상태: 예정/진행/완료)
- `data/battle/fixes.csv` — 정정 기록
- `data/contents.csv` — 상단 메뉴에 고정으로 보일 콘텐츠 목록 (대충돌, 프론티어, 대충돌 2.0 beta). 기록이 없어도 메뉴는 보임
- `data/seasons.csv` — 시즌 목록 (시즌ID, 표시이름, 콘텐츠, 적 성격, 조사일). **아래로 갈수록 최신**, 맨 아래 시즌이 첫 화면. 표시이름은 메뉴에 그대로 나옴 (예: `26년 9월 · 크레용사용(순수)`)
- `data/sado.csv` — 사도 목록 (사도명, 성격, 코멘트) — 모든 시즌 공용
- `data/seasons/<시즌ID>/decks.csv` — 순위별 덱 (순위, 단계, 보스, 사도1~9)
- `data/seasons/<시즌ID>/info.csv` — 조사 정보, 한줄요약, 메타 코멘트
- `data/seasons/_template/` — 새 시즌을 만들 때 복사할 빈 양식
- `docs/전투판정DB_작성방법.md` — 스킬 판정표를 만들고 검증한 절차

## 새 시즌 추가 방법
1. `_template` 폴더의 두 파일을 받아 엑셀에서 채운 뒤 "CSV UTF-8 (쉼표로 분리)"로 저장
2. GitHub에서 `data/seasons/<새 시즌ID>/` 경로로 두 파일 업로드 (예: `data/seasons/2026-10-frontier/decks.csv`)
3. `data/seasons.csv` 맨 아래에 한 줄 추가 → 커밋
   ```
   2026-10-frontier,26년 10월 · 1주차,프론티어,성격 없음,26.10.09
   ```
4. 새 사도가 나왔다면 `data/sado.csv`에 이름과 성격 추가

- 적 성격은 보스 성격(순수·냉정·광기·활발·우울) 또는 `성격 없음`. 페이지가 이 값으로 유리·불리 성격을 표시합니다
- 시즌ID는 영문·숫자·하이픈만 사용 (예: `2026-11-clash2`)
- 콘텐츠 칸은 `contents.csv`의 이름과 똑같이 적어야 해당 메뉴 아래에 들어갑니다
- **같은 콘텐츠의 시즌이 2개 이상**이면 이전 시즌과의 비교 섹션이 자동으로 생깁니다
- 새 PvE 콘텐츠가 생기면 `contents.csv`에 한 줄 추가
- 덱 인원이 9명이 아닌 콘텐츠도 `사도1, 사도2, …` 열 개수만 맞추면 그대로 동작합니다
- 시즌별 주소: `https://gasumii.github.io/trickcal-meta/?s=<시즌ID>`

티어표·차트·시즌 비교·데이터 점검은 CSV를 읽어 자동으로 다시 그려집니다.

## 전투 메커니즘·덱 계산기 데이터 갱신
- `skills.csv`, `terms.csv`는 개인 엑셀(전투 판정 DB)에서 내보낸 파일입니다. 사도를 추가하면 다시 내보내서 덮어쓰면 됩니다
  ```
  python export_battle_csv.py 이영준_에피드QA_전투판정DB.xlsx <trickcal-meta 폴더>
  ```
  → skills·terms·sado_info·gimmicks·gimmick_tags·icons·growth CSV를 한 번에 다시 만듦
- 얼굴 아이콘: 게임 고학년 스킬 화면을 캡처해 `python crop_face.py <캡처.png> <사도명> <trickcal-meta 폴더>` → 그다음 위 내보내기를 다시 실행
- `skills.csv` 주요 열: 스킬 구분·스킬명·효과 유형·대상·발동 조건·수치·지속·확실도·검증 포인트 / 계산용: 피해 분류·계산용 수치(%)·어사이드 단계·고학년 의존·성격 조건·대상 배치 조건 / 대조: 나무위키 대조
- 덱 계산기는 성격·열(편성 칸 기준)·역할·물리/마법 조건이 붙은 효과를 해당 사도에게만 더합니다. 주소에 `?deck=사도1,사도2,…`를 붙이면 그 덱이 편성 판에 채워집니다 (PvE 기록 분석의 '덱 계산기로 열기')
- 덱 계산기의 사도 목록은 `skills.csv`에 있는 사도로 자동으로 바뀝니다
- 덱 계산기의 시즌 목록은 `data/seasons.csv`를 그대로 씁니다 (적 성격 칸이 보스 성격)
- 실험 결과는 `experiments.csv`의 실측·결론·확인일 칸을 채우고 상태를 `완료`로 바꾸면 페이지에 반영됩니다
