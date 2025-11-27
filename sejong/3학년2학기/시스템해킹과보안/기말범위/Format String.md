# 1. 주요 포맷 스트링 문자

| Parameter | Format                                |
| --------- | ------------------------------------- |
| %d        | decimal integer                       |
| %f        | float                                 |
| %lf       | double                                |
| %c        | character                             |
| %u        | unsigned decimal integer              |
| %o        | unsigned octal integer                |
| %x        | unsigned hexadecimal integer          |
| %s        | null-terminated string                |
| %n        | int *(number of bytes so far)         |
| %hn       | half of %n, **2 bytes** unit (더 정교함!) |
# 2. 포맷 스트링 예시 잘못된 사용 예와 올바른 사용 예
## 2.1 올바른 예시
```c
#include <stdio.h>

main() {
	char *buffer = "wishfree\n";
	printf("%s\n", buffer);
}
```
## 2.2 잘못된 사용 예시
```c
#include <stdio.h>

main() {
	char *buffer = "wishfree\n";
	printf(buffer);
}
```
# 3. 포맷 스트링 공격
- 포맷 스트링 문자를 사용하지 않고 출력 함수를 사용하는 공격.
- 버퍼 오버플로우 공격과 마찬가지로 ret 값을 변조하여 임의의 코드를 실행할 수 있다.
# 4. 포맷 스트링에 취약한 함수
- `printf`
- `fprintf`
- `sprintf`
- `snprintf`
