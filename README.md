# K-Beauty Intelligence Dashboard

글로벌 이커머스 아마존/틱톡샵 운영팀(본사)을 위한 **정책·뉴스 모니터링 + 리뷰(VOC) 분석 + AI 리포트** 대시보드입니다.  
현재 기준으로 다음 UX가 반영되어 있습니다.

- `정책·뉴스`: 페이지 진입 시 자동으로 최신 뉴스 수집 실행 
- `리뷰 분석`: 제품 선택 시 해당 제품 ASIN으로 Apify를 재호출해 최신 리뷰 조회
- `리뷰 분석`: 카테고리 필터에서 `전체` 제거 (실제 카테고리만 선택)
- `AI 리포트`: `메일 초안`/`구조화 리포트` 선택 후 한·영 전환 지원
- `리포트 PDF`: 화면 렌더 결과 그대로 브라우저 인쇄로 저장

---

## 1) 핵심 기능

### 1-1. 정책·뉴스 모니터링 (`/policy`)
- 페이지 첫 진입 시 `POST /api/policy/sync` 자동 실행
- RSS 수집 → OpenAI 분류(관련성/긴급도/채널/국가) → DeepL 번역/요약
- 긴급도(`전체/긴급/동향`) + 플랫폼(`전체/Amazon/TikTok`) 필터 제공
- 수집 완료 후 `마지막 갱신 시각(HH:mm)` 표시

### 1-2. 유럽 리뷰 분석 (`/reviews`)
- 기본 데이터는 `GET /api/reviews`로 최근 성공 Dataset 조회
- 제품 선택 시 `POST /api/reviews/product` 자동 호출
  - 요청한 `channel + category + product` 조합에서 ASIN 해석
  - 해당 ASIN의 Amazon dp URL 기준으로 Apify 단일 Run 실행
  - 결과에서 요청 ASIN만 우선 필터링
  - 최신순 정렬 후 최대 N건 반환 (기본 10건)
- 국가/카테고리/제품/감성 필터 + 지표 + 차트 + 리뷰 목록 동기화

### 1-3. AI 리포트 (`/report`)
- 워크플로우 2종 제공
  - `플랫폼 동향 메일 초안`: 수신자/제목/본문 편집 후 Gmail SMTP 발송
  - `플랫폼 동향 리포트`: 구조화 리포트(요약·트렌드·플레이어·차트·뉴스) 생성
- 한국어/영어 전환 지원
- 리포트 PDF는 서버 재렌더링이 아닌 **브라우저 인쇄 기반(화면 그대로 저장)** 방식

### 1-4. 주요 사용자 흐름 (`/report`)
- Step 1) 리포트 유형 선택: `플랫폼 동향 메일 초안` 또는 `플랫폼 동향 리포트`
- Step 2) 언어 선택: `한국어` / `English`
- Step 3-A) 메일 초안 경로
  - `POST /api/report/email-draft/generate`로 제목/본문 생성
  - 수신자 입력 후 `POST /api/report/email-draft/send`로 Gmail SMTP 발송
- Step 3-B) 구조화 리포트 경로
  - `POST /api/report/structured`로 리포트 생성
  - `PDF 다운로드` 버튼 클릭 시 인쇄 창에서 `PDF로 저장`으로 내보내기

---

## 2) 기술 스택

- **Framework**: Next.js 16 (App Router), React 19, TypeScript
- **UI**: Tailwind CSS 4, Lucide Icons, Recharts
- **Data/AI**
  - Apify (`apify-client`) - Amazon 리뷰 수집
  - OpenAI (`ai`, `@ai-sdk/openai`) - 기사 분류/리포트 생성
  - DeepL (`deepl-node`) - 기사 번역
  - RSS (`rss-parser`) - 뉴스 소스 수집
- **기타**: Supabase client 포함(확장 용도)

---

## 3) 페이지 및 API 구조

### 페이지
- `/` : 대시보드 홈
- `/policy` : 정책·뉴스 모니터링
- `/reviews` : 리뷰 분석
- `/report` : AI 리포트

### API 라우트
- `POST /api/policy/sync` : 정책·뉴스 수집/분류/번역
- `GET /api/reviews` : 리뷰 데이터셋 조회 및 집계
- `POST /api/reviews/sync` : 전체 제품 리뷰 일괄 수집(내부/운영용)
- `POST /api/reviews/product` : 단일 제품(ASIN) 리뷰 재수집
- `POST /api/chat/report` : 리포트 보조 채팅 스트리밍
- `POST /api/report/email-draft/generate` : 메일 초안 생성
- `POST /api/report/email-draft/send` : Gmail SMTP 발송
- `POST /api/report/structured` : 구조화 리포트 생성

---

## 4) 환경 변수 (`.env.local`)

아래는 현재 코드 기준으로 사용하는 변수들입니다.

### 필수
- `APIFY_API_TOKEN` : Apify API 토큰 (리뷰 기능 필수)
- `OPENAI_API_KEY` : OpenAI API 키 (정책 분류 + 리포트 필수)
- `DEEPL_API_KEY` : DeepL API 키 (정책 번역 필수)
- `GMAIL_USER` : Gmail SMTP 발신 계정(전체 이메일)
- `GMAIL_APP_PASS` : Gmail 앱 비밀번호(공백/따옴표 없이 16자)

### 리뷰 수집 관련 (선택)
- `APIFY_REVIEWS_ACTOR_ID`
  - 기본값: `junglee/amazon-reviews-scraper`
  - 액터 교체 시 사용
- `APIFY_DATASET_ID`
  - 지정 시 해당 Dataset 고정 조회
  - 미지정 시 최근 성공 Run Dataset 자동 조회
- `APIFY_WAIT_SECS`
  - 액터 `call` 대기 시간(초), 코드에서 120~3600으로 보정
- `APIFY_USE_RESIDENTIAL_PROXY`
  - `true`면 `RESIDENTIAL` 프록시 그룹 사용
- `APIFY_MAX_REVIEWS_PER_PRODUCT`
  - 전체 수집(`/api/reviews/sync`) 시 상품당 리뷰 상한
  - 예: `50`, `100`, `all`
- `APIFY_MAX_TOTAL_CHARGE_USD`
  - Apify run charge 상한(USD)
- `APIFY_PRODUCT_SELECT_MAX_REVIEWS`
  - 단일 제품 수집(`/api/reviews/product`) 응답 상한
  - 기본값: `10` (1~500 허용)

### Supabase (현재 핵심 기능에서는 선택)
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

예시:

```bash
APIFY_API_TOKEN=apify_xxx
OPENAI_API_KEY=sk-xxx
DEEPL_API_KEY=xxx:fx
GMAIL_USER=you@gmail.com
GMAIL_APP_PASS=xxxxxxxxxxxxxxxx

APIFY_REVIEWS_ACTOR_ID=junglee/amazon-reviews-scraper
APIFY_WAIT_SECS=600
APIFY_MAX_REVIEWS_PER_PRODUCT=50
APIFY_PRODUCT_SELECT_MAX_REVIEWS=10
APIFY_MAX_TOTAL_CHARGE_USD=5
```

---

## 5) 로컬 실행

```bash
npm install
npm run dev
```

브라우저에서 `http://localhost:3000` 접속

`/report`에서 PDF를 받을 때는 브라우저 인쇄 창이 열리며,
`대상(프린터)`을 `PDF로 저장`으로 선택해야 파일로 저장됩니다.

검증 명령:

```bash
npx tsc --noEmit
npm run lint
```

---

## 6) 현재 동작 상세 (중요)

### 6-1. 정책 페이지 자동 수집
- `/policy` 진입 즉시 수집 시작
- 화면 상단 상태 메시지:
  - 수집 중: 진행 메시지
  - 완료: 수집 건수 요약 + 마지막 갱신 시각
  - 실패: 에러 메시지
- 기존 수동 버튼(`최신 뉴스 수집`)은 제거됨

### 6-2. 리뷰 페이지 제품 선택 동작
- 제품 선택 시 버튼 클릭 없이 자동으로 `/api/reviews/product` 호출
- 서버는 요청 ASIN을 기준으로 결과를 정제:
  - ASIN 일치 항목이 있으면 그것만 사용
  - 없으면 원본 결과 사용(액터 응답 특성 대응)
- 목록/지표/차트는 해당 결과 기준으로 즉시 갱신

### 6-3. 카테고리 필터 정책
- 카테고리 `전체` 제거
- 국가 선택 시 해당 국가의 첫 카테고리를 자동 선택
- 제품은 `전체` 또는 특정 제품 선택 가능

### 6-4. 리포트 PDF 저장 방식
- 기존: 서버에서 텍스트 기반 PDF 재생성 (`/api/report/pdf`)
- 현재: `/report` 화면의 구조화 리포트를 브라우저 인쇄로 저장
  - 인쇄 시 `#printable-structured-report` 영역만 출력
  - 한글 깨짐(폰트/인코딩) 이슈를 회피
  - 브라우저 인쇄 창에서 `PDF로 저장` 선택 (화면 레이아웃 유지)

---

## 7) 운영/비용 주의사항

- Apify는 액터/플랜/프록시에 따라 실제 반환 건수가 다를 수 있음
- `maxReviews`를 크게 줘도 액터 특성상 run당 소량 반환될 수 있음
- 제품 선택 시마다 단일 제품 run이 발생하므로 호출 비용 누적 가능
- 운영 환경에서는 아래를 먼저 점검 권장
  - `APIFY_PRODUCT_SELECT_MAX_REVIEWS` (기본 10)
  - `APIFY_MAX_TOTAL_CHARGE_USD`
  - 액터 ID 교체 여부 (`APIFY_REVIEWS_ACTOR_ID`)

---

## 8) 트러블슈팅

### Q1. 제품 바꿔도 리뷰가 비슷해 보입니다.
- 원인:
  - 액터 응답에 타 상품 리뷰가 섞이는 경우
  - 선택 제품 자체의 리뷰 모수가 매우 작거나 최근 리뷰가 동일 패턴
- 해결:
  - 서버에서 ASIN 일치 필터가 적용된 최신 코드인지 확인
  - `meta.rawCount`, `meta.asinMatchedCount` 값을 API 응답으로 확인
  - 필요 시 액터를 다른 것으로 교체 검토

### Q2. 리뷰가 10개만 보입니다.
- 원인:
  - 단일 제품 API 기본 상한이 10 (`APIFY_PRODUCT_SELECT_MAX_REVIEWS`)
- 해결:
  - `.env.local`에서 상한 값을 올리고 재시작

### Q3. 메일 발송이 535(EAUTH)로 실패합니다.
- 원인:
  - Gmail이 인증 조합(USER + 앱 비밀번호)을 거부
  - 앱 비밀번호 오입력/복사 오류, 발급 계정 불일치, Workspace 정책 차단 가능
- 해결:
  - `GMAIL_APP_PASS`가 정규화 후 16자인지 확인
  - `GMAIL_USER`가 앱 비밀번호를 발급한 동일 Google 계정인지 확인
  - 앱 비밀번호를 재발급 후 `.env.local` 갱신, 개발 서버 재시작

---

## 9) 향후 확장 아이디어

- 정책 뉴스 결과를 DB(Supabase)에 저장해 히스토리 조회
- 리뷰/정책 스냅샷 버전 관리 및 시계열 비교 차트
- 수집 스케줄러(CRON) 및 알림(Slack/Email) 연동
- 리포트 결과 내 근거 링크 자동 첨부
