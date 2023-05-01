**참고**
- https://rlawls1991.tistory.com/entry/MySQL-Replication#:~:text=MySQL%20Replication%EC%9D%B4%EB%9E%80%3F,Master%20%2F%20Slave%20%EC%9C%BC%EB%A1%9C%20%EB%90%98%EC%96%B4%EC%9E%88%EB%8B%A4

### What is MySQL Replication?
리플리케이션(Replication)은 복제를 뜻하며 2대 이상의 DBMS를 나눠서 데이터를 저장하는 방식이며,
사용하기 위한 최소 구성은 **Master / Slave** 으로 되어있다.

**master**
- 웹서버로 부터 데이터 등록/수정/삭제 요청시 바이너리로그(Binarylog)를 생성하여 Slave 서버로 전달
- 웹서버로 부터 요청한 데이터 등록/수정/삭제 기능을 하는 DBMS로 많이 사용
**slave**
- Master DBMS로 부터 전달받은 바이너리로그(Binarylog)를 데이터로 반영
- 웹서버로 부터 요청을 통해 데이터를 조회하는 DBMS로 많이 사용

### Why MySQL Replication?
데이터 백업
DBMS의 부하분산