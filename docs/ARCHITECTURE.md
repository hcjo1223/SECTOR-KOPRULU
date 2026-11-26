# SECTOR: KOPRULU — 웹 아키텍처 설계서

## 1. 기술 스택
- **언어 / 렌더링:** TypeScript + PixiJS v8 (WebGL 2D 배칭, `scaleMode: 'nearest'`)
- **빌드 도구:** Vite
- **상태 관리 / UI:** Zustand + React + HTML5/CSS3 (Tailwind CSS) 오버레이 HUD

## 2. 디렉터리 구조
```text
sector-koprulu/
├── .agent/
│   ├── rules/
│   │   └── pixel-engine-rules.md
│   └── workflows/
│       └── add-new-unit.md
├── docs/
│   ├── ARCHITECTURE.md
│   └── DESIGN.md
├── public/
│   └── assets/
│       ├── atlases/             # 스프라이트 시트 (.png + .json)
│       ├── audio/               # 효과음 및 BGM
│       └── fonts/               # 픽셀 웹폰트
├── src/
│   ├── core/                    # PixiJS 초기화, 씬 전환, 에셋 로더
│   │   ├── GameApp.ts
│   │   ├── SceneManager.ts
│   │   └── AssetLoader.ts
│   ├── domain/                  # 순수 전투·그리드 로직 (PixiJS import 금지)
│   │   ├── types.ts
│   │   ├── grid/
│   │   │   ├── GridSystem.ts
│   │   │   └── Pathfinding.ts
│   │   ├── combat/
│   │   │   ├── BattleEngine.ts
│   │   │   ├── DamageCalc.ts
│   │   │   └── StageRule.ts
│   │   └── synergy/
│   │       └── SynergyCalc.ts
│   ├── entities/                # 렌더링 바인딩 객체
│   │   ├── Unit.ts
│   │   ├── Projectile.ts
│   │   └── Structure.ts
│   ├── data/                    # JSON 밸런스 및 유닛 마스터 데이터
│   │   ├── projectiles.json
│   │   ├── stages.json
│   │   ├── units_terran.json
│   │   ├── units_zerg.json
│   │   └── units_protoss.json
│   ├── store/                   # Zustand 메타 상태
│   │   └── useGameStore.ts
│   ├── ui/                      # HTML/CSS 오버레이 컴포넌트
│   │   ├── TitleScreen.tsx
│   │   ├── PrepOverlay.tsx
│   │   └── BattleHUD.tsx
│   └── main.tsx
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## 3. 핵심 아키텍처 설계 원칙
1. **시뮬레이션과 렌더링 완전 분리 (Headless Simulation):**
   - `BattleEngine.ts`는 고정 타임스텝(`FIXED_DT = 1/30초`)으로 순수 수치 연산만 수행합니다.
   - `Unit.ts`는 좌표를 보간(Lerp)하여 렌더링만 담당하며, 배속(`1x`/`2x`/`4x`)은 틱 실행 횟수 조절로 처리합니다.
   - `src/domain/` 하위의 모든 모듈은 `pixi.js`, `react`, `zustand`, DOM API를 import하지 않습니다.
2. **가변 전장 좌표계 및 카메라 오토 줌:**
   - 전장은 `[아군 N×N] + [중앙 2열] + [적군 N×N]` 구조(`8x3` → `10x4` → `12x5`)로 확장됩니다.
   - 그리드 확장에 맞춰 메인 월드 컨테이너(`worldContainer`)의 스케일과 오프셋만 자동 조정해 한 화면(`640x360` 가상 해상도)에 전체 전장을 수용합니다.
3. **픽셀 퍼펙트 강제:**
   - 가상 해상도 `640x360` 고정
   - 모든 텍스처 `scaleMode: 'nearest'`
   - 스프라이트 좌표 `Math.round()` 정수화
   - `sortableChildren = true` 및 `zIndex = Math.round(logicalY)` 깊이 정렬
4. **데이터 주도 설계 및 플레이스홀더 폴백:**
   - 유닛 및 투사체 스펙은 `src/data/*.json`에 정의합니다.
   - 아틀라스가 없는 프로토타입 단계에서도 `AssetLoader.ts`가 종족 컬러·유닛 이니셜·외곽선·팀 링이 반영된 동적 픽셀 텍스처를 생성합니다.

## 4. 유닛 데이터 스키마
```json
{
  "unit_id": "terran_marine",
  "name": "해병 (Marine)",
  "race": "TERRAN",
  "tier": 1,
  "cost": 2,
  "grid_size": 1,
  "tags": ["BIO", "RANGED", "INFANTRY"],
  "base_stats": {
    "hp": 45,
    "shield": 0,
    "attack": 6,
    "attack_speed": 1.2,
    "range": 4,
    "move_speed": 1.5,
    "armor_type": "LIGHT"
  },
  "skill": {
    "id": "stimpack",
    "trigger": "ON_COMBAT_START",
    "effect": "HP_COST_10_ATK_SPD_PLUS_40_PCT"
  },
  "visual": {
    "sprite_sheet": "atlas_terran_units.png",
    "sprite_size": 32,
    "pivot_offset": [0, -8],
    "projectile_id": "bullet_gauss"
  }
}
```
