# Cadence 작업 목록 (TASKS.md)

이 문서는 개정된 [docs/product-reform-plan.md](docs/product-reform-plan.md)의 4단계 구현 계획을 구체적인 개발 태스크로 세분화한 작업 목록입니다.

---

## 📅 단계별 세부 태스크

### 🟦 1단계: 코어 인프라 구축 (Dynamic Transposition & Data Layer)
* [x] **정적 책 패턴 데이터 추가**
  * [x] `static/books` 디렉토리 생성
  * [x] `static/books/guitar-chord-recipes.json` 파일 생성 및 첫 샘플 패턴(`밝은 메이저 진행 (A-01)`) 데이터 입력
* [x] **동적 전조 엔진 (`js/core/transpose.js`) 개발**
  * [x] 12개 근음 리스트 및 반음 인덱스 맵 정의 (`['C', 'C#', 'Db', ..., 'B']`)
  * [x] 단일 코드 전조 함수 `transposeChord(chord, semitones)` 구현 (품질/텐션 유지 및 근음 시프트)
  * [x] 분수 코드(Slash Chord) 슬래시 베이스 노트의 동적 전조 로직 통합
  * [x] 패턴 전체 코드를 타겟 키로 변환하는 `transposePattern(pattern, targetKey)` 함수 구현
* [x] **데이터 저장 레이어 (`js/core/storage.js`) 구현**
  * [x] `app.js`에서 localStorage 저장 책임을 분리하여 `storage.js`로 이관
  * [x] 레거시 `cadence_song` 키 검출 시 `cadence:v1:currentSong`으로 자동 마이그레이션하는 로직 추가
  * [x] 사용자 설정(`settings`), 즐겨찾기(`favorites`), 최근 연습 패턴(`recent`)용 로컬 스토리지 CRUD 인터페이스 구현
  * [x] 내보내기/가져오기(Import/Export) 함수 구현 및 데이터 유효성 스키마 검증기 (`validateImportData`) 구현

---

### 🟨 2단계: 아키텍처 연결 (Adapter & Playback Connection)
* [x] **패턴-송 어댑터 (`js/core/patternToSong.js`) 개발**
  * [x] 패턴 데이터를 기존 플레이백 시스템 구조(`song -> sections -> bars -> slots`)로 맵핑하는 `patternToSong(pattern, key)` 함수 구현
  * [x] 4/4 박자 기준 코드 1개를 2개의 2박자 슬롯(`[Chord, Continue]`)으로 분할하는 변환 로직 설계
  * [x] 쉼표(`—`) 및 예외 코드에 대응하는 예외 처리 헬퍼 추가
* [x] **어댑터를 통한 기존 오디오 엔진 연동**
  * [x] `app.js` 초기화 시 정적 패턴 로드 및 선택된 키에 따라 전조된 데이터를 기존 오디오 재생 엔진에 주입하는 통합 테스트 진행
  * [x] 키 변경 칩(Chip) UI 클릭 시 즉시 전조하여 플레이백 타겟을 실시간 업데이트하는 로직 연동

---

### 🟩 3단계: 사용자 경험 개편 (Mobile Practice UI & Player)
* [x] **패턴 라이브러리 UI 구현**
  * [x] 메인화면 최상단에 패턴 검색, 도서별 필터링, 난이도별 정렬이 가능한 리스트/카드 뷰 추가
  * [x] 패턴 선택 시 상세 정보를 하단 패널에 표시하고 원클릭 로드 연동
* [x] **모바일 연습 플레이어 화면 구현**
  * [x] 폰을 쥔 한 손으로 조작하기 쉽도록 대형 재생/정지/템포 조절 버튼 레이아웃 배치
  * [x] 재생 상태에서 **현재 재생 중인 코드(운지도 포함)**를 가장 크게 중앙 배치하고, **다음 마디에 연주할 코드**를 우측 상단에 미리 보여주는 뷰 컴포넌트 추가
  * [x] 플레이헤드 이동 시 현재 코드 카드의 하이라이트 싱크 맞춤 처리
  * [x] 키 선택 칩 컴포넌트 (`C`, `G`, `E` 등) 배치

---

### 🟥 4단계: 고급 기능 고도화 (Chord Parsing & Synth Expansion)
* [x] **코드 파서 및 `chordDb.js` 해석 엔진 확장**
  * [x] `Cadd9`, `F/A` 등의 텍스트 기반 빠른 입력을 위해 슬래시 코드 파싱 정규식 작성
  * [x] `chordDb`에 정의되지 않은 텐션 코드가 올 경우 동적으로 음정을 연산하는 dynamic fallback 로직 고도화
  * [x] 베이스 분수 노트를 판별하여 오디오 렌더러가 6번/5번 선 최저음을 베이스음으로 연주하도록 음계 매핑 로직 확장
* [x] **피아노 사운드 렌더러 추가 (Rhodes 신디사이저 연동)**
  * [x] WebAudio API의 감쇄 진폭 Envelope 및 다중 Oscillator 기법을 이용한 Rhodes 스타일 피아노 신스 구현
  * [x] 악기 선택 스위처 UI (`Guitar` vs `Piano`) 추가 및 실시간 플레이백 동기화
* [x] **연습용 특화 기능 부가**
  * [x] 특정 마디 구간 반복(A-B Loop) 기능 UI & 재생 엔진 로직 추가
  * [x] 화면 꺼짐 방지 (Wake Lock API) 적용 및 설정 토글 기능 제공
