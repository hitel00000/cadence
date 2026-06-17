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
- [ ] **R-001**: DOM 캐시 분리 (`js/ui/dom.js`)
- [ ] **R-002**: 전역 상태 관리 모듈 구축 (`js/core/state.js` - Pub/Sub 패턴)

### 🟪 2단계: 독립 UI 컴포넌트 분리
- [ ] **R-003**: 운지 다이어그램 모듈 추출 (`js/ui/diagram.js`)
- [ ] **R-004**: 패턴 라이브러리 드로어 추출 (`js/ui/library.js`)
- [ ] **R-005**: 코드 선택 모달 추출 (`js/ui/picker.js`)

### 🟪 3단계: 코어 뷰 컴포넌트 분리
- [ ] **R-006**: 재생 제어 툴바 추출 (`js/ui/toolbar.js`)
- [ ] **R-007**: 연습 포커스 뷰 추출 (`js/ui/practice.js`)
- [ ] **R-008**: 그리드 코드 진행 편집기 추출 (`js/ui/editor.js`)

### 🟪 4단계: 진입점 통합 및 검증
- [ ] **R-009**: 메인 `js/app.js` 경량화 및 중재자 역할 축소
- [ ] **R-010**: 회귀 테스트 및 정밀 통합 검증
