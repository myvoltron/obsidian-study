Created at:  2025-01-15 00:24
Tag: #linux #process #commands 
References:
- [[리눅스, 유닉스] ps 프로세스 명령어 완벽정리, 프로세스 관리, 계열에 따른 옵션 차이, 조건에 맞게 프로세스 정보 추출하기 (tistory.com)](https://jhnyang.tistory.com/entry/%EB%A6%AC%EB%88%85%EC%8A%A4-%EC%9C%A0%EB%8B%89%EC%8A%A4-ps-%ED%94%84%EB%A1%9C%EC%84%B8%EC%8A%A4-%EB%AA%85%EB%A0%B9%EC%96%B4-%EC%A0%95%EB%A6%AC%ED%95%98%EA%B8%B0)
Link Notes:

ps 명령어는 리눅스에서 현재 실행 중인 프로세스들의 정보를 보여주는 명령어입니다. 이 명령어를 사용하면 CPU, 메모리, 실행 시간 등의 정보를 확인할 수 있어서 시스템 모니터링이나 디버깅에 유용합니다.

```
voltron@DESKTOP-G2V7AOD:~$ ps -ef
UID        PID  PPID  C STIME TTY          TIME CMD
root         1     0  0 23:56 ?        00:00:00 /init
root         9     1  0 23:56 ?        00:00:00 /init
root        10     9  0 23:56 ?        00:00:00 /init
voltron     11    10  1 23:56 pts/0    00:00:00 -bash
voltron    264    11  0 23:56 pts/0    00:00:00 ps -ef
```
