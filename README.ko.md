# bestwork-agent

**now you see me** — Claude Code를 위한 최고의 하네스 엔지니어링. 동아리가 아닌 기업처럼 일하게.

<p align="center">
  <a href="README.md">English</a> · <a href="README.ko.md">한국어</a> · <a href="README.ja.md">日本語</a>
</p>

---

AI 에이전트가 혼자 일합니다. 할루시네이션, 루프, 요구사항 누락 — 끝나고 나서야 알게 됩니다.

**bestwork-agent**는 에이전트를 팀으로 만듭니다. 모든 태스크에 **Tech**(엔지니어) + **PM**(프로덕트 매니저) + **Critic**(품질 리뷰어)이 배정됩니다. 36개 전문 프로필. 자동 선택. 병렬 실행. 피드백 루프. 실시간 알림.

## 설치

```bash
npm install -g bestwork-agent
bestwork install
```

Claude Code 재시작 후 `./help` 입력.

---

## 하네스

### 트리오 실행 — AI 기업

```
./trio auth API 구현 | 레이트 리밋 추가 | 통합 테스트 작성
```

각 태스크에 도메인 전문가 트리오 자동 매칭:

| 태스크 | Tech | PM | Critic |
|--------|------|----|--------|
| auth API | tech-auth | pm-security | critic-security + critic-hallucination |
| 레이트 리밋 | tech-performance | pm-api | critic-scale + critic-hallucination |
| 통합 테스트 | tech-testing | pm-product | critic-testing + critic-hallucination |

- **Tech** — 도메인 전문성으로 구현
- **PM** — 요구사항 충족 여부 검증
- **Critic** — 품질 리뷰 + 할루시네이션 감지
- 거부? 피드백 루프 → Tech 수정 → 재리뷰 (최대 3회)

### 36개 전문 에이전트

```bash
bestwork agents    # 전체 카탈로그
```

**18 Tech**: backend, frontend, fullstack, infra, database, API, mobile, testing, security, performance, devops, data, ML, CLI, realtime, auth, migration, config

**8 PM**: product, API, platform, data, infra, migration, security, growth

**10 Critic**: performance, scalability, security, consistency, reliability, testing, hallucination, DX, type safety, cost

### 개발 제어

| 명령어 | 설명 |
|--------|------|
| `./scope src/auth/` | 해당 디렉토리만 수정 가능 |
| `./unlock` | 스코프 해제 |
| `./strict` | 가드레일 전체 활성화 |
| `./relax` | 스트릭트 모드 해제 |
| `./tdd add auth` | 테스트 주도 개발 강제 |
| `./context [files]` | 파일 컨텍스트 프리로드 |
| `./recover` | 에이전트 막힘? 접근법 리셋 |
| `./review` | 플랫폼/런타임 할루시네이션 체크 |

### 스마트 게이트웨이

명령어 암기 필요 없음. 자연어로 입력:

```
"코드 리뷰해줘"                    → ./review
"이 3개 병렬로 돌려"               → ./trio
"왜 그 세션 실패했어"              → ./autopsy
"프롬프팅 개선법 알려줘"           → ./learn
```

### 알림

```
./discord <webhook_url>
./slack <webhook_url>
```

프롬프트 완료 시 풍부한 알림: 프롬프트 요약, 세션 통계, git diff, 플랫폼 리뷰, 세션 건강도.

### 할루시네이션 방지 (자동)

- **그라운딩** — 읽지 않은 파일 수정 시 경고
- **검증** — 코드 변경마다 자동 타입체크
- **플랫폼 리뷰** — 세션 종료 시 OS/런타임 불일치 감지
- **스코프 강제** — 잠긴 경로 밖 수정 차단
- **스트릭트 강제** — `rm -rf`, `git push --force` 등 차단

---

## 옵저버빌리티

```bash
bestwork                  # TUI 대시보드
bestwork sessions         # 세션 목록 (CWD, 마지막 프롬프트, 사용률 %)
bestwork session <id>     # 도구 사용 분포, 에이전트 트리
bestwork summary -w       # 주간 요약
bestwork heatmap          # 365일 활동 그래프
bestwork loops            # 에이전트 루프 감지
bestwork replay <id>      # 세션 리플레이
bestwork effectiveness    # 프롬프트 효율 트렌드
```

---

## 보안

모든 데이터는 로컬. 외부 전송 없음. [SECURITY.md](SECURITY.md) 참조.

## 라이선스

[MIT](LICENSE)
