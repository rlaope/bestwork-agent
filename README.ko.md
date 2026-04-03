# bestwork-agent

Claude Code 하네스 엔지니어링 오픈소스. AI 에이전트를 혼자 일하게 두지 마세요.

<p align="center">
  <a href="README.md">English</a> · <a href="README.ko.md">한국어</a> · <a href="README.ja.md">日本語</a>
</p>

---

에이전트한테 일 시키면 혼자 끙끙대다가 할루시네이션 내고, 루프 돌고, 요구사항 빠뜨립니다. 끝나고 나서야 아는 거죠.

**bestwork-agent**는 에이전트한테 팀을 붙여줍니다. 태스크마다 **Tech**(개발) + **PM**(검증) + **Critic**(리뷰) 3명이 붙어서 일합니다. 49개 전문 에이전트 자동 매칭. 병렬 실행. 피드백 루프. 디스코드/슬랙 알림.

## 설치

### 방법 1: Claude Code 플러그인 (추천)

```
/plugin marketplace add https://github.com/rlaope/bestwork-agent
/plugin install bestwork-agent
```

### 방법 2: npm

```bash
npm install -g bestwork-agent
bestwork install
```

### 알림 설정

설치 후 알림 연결:

```
./discord <webhook_url>
./slack <webhook_url>
```

---

## 하네스

### 트리오 — 태스크마다 3명이 붙는다

```
./trio auth API 구현 | 레이트 리밋 추가 | 통합 테스트 작성
```

| 태스크 | Tech | PM | Critic |
|--------|------|----|--------|
| auth API | tech-auth | pm-security | critic-security + critic-hallucination |
| 레이트 리밋 | tech-performance | pm-api | critic-scale + critic-hallucination |
| 통합 테스트 | tech-testing | pm-product | critic-testing + critic-hallucination |

- **Tech**가 구현하면
- **PM**이 "요구사항 다 됐나?" 확인하고
- **Critic**이 "코드 품질 괜찮나? 할루시네이션 없나?" 검사
- Critic이 리젝하면 → Tech한테 피드백 → 다시 구현 (최대 3번)
- **할루시네이션 크리틱은 모든 태스크에 필수**

### 49개 전문 에이전트

```bash
bestwork agents
```

**Tech 25개**: backend, frontend, fullstack, infra, database, API, mobile, testing, security, performance, devops, data, ML, CLI, realtime, auth, migration, config, agent-engineer, plugin, accessibility, i18n, graphql, monorepo, writer

**PM 10개**: product, API, platform, data, infra, migration, security, growth, compliance, DX

**Critic 14개**: performance, scalability, security, consistency, reliability, testing, hallucination, DX, type safety, cost, accessibility, devsecops, i18n, agent

에이전트 프롬프트는 `prompts/` 폴더에 있어서 빌드 없이 수정 가능.

### 개발 제어

```
./scope src/auth/       이 폴더만 수정 가능하게 잠금
./unlock                잠금 해제
./strict                가드레일 전체 켜기 (rm -rf 차단, read-before-edit 강제)
./relax                 가드레일 끄기
./tdd 유저 인증 추가     테스트 먼저 쓰게 강제
./context               최근 수정 파일 미리 로드
./recover               막혔을 때 접근법 리셋
./review                플랫폼/런타임 할루시네이션 체크
```

### 스마트 게이트웨이

명령어 외울 필요 없음. 그냥 말하면 됨:

```
"코드 리뷰해줘"              → ./review
"이거 병렬로 돌려"            → ./trio
"왜 그 세션 실패했어"          → ./autopsy
"프롬프팅 잘하는 법"           → ./learn
```

### 알림

```
./discord <webhook_url>
./slack <webhook_url>
```

프롬프트 처리 끝날 때마다: 프롬프트 요약, git diff, 플랫폼 리뷰, 세션 건강도 알림. 색으로 구분 (초록/노랑/빨강).

### 할루시네이션 방지 (자동)

- **그라운딩** — 안 읽은 파일 수정하려 하면 경고
- **검증** — 코드 바꿀 때마다 타입체크 자동 실행
- **플랫폼 리뷰** — macOS에서 Linux 코드 쓰면 잡아냄
- **스코프 강제** — 잠근 폴더 밖은 수정 불가
- **스트릭트 강제** — `rm -rf`, `git push --force` 차단

---

## 옵저버빌리티

```bash
bestwork                  # TUI 대시보드
bestwork sessions         # 세션 목록 (경로, 마지막 프롬프트, 사용률 %)
bestwork session <id>     # 도구 분포, 에이전트 트리
bestwork summary -w       # 주간 요약
bestwork heatmap          # 365일 활동 그래프
bestwork loops            # 루프 감지
bestwork replay <id>      # 세션 리플레이
bestwork effectiveness    # 프롬프트 효율 트렌드
```

### 데이터 기반 에이전트

```
./autopsy [id]         세션 부검 — 뭐가 잘못됐는지
./learn                내 프롬프팅 패턴 분석
./predict <태스크>      이 작업 얼마나 걸릴지 예측
./guard                지금 세션 괜찮은 건지
./compare <id1> <id2>  두 세션 비교
```

---

## 보안

데이터 전부 로컬. 외부 전송 없음. 웹훅 URL은 discord.com/hooks.slack.com만 허용. [SECURITY.md](SECURITY.md) 참고.

## 라이선스

[MIT](LICENSE)
