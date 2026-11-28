---
description: 노바 기동군 신규 분대(또는 신규 적)를 데이터, 공격 로직, 32x32 스프라이트, 테스트까지 아키텍처 규칙에 맞게 추가합니다.
---

# 신규 분대·적 추가 워크플로우

## Step 1: 스펙 확정
- **분대:** 배치(`role`: FRONT/BACK), 조준(`targeting`: AUTO/FACING), 공격 방식(`style`: PROJECTILE·PIERCE·MELEE·CONE·PULSE·HEAL·CHAIN·TURRET), 피해·쿨다운·사거리. 사거리는 `docs/DESIGN.md`의 사거리 계층에 맞춥니다.
- **진화:** 레시피 모듈(`evolution.moduleId`)과 진화 분대(`evolved: true`, 백금 `paletteOverride`).
- **적:** 행동 패턴(`behavior`), 체력·접촉 피해·속도·경험치·스케일, 소속 세력 팔레트.

## Step 2: JSON 데이터 등록
- 분대: `src/data/survivor_units.json`에 추가하고 `survivor_factions.json`의 `unitPool`에 넣습니다. ID는 `ic_<name>`.
- 적: `src/data/survivor_enemies.json`에 추가하고 `survivor_waves.json`의 `streams`/`events`에 등장 시간을 넣습니다.

## Step 3: 로직 (필요할 때만)
- 기존 공격 방식·행동 패턴으로 표현되면 데이터만으로 끝냅니다.
- 새 메커니즘은 `SurvivorEngine.performSquadAttack`(분대) 또는 `EnemyBehaviors.stepEnemyAI`(적)에 추가합니다. pixi/DOM import 금지.

## Step 4: 스프라이트
- `SurvivorSprites.ts`에 `draw<Name>32` 드로잉 함수를 추가하고 `drawRaw`의 switch와 `SpriteArchetype`에 등록합니다.
- 총구 섬광·번개 등은 `c.fxBegin()/fxEnd()`로 이펙트 레이어에 그립니다.
- `SpriteSheetSpec.test.ts`(16색, 2/4/4 프레임, 기준선·피벗)가 통과해야 합니다.

## Step 5: 검증 및 보고
1. `npm run typecheck`, `npm test`, `npm run build`
2. 필요하면 봇 시뮬레이션으로 생존 시간 변화를 확인합니다.
3. 스탯 요약표, 구현 위치, 게임에서 확인하는 방법(`?skip=초` 디버그 등)을 보고합니다.
