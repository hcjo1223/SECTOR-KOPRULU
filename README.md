# SECTOR: KOPRULU

> 지휘관을 직접 움직여 부대를 이끄는 웹 픽셀 **부대 서바이벌** (`TypeScript + PixiJS v8 + Vite + Zustand + React`)
> 사방에서 몰려오는 블라이트 무리 속에서 10분을 버티고 최종 보스를 처치하라.

## 문서 및 규칙
- 기획 통합 설계서 (v2 · 부대 서바이벌): [docs/DESIGN.md](./docs/DESIGN.md)
- 웹 아키텍처 설계서: [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)
- 핵심 개발 규칙: [.agent/rules/pixel-engine-rules.md](./.agent/rules/pixel-engine-rules.md)
- GitHub Pages CI/CD: [.github/workflows/ci-cd.yml](./.github/workflows/ci-cd.yml)

## 실행 방법
```bash
npm install
npm run dev
```
조작: WASD / 방향키 이동 · Space 일시정지 · 레벨업 시 1/2/3 키 선택 · 모바일은 화면을 누르고 드래그(플로팅 조이스틱)

디버그: URL에 `?skip=170` 처럼 초를 붙이면 런 시작 시 그 시간만큼 빨리 감습니다 (보스 확인용, 지휘관 무적·첫 선택지 자동).

## 검증 스크립트
```bash
npm run typecheck   # TypeScript strict 검사
npm test            # 도메인 및 픽셀 스프라이트 단위 테스트 (Vitest)
npm run build       # 프로덕션 번들 빌드
```

## 마일스톤 진행 현황
- [x] **M1~M4 (v1 그리드 오토배틀러)**: 그리드·전투 엔진·로그라이크 루프·픽셀 폴리시 — v2 전환으로 레거시화 (`src/domain/combat`, `grid`, `roguelike` 등, 정리 예정)
- [x] **M5 (`survivor-core`)**: 지휘관 이동 + 링 진형 추종, 화면 밖 웨이브 스폰(공간 해시), AUTO / 지휘관 방향(FACING) 공격, 경험치·레벨업 3택 1, 최종 보스, 승패, 오리지널 3진영·12x12 도트 스프라이트, 정수 배율 반응형 뷰 + 모바일 조이스틱
- [x] **M5.1**: 분대 4 + 모듈 4 + 진화 + 보급 상자, 철갑 연합 분대 8종·진화 8종·지휘관 3명
- [x] **M6**: 적 행동 6종, 엘리트 특성 5종, 중간 보스 2종 + 최종 보스 3페이즈, 맵 이벤트
- [ ] **M7**: 유닛 진화, 유물, 메타 해금
- [ ] **M8**: 연출·사운드, v1 레거시 코드 정리
