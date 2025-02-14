Created at:  2025-01-14 23:53
Tag: #nestjs #typeorm 
References:
- https://github.com/typeorm/typeorm/issues/3103
- [Database: Query Builder - Laravel - The PHP Framework For Web Artisans](https://laravel.com/docs/5.8/queries#conditional-clauses)
Link Notes: 

typeorm을 쓸 때 종종 특정 조건이 만족했을 때만 특정한 조건이나 쿼리를 삽입하고 싶을 때가 종종 있다. 

그럴 땐, 다음과 같이 조건문을 사용해서 조건적으로 쿼리를 넣을 수 있다.
```typescript
let query = somehow
  .createQueryBuilder('users')
  .where(`user.deletedAt IS NOT NULL`);
if(params.hasImage) {
  query = query.andWhere(`user.image IS NOT NULL`);
}
if(params.q != '') {
  query = query.andWhere(`user.username LIKE :q`, { q: params.q });
}
const users = query.getMany();
```

`QueryBuilder`의 메서드를 쓸 때 `QueryBuilder` 객체가 반환되는 점을 활용한 것:) 