Created at:  2025-01-15 00:21
Tag: #nodejs 
References:
Link Notes: [[Node.js Basic]]

> [!info] Node.js 내부적으로 구현되어 있는 기능들 중 자주 쓰일만한 기능들을 소개합니다. 
> 
# 1. `__filename`, `__dirname`
Node.js 개발에는 현재 파일의 경로나 파일명을 알아야 할 때가 많습니다. 따라서 Node.js에서는 `__filename`, `__dirname` 이라는 키워드를 통해서 경로에 관한 정보를 제공합니다. 

- `__filename`은 파일명까지
- `__dirname`은 현재 파일 경로로 바뀝니다. 
# 2. path 
폴더와 파일의 경로를 쉽게 조작하도록 도와주는 모듈입니다. 보통 운영체제 별로 경로 구분자가 다를 수 있습니다. 
- 윈도우 계열은 `\`로 구분합니다. 
- POSIX 계열은 `/`로 구분합니다. 
# 3. url
인터넷 주소를 쉽게 조작하도록 도와주는 모듈입니다. 