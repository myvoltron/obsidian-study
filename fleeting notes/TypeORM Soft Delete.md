Created at:  2025-01-15 15:25
Tag: #typeorm #database 
References:
- [https://typeorm.io/delete-query-builder#soft-delete](https://typeorm.io/delete-query-builder#soft-delete)
- [https://github.com/myvoltron/typeorm-soft-delete](https://github.com/myvoltron/typeorm-soft-delete)
Link Notes:

# Soft Delete란?
- 실제로 데이터를 삭제시키는 방법이 **Hard Delete**
- **삭제여부**를 알 수 있는 컬럼에 삭제를 표현하는 방법이 **Soft Delete**, 즉 실제로 삭제하지는 않음

따라서 실제로 삭제시키지 않고 삭제된 것처럼 표현이 가능해서 Soft Delete된 **데이터가 남아있으니** 이를 **활용**할 수 있어서 **현업에서는 Soft Delete가 권장**된다.

## TypeORM에서 **Soft Delete**를 하는 방법

| 방법                   | 장점                                                                                                                               | 단점                                                               |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| 직접 구현                | 1. 자기가 원하는 방식으로 Soft Delete를 구현할 수 있다.                                                                                           | 1. 조회나 업데이트 같은 메서드를 쓸 때마다 Soft Delete 처리되었는지 확인하는 where절을 넣어야한다. |
| TypeORM의 Soft Delete | 1. soft delete 처리되었는지 확인하는 where절을 자동으로 넣어준다.<br>2. soft delete된 데이터들을 복구시키는 메서드도 제공됨.<br>3. soft delete된 데이터들도 같이 조회하는 기능도 제공됨. | 1. 무조건 `@DeleteDateColumn()`방식으로만 soft delete가 구현된다.             |

# TypeORM의 Soft Delete 써보기
##  빠르게 Soft Delete 써보기
우선 entity에 `@DeleteDateColumn()` 처리된 컬럼이 필요하다.
```jsx
import { CreateDateColumn, DeleteDateColumn, UpdateDateColumn } from 'typeorm';

export class BaseEntity {
  @CreateDateColumn()
  createdDate: Date;

  @UpdateDateColumn()
  modifiedDate: Date;

  @DeleteDateColumn() // soft delete를 하려면 필수
  deletedDate: Date;
}
```

```jsx
import { BaseEntity } from 'src/app/base/base.entity';
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class Cat extends BaseEntity {
  @PrimaryGeneratedColumn()
  idx: number;

  @Column()
  name: string;
}
```

`BaseEntity`를 정의해서 Cat Entity에서 extends했습니다.
이제 `CatsService`에서 `CatsRepository`를 사용해서 Soft Delete를 할 수 있습니다.

```jsx
async softDelete(idx: number) {
	return this.catsRepository.softDelete(idx);
  }
```
## 내부 원리
TypeORM logging 기능을 켜서 실제로 어떤 쿼리문이 실행되는지 알아보자.

```jsx
query: SELECT `Cat`.`createdDate` AS `Cat_createdDate`, `Cat`.`modifiedDate` AS `Cat_modifiedDate`, `Cat`.`deletedDate` AS `Cat_deletedDate`, `Cat`.`idx` AS `Cat_idx`, `Cat`.`name` AS `Cat_name` FROM `cat` `Cat` WHERE `Cat`.`deletedDate` IS NULL
```
이게 조회를 했을 때 쿼리문이다. 따로 Where절을 넣지않았음에도 `deletedDate`를 체크하는 모습이다.

```jsx
query: UPDATE `cat` SET `deletedDate` = CURRENT_TIMESTAMP, `modifiedDate` = CURRENT_TIMESTAMP WHERE `idx` IN (?) -- PARAMETERS: [3]
```
이게 **Soft Delete**를 했을 때 쿼리문이다. `deleteDate` 컬럼에 현재 TimeStamp를 넣는것을 볼 수 있다.
## 데이터 복구
TypeORM에는 **Soft Delete** 처리된 데이터들을 쉽게 복구시킬 수 있는 메서드가 제공된다.

```jsx
async restore(idx: number) {
	return this.catsRepository.restore({ idx });
}
```
`restore` 메서드를 통해서 Soft Delete 처리된 row 데이터를 복구시킬 수 있다.

```jsx
query: UPDATE `cat` SET `deletedDate` = NULL, `modifiedDate` = CURRENT_TIMESTAMP WHERE `idx` = ? -- PARAMETERS: [3]
```
`restore` 메서드를 실행했을 때의 쿼리문. `deletedDate`를 `null`처리 하는걸 볼 수 있다.
## Soft Delete 처리된 데이터 함께 조회하기
find 옵션에서 `withDeleted`필드를 `true`로 세팅하면 TypeORM의 Soft Delete 기능을 써서 처리한 row 데이터들도 함께 조회할 수 있다.

```jsx
async findAllWithDeleted() {
	return this.catsRepository.find({ withDeleted: true });
  }
```

```jsx
query: SELECT `Cat`.`createdDate` AS `Cat_createdDate`, `Cat`.`modifiedDate` AS `Cat_modifiedDate`, `Cat`.`deletedDate` AS `Cat_deletedDate`, `Cat`.`idx` AS `Cat_idx`, `Cat`.`name` AS `Cat_name` FROM `cat` `Cat`
```
`withDeleted`옵션을 썼을 때 `deletedDate`컬럼을 체크하는 where 절이 사라진 것을 볼 수 있다.