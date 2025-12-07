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
