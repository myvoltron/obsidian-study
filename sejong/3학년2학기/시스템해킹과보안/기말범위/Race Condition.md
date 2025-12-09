# 1. 개요
- 프로세스 또는 스레드 간에 자원을 사용하기 위한 경쟁
- "관리자 권한"으로 생성되고 사용되는 **임시 파일**에 대한 치환(Substitution, 끼워넣기)을 이용해 공격.
## 1.1. TOCTTOU(Time-of-Check-to-Time-of-Use)
- 소프트웨어에서 **리소스의 상태를 확인하는 시간**(Time-of-Check)과 **실제 리소스를 사용하는 시간**(Time-of-Use) 사이에 공격자가 해당 리소스를 변경하여 **상태 확인을 우회**하는 방식
- -> 리소스가 예기치 않은 상태로 변경되어 소프트웨어가 잘못된 작업을 수행
# 2. 하드 링크와 심볼릭 링크
## 2.1 하드 링크 (Hard Link)
- **개념**: 원본 파일과 **동일한 Inode**를 공유함. (이름만 다른 '같은 파일'임)
- **동기화**: 물리적인 **데이터 블록**을 같이 쓰기 때문에 내용을 수정하면 양쪽 다 바뀜.
- **삭제 로직**: 파일을 지워도 **링크 카운트**만 1 줄어듦. (카운트가 0이 되어야 디스크에서 실제 데이터가 날아감)
- **제약**: Inode는 파티션 단위로 관리되므로, **같은 파티션** 내에서만 생성 가능함.
## 2.2 심볼릭 링크 (Symbolic Link)
- **개념**: 원본 파일의 **경로**만 저장된 별도의 파일임. (새로운 Inode를 가짐)
- **의존성**: 원본 파일이 삭제되면 연결이 끊겨서 **사용 불가(Dangling Link)** 상태가 됨.
- **생성**: `ln -s` 옵션 필수. (`-s`는 **S**oft Link라고 외우면 편함)
- **특징**: 단순히 경로만 가리키므로 **다른 파티션**이나 디렉터리도 자유롭게 링크 가능함.
# 3. 심볼릭 링크와 Race Condition 공격
## 3.1 Requirements
- 소유자가 root, SetUID 비트, 파일 상태 확인과 사용을 모두 **파일 경로 문자열**로 수행하는 프로그램
## 3.2 `vuln.c`
```c
#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>
#include <fcntl.h>

void main()
{
    int fd;
    char *file = "./file";
    char buffer[]="Success!! Race Condition : lazenca.0x0\n";
    
    if (!access(file, W_OK)) {
        printf("Able to open file %s.\n",file);
        fd = open(file, O_WRONLY);
        write(fd, buffer, sizeof(buffer));
        close(fd);
    } else{
        //printf("Unable to open file %s.\n",file);
    }
}
```
- `access()` 와 `open()` 함수는 FD 대신에 파일 이름을 사용함. 따라서 `access`에 전달된 파일과 `open`에 전달된 파일이 동일하다고 보장할 수 없음!!
- 따라서 공격자가 `access` 함수 호출 뒤에 심볼릭 링크로 파일을 변경하면 `open` 함수에 의해 다른 파일을 수정하게 됨.
### 3.2.1 정상적인 프로그램 실행 절차
![[Pasted image 20251209164255.png]]
1. `access()` 함수를 이용하여 쓰기가 가능한지 확인
2. 쓰기가 가능하다면 `open()`, `write()` 함수를 이용하여 파일을 읽고 내용을 작성
- 2단계와 3단계 사이에 race condition 공격!!
### 3.2.2 `attack.c`
```c
#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>

void main()
{
    unlink("file");
    symlink("./etc/passwd", "file");
}
```
- `unlink()`를 사용하여 기존 파일을 삭제
- `symlink()`를 사용하여 공격 대상 파일(예: `/etc/passwd`)로 다시 링크하는 작업을 반복
### 3.2.3 Race Condition 공격 과정 (공격 성공 시)
![[Pasted image 20251209164308.png]]
1. (정상 프로세스) `./file` 파일 권한 검사
2. (공격 프로세스) `./file` 파일 삭제
3. (공격 프로세스) `./file` 파일을 `/etc/passwd` 파일을 가리키도록 **심볼릭 링크 생성**
4. (정상 프로세스) **관리자 권한으로 실행되던 프로세스**가 이제 심볼릭 링크를 따라 **목표 파일**에 작업
# 4. Race Condition에 대한 대응 방안
## 4.1 안전한 파일 열기
1. `if(lstat(filename, &st) != 0)`: 파일의 링크 상태를 확인
2. `if(!S_ISREG(st.st_mode))`: 열고자 하는 파일 종류를 확인
3. `if(st.st_uid != 0)`: 열고자 하는 파일의 사용자 계정 검사
4. `if((st.st_ino != st2.st_ino) || (st.st_dev != st2.st_dev))`: 최초 파일 정보를 저장하고 있는 st, 파일은 연 후의 st2에 저장된 I-node 값, 장치 값을 변경했는지 확인.
## 4.2 커널 보안 강화
```sh
# Ubuntu 12.04
sudo sysctl -w kernel.yama.protected_sticky_symlinks=1

# Ubuntu 16.04
sudo sysctl -w fs.protected_symlinks=1
```