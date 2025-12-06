> [!Note] 
> 솔라리스 11(Solaris 11) 환경을 기준으로 함.
# 1. 계정 관리 (Account Management)
## 1.1. 중복된 루트(Root) 계정 확인
- **핵심:** `/etc/passwd` 파일에서 UID나 GID가 '0'인 계정이 있는지 확인해야 함.
    - UID 0은 슈퍼유저(Super-User) 권한을 의미함.
- **확인 명령어:** `grep ':0:' /etc/passwd`
    - 결과에 `root` 외에 다른 계정이 UID 0을 가지고 있다면 보안상 위험할 수 있음.
## 1.2. 관리자 계정 생성 및 관리 실습
1. **계정 생성:** `useradd [계정명]` (예: `useradd wish`)
2. **UID 변조 (실습용):**
    - `/etc/passwd` 파일을 편집하여 일반 계정의 UID를 0으로 수정함.
    - 결과: 해당 계정은 루트 권한을 갖게 됨. (예: `wish:x:0:10:...`)
3. **비밀번호 설정:** `passwd [계정명]`
4. **확인:**
    - `su [계정명]`으로 로그인 후 `id` 명령어를 치면 `uid=0(root)`로 표시됨을 확인할 수 있음.
## 1.3. 쉘(Shell) 관리
- **불필요한 계정의 쉘 제거:**
    - 로그인이 필요 없는 계정(시스템 계정 등)의 쉘을 `/bin/false`로 변경하여 로그인을 차단해야 함.
    - **설정 파일:** `/etc/passwd`
    - 예: `/bin/bash` → `/bin/false`
    - **효과:** 해당 계정으로 `su` 명령어를 시도하면 로그인되지 않고 튕겨 나감.
## 1.4. 패스워드 정책 (Password Policy)
- **설정 파일:** `/etc/shadow`
- **설정 항목:**
    - 마지막으로 비밀번호를 변경한 날짜
    - 비밀번호 변경 전 최소 기간
    - 비밀번호 변경 전 최대 기간 (만료 기간)
    - 비밀번호 만료 전 경고 날짜
# 2. 데몬 관리 (Daemon Management)
## 2.1. inetd 데몬 (Super Daemon)
- **역할:** 텔넷(Telnet), FTP 등의 클라이언트 요청을 감지하고, 해당 서비스를 연결해 주는 '중계자' 역할을 함.
- **작동 방식:**
    1. 클라이언트가 접속 요청.
    2. `inetd`가 요청을 받음.
    3. `/etc/inetd.conf` 및 `/etc/services` 설정을 참조하여 실제 서버 데몬(Telnet Server 등)을 실행 및 연결.
- **보안 포인트:**
    - `/etc/services`: 포트 번호 정의 파일. 포트를 주석 처리하면 서비스 접근 불가.
    - `/etc/inetd.conf` (Solaris 9 이하): 서비스 실행 여부 설정.
## 2.2. Solaris 11에서의 inetd 관리
- **inetadm:** inetd 서비스를 관리하는 명령어.
    - `inetadm`: 현재 활성화(enabled)/비활성화(disabled)된 서비스 목록 출력.
    - `inetadm -?`: 사용법 출력.
    - `inetadm -p`: 기본 inetd 속성 값 출력 (tcp_wrappers 설정 확인 가능).
    - `inetadm -l [FMRI]`: 특정 서비스의 속성 확인.
    - `inetadm -e [FMRI]`: 서비스 활성화 (Enable).
    - `inetadm -d [FMRI]`: 서비스 비활성화 (Disable).
    - `inetadm -m [FMRI] [name=value]`: 서비스 속성 수정.
- **svcadm:** 서비스 상태 관리 (재시작 등).
## 2.3. RPC (Remote Procedure Call)
- **포트:** 111 (sunrpc)
- **구조:**
    - 클라이언트가 RPC 서버(port 111)에 접속하여 사용하려는 서비스의 포트를 물어봄.
    - 서버가 할당된 포트를 알려주면 클라이언트가 해당 포트로 재접속.
- **확인 명령어:** `rpcinfo` (실행 중인 RPC 정보 확인).
- **취약점:** 원격 버퍼 오버플로우(Remote Buffer Overflow) 취약점이 존재할 수 있음. 불필요시 반드시 비활성화해야 함.
## 2.4. 주요 데몬별 보안 설정
불필요한 서비스는 보안을 위해 중지시켜야 함.
1. **Echo (7), Discard (9), Daytime (13):**
    - Echo: 받은 데이터를 그대로 돌려줌 (Ping과 유사).
    - Discard: 데이터를 받으면 폐기함 (Sink null).
    - Daytime: 현재 날짜와 시간을 알려줌.
    - **조치:** 불필요한 서비스이므로 비활성화 권장.
2. **Chargen (19):**
    - 연결 시 무작위 문자열을 계속 보냄. DoS 공격 등에 악용될 소지 있음.
3. **SMTP (25) - Sendmail:**
    - 메일 전송 프로토콜.
    - **취약점:** `EXPN`(Expansion) 및 `VRFY`(Verify) 명령어를 통해 계정 존재 여부 확인 가능 (정보 유출).
    - **조치:** 설정 파일(`/etc/mail/sendmail.cf`)에서 `PrivacyOptions`에 `noexpn`, `novrfy` 옵션을 추가하고 데몬 재시작.
4. **Time (37):**
    - 시스템 간 시간 동기화 프로토콜 (사용자용 아님).
5. **TFTP (69):**
    - FTP의 단순화 버전.
    - **위험성:** 계정/비밀번호 인증 과정이 없음. 누구나 접근 가능. `/etc/passwd` 같은 중요 파일 유출 위험.
6. **Finger (79):**
    - 접속한 사용자 정보(로그인 시간, 계정명, 홈 디렉터리 등) 확인 가능.
    - 해커의 정보 수집 도구로 악용되므로 비활성화 권장.
7. **SNMP (161):**
    - 네트워크 관리 시스템(NMS)에서 주로 사용.
    - 시스템의 많은 정보(MIB)를 제공하므로 불필요 시 비활성화.
8. **R-series (Exec 512, Login 513, Shell 514):**
    - `rexec`, `rlogin`, `rsh` 등.
    - 인증 없이 신뢰 관계(Trust)를 기반으로 원격 명령 실행 가능.
    - 보안상 매우 취약하므로 사용 지양 (SSH로 대체 권장).
9. **X11 (XDMCP 6000):**
    - 원격 GUI 환경 제공. 보안상 위험할 수 있음.
# 3. 접근 제어 (Access Control) - TCP Wrapper
## 3.1. TCP Wrapper 개요
- **기능:** `inetd` 데몬이 관리하는 서비스들에 대해 호스트 기반의 접근 제어(IP 차단/허용) 및 로그 기록을 제공함.
- **작동 원리:** `inetd`가 요청을 받으면 바로 서비스로 넘기지 않고 `tcpd` 데몬에게 먼저 넘김. `tcpd`가 허용 여부를 검사한 후 통과시키거나 차단함.
## 3.2. 설정 방법
1. **inetd 설정 확인 및 변경:**
    - Solaris 9 이하: `/etc/inetd.conf`에서 실행 경로를 `/usr/sbin/in.telnetd` 대신 `/usr/sfw/sbin/tcpd`로 변경해야 했음.
    - **Solaris 11:** `inetadm -p`로 확인 후 `tcp_wrappers=FALSE`라면 `inetadm -M tcp_wrappers=TRUE` 명령어로 활성화해야 함.
2. **접근 제어 파일:**
    - `/etc/hosts.allow`: 허용할 목록.
    - `/etc/hosts.deny`: 차단할 목록.
    - **문법:** `데몬리스트 : 클라이언트리스트` (예: `sshd : 192.168.40.1`)
    - **우선순위:** `hosts.allow`를 먼저 참조하고, 없으면 `hosts.deny`를 참조함.
    - **보안 권장 설정:** `hosts.deny`에 `ALL:ALL` (모두 차단)을 넣고, `hosts.allow`에 필요한 IP만 등록하는 방식(Whitelist) 사용.
## 3.3. 검증 도구
- **tcpdchk:** 설정 파일(`hosts.allow`, `hosts.deny`)의 문법 오류 검사.
- **tcpdmatch:** 특정 IP와 데몬에 대해 접근이 허용되는지 차단되는지 시뮬레이션.
    - 예: `tcpdmatch sshd 192.168.40.1`
# 4. 파일 및 디렉터리 관리 (File and Directory Management)
중요 시스템 파일 및 디렉터리에 적절한 권한(Permission)을 설정해야 함.
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
- **Solaris 11 업데이트:**
    - 명령어가 매우 간단해짐.
    - **명령어:** `pkg update`
    - 시스템 패키지를 최신 상태로 유지하여 보안 취약점을 패치해야 함.