# 1. Return-Oriented Programming (ROP)
## 1.1 ROP 개요 및 정의
- 실제 함수 대신, 프로그램의 메모리 공간에 존재하는 gadget을 활용해 임의의 동작 수행
- ASLR이나 NXbit 같은 **보안이 활성화**된 상태에서 코드를 실행할 수 있게 함
## 1.2. Gadget and Gadget chaining
### 1.2.1. 가젯의 특징
- `ret` 명령어로 끝나는 짧은 코드 시퀀스
- 기존 프로그램이나 공유 라이브러리 코드 내에 위치함
### 1.2.2. 가젯의 체인 실행 (Chain Execution)
- `ret`은 **스택의 최상단 값으로 점프**하므로, 스택에 **연속된 가젯의 주소를 배치**하여 순차적으로 실행할 수 있음
- **임의의 데이터를 실행 과정에 주입**하는 것도 가능 (예: `popl %eax; ret` 가젯을 사용하여 스택의 다음 값을 레지스터에 저장).
### 1.2.3. 가젯 탐색(ROPgadget)
- x86의 **CISC 특성**으로 인해, 다른 명령어 바이트 안에 가젯이 숨겨져 있을 수 있음 (예: `jmp PC+0xffffc35a`의 바이트 코드 중 일부가 `popl %edx; ret`에 해당).
- 실행 파일 크기가 3MB보다 크면 필요한 모든 가젯을 찾을 가능성이 높습니다.
# 2. Blind Return-Oriented Programming (BROP)
## 2.1 BROP 개요 및 공격 환경
- 공격 대상의 **바이너리 파일이나 소스 코드가 전혀 없는** 상태(Closed-binary and source)에서 Exploit 코드를 작성할 수 있는 기술
- **필수 전제 조건:**
	1. **스택 오버플로우 취약점**
	2. Crash 발생 시 **서비스가 자동으로 재시작** (이를 통해 공격자는 서비스의 반응을 지속적으로 확인하여 공격을 구성합니다).
## 2.2 BROP 단계
### 2.2.1 Stack Overflow 크기 확인
### 2.2.2. STOP Gadget 찾기
- `main()` 함수 또는 취약한 함수를 다시 실행하는 가젯. 즉, stack overflow 전, 후의 메시지가 동일한 것이 이상적.
- `A * SIZE + target address`
### 2.2.3. BROP Gadget 찾기
- 함수에 인자 값을 전달하기 위해 필요한 Gadget
- **pop instruction이 많고 희소성이 있는 Gadget**을 찾는 것이 좋음. 
- 보통 공유 라이브러리에 위치한 `pop rbx; pop rbp; pop r12; pop r13; pop r14; pop r15; ret` 가젯을 찾음.
	- 해당 가젯에서 오프셋 9를 통해 `pop rdi; ret`을 획득할 수 있음
- `A * SIZE + target address + PARAM * 6 + STOP gadget`
### 2.2.4 출력 함수 주소 찾기
- STOP, BROP gadget을 통해 `puts()`와 같은 **출력 함수의 PLT 주소**를 획득
- 리눅스 실행파일은 ELF 구조라 Codebase 부분에 "\x7fELF" 문자열이 있음. target gadget + Codebase를 통해 해당 문자열이 출력되는지 확인하면 됨. 
- `A * SIZE + POP RDI gadget + Codebase + target address`
### 2.2.5 메모리 덤프
- 출력 함수를 이용해 **서비스 프로그램의 바이너리 전체(예: 0x400000 ~ 0x401000 영역)를 덤프**
- 페이로드는 `A * SIZE + POP RDI gadget + target address + PUTS PLT`
### 2.2.6 출력 함수의 GOT 주소 찾기
- r덤프된 바이너리를 분석하여 `puts` 함수의 GOT 주소를 찾음
### 2.2.7 libc 주소 유출
- puts GOT 주소를 `puts@plt`를 이용해 출력하여 **libc 영역의 실제** **puts** **함수 주소**를 유출
- `A * SIZE + POP RDI gadget + PUTS GOT + PUTS PLT`
### 2.2.8 offset 찾기
- libc의 puts 함수 주소를 이용해 `puts`, `system`, `/bin/sh`의 오프셋을 찾음 (`libc-database` 이용 가능)
### 2.2.9 최종 Exploit
- libc base 주소에 offset 주소를 더하여 각 함수를 이용할 수 있음
- `A * SIZE + POP RDI gadget + /bin/sh addr + SYSTEM addr`
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