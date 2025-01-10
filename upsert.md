#mysql #database 

**참고** 
- [MySQL 의 UPSERT 쿼리](https://eng-sohee.tistory.com/155#:~:text=MySQL%20%EC%9D%98%20UPSERT%20%EB%AC%B8%20UPSERT%20%EB%9E%80%2C%20UNIQUE%20%EC%9D%B8%EB%8D%B1%EC%8A%A4,KEY%20UPDATE%20%EB%AC%B8%EC%9D%84%20%ED%86%B5%ED%95%B4%EC%84%9C%20UPSERT%EB%A5%BC%20%EC%88%98%ED%96%89%ED%95%A0%20%EC%88%98%20%EC%9E%88%EB%8B%A4.)
- [MySQL INSERT ... ON DUPLICATE KEY UPDATE Statement](https://dev.mysql.com/doc/refman/8.0/en/insert-on-duplicate.html)

**UPSERT 란,  UNIQUE 인덱스 또는 PRIMARY KEY 와 동일한 값이 있는 데이터가 기존에 존재하지 않으면 INSERT & 존재하면 변경사항에 대해 UPDATE를 해주는 것**을 의미한다.

MySQL에서는 다음 쿼리를 통해서 UPSERT를 수행할 수 있습니다.
```sql
INSERT... ON DUPLICATE KEY UPDATE
```
- DUPLICATE KEY일 때 UPDATE를 한다고 이해하면 수월합니다. 

