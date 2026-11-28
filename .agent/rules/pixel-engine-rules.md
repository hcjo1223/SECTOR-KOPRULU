---
description: 웹 픽셀 부대 서바이벌(SECTOR: KOPRULU)의 아키텍처, 픽셀 렌더링, 도메인 분리 핵심 개발 규칙
globs: ["src/**/*", "public/**/*"]
alwaysApply: true
---

# Squad Horde Survival Engine Rules

이 프로젝트는 **TypeScript + PixiJS v8 + Vite + Zustand + React** 기반의 웹 픽셀 부대 서바이벌 게임입니다. 모든 코드 작성 및 수정 시 아래 규칙을 엄격히 준수하십시오.

## 1. 계층 분리 원칙 (Strict Decoupling)
- **Domain 계층 (`src/domain/survivor/`) 순수성 유지:**
  - `SurvivorEngine`, `EnemyBehaviors`, `Formation`, `SpatialHash`, `MetaProgress` 등에서는 `pixi.js`, DOM, React, Zustand를 **절대 import 하지 마십시오.**
  - 시뮬레이션은 고정 타임스텝(`SURVIVOR_DT = 1 / 30`) 헤드리스 방식으로 동작합니다. 사운드·화면 흔들림 같은 연출은 엔진이 `cues` 큐에 이벤트만 남기고, 앱 계층(`src/core/`)이 소비합니다.
- **렌더링·앱 계층 (`src/core/`):** `SurvivorRenderer`는 엔진 상태를 읽어 스프라이트 보간·애니메이션 프레임만 담당하고, `SurvivorApp`이 틱 루프·카메라·연출 cue 소비를 맡습니다.
- **UI 계층 (`src/ui/`):** 타이틀·HUD·레벨업·상자·유물·결과 화면은 HTML/CSS(Tailwind) 오버레이로 구현하며, PixiJS 안에 텍스트 UI를 그리지 마십시오.
- **저장 (`src/store/`):** 브라우저 저장(localStorage)은 스토어 계층만 다루며, 저장 불가 환경에서도 게임이 동작해야 합니다.

## 2. 픽셀 퍼펙트(Pixel-Perfect) 렌더링 규칙
- **스케일링 모드:** 모든 텍스처는 `scaleMode: 'nearest'`, 캔버스는 `image-rendering: pixelated`로 안티앨리어싱을 금지합니다.
- **좌표 정수화:** 최종 화면 좌표는 `Math.round()` 처리합니다. 화면 흔들림도 정수 픽셀 오프셋만 사용합니다.
- **Z-Index 정렬:** 유닛 레이어는 `sortableChildren = true`, `zIndex = Math.round(y)`로 깊이를 정렬합니다.
- **스프라이트 시트 사양:** 32x32 · 스프라이트당 16색 · IDLE 2 / WALK 4 / ATTACK 4 · 피벗 (16, 31) · 여백·텍스트·그림자·반투명 없음. `SpriteSheetSpec.test.ts`가 강제합니다.
- **카메라:** 진형이 커져도 스프라이트 크기를 줄이지 않고 논리 뷰를 넓혀 줌아웃합니다.

## 3. 데이터 주도 설계 (Data-Driven Design)
- 유닛·적·웨이브·모듈·유물 수치는 `src/data/survivor_*.json`에서 로드하고 코드에 하드코딩하지 않습니다. 밸런스 조정용 패시브·유물 배율은 엔진 상단의 이름 붙은 상수로 모읍니다.
- 스프라이트는 이미지 파일 없이 `SurvivorSprites.ts`의 오리지널 드로잉 코드로 생성합니다. 특정 게임의 캐릭터·명칭·아트를 재현하지 마십시오.

## 4. TypeScript 및 성능 규칙
- `any` 금지. 상태·이벤트는 `src/domain/survivor/types.ts`의 명시적 타입을 사용합니다.
- 적 500기 규모에서 GC 스파이크를 막기 위해 틱 루프 안에서는 배열 복사·객체 생성을 최소화하고, 근접 탐색·충돌은 `SpatialHash`를 사용합니다.

## 5. Git 브랜치 및 PR 워크플로우 규칙
- 모든 기능 개발, 마일스톤 작업, 버그 수정, CI/CD 변경은 `main` 브랜치에 직접 커밋·푸시하지 않고 별도 브랜치에서 진행합니다.
- 로컬 검증(`npm run typecheck`, `npm test`, `npm run build`) 완료 후 원격 브랜치로 푸시하고 `main`을 대상으로 GitHub Pull Request를 생성하여 반영합니다.
