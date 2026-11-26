---
description: 종족별 신규 유닛(데이터, 고유 스킬 로직, 플레이스홀더 비주얼, 시너지 연결)을 아키텍처 규칙에 맞게 추가합니다.
---

# 신규 유닛 추가 워크플로우 (Add New Unit)

사용자가 요청한 신규 유닛을 프로젝트에 추가하기 위해 아래 단계를 순서대로 실행하십시오.

## Step 1: 요구사항 및 스펙 확정
사용자의 프롬프트에서 다음 항목을 파악하고, 누락된 밸런스 수치는 스타크래프트 원작 컨셉과 기존 `src/data/units_*.json`의 티어 기준에 맞춰 합리적으로 제안합니다.
- **종족 (`race`):** `TERRAN` | `ZERG` | `PROTOSS`
- **티어 (`tier`) 및 비용 (`cost`):** 1~4티어
- **병종 태그 (`tags`):** 예) `["BIO", "RANGED", "INFANTRY"]`, `["MECH", "SPLASH", "SIEGE"]`, `["AIR", "CARRIER"]`
- **기본 스탯 (`base_stats`):** `hp`, `shield`, `attack`, `attack_speed`, `range`, `move_speed`, `armor_type` (`LIGHT` | `ARMORED` | `MASSIVE`)
- **고유 스킬 (`skill`):** 트리거 조건(`ON_COMBAT_START`, `ON_ATTACK`, `ON_KILL`, `PASSIVE`)과 효과

## Step 2: JSON 마스터 데이터 등록
1. 해당 종족의 데이터 파일(`src/data/units_terran.json`, `units_zerg.json`, 또는 `units_protoss.json`)을 엽니다.
2. 기존 스키마 형식에 맞춰 새 유닛 엔트리를 추가합니다.
   - `unit_id`는 `{race}_{unit_name}` 소문자 스네이크 케이스(예: `terran_siege_tank`)로 통일합니다.
   - 대형 유닛(배틀크루저, 울트라리스크, 캐리어 등)의 경우 `visual.sprite_size`를 `64`로, 일반 소/중형 유닛은 `32` 또는 `48`로 지정합니다.

## Step 3: 고유 스킬 및 특수 기믹 핸들러 구현
1. 유닛의 스킬이 기존 공용 효과(단순 버프, 범위 데미지 등)로 처리 가능하면 데이터 설정만으로 연결합니다.
2. 신규 메커니즘(예: 시즈 탱크 모드 전환, 러커 잠복 가시 공격, 캐리어 인터셉터 사출)이 필요한 경우:
   - `src/domain/combat/skills/` 경로에 순수 로직 핸들러를 추가합니다. (PixiJS 의존성 금지)
   - `BattleEngine.ts`의 스킬 레지스트리에 해당 `skill.id`를 등록합니다.

## Step 4: 비주얼 및 투사체 매핑
1. `public/assets/atlases/`에 해당 유닛의 스프라이트가 존재하는지 확인합니다.
2. 스프라이트가 아직 없는 경우 `AssetLoader.ts`의 플레이스홀더 생성 규칙(종족별 테마 컬러 + 유닛 약어 표기 + 크기 규격)이 정상 작동하는지 검증합니다.
3. 원거리/특수 공격 유닛이라면 `src/data/projectiles.json`에 투사체 ID(`bullet_gauss`, `spine_lurker`, `interceptor` 등)와 속도, 스플래시 반경을 등록합니다.

## Step 5: 시너지 및 상점 드래프트 풀 반영
1. `src/domain/synergy/SynergyCalc.ts`에서 새 유닛의 `tags`가 종족 및 병종 시너지 카운트에 정상 집계되는지 확인합니다.
2. `src/data/stages.json` 또는 상점 드래프트 풀 설정에서 해당 유닛의 티어에 맞는 등장 확률 구간에 포함되었는지 점검합니다.

## Step 6: 검증 및 요약 보고
1. TypeScript 컴파일 에러(`tsc --noEmit`)가 없는지 확인합니다.
2. 추가된 유닛의 스탯 요약표, 구현된 스킬 로직 위치, 그리고 테스트를 위해 상점/디버그 배치에서 확인하는 방법을 간결하게 보고합니다.
