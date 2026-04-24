# bestwork-agent

그냥 동아리가 아니라 회사처럼 일하세요. 당신의 AI 에이전트에게 조직도, 품질 게이트, 실제 엔지니어링 조직이 쓰는 팀 리뷰를 붙여드립니다.

<p align="center">
  <a href="README.md">English</a> · <a href="README.ko.md">한국어</a> · <a href="README.ja.md">日本語</a>
</p>

---

## 문제

AI 에이전트는 혼자 일합니다. 할루시네이션, 루프, 요구사항 누락을 만들고 문제를 너무 늦게 알게 됩니다. AI 생성 코드의 45%가 취약점을 포함합니다(Veracode). 바이브 코딩 앱은 아이디어 검증 없이 만들어져서 실패합니다.

**bestwork-agent**는 당신의 AI 에이전트를 최고의 유니콘이 엔지니어링 팀을 조직하는 방식으로 조직합니다 — 그리고 그 팀이 의존하는 품질 게이트를 올려서, 실제로 신뢰할 수 있는 결과물만 배포되게 합니다.

## 팀은 스스로 구성됩니다

bestwork는 모든 프롬프트를 분석해서 코드가 작성되기 전에 적절한 팀 형태를 선택합니다.

```
당신: "auth 모듈을 OAuth2 지원하도록 리팩터"

bestwork 분석 → 큰 스코프, 아키텍처 결정, 보안 민감
bestwork 선택 → Hierarchy: Security Team

┌─────────────────────────────────────────────────────┐
│  CISO                                               │
│  "공격 표면 수용 가능. 조건부 승인:                   │
│   배포 시 기존 JWT 시크릿 로테이션."                  │
│          ▲ 최종 결정                                 │
│  Tech Lead                                          │
│  "OAuth2 PKCE 플로우 정확. 두 개의 토큰 리프레시      │
│   경로를 하나로 통합하세요."                          │
│          ▲ 아키텍처 리뷰                             │
│  Sr. Security Engineer                              │
│  "구현 보안 양호. CSRF 보호 추가.                    │
│   redirect_uri 입력 검증."                           │
│          ▲ 구현 + 하드닝                             │
│  Jr. QA Engineer                                    │
│  "발견: /callback이 만료된 state를 처리 안 함.         │
│   토큰 리플레이 공격 테스트 추가."                    │
│          ▲ 새로운 시각 + 엣지 케이스                  │
└─────────────────────────────────────────────────────┘
```

```
당신: "설정 페이지에 다크모드 토글 추가"

bestwork 분석 → 단일 기능, 로컬 스코프, 빠른 피드백
bestwork 선택 → Squad: Feature Squad

┌──────────────────────────────────────────────────────┐
│                  Feature Squad (병렬)                 │
│                                                       │
│  Sr. Backend         Sr. Frontend       Product Lead  │
│  "유저 설정 API      "CSS 변수 사용     "유저 스토리   │
│   준비. 테스트        토글 컴포넌트,     일치. 배포."  │
│   통과."              접근성 OK."                     │
│                          QA Lead                      │
│                    "라이트/다크/시스템                 │
│                     설정 테스트 완료.                  │
│                     모두 통과."                        │
│                                                       │
│  결론: 전원 APPROVE → 머지                            │
└──────────────────────────────────────────────────────┘
```

```
당신: "지난 세션이 왜 힘들었지?"

bestwork 분석 → 옵저버빌리티 요청, 코딩 아님
bestwork 선택 → 데이터 분석

  세션 결과 — b322dc3e  ✗ 고전

  Duration:     45m
  Calls/Prompt: 38 (높음 — 평균 12)
  루프 감지: Edit → Bash(테스트 실패) → Edit × 6 on auth.ts

  근본 원인: import 누락 → 테스트 실패 루프
  추천: ./strict 로 read-before-edit 강제
```

## 팀이 형태를 고르는 방식

bestwork는 최고의 엔지니어링 조직이 일하는 방식을 따릅니다.

**Hierarchy** — 권한 레이어가 필요한 결정
```
CTO → Tech Lead → Sr. Engineer → Jr. Engineer
```
Junior가 먼저 구현(새 시각으로 명백한 문제를 잡음), Senior가 다듬고, Lead가 아키텍처를 리뷰하고, C-level이 최종 전략 결정을 내립니다. 각 레벨이 아래로 되돌려보낼 수 있습니다.

**Squad** — 속도와 협업이 필요한 작업
```
Backend + Frontend + Product + QA (모두 동등)
```
모두 병렬로 일합니다. 단일 권한 없음. 합의 기반. 빠름.

**게이트웨이가 태스크 신호에 따라 자동 선택**:
- 간단한 수정 / rename / format → **solo** (에이전트 1명, 오버헤드 없음)
- 관련된 2개 하위 태스크 → **pair** (태스크당 에이전트 1 + 크리틱)
- 다중 하위 태스크 → **trio** (태스크당 tech + PM + critic, 병렬)
- 대규모 / 디렉토리 간 / 아키텍처 → **hierarchy** (CTO → Lead → Senior → Junior)
- 단일 기능 / 버그픽스 / 로컬 → **squad** (플랫, 합의 기반)
- 보안 민감 파일 → security team
- 인프라 / CI/CD 파일 → infra squad

Solo가 아니면 게이트웨이가 플랜을 보여주고 확인/조정/solo 다운그레이드를 요청합니다.

## 팀이 의존하는 품질 게이트

팀 구조만으로는 충분하지 않습니다 — AI 에이전트는 여전히 할루시네이션을 일으킵니다. 모든 액션은 실제 엔지니어링 팀이 의존하는 품질 게이트를 통과합니다.

| 게이트 | 시점 | 잡아내는 것 |
|--------|------|------------|
| **그라운딩** | PreToolUse (Edit/Write) | 읽지 않은 파일 수정 |
| **스코프 잠금** | PreToolUse | 잠긴 디렉토리 밖 수정 |
| **스트릭트** | PreToolUse | `rm -rf`, `git push --force` |
| **타입 체크** | PostToolUse (Edit/Write) | 변경 후 TypeScript 에러 |
| **리뷰** | 요청 시 / PostToolUse | 가짜 import, 할루시네이션 메서드, 플랫폼 불일치, 디프리케이트 API |
| **요구사항 체크** | PostToolUse (Edit/Write) | clarify/validate 세션의 미충족 요구사항 |
| **Verifier** | 작성자 패스 후 | 별도 패스 완료 검증, 실시간 증거 테이블 |
| **검증** | 빌드 전 | 증거 기반 go/no-go — 이 기능을 만들 가치가 있는가? |

모든 게이트는 자동 실행됩니다. 프롬프트만 치면 됩니다.

## 증거: 하네스 ON vs OFF

```
═══════════════════════════════════
  HARNESS EFFECTIVENESS BENCHMARK
═══════════════════════════════════

  시나리오:      13개
  정확도:        100.0%

  하네스 ON:
    캐치율:      100% (10/10)
    오탐:        0

  하네스 OFF (바닐라):
    캐치율:      0% (0/10)

  카테고리:
    할루시네이션   3/4 캐치
    플랫폼        4/4 캐치
    디프리케이트   1/1 캐치
    보안          1/1 캐치
═══════════════════════════════════
```

직접 돌려보세요: `npm run benchmark`

## 설치

### 방법 1: Claude Code 플러그인 (추천)

```bash
/plugin marketplace add https://github.com/rlaope/bestwork-agent
/plugin install bestwork-agent
```

### 방법 2: npm

```bash
npm install -g bestwork-agent
bestwork install
```

## 50개 도메인 전문가

**25 Tech** · **10 PM** · **15 Critic**

에이전트 프롬프트는 `prompts/` 폴더에 있어서 빌드 없이 수정 가능.

## 22개 스킬

자연어 또는 슬래시 명령어 — 게이트웨이가 자동 라우팅합니다.

| 스킬 | 하는 일 |
|------|--------|
| `validate` | 빌드 전 증거 기반 기능 검증 |
| `clarify` | 실행 전 요구사항 질문 |
| `review` | 할루시네이션 + 플랫폼 불일치 스캔 |
| `trio` | 품질 게이트 포함 병렬 실행 |
| `plan` | 스코프 분석 + 팀 추천 |
| `delegate` | 확인 없이 자율 실행 |
| `deliver` | 완료까지 반복 실행 |
| `blitz` | 최대 병렬 실행 |
| `doctor` | 배포 설정 vs 코드 정합성 검사 |
| `pipeline-run` | GitHub 이슈 일괄 자동 처리 |
| `superthinking` | 1000회 반복 사고 시뮬레이션 |
| `waterfall` | 게이트 포함 순차 단계 처리 |

외 10개: agents, changelog, docs, health, install, meetings, onboard, sessions, status, update.

## 하네스 제어

```
./scope src/auth/       디렉토리 잠금
./unlock                잠금 해제
./strict                rm -rf 차단, 읽기 강제
./relax                 스트릭트 해제
./tdd 유저 인증 추가    테스트 먼저 쓰게 강제
./review                할루시네이션 스캔
./validate              이 기능을 만들 가치가 있는가?
./clarify               요구사항 확인
```

## 옵저버빌리티

```bash
bestwork                  # TUI 대시보드
bestwork sessions         # 세션 목록
bestwork heatmap          # 365일 활동 그래프
bestwork loops            # 루프 감지
bestwork replay <id>      # 세션 리플레이
```

## 알림

```
./discord <webhook_url>
./slack <webhook_url>
```

## 보안

데이터 전부 로컬. 외부 전송 없음. [SECURITY.md](SECURITY.md) 참고.

## 라이선스

[MIT](LICENSE)
