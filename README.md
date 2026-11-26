# SECTOR: KOPRULU

> 스타크래프트 3종족 비대칭 전투 기반 웹 픽셀 전술 오토배틀러 로그라이크 (`TypeScript + PixiJS v8 + Vite + Zustand + React`)

## 문서 및 규칙
- 기획 통합 설계서: [docs/DESIGN.md](./docs/DESIGN.md)
- 웹 아키텍처 설계서: [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)
- 핵심 개발 규칙: [.agent/rules/pixel-engine-rules.md](./.agent/rules/pixel-engine-rules.md)
- 신규 유닛 워크플로우: [.agent/workflows/add-new-unit.md](./.agent/workflows/add-new-unit.md)

## 실행 방법
```bash
npm install
npm run dev
```

## 검증 스크립트
```bash
npm run typecheck   # TypeScript strict 검사
npm test            # 도메인 순수 로직 단위 테스트 (Vitest)
npm run build       # 프로덕션 번들 빌드
```

## 마일스톤 진행 현황
- [x] **Milestone 1 (`feat/grid-core`)**: Vite + TS + PixiJS v8 초기 세팅, 픽셀 퍼펙트 캔버스(`640x360`, `nearest`), `3x3 ~ 5x5` 가변 그리드 및 오토 줌, 드래그 앤 드롭 배치
- [ ] **Milestone 2 (`feat/combat-engine`)**: 일꾼 및 1티어 유닛 헤드리스 전투 루프(`FIXED_DT = 1/30`)
- [ ] **Milestone 3 (`feat/roguelike-loop`)**: 종족 선택 루프, 3택 1 드래프트 상점, 그리드 확장 이벤트, 3가지 스테이지 모드
- [ ] **Milestone 4 (`feat/pixel-polish`)**: 픽셀 아틀라스 교체, 종족 고유 기믹 및 사운드 적용