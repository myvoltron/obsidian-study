typeorm을 쓸 때 종종 특정 조건이 만족했을 때만 특정한 조건이나 쿼리를 삽입하고 싶을 때가 있습니다. 

관련해서 스택오버플로우에서 찾아보니 유용한 방식이 많이 있었습니다. 그 중 가장 합리적으로 보였던 방식은 다음과 같습니다.

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

메서드를 쓸 때 `QueryBuilder` 객체가 반환되는 점을 활용합니다. 

### 참고
- https://github.com/typeorm/typeorm/issues/3103
- [Database: Query Builder - Laravel - The PHP Framework For Web Artisans](https://laravel.com/docs/5.8/queries#conditional-clauses)