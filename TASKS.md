# Cadence 작업 목록 (TASKS.md)

이 문서는 개발 태스크 진행 상황을 관리하는 고수준 체크리스트입니다. 구체적인 태스크 명세 및 구현 가이드는 [docs/task-details.md](docs/task-details.md) 및 [docs/refactoring-plan.md](docs/refactoring-plan.md)를 참고하세요.

---

## 📅 제품 개편 태스크 (Phases 1-4)
* 상세 설명: [docs/task-details.md](docs/task-details.md)

### 🟦 1단계: 코어 인프라 구축 (Dynamic Transposition & Data Layer)
- [x] **A-001**: 정적 책 패턴 데이터 추가 (guitar-chord-recipes.json)
- [x] **A-002**: 동적 전조 엔진 개발 (transpose.js)
- [x] **A-003**: 데이터 저장 레이어 구현 (storage.js)

### 🟨 2단계: 아키텍처 연결 (Adapter & Playback Connection)
- [x] **A-004**: 패턴-송 어댑터 개발 (patternToSong.js)
- [x] **A-005**: 어댑터를 통한 기존 오디오 엔진 연동 (app.js)

### 🟩 3단계: 사용자 경험 개편 (Mobile Practice UI & Player)
- [x] **A-006**: 패턴 라이브러리 UI 구현 (Drawer, Chips)
- [x] **A-007**: 모바일 연습 플레이어 화면 구현 (대형 코드 카드 및 프리뷰)

### 🟥 4단계: 고급 기능 고도화 (Chord Parsing & Synth Expansion)
- [x] **A-008**: 코드 파서 및 chordDb.js 해석 엔진 확장 (슬래시 코드, fallback)
- [x] **A-009**: 피아노 사운드 렌더러 추가 (Rhodes 신스 연동)
- [x] **A-010**: 연습용 특화 기능 부가 (A-B Loop 및 Wake Lock API)

---

## 📅 리팩토링 태스크 (Refactoring Phases)
* 상세 설명: [docs/refactoring-plan.md](docs/refactoring-plan.md)

### 🟪 1단계: 코어 분리 및 상태 모듈화
- [x] **R-001**: DOM 캐시 분리 (`js/ui/dom.js`)
  - [x] `js/ui/dom.js` 파일 생성 및 `dom` 캐시 객체 내보내기 (`export const dom = {...}`)
  - [x] `cacheDOMElements` 전담 함수 정의 및 내보내기
  - [x] `js/app.js`에서 DOM 캐시 선언부 제거 및 신규 모듈 임포트 연동
  - [x] 아이콘 및 초기 DOM 셋팅 연동 상태 복구 검증
- [x] **R-002**: 전역 상태 관리 모듈 구축 (`js/core/state.js` - Pub/Sub 패턴)
  - [x] `js/core/state.js` 파일 생성 및 글로벌 `state` 선언
  - [x] 상태 구독(`subscribe`), 발행(`publish`) 이벤트 처리 메커니즘 구현
  - [x] 핵심 액션(BPM 업데이트, 악기 전환, 플레이 위치 이동, 재생 여부 토글 등) 구현
  - [x] `app.js`의 직관적인 `state.xxx = yyy` 직접 변경부들을 스토어 액션 및 구독 구조로 마이그레이션

### 🟪 2단계: 독립 UI 컴포넌트 분리
- [x] **R-003**: 운지 다이어그램 모듈 추출 (`js/ui/diagram.js`)
  - [x] `js/ui/diagram.js` 파일 생성 및 `drawChordDiagram(chord, container)` 이관
  - [x] 다이어그램 내부 SVG 드로잉 및 눈금 계산 헬퍼 격리
  - [x] `app.js` 및 Chord Picker 모달 등 지판 운지가 필요한 곳에서 임포트 호출 연동
- [x] **R-004**: 패턴 라이브러리 드로어 추출 (`js/ui/library.js`)
  - [x] `js/ui/library.js` 파일 생성 및 드로어 전용 UI 빌더 이관
  - [x] `renderLibraryDrawer`, `renderPatternList`, `openLibraryDrawer`, `closeLibraryDrawer` 이관
  - [x] 카테고리 필터링 칩 렌더링 및 드로어 내 텍스트 검색창 실시간 이벤트 바인딩 격리
- [ ] **R-005**: 코드 선택 모달 추출 (`js/ui/picker.js`)
  - [ ] `js/ui/picker.js` 파일 생성 및 `openPicker`, `closePicker`, `renderPicker` 이관
  - [ ] Root/Quality/Tension/Extension 동적 격자 렌더링 및 Bass Note 아코디언 핸들러 이관
  - [ ] 모달 확인(Confirm) 및 초기화(Clear) 클릭 핸들러 동작 및 상태 동기화 격리

### 🟪 3단계: 코어 뷰 컴포넌트 분리
- [ ] **R-006**: 재생 제어 툴바 추출 (`js/ui/toolbar.js`)
  - [ ] `js/ui/toolbar.js` 파일 생성 및 `renderToolbar`, `updatePositionDisplay` 이관
  - [ ] BPM Input, Up/Down 버튼, 스트로크 셀렉터, 루프 토글 클릭 핸들러 바인딩 이관
  - [ ] 악기 선택기(Guitar vs Piano) 클릭 스위치 동작 연동
- [ ] **R-007**: 연습 포커스 뷰 추출 (`js/ui/practice.js`)
  - [ ] `js/ui/practice.js` 파일 생성 및 `renderFocusView`, `updateFocusViewActiveSlot`, `rebuildFocusTimeline`, `initLoopABOptions` 이관
  - [ ] A-B Loop 시작/종료 마디 변경 핸들러 및 스토어 범위 지정 연동
  - [ ] Wake Lock API 화면 꺼짐 방지 제어 로직(`requestWakeLock`/`releaseWakeLock`/`checkWakeLockSupport`) 이관
- [ ] **R-008**: 그리드 코드 진행 편집기 추출 (`js/ui/editor.js`)
  - [ ] `js/ui/editor.js` 파일 생성 및 `renderEditor`, `addSection`, `removeSection` 이관
  - [ ] 마디 슬롯 클릭 시 코드 선택 모달 호출하는 중재 이벤트 가교 구현

### 🟪 4단계: 진입점 통합 및 검증
- [ ] **R-009**: 메인 `js/app.js` 경량화 및 중재자 역할 축소
  - [ ] 에디터와 픽커, 포커스 뷰 간의 상호 의존성을 `app.js` 또는 `state.js`에서 조율하는 최소한의 바인딩만 보존
  - [ ] 불필요하게 남은 로컬 함수 정리 및 모듈 로딩 시퀀스 최적화 (Target: 150라인 이하)
- [ ] **R-010**: 회귀 테스트 및 정밀 통합 검증
  - [ ] 전조(Transpose) 변경, 저장소 오토세이브, 포크(Fork to Custom) 동작 검증
  - [ ] 모바일 터치 상태에서 A-B 루프 조작 및 Wake Lock 꺼짐 방지 실기기 시뮬레이션 동작 검증
