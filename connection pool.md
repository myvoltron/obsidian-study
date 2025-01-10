#mysql #database 

**참고**
- https://www.happykoo.net/@happykoo/posts/133

### What is Connection Pool?
서버에서 미리 DB와 connection을 맺어놓은 객체들을 만들어 pool에 저장해놓고, 요청이 발생할 때 마다 이 pool에 저장된 connection을 빌려와 쓰고 작업이 끝나면 pool에 다시 반납하는 걸 말합니다. 
![connection pool](https://pdf-lib.org/Images/UpLoadImages/2019102716036302.png)

### Why Connection Pool? 
보통 서버에서 DB에 있는 데이터를 read하거나 write할 때 다음과 같은 과정이 발생합니다. 
1. 서버는 해당 DB와 connection을 맺습니다.
2. 쿼리를 실행하여 데이터를 read하거나 write합니다. 
3. connection을 close합니다. 

서버에 요청이 적은 경우에는 위 과정이 부담되지는 않지만, 매우 많아진다면 이 connection을 맺고 끊는 작업이 부담될 수도 있습니다. 
따라서 이러한 connection을 미리 만들어 저장해두고 필요할 때 빌려 쓰는 방법인 **connection pool**을 사용해야합니다. 

### 주의 사항
connection pool이 만능인것은 아닙니다. 
- 요청이 발생했을 때 pool의 connection이 모두 사용 중이라면 반납될 때까지 대기해야합니다.
- 따라서 connection pool 사이즈를 작게 설정하면 서비스가 원할하게 이뤄지지 못합니다. 
- 그렇다고 connection pool 사이즈를 너무 크게 설정하면 connection 객체가 메모리를 많이 사용하기 때문에 오히려 성능을 떨어뜨릴 수도 있습니다. 
따라서, 실제로 서비스에 요청이 어느정도인지 조사해서 그에 맞게 connection pool 사이즈를 유연하게 설정해주는게 가장 좋습니다. 