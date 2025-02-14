Created at:  2025-01-15 15:27
Tag:
References:
Link Notes:

### 참고

- [https://soo-sin.tistory.com/m/24](https://soo-sin.tistory.com/m/24)
- [https://v3.leedo.me/39f74376-46ed-4e38-bb35-b1980f5d4a31](https://v3.leedo.me/39f74376-46ed-4e38-bb35-b1980f5d4a31)
- [](https://techblog.wclub.co.kr/posts/0007.what-is-timezone/Timezone%20%EB%A7%9E%EC%B6%B0%EC%A3%BC%EB%8A%94%20%EB%B2%95%20%EC%B4%9D%EC%A0%95%EB%A6%AC)[https://techblog.wclub.co.kr/posts/0007.what-is-timezone/Timezone](https://techblog.wclub.co.kr/posts/0007.what-is-timezone/Timezone) 맞춰주는 법 총정리
- [https://typeorm.io/data-source-options#mysql--mariadb-data-source-options](https://typeorm.io/data-source-options#mysql--mariadb-data-source-options)

### 개요

간혹 보면 TypeORM을 통해 가져온 값과 실제 저장되어 있는 데이터에서 시간대가 다른 것을 볼 수 있다.

예를 들어 DB에 실제로 저장되어 있는 날짜값은 `2023-02-21 23:38:51.820841` 인데 내가 조회했을 땐 `2023-02-21T14:38:51.820Z` 이렇게 나온다.

이번에는 이러한 현상의 원인 파악과 해결 방법을 알아본다.