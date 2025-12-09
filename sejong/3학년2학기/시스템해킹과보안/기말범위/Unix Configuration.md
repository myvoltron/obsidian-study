# 1. 계정 관리 (Account Management)
## 1.1. 중복된 루트(Root) 계정 확인
- **핵심:** `/etc/passwd` 파일에서 UID나 GID가 '0'인 계정이 있는지 확인해야 함.
- **확인 명령어:** `grep ':0:' /etc/passwd`
    - 결과에 `root` 외에 다른 계정이 UID 0을 가지고 있다면 보안상 위험
## 1.2. 관리자 계정 생성
- root 계정을 다른 이름으로 바꾸는 게 좋음.
1. **계정 생성:** `useradd [계정명]` (예: `useradd wish`)
2. **UID 변조 (실습용):**
    - `/etc/passwd` 파일을 편집하여 일반 계정의 UID를 0으로 수정함.
    - 결과: 해당 계정은 루트 권한을 갖게 됨. (예: `wish:x:0:10:...`)
3. **비밀번호 설정:** `passwd [계정명]`
4. **확인:**
    - `su [계정명]`으로 로그인 후 `id` 명령어를 치면 `uid=0(root)`로 표시됨을 확인할 수 있음.
## 1.3. 쉘(Shell) 관리
- **불필요한 계정의 쉘**을 `/bin/false`로 변경하여 **로그인을 차단**해야 함. (`/etc/passwd`)
## 1.4. 패스워드 정책
- **설정 파일:** `/etc/shadow`
- **설정 항목:**
    - 마지막으로 비밀번호를 변경한 날짜
    - 비밀번호 변경 전 최소 기간
    - 비밀번호 변경 전 최대 기간 (만료 기간)
    - 비밀번호 만료 전 경고 날짜
# 2. 데몬 관리 (Daemon Management)
## 2.1. **inetd** 데몬 (Super Daemon)
![[Pasted image 20251209133458.png|400]]
- **역할:** 텔넷(Telnet), FTP 등의 클라이언트 요청을 감지하고, 해당 서비스를 연결해 주는 '중계자' 역할을 함.
- **작동 방식:**
    1. 클라이언트가 접속 요청.
    2. `inetd`가 요청을 받음.
    3. `/etc/inetd.conf` 및 `/etc/services` 설정을 참조하여 실제 서버 데몬(Telnet Server 등)을 실행 및 연결.
### 2.1.1 `/etc/services`
![[Pasted image 20251209133909.png|400]]
- 포트 번호 정의 파일. 포트를 주석 처리하면 서비스 접근 불가.
### 2.1.2 `/etc/inetd.conf`
![[Pasted image 20251209133941.png]]
- `/etc/inetd.conf` (Solaris 9 이하): 서비스 실행 여부 설정.
- standalone 모드: inetd 데몬을 통하지 않고 수행되는 서비스. ex) http 데몬
	- `/etc/rc3.d`에서 확인 가능.
1. Service: 데몬 이름, `/etc/services`에 정의됨.
2. Socket Type: `stream` -> TCP, `dgram` -> UDP
3. Protocol: protocol 번호는 `/etc/protocols`에 정의됨. TCP는 6!
4. Standby Setting(대기 설정): inetd가 요청을 받았을 때, 또 다른 요청을 처리할지 여부에 따라 `nowait`, `wait`으로 구분. TCP *must* be `nowait`!! 
5. Login name: 데몬을 어떤 사용자 권한으로 수행할지 명시 -> root ㄴㄴ
6. Server: 서비스 실행을 위한 프로그램의 절대 경로
7. Argument: 데몬 실행을 위한 인자.
## 2.2. inetd 관리 in Solaris 11
- `inetadm`: inetd 서비스를 관리하는 명령어.
    - `inetadm`: 관련 서비스 목록 출력.
    - `inetadm -?`: 사용법 출력.
    - `inetadm -p`: 기본 inetd 속성 값 출력 (tcp_wrappers 설정 확인 가능).
    - `inetadm -l [FMRI]`: 특정 서비스의 속성 확인.
    - `inetadm -e [FMRI]`: 서비스 활성화 (Enable).
    - `inetadm -d [FMRI]`: 서비스 비활성화 (Disable).
    - `inetadm -m [FMRI] [name=value]`: 서비스 속성 수정.
- **svcadm:** 서비스 상태 관리 (재시작 등).
## 2.3 주요 데몬 보안 설정
- Solaris 11 설치 이후 NMAP으로 포트 스캐닝시 ssh, rpcbind 밖에 없음. -> 제한적 제공!
### 2.3.1 SSH(22)
- 텔넷 + 암호화
- **연결과 인증**: RSA
- **통신 암호화**: Blowfish, DES, 3DES, RC4
### 2.3.2 SUNRPC(111)
- 클라이언트가 RPC 서버에 접속하여 사용하려는 서비스의 포트를 물어봄
- 서버가 할당된 포트를 알려주면 클라이언트가 해당 포트로 재접속.
- **확인 명령어:** `rpcinfo` (실행 중인 RPC 정보 확인).
- **취약점**: 원격 버퍼 오버플로우(Remote Buffer Overflow) 취약점이 존재할 수 있음. 불필요시 반드시 비활성화해야 함.
## 2.4. 그 외 데몬 보안 설정
- *불필요한 서비스는 보안을 위해 중지시켜야 함*
1. **Echo**(7): 받은 데이터를 그대로 돌려줌 (Ping과 유사)
2. **Discard**(9): 데이터를 받으면 폐기함 (Sink null).
3. **Daytime**(13): 현재 날짜와 시간을 알려줌.
4. **Chargen**(19): 연결 시 무작위 문자열을 보냄.
5. **SMTP**(25)
	- 메일 전송 프로토콜.
	- **취약점:** `EXPN`(Expansion) 및 `VRFY`(Verify) 명령어를 통해 계정 존재 여부 확인 가능 (정보 유출).
	- **조치:** 설정 파일(`/etc/mail/sendmail.cf`)에서 `O PrivacyOptions`에 `noexpn`, `novrfy` 옵션을 추가하고 데몬 재시작.
6. **TIME**(37): 시스템 간 시간 동기화 프로토콜 (사용자용 아님).
7. **TFTP**(69)
	- FTP의 단순화 버전.
	- **위험성:** 계정/비밀번호 인증 과정이 없음. 누구나 접근 가능. 
	- `get /etc/passwd`
8. **finger**(79)
	- 접속한 사용자 정보(로그인 시간 등) 확인 가능.
9. **SNMP**(161)
	- 네트워크 관리 시스템(NMS)에서 주로 사용.
	- 시스템의 많은 정보를 제공하므로 불필요 시 비활성화.
10. **Exec**(512), **Login**(513), **Shell**(514)
	- 인증 없이 신뢰 관계(Trust)를 기반으로 원격 명령 실행 가능.
	- 보안상 매우 취약하므로 사용 지양 (SSH로 대체 권장).
11. **XDMCP**(6000)
	- 원격 GUI 환경 제공. 보안상 위험할 수 있음.
# 3. 접근 제어 (Access Control) - TCP Wrapper
![[Pasted image 20251209142146.png|500]]
## 3.1. TCP Wrapper 개요
- `inetd`가 요청을 받으면 바로 서비스로 넘기지 않고 `tcpd` 데몬에게 먼저 넘김. 
- `tcpd`가 허용 여부를 검사한 후 통과시키거나 차단함. 
- 연결에 대한 로깅까지 수행
## 3.2. 설정 방법
### 3.2.1 TCP Wrapper 활성화
- Solaris 9 이하: `/etc/inetd.conf`에서 `/usr/sbin/in.telnetd` 대신 `/usr/sfw/sbin/tcpd`로 변경
- **Solaris 11:** `inetadm -p`로 확인 후 `tcp_wrappers=FALSE`라면 `inetadm -M tcp_wrappers=TRUE` 명령어로 활성화
### 3.2.2 접근 제어 설정
- `/etc/hosts.allow`: 허용할 목록.
- `/etc/hosts.deny`: 차단할 목록.
- 우선순위? **allow > deny**
- **문법:** `데몬리스트 : 클라이언트리스트` (예: `sshd : 192.168.40.1`)
### 3.2.3. 접근 제어 설정 검증
- **tcpdchk:** 설정 파일(`hosts.allow`, `hosts.deny`)의 문법 오류 검사.
- **tcpdmatch:** 특정 IP와 데몬에 대해 접근이 허용되는지 차단되는지 시뮬레이션.
    - 예: `tcpdmatch sshd 192.168.40.1`
# 4. 파일 및 디렉터리 관리 (File and Directory Management)
- 중요 시스템 파일 및 디렉터리에 적절한 권한(Permission)을 설정해야 함.
- **주요 권한 설정 권장사항:**
    - `/etc`: 751 (d rwx r-x --x) - 일반 사용자의 쓰기 제한.
    - `/bin`, `/sbin`, `/usr/bin`: 751 또는 771 - 실행 파일 보호.
    - `/var/log`: 751 - 로그 파일 보호.
    - **매우 중요한 보안 파일 (소유자만 읽기/쓰기 가능해야 함 - 600 또는 640):**
        - `/etc/shadow` (600): 패스워드 해시 저장.
        - `/etc/ftpusers` (600): FTP 접근 제한 계정 목록.
        - `/etc/hosts.allow`, `/etc/hosts.deny` (600)
        - `/etc/securetty` (600)
        - `/etc/inetd.conf` (600)
        - `/etc/syslog.conf` (640)
        - `/var/log/messages` (640)
    - **일반 공개 파일 (644):**
        - `/etc/passwd`: 누구나 읽을 수 있어야 로그인 가능 (쓰기는 관리자만).
        - `/etc/hosts`.
# 5. 업데이트 (Update)
- **Solaris 11 업데이트:** `pkg update`
    - 시스템 패키지를 최신 상태로 유지하여 보안 취약점을 패치해야 함.