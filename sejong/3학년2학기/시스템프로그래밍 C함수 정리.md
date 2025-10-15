# File Descriptor & Opening Files
## 대표 함수들
```c
#include <fcntl.h>

int open(const char *_path_, int _flags_, ...
                  /* mode_t _mode_ */);
int creat(const char *_path_, mode_t _mode_);
int openat(int _dirfd_, const char *_path_, int _flags_, ...
                  /* mode_t _mode_ */ );
```
- `path`: 파일경로
- `oflag`: 접근 모드 및 옵션
- `mode`: `O_CREAT`로 설정했을 때 새 파일의 권한을 지정.
- `dirfd` (openat 전용): 기준 디렉터리의 fd
	- `AT_FDCWD`로 하면 현재 디렉터리 기준으로 동작됨.
## `oflag`

| 플래그                 | 의미                              |
| ------------------- | ------------------------------- |
| O_RDONLY (required) | 읽기 전용                           |
| O_WRONLY (required) | 쓰기 전용                           |
| O_RDWR (required)   | 읽기 및 쓰기                         |
| O_CREAT             | 파일 없으면 생성 -> mode 인자 필요         |
| O_EXEL              | O_CREAT와 함께 사용 시, 파일 존재하면 오류 발생 |
| O_TRUNC             | 열 때 기존 파일 내용 제거                 |
| O_APPEND            | 항상 파일 끝에 덧붙임                    |
