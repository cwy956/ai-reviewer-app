# AI 심사역 IR 평가 (데모)

딥테크 스타트업 IR(피치덱)을 업로드하면, 심사역의 관점을 재현한 "Persona AI 심사역"이 자료의 충실도를 평가하는 데모 앱입니다.
투자 자문이 아니라 "IR 자료가 근거를 얼마나 충실히 담았는가"를 평가합니다.

## 실행 방법

1. 의존성 설치 (최초 1회):
   ```bash
   npm install
   ```
2. `.env.local.example`을 복사해 `.env.local`을 만들고 Anthropic API 키를 채웁니다:
   ```bash
   cp .env.local.example .env.local
   ```
3. 개발 서버 실행:
   ```bash
   npm run dev
   ```
4. 브라우저에서 http://localhost:3000 접속.

## 데모 시나리오

1. 영역 선택 (예: 반도체·소부장, AI·소프트웨어 등)
2. 심사역 선택 — 기본 AI 심사역 또는 등록된 Persona AI 심사역(예: 정우영)
3. 투자단계·pre-밸류 등 부가 정보 입력 (선택)
4. 면책 동의 체크
5. PDF 피치덱 업로드 → 평가 → 결과 리포트 확인 (점수, 5축 레이더, 단계 적합도, 강점/보강포인트, 스토리라인,
   Action Plan, 심사역이 궁금해할 질문)

결과 화면의 "이 심사역에게 메일로 IR 보내기"는 데모에서 실제로 이메일을 발송하지 않는 UI 스텁이며, 80점 미만이면
버튼 대신 안내 문구만 표시됩니다.

## 심사역 페르소나 교체 방법

`lib/personas/jungwooyoung.json`은 플레이스홀더입니다. 실제 심사역의 기준으로 교체하려면:

- `bio`, `portfolio`, `sevenPrinciples` 필드를 실제 내용으로 채웁니다.
- `domainCriteria`에서 각 영역별로 중요하게 보는 체크포인트 5개의 id를 `starredCheckpointIds`에 넣고,
  체크포인트로 담지 못하는 판단 기준은 `freeform`에 500자 이내로 적습니다. 체크포인트 id 목록은
  `lib/domains.ts`의 `buildCheckpoints`가 생성하며, `{domainId}-{team|market|product|traction|finance}-{1~5}`
  형식입니다.
- 새 심사역을 추가하려면 `lib/personas/*.json`에 파일을 추가하고 `lib/personas/index.ts`의 `personas` 배열에
  등록합니다.
- 새 도메인(영역)을 추가/수정하려면 `lib/domains.ts`의 `DOMAIN_SEEDS`를 편집합니다.

## 현재 데모 범위에서 제외된 것 (실사용 도구 전환 시 추가 필요)

- 심사역 온보딩 웹 UI (지금은 JSON 파일을 직접 편집)
- Peer 현황조사 (실시간 웹 검색 연동 필요)
- 실제 이메일 발송
- 인증/DB, IR 보관 정책 — 지금은 업로드된 IR을 요청 처리 후 메모리에서 폐기하고 별도 저장하지 않습니다.
- PDF 이외 포맷(Word, 이미지) 업로드
