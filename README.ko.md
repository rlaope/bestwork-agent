# bestwork-agent

Claude Code 하네스 엔지니어링. 프롬프트 한 줄이면 됩니다 — 나머지는 하네스가 잡아냅니다.

<p align="center">
  <a href="README.md">English</a> · <a href="README.ko.md">한국어</a> · <a href="README.ja.md">日本語</a>
</p>

---

## 문제

AI 코딩 에이전트는 할루시네이션, 루프, 요구사항 누락, 보안 결함을 만듭니다. AI 생성 코드의 45%가 취약점을 포함합니다(Veracode). 바이브 코딩 앱은 아이디어 검증 없이 만들어져서 실패합니다.

**bestwork-agent**는 프로 엔지니어링 팀이 사용하는 품질 게이트를 추가합니다 — 작업 방식은 바꾸지 않으면서.

## 벤치마크: 하네스 ON vs OFF

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

## 하네스가 하는 일

| 게이트 | 시점 | 잡아내는 것 |
|--------|------|------------|
| **그라운딩** | PreToolUse (Edit/Write) | 읽지 않은 파일 수정 |
| **스코프 잠금** | PreToolUse | 잠긴 디렉토리 밖 수정 |
| **스트릭트** | PreToolUse | `rm -rf`, `git push --force` |
| **타입 체크** | PostToolUse (Edit/Write) | 변경 후 TypeScript 에러 |
| **리뷰** | 요청 시 / PostToolUse | 가짜 import, 할루시네이션 메서드, 플랫폼 불일치, 디프리케이트 API |
| **요구사항 체크** | PostToolUse (Edit/Write) | clarify/validate 세션의 미충족 요구사항 |
| **검증** | 빌드 전 | 증거 기반 go/no-go — 이 기능을 만들 가치가 있는가? |

모든 게이트는 자동 실행됩니다. 프롬프트만 치면 됩니다.

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

## 작동 원리

게이트웨이가 프롬프트를 분석해서 적절한 규모를 선택합니다:

- **Solo** — 간단한 수정 (에이전트 1명)
- **Pair** — 관련된 2개 태스크 (에이전트 2명 + 크리틱)
- **Trio** — 품질 게이트 포함 다중 태스크 (태스크당 tech + PM + critic)
- **Hierarchy** — 대규모, 아키텍처 결정 (CTO → Lead → Senior → Junior)
- **Squad** — 로컬 기능, 빠른 합의 (플랫, 병렬)

Solo가 아니면 게이트웨이가 플랜을 보여주고 확인을 요청합니다.

## 49개 도메인 전문가

**25 Tech** · **10 PM** · **14 Critic**

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
