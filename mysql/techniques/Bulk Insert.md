참고
- [Bulk Inserting - MySQL 다량의 데이터 넣기](https://dev.dwer.kr/2020/04/mysql-bulk-inserting.html)

MySQL에서는 다수의 데이터를 한꺼번에 입력해서 빠르게 저장할 수 있는 기능을 제공합니다. 

예를 들어 다음과 같은 쿼리를 
```SQL
INSERT INTO table VALUES (1, 'hello');
INSERT INTO table VALUES (2, 'world');
INSERT INTO table VALUES (3, '!');
```

```SQL
INSERT INTO table VALUES (1, 'hello'), (2, 'world'), (3, '!');
```
처럼 한 쿼리에 다량의 데이터를 묶어서 쿼리를 한 번만 호출할 수 있게 됩니다. 

### 빨라지는 이유? 
SQL 쿼리를 날리는 것도 I/O 호출이기 때문에 이러한 호출을 한 번으로 줄이면 실제로 엄청난 속도 차이를 체감할 수 있습니다. 

[스택오버플로우 글](https://stackoverflow.com/questions/1793169/which-is-faster-multiple-single-inserts-or-one-multiple-row-insert)을 보면 SQL 쿼리를 날릴 때 대략적으로 다음과 같은 절차가 수행됩니다. 
-   Connecting: (3)
-   Sending query to server: (2)
-   Parsing query: (2)
-   Inserting row: (1 × size of row)
-   Inserting indexes: (1 × number of indexes)
-   Closing: (1)

실제로 저장하는 단계는 한 두개 정도 밖에 없는데도 불구하고 다른 부가적인 절차가 많아서 여러 개의 데이터를 순차적으로 저장할 땐 시간적 손실이 발생합니다. 이것이 바로, bulk insert가 시간을 아낄 수 있는 이유입니다. 
