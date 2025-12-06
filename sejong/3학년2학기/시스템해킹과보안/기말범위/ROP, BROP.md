# 1. Return-Oriented Programming (ROP)
## 1.1 ROP 개요 및 정의
- 실제 함수 대신, 프로그램의 메모리 공간에 존재하는 gadget을 활용해 임의의 동작 수행
- 공격자가 NXbit 및 코드 서명과 같은 보안이 활성화된 상태에서 코드를 실행할 수 있게 함
- RTL(Return-to-libc) + Gadget + Stack Overflow
## 1.2. Gadget and Gadget chaining
### 1.2.1. 가젯의 특징
- `ret` 명령어로 끝나는 짧은 코드 시퀀스
- 기존 프로그램이나 공유 라이브러리 코드 내에 위치함
- 가젯을 체이닝하여 임의의 작업을 수행할 수 있음
### 1.2.2. 가젯의 체인 실행 (Chain Execution)
- `ret`은 스택의 최상단 값으로 점프하므로, 스택에 연속된 가젯의 주소를 배치함으로써, **일련의 가젯들을 순차적으로 연결하여 실행**
- **외부 데이터를 실행 과정에 주입**하는 것도 가능 (예: `popl %eax; ret` 가젯을 사용하여 스택의 다음 값을 레지스터에 저장).
### 1.2.3. 가젯 탐색(ROPgadget)
- x86의 **CISC 특성**으로 인해, 때로는 다른 명령어 바이트 안에 가젯이 숨겨져 있을 수 있음 (예: `jmp PC+0xffffc35a`의 바이트 코드 중 일부가 `popl %edx; ret`에 해당).
- 실행 파일 크기가 3MB보다 크면 필요한 모든 가젯을 찾을 가능성이 높습니다.
# 2. Blind Return-Oriented Programming (BROP)
## 2.1 BROP 개요 및 공격 환경
- 공격 대상의 **바이너리 파일이나 소스 코드가 전혀 없는** 상태(Closed-binary and source)에서 Exploit 코드를 작성할 수 있는 기술
- 주로 독점 네트워크 서비스나 바이너리가 공개되지 않은 오픈 소스 소프트웨어를 공격할 때 유용합니다.
- **필수 전제 조건:**
	1. **스택 오버플로우 취약점**
	2. Crash 발생 시 **서비스가 자동으로 재시작** (이를 통해 공격자는 서비스의 반응을 지속적으로 확인하여 공격을 구성합니다).
	3. ROP Gadget 원격 추출 단계
- **ASLR, NX, Stack Canary**와 같은 현대적인 방어 기법이 적용된 Closed Source 서비스를 공격 가능하게 만드는 기법이라는 의의를 가집니다.
## 2.2 BROP 단계
### 2.2.1. Stop Gadget 찾기
- ROP 체인을 중지하고 프로그램 실행을 다시 시작하게 하여, 공격자가 원격에서 **"NO CRASH" 신호** (예: 프로그램 시작 메시지)를 포착하게 해주는 가젯
- **이상적인 형태:** Stop Gadget은 **Stack Overflow 전, 후의 메시지가 동일한 것**이 가장 이상적입니다. 이는 해당 프로그램을 처음부터 다시 시작하게 하는 주소(예: `_start()` 함수의 시작 주소)이거나, 취약성이 있는 함수의 시작 주소일 수 있습니다.
- **활용:** 조사하고자 하는 target gadget 바로 뒤에 Stop Gadget을 배치하여, target gadget이 유효할 경우 프로그램이 재실행되고 소켓 연결이 유지되는지 확인합니다.
### 2.2.2. BROP Gadget (Blind ROP Gadget) 찾기
- 함수에 인자 값을 전달하기 위해 필요한 Gadget을 찾는 단계
- **특징:** BROP Gadget으로는 **pop instruction이 많고 희소성이 있는 Gadget**을 찾는 것이 좋습니다. 이는 보통 64비트 리눅스에서 호출된 함수가 레지스터를 복원하는 패턴을 보입니다 (예: `pop rbx; pop rbp; pop r12; pop r13; pop r14; pop r15; ret`).
- **유용한 가젯 추출:** BROP Gadget 주소 근처의 특정 오프셋(offset)을 활용하여 **`pop rdi; ret`**와 같이 유용한 레지스터 제어 가젯을 추출할 수 있습니다 (예: BROP Gadget 주소 + 9 오프셋으로 `pop rdi; ret` 획득).
- **검증:** BROP Gadget으로 의심되는 주소에 인자 값을 넣고 **Stop Gadget을 제거**한 채 실행했을 때, 프로세스가 **종료되거나 에러가 발생하면** (Crash), 해당 주소를 BROP Gadget으로 확정합니다.
### 2.2.3 출력 함수 주소 찾기
- BROP 공격을 통해 `write()` 또는 `puts()`와 같은 출력 함수(printable function)의 PLT 주소와 RDI Gadget을 원격으로 획득.
### 2.2.3 메모리 덤프
- 출력 함수를 이용해 **서비스 프로그램의 바이너리 전체(예: 0x400000 ~ 0x401000 영역)를 공격자에게 덤프**
### 2.2.4 libc 주소 유출
- 덤프된 바이너리를 분석하여 `puts` 함수의 GOT 주소를 찾고 (예: 0x601018), 이를 다시 `puts@plt`를 이용해 출력하여 **libc 영역의 실제** **puts** **함수 주소**를 유출합니다.
### 2.2.5 ROP 체이닝
- 유출된 libc 주소와 `libc-database`를 활용하여 `system` 함수 및 `"/bin/sh"` 문자열의 오프셋을 계산한 후, **일반적인 ROP 공격** 체인(`RDI Gadget` -> `"/bin/sh"` 주소 -> `system()` 함수 주소)을 구성하여 셸을 획득합니다.
# 3. 관련 개념 및 용어
## 3.1 ELF (Executable Linkable Format)
-  리눅스 등 Unix 계열에서 사용되는 표준 바이너리 파일 형식
- ELF 헤더는 파일의 맨 앞에 위치하며, ELF 파일임을 표시하기 위해 `\x7fELF`라는 매직 넘버를 사용. 
- No-PIE 파일의 경우 기본 시작 주소는 0x400000으로 고정.
## 3.2 PLT (Procedure Linkage Table)
- 공유 라이브러리 함수를 호출하기 위해 사용되는 코드 스텁 배열입니다. 
- 함수 호출 시 성능 최적화를 위해 처음 호출될 때만 Dynamic Linking
## 3.3 GOT (Global Offset Table)
- 공유 라이브러리 함수의 **실제 메모리 주소**가 저장되는 테이블
- PLT에 의해 참조되며, BROP 공격 시 **GOT에 저장된 실제 libc 주소를 유출**하여 libc의 베이스 주소를 계산하는 데 활용됨.
## 3.4 PIE (Position Independent Executable)
- 실행 파일을 메모리의 어느 주소에 로드해도 실행 가능하게 만드는 보안 기법 
- PIE는 ASLR이 프로그램의 `.text` 세그먼트에도 적용될 수 있게 하여 공격자가 ROP 가젯 주소를 예측하기 어렵게 만듬.