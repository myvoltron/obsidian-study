Created at:  2025-01-13 16:19
Tag: #mysql #sql #database #syntax 
References:
- https://extbrain.tistory.com/56
- [GROUP BY (上) : 개념과 실제 사용 방법](https://kimsyoung.tistory.com/entry/SQL-GROUP-BY-%E4%B8%8A-%EA%B0%9C%EB%85%90%EA%B3%BC-%EC%8B%A4%EC%A0%9C-%EC%A0%81%EC%9A%A9-%EB%B0%A9%EB%B2%95)
Link Notes:

### GROUP BY 개요
MySQL에서 유형별로 개수를 가져오고 싶을 때 컬럼 데이터를 그룹화 할 수 있는 `GROUP BY`를 사용합니다.
특정 조건으로 그룹화를 시켜서 총 개수, 총합 등의 값을 구할 때 유용합니다. 

### GROUP BY 사용법
**컬럼 그룹화**
```SQL
SELECT 컬럼 FROM 테이블 GROUP BY 그룹화할 컬럼;
```

**조건 처리 후에 컬럼 그룹화**
```SQL
SELECT 컬럼 FROM 테이블 WHERE 조건식 GROUP BY 그룹화할 컬럼;
```

**컬럼 그룹화 후에 조건 처리**
```SQL
SELECT 컬럼 FROM 테이블 GROUP BY 그룹화할 컬럼 HAVING 조건식;
```

**조건 처리 후에 컬럼 그룹화 후에 조건 처리**
```SQL
SELECT 컬럼 FROM 테이블 WHERE 조건식 GROUP BY 그룹화할 컬럼 HAVING 조건식;
```

**ORDER BY가 존재하는 경우**
```SQL
SELECT 컬럼 FROM 테이블 [WHERE 조건식]
GROUP BY 그룹화할 컬럼 [HAVING 조건식] ORDER BY 컬럼1 [, 컬럼2, 컬럼3 ...];
```

