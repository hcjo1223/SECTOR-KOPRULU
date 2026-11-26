# SECTOR: KOPRULU

> 스타크래프트 3종족 비대칭 전투 기반 웹 픽셀 전술 오토배틀러 로그라이크 (`TypeScript + PixiJS v8 + Vite + Zustand + React`)

## 문서 및 규칙
- 기획 통합 설계서: [docs/DESIGN.md](./docs/DESIGN.md)
- 웹 아키텍처 설계서: [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)
- 핵심 개발 규칙: [.agent/rules/pixel-engine-rules.md](./.agent/rules/pixel-engine-rules.md)
- 신규 유닛 워크플로우: [.agent/workflows/add-new-unit.md](./.agent/workflows/add-new-unit.md)
- GitHub Pages CI/CD: [.github/workflows/ci-cd.yml](./.github/workflows/ci-cd.yml)

## 실행 방법
```bash
npm install
npm run dev
```

## 검증 스크립트
```bash
npm run typecheck   # TypeScript strict 검사
npm test            # 도메인 및 픽셀 스프라이트 단위 테스트 (Vitest)
npm run build       # 프로덕션 번들 빌드
```

## 마일스톤 진행 현황
- [x] **Milestone 1 (`feat/grid-core`)**: Vite + TS + PixiJS v8 초기 세팅, 픽셀 퍼펙트 캔버스(`640x360`, `nearest`), `3x3 ~ 5x5` 가변 그리드 및 오토 줌, 드래그 앤 드롭 배치
- [x] **Milestone 2 (`feat/combat-engine`)**: 3종족 18종 유닛 데이터 정의, 헤드리스 전투 루프(`FIXED_DT = 1/30`), 유닛 고유 스킬 및 투사체 오브젝트 풀링, 지휘관 액티브 스킬 개입
- [x] **Milestone 3 (`feat/roguelike-loop`)**: 종족 선택, 3갈래 전술 지도(전투/보급·유물/정비·확장), 3택 1 드래프트 상점, 그리드 확장 이벤트(`3x3→4x4→5x5`), 3가지 스테이지 모드(섬멸/방어/돌파), 병영 도감
- [x] **Milestone 4 (`feat/pixel-polish`)**: 7단계 볼류메트릭 Bayer 디더링 픽셀 아틀라스(`.png` + `.json`) 및 종족별 픽셀 지형 타일, 종족 고유 기믹(테란 애드온/스팀팩, 저그 군단 변이/점막, 프로토스 플라즈마 실드/차원 소환) 및 Web Audio API 레트로 사운드 적용