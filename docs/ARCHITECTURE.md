# SECTOR: KOPRULU — 웹 아키텍처 설계서

> v1(그리드 오토배틀러) 코드는 M8에서 삭제했습니다. v1 설계는 git 히스토리에서 확인할 수 있습니다.

## 1. 기술 스택
- **언어 / 렌더링:** TypeScript + PixiJS v8 (`scaleMode: 'nearest'`, `antialias: false`, `roundPixels: true`)
- **빌드 / 테스트:** Vite · Vitest
- **상태 / UI:** Zustand + React + Tailwind CSS 오버레이 HUD
- **사운드:** WebAudio 실시간 합성 (오디오 파일 없음)

## 2. 디렉터리 구조
```text
src/
├── domain/survivor/            # 순수 로직 (pixi/DOM/React import 금지)
│   ├── types.ts                # 진영·유닛·적·웨이브·유물·연출 신호·런타임 상태 타입
│   ├── SurvivorCatalog.ts      # src/data/survivor_*.json 로더
│   ├── SurvivorEngine.ts       # 고정 타임스텝(1/30s) 헤드리스 시뮬레이션, 연출 신호(cues) 큐
│   ├── EnemyBehaviors.ts       # 적 행동 패턴 (돌진·포자·자폭·갑각·둥지·보스·군체/교단 전용)
│   ├── MetaProgress.ts         # 본부: 전술 데이터 보상·영구 강화·지휘관 해금 (순수 함수)
│   ├── Formation.ts            # 링 진형 슬롯 계산 + FRONT/BACK 배정
│   └── SpatialHash.ts          # 수백 기 근접 탐색용 균일 격자 해시
├── core/
│   ├── SurvivorApp.ts          # Pixi 앱 수명주기, 틱 누적 루프, 링 기반 줌, 연출 신호 → 사운드·흔들림
│   ├── SurvivorRenderer.ts     # 지휘관 추종 카메라, 틱 보간, 스프라이트 풀, 이펙트, 화면 흔들림
│   ├── SurvivorSprites.ts      # 32x32 8방향 스프라이트 (16색 · IDLE2/WALK4/ATTACK4 · 몸/이펙트 레이어 · 시트 패킹)
│   ├── SurvivorAudio.ts        # WebAudio 효과음 합성기 (종류별 최소 간격·동시 발음 제한·거리 감쇠)
│   └── SurvivorInput.ts        # 키보드 + 가상 조이스틱 이동 벡터
├── store/
│   ├── useSurvivorStore.ts     # 화면 전환, 엔진 인스턴스, HUD 스냅샷, 선택지·유물·상자, 런 보상 지급
│   ├── useMetaStore.ts         # 본부 상태 (localStorage 저장)
│   └── useSettingsStore.ts     # 사운드·화면 흔들림 설정 (localStorage 저장)
├── ui/                         # SurvivorTitle, HQPanel, SurvivorHUD, LevelUpModal, ChestModal, RelicModal,
│                               # ResultModal, SettingsToggles, VirtualJoystick
└── data/survivor_{factions,units,enemies,modules,relics,waves}.json
scripts/export-sprite-sheets.ts # 스프라이트 시트 PNG + JSON 내보내기 (npm run sprites:export)
```

## 3. 핵심 설계 원칙
- **계층 분리:** 도메인은 렌더링·브라우저를 모른다. 렌더러는 엔진 상태를 읽기만 하고, UI는 스토어를 통해 엔진에 명령한다.
- **연출 신호(cues):** 엔진은 사격·폭발·처치·보스 등장·레벨업 같은 사건을 `engine.cues`에 `{ kind, x, y, power }`로 남긴다. `SurvivorApp`이 매 프레임 비우며 사운드와 화면 흔들림으로 바꾼다. 소비하지 않는 헤드리스 실행(테스트·시뮬레이션)에서도 96개 상한까지만 쌓인다.
- **결정론:** 엔진의 난수는 시드 기반(`mulberry32`)이라 같은 시드면 같은 런이 재현된다. 렌더러의 화면 흔들림만 비결정적이다.
- **고정 타임스텝:** 시뮬레이션은 1/30초 틱으로만 진행하고, 렌더러는 이전·현재 틱 사이를 보간한다.
- **픽셀 퍼펙트:** 모든 좌표·흔들림은 정수 픽셀. 진형이 커지면 스프라이트를 줄이지 않고 논리 뷰를 넓혀 줌아웃한다(1링 1.00x → 2링 0.84x → 3링 0.72x).
- **저장:** 브라우저 저장은 스토어 계층만 다루며, 저장이 막힌 환경에서도 세션 동안 정상 동작한다.

## 4. 성능
- 적 500기 기준 틱당 ≈0.6ms (헤드리스 측정). 적 탐색·투사체 충돌(연속 충돌 판정)·군집 분리 모두 공간 해시를 쓴다.
- 효과음은 종류별 최소 간격과 동시 발음 20개 제한으로 호드 규모에서도 과부하·소리 뭉개짐을 막는다.
