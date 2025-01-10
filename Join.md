#mysql #database 

> [!info] MySQL 가장 중요한 것 중 하나인 Join입니다. 

**참고**
- https://yoo-hyeok.tistory.com/98
- [MySQL Joins (w3schools.com)](https://www.w3schools.com/mysql/mysql_join.asp)
- [[MYSQL] 📚 테이블 조인(JOIN) - 그림으로 알기 쉽게 정리 (tistory.com)](https://inpa.tistory.com/entry/MYSQL-%F0%9F%93%9A-JOIN-%EC%A1%B0%EC%9D%B8-%EA%B7%B8%EB%A6%BC%EC%9C%BC%EB%A1%9C-%EC%95%8C%EA%B8%B0%EC%89%BD%EA%B2%8C-%EC%A0%95%EB%A6%AC)

### What is Join statement? 
![MySQL Join](https://4.bp.blogspot.com/-_HsHikmChBI/VmQGJjLKgyI/AAAAAAAAEPw/JaLnV0bsbEo/s1600/sql%2Bjoins%2Bguide%2Band%2Bsyntax.jpg)


**(INNER) JOIN**
- 조인하는 테이블의 ON 절의 조건이 일치하는 결과만 출력합니다. 
- MySQL에서는 JOIN, INNER JOIN, CROSS JOIN이 모두 같은 의미로 사용됩니다.
- 개인적으로 개발해왔을 땐 가장 많이 사용했습니다.

예를 들어 다음과 같이 `users`와 `orders`라는 두 개의 테이블이 있다고 가정해봅시다. 
**`users` 테이블**
| id  | name    |
| --- | ------- |
| 1   | Alice   |
| 2   | Bob     |
| 3   | Charlie |

**`orders` 테이블**
| id  | user_id | order_date |
| --- | ------- | ---------- |
| 1   |    1    |     2021-01-01       |
| 2   |    1    |     2021-02-15       |
| 3   |    2    |    2021-03-22        |

아래는 `users`와 `orders` 테이블을 INNER JOIN하여 사용자와 해당 사용자의 주문 내역을 조회하는 SQL 쿼리의 예시입니다.
```SQL
SELECT users.name, orders.order_date 
	FROM users 
	INNER JOIN orders ON users.id = orders.user_id;
```

위의 쿼리를 실행하면 아래와 같은 결과가 반환됩니다.
| name    | order_date |
| ------- | ---------- |
| Alice   |   2021-01-01         |
| Alice   |      2021-02-15      |
| Bob     |     2021-03-22       |


LEFT / RIGHT OUTER JOIN
- OUTER JOIN은 조인하는 테이블의 ON 절의 조건 중 한쪽의 데이터를 모두 가져옵니다.
- 보통 LEFT OUTER JOIN을 사용합니다. 

**LEFT JOIN**
- 두 개의 테이블에서 왼쪽 테이블을 기준으로 JOIN을 수행합니다. 
- 따라서 오른쪽 테이블의 부분집합을 포함합니다. 

이제 `users`와 `orders` 테이블을 LEFT JOIN하여 모든 사용자와 해당 사용자의 주문 내역을 조회하는 SQL 쿼리를 작성해봅시다.
```SQL
SELECT users.name, orders.order_date 
	FROM users 
	LEFT JOIN orders ON users.id = orders.user_id;
```

위의 쿼리를 실행하면 아래와 같은 결과가 반환됩니다.
| name    | order_date |
| ------- | ---------- |
| Alice   |   2021-01-01         |
| Alice   |      2021-02-15      |
| Bob     |     2021-03-22       |
| Charlie |    NULL        |

**INNER JOIN**과 달리 **OUTER JOIN**이기 때문에 `Charlie`에 해당하는 `orders` 로우가 없더라도 일단 조회는 되는 걸 확인할 수 있습니다. 
