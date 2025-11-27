# 1. 퍼징(Fuzzing) 이론

## 1.1. 정의
- '퍼즈 테스팅'이라고도 하며, **소프트웨어 대상**에게 무작위 또는 반 무작위 값을 입력하여 상태를 모니터링하여 버그를 탐지하는 목적.
- 탐지된 버그는 취약점으로 이어질 수 있음 -> 시스템 권한을 획득
# 2. 퍼징의 분류
- 필요 정보, 대상 그리고 입력 값 생성 방식에 따라서 분류할 수 있음.
## 2.1 필요정보에 따른 분류
### 2.1.1 블랙박스 (Sulley, Boofuzz, Peach)
- 일반적인 퍼징을 칭하며, 무작위 또는 반무작위된 입력 값을 대상에 입력하고 모니터링하는 방식 (입력과 출력만을 관찰)
- brute-force 취약점 탐지기라고도 불림
- 장점: Easy to Use, 사전 작업 필요 X
- 단점: 낮은 코드 커버리지, 무의미한 시도 많음
### 2.1.2 화이트박스 (Driller, QSYM, T-Fuzz)
- 대상의 내부 구조 정보와 실행 정보 등 프로그램 전반에 대한 정보를 바탕으로 퍼징 수행 ex) Symbolic Execution
- 장점: 코드 커버리지가 넓고, 효과적임
- 단점: 사전 정보 수집이 필요, 제약 조건 해결기 필요, 제약 조건 해결을 위한 state explosion 문제 
### 2.1.3 그레이박스 퍼징 (AFL, libFuzzer, VUzzer)
- 블랙박스와 화이트박스의 중간 접근법. 퍼징을 수행하면서 대상 내부의 일부 정보를 이용함.
- 화이트 박스 퍼징과 다르게 대상 내부의 전체 의미를 추론하지 않음
- 즉, 가벼운 정적 분석을 수행함.
- 장점: 중간 접근법이므로 구현에 따라 효율적인 퍼징이 가능. 블랙박스보다 효율적!
- 단점: 블랙박스 퍼징보다 오버헤드가 많음
## 2.2 테스트케이스 생성 방법에 따른 분류
### 2.2.1 Generation-based Fuzzing (Smart Fuzzing)
- 퍼징을 수행할 대상에 대한 포맷이나 명세를 해석함으로써 잘 형성된 입력 값 생성
- 장점: 정의되어 있는 ruleset에 따라 입력값이 생성되므로 완벽성이 있고, 대상에 Checksum과 같은 복잡한 의존성이 있는 경우에도 해결 가능
- 단점: 명세를 작성하기 위한 분석시간이 필요, 사용자가 작성한 명세의 품질에 따라 퍼징 성능에 대한 의존성이 있음
### 2.2.2 Mutation-based Fuzzing
- 초기 입력 값(seed)를 변형하는 방식으로 계속적인 테스트케이스를 생성하는 방식 
- ex) bit-flipping, arithmetic inc/dec, random bytes
- 장점: 퍼징 환경 설정과 자동화가 용이
- 단점: 초기 입력 값이 제한적이면 대상의 Checksum이나 다른 검사들로 인해 깊은 탐색이 어려워질 수 있음
## 2.3 대상에 따른 분류
- 네트워크 퍼징, 파일 퍼징, 커널 퍼징 등
# 3. 퍼징 수행 6단계
## 3.1 Identifying Interfaces
- 외부의 입력을 받을 수 있는 모든 인터페이스를 식별해야함. ex) socket, formatted files...
- 이는 테스트 커버리지를 증가시키는 원인임.
## 3.2 Input Generation
- fuzzed input을 만드는 것이 가장 중심. protocol이나 구조에 대한 높은 이해도가 있을 수록 더 좋은 input을 만들 수 있음.
### 3.2.1 Random data
- 프로그램에 대해 가능한 모든 입력에 대한 결과를 도출할 수 있으나, 시간이 오래 걸림.
### 3.2.2 mutation-based approach
- 시스템에 대해 유효한 입력을 모아서 이 입력들을 변조시킴.
	- random 하게 변조
	- 프로토콜 기반으로 변조
### 3.2.3 Generation-based Fuzzers (Peach, SPIKE, Sulley)
- 유효한 테스트 케이스 필요 X, 프로토콜이나 입력 형식에 대한 정보는 필요함.
- . . .
## 3.3 Sending Inputs to the target
- 특정 Fuzzers는 사용자가 이 작업을 하게 함.
- Network protocols: 반복적으로 target server에 대한 connection을 만듦.
- File format: 반복적으로 fuzzed file로 target application을 실행함.
## 3.4 Target Monitoring
- 
## 3.5 Exception Analysis
- 발견된 Crash나 에러 조건에서 버그를 발생시키는 가장 작은 입력 시퀀스를 발견할 수 있음
- 유일한 버그를 구별함.
	- 
## 3.6 Reporting
- 개발팀에 발견된 버그를 보고
- client에 문서 제공
- 특정 Fuzzer들은 통계, 그래픽, 예제 코드 등을 제공.
# 4. AFL (American Fuzzy Lop) 개요
- **그레이박스 퍼저**
- **커버리지 기반(Coverage-guided):** 변형된 입력 값이 새로운 코드 실행 경로(Path)를 발견하면, 해당 입력을 큐(Queue)에 저장하여 다음 변이의 재료로 씁니다. 이 과정을 통해 효율적으로 코드 커버리지를 넓혀갑니다
## 4.1 주요 구성 요소
- `afl-fuzz`: 실제 퍼징을 수행하는 핵심 도구.
- `afl-gcc`: 소스 코드를 컴파일할 때 사용하는 래퍼(Wrapper). 컴파일 과정에서 계측(Instrumentation) 코드를 삽입
- `afl-analyze`: 파일 포맷 분석기.
- `afl-cmin`, `afl-tmin`: 테스트 케이스 중복 제거 및 최소화 도구.
## 4.2 결과 모니터링 및 분석
- **UI 화면:** 실행 시 대시보드가 나타나며 `Process timing`, `Stage progress`, `Total crashes` 등의 정보를 보여줌.
- **결과 폴더:** 작업 디렉토리 내에 다음과 같은 폴더가 생성됨
    - `queue`: 코드 커버리지를 높인 유의미한 입력값들
    - `hangs`: 타임아웃(응답 없음)을 유발한 입력값들
    - **`crashes`**: 프로그램 충돌을 일으킨 입력값들 (**핵심 분석 대상**)