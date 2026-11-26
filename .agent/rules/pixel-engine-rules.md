---
description: 웹 기반 픽셀 오토배틀러 로그라이크(SECTOR: KOPRULU)의 아키텍처, 픽셀 렌더링, 도메인 분리 핵심 개발 규칙
globs: ["src/**/*", "public/**/*"]
alwaysApply: true
---

# Pixel Auto-Battler Engine Rules

이 프로젝트는 **TypeScript + PixiJS v8 + Vite + Zustand** 기반의 웹 픽셀 오토배틀러 로그라이크 게임입니다. 모든 코드 작성 및 수정 시 아래 규칙을 엄격히 준수하십시오.

## 1. 계층 분리 원칙 (Strict Decoupling)
- **Domain 계층 (`src/domain/`) 순수성 유지:**
  - `src/domain/` 내부의 모든 파일(`BattleEngine`, `GridSystem`, `DamageCalc`, `StageRule` 등)에서는 `pixi.js` 또는 DOM/React/Zustand UI 모듈을 **절대 import 하지 마십시오.**
  - 전투 로직은 고정 타임스텝(`FIXED_DT = 1 / 30`) 기반의 헤드리스(Headless) 시뮬레이션으로 동작해야 하며, 배속(`1x`, `2x`, `4x`) 변경 시 로직 수정 없이 틱(Tick) 실행 횟수만 증가시켜 처리합니다.
- **Entities 및 렌더링 계층 (`src/entities/`, `src/core/`):**
  - `Unit.ts`, `Projectile.ts` 등의 엔티티 클래스는 `domain`의 논리 상태(좌표, HP, 현재 액션 상태)를 읽어 PixiJS 스프라이트 위치 보간(Lerp) 및 애니메이션 프레임 전환만 담당합니다.
- **UI 계층 (`src/ui/`):**
  - 캔버스 외부의 상점, 종족 선택, 시너지 툴팁, HUD는 HTML/CSS(Tailwind) 오버레이로 구현하며, PixiJS 내부에 복잡한 텍스트 UI를 직접 그리지 마십시오.

## 2. 픽셀 퍼펙트(Pixel-Perfect) 렌더링 규칙
- **스케일링 모드:** 모든 텍스처와 스프라이트는 `scaleMode: 'nearest'`를 적용하여 확대 시 안티앨리어싱(흐려짐)이 발생하지 않도록 합니다.
- **좌표 정수화:** 스프라이트 렌더링 시 서브픽셀 번짐을 방지하기 위해 최종 화면 좌표는 `Math.round()` 처리를 원칙으로 합니다.
- **Z-Index 정렬:** 탑다운/쿼터뷰 원근감을 위해 유닛 컨테이너는 `sortableChildren = true`를 유지하고, 매 프레임 `zIndex = Math.round(logicalY)`로 깊이를 정렬합니다.
- **캔버스 확장 대응:** 아군 진영 그리드가 `3x3` → `4x4` → `5x5`로 확장될 때 개별 스프라이트 크기를 줄이지 말고, 메인 월드 컨테이너(`worldContainer`)의 스케일과 카메라 오프셋만 조정하여 전장 전체가 뷰포트 내에 들어오도록 처리합니다.

## 3. 데이터 주도 설계 (Data-Driven Design)
- **하드코딩 금지:** 유닛의 체력, 공격력, 사거리, 공격 속도, 태그(`BIO`, `MECH`, `AIR` 등), 스킬 계수는 코드에 하드코딩하지 않고 `src/data/units_*.json` 파일에서 로드합니다.
- **플레이스홀더 폴백(Fallback):** 신규 유닛이나 투사체 추가 시 아틀라스에 실제 픽셀 스프라이트가 아직 없더라도 에러를 발생시키지 않고, `AssetLoader`에서 종족 컬러와 유닛 이니셜이 그려진 `32x32` 동적 플레이스홀더 텍스처를 자동 생성하여 반환해야 합니다.

## 4. TypeScript 및 성능 규칙
- `any` 타입 사용을 금지하며, 모든 유닛 데이터 및 전투 이벤트는 `src/domain/types.ts`의 명시적 인터페이스와 유니온 타입을 사용합니다.
- 5x5 대규모 전투(최대 50기 이상 동시 교전)에서 GC(가비지 컬렉션) 스파이크를 방지하기 위해, 전투 루프(`update` 틱) 내부에서는 불필요한 배열 복사(`.map`, `.filter` 체이닝)나 객체 생성을 최소화하고 투사체/이펙트는 오브젝트 풀링(Object Pooling)을 우선 고려합니다.
