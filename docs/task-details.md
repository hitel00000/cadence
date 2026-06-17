# Cadence 단계별 세부 구현 명세서 (Task Details Archive)

이 문서는 [TASKS.md](../TASKS.md)에 간략히 나열된 **제품 개편 태스크 (A-001 ~ A-010)**의 구체적인 세부 구현 내용과 체크리스트를 보관하는 문서입니다.

---

## 🟦 1단계: 코어 인프라 구축 (Dynamic Transposition & Data Layer)

### A-001: 정적 책 패턴 데이터 추가
* `static/books` 디렉토리 생성 및 `static/books/guitar-chord-recipes.json` 파일 생성.
* 저작권 문제를 우려하여 도서명을 직접 사용하는 대신 제네릭 용어인 `기타 코드 레시피 (연습용)`로 변경.
* 첫 샘플 패턴인 `밝은 메이저 진행 (A-01)` 데이터 입력:
  - 구성: 4/4 박자, 4마디(Bar)로 이루어진 코드 리스트.

### A-002: 동적 전조 엔진 개발 (`js/core/transpose.js`)
* 12개 근음 리스트 및 올림/내림조 반음 인덱스 맵 정의 (`['C', 'C#', 'Db', ..., 'B']`).
* 단일 코드 전조 함수 `transposeChord(chord, semitones)` 구현:
  - 근음(Root)과 분수 코드의 베이스음(Slash Bass)을 개별로 계산해 음계를 이동.
  - 마이너/세븐/텐션 등 기존 코드 품질(Quality)을 온전히 보존.
* 패턴 전체를 한 번에 특정 키(Target Key)로 바꾸는 `transposePattern(pattern, targetKey)` 함수 구현.

### A-003: 데이터 저장 레이어 구현 (`js/core/storage.js`)
* `app.js`에 산재되어 있던 localStorage 입출력 기능을 분리하여 전담 레이어 구현.
* 레거시 키 `cadence_song`을 감지할 경우 신규 스키마 `cadence:v1:currentSong`으로 자동 구조 이전(Migration)하는 로직 탑재.
* 사용자 설정(`settings`), 즐겨찾기(`favorites`), 연습 기록(`recent`)에 대한 로컬 CRUD 구현.
* 외부 JSON 불러오기/내보내기 시 앱 크래시 방지를 위한 데이터 유효성 검증 함수 `validateImportData` 구현.

---

## 🟨 2단계: 아키텍처 연결 (Adapter & Playback Connection)

### A-004: 패턴-송 어댑터 개발 (`js/core/patternToSong.js`)
* 로드된 패턴 JSON 데이터를 기존의 4/4 시퀀서 형식(`sections -> bars -> slots`)으로 변환하는 `patternToSong` 어댑터 구현.
* 4박자짜리 한 마디 안의 코드를 2박씩 쪼개 2개의 슬롯(`[코드, Continue(↳)]`)으로 구성하는 맵핑 로직 설계.
* 쉼표(`—`) 혹은 비어 있는 운지 데이터에 대한 처리 예외 헬퍼 포함.

### A-005: 어댑터를 통한 기존 오디오 엔진 연동 (`js/app.js`)
* 키 선택 칩(`C`, `G`, `E` 등)을 누르면 즉시 새로운 키로 전조하여 기존 오디오 재생 엔진에 동적으로 송(Song) 구조를 주입하도록 연동.
* 책 패턴을 연주하던 중 코드 편집이나 마디 추가/삭제 시 자동으로 "내 자유 연주곡"으로 복제 및 저장(Fork to Custom)하여 연습 유실을 막는 로직 탑재.

---

## 🟩 3단계: 사용자 경험 개편 (Mobile Practice UI & Player)

### A-006: 패턴 라이브러리 UI 구현
* 메인 화면 좌측 상단에 📖 패턴 라이브러리 드로어 시트(`library-drawer`)를 구성.
* 카테고리 칩 필터링 및 실시간 텍스트 검색창을 연동하여 모바일 화면에서도 직관적으로 도서를 탐색하고 원클릭 로드할 수 있도록 UI 배치.

### A-007: 모바일 연습 플레이어 화면 구현
* 모바일 세로 모드에 특화된 포커스 모드(`practice-focus-view`) 구현.
* 한 손 조작을 위한 대형 재생/정지/템포 조절 툴바 배치.
* 중앙에 초대형 현재 코드 다이어그램 카드를 노출하고, 우측 상단에 다음 마디에 올 코드를 작게 미리 보여주는 뷰 컴포넌트 추가.
* 하단에 전체 코드 진행을 미니 칩 목록으로 렌더링하고, 현재 연주 중인 코드에 테두리 하이라이트 싱크 동기화.

---

## 🟥 4단계: 고급 기능 고도화 (Chord Parsing & Synth Expansion)

### A-008: 코드 파서 및 `chordDb.js` 해석 엔진 확장
* 슬래시 코드(Slash Chord, 예: `F/A`) 파싱 기능 및 최저음 기타 6번/5번 선에 맞춰 실제 MIDI 베이스 노트를 덮어씌우는 Heuristic 매핑 패치.
* 운지 데이터베이스(`chordDb`)에 존재하지 않는 텐션 코드(`sus2`, `sus4`, `7`, `maj7`, `9`, `11`, `13` 등)가 입력될 때 근음과의 상대적 반음 간격을 자동 연산하는 fallback 운지 생성 알고리즘 구현.

### A-009: 피아노 사운드 렌더러 추가
* Web Audio API의 다중 오실레이터(Sine 및 Triangle 파형 혼합) 및 지수형 진폭 엔벨로프(Envelope)를 활용하여 Rhodes 스타일의 일렉트릭 피아노 사운드 렌더러 구현.
* 툴바 내에 `🎸 Guitar / 🎹 Piano` 전환 버튼([index.html](../index.html))을 추가하고 연주 도중 소스 핫스왑 지원.

### A-010: 연습용 특화 기능 부가 (A-B Loop 및 Wake Lock API)
* 연습 모드 내 구간 반복(A-B Loop)을 시작 마디와 종료 마디 셀렉터로 제한하여 훈련 효과 극대화. (드롭다운 조작 시 렌더러 충돌 및 포커스 유실 현상 완전 수정)
* 화면 꺼짐 방지(Wake Lock API) 기능을 연습 모드 💡 토글 버튼으로 연동하여 기타 연주 시 화면 슬립 방지. 미지원 브라우저의 경우 버튼 비활성화 및 마우스오버 툴팁 안내 제공.
