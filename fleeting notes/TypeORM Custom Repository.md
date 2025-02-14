Created at:  2025-01-15 15:25
Tag: #nestjs #typeorm 
References:
- [https://stackoverflow.com/questions/74542474/how-to-create-custom-separate-file-repository-in-nestjs-9-with-typeorm-0-3-x](https://stackoverflow.com/questions/74542474/how-to-create-custom-separate-file-repository-in-nestjs-9-with-typeorm-0-3-x)
Link Notes:

우선 기본적으로 다음과 같은 entity가 있다고 가정하고 진행하겠다.
```jsx
import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string; 
}
```

# TypeORM 0.2.x 버전에서의 custom repository
```jsx
import { EntityRepository, Repository } from "typeorm";
import { User } from "./entity/user.entity";

@EntityRepository(User)
export class UserRepository extends Repository<User>{}
```
TypeORM에서 제공되는 `@EntityRepository` 데코레이터로 간단하게 구현할 수 있다.

다만, TypeORM 0.3.x 버전부터는 **deprecated** 되었고 사용이 불가능하다. 따라서 위와 비슷하게 구현하기 위해서 여러가지 방법이 나오고 있다.
# TypeORM 0.3.x 버전에서의 custom repository
여러가지 방법으로 구현할 수 있겠지만 내가 본 것 중에서 그나마 간단하면서 기존의 `@EntityRepository`를 쓴 custom repository와 비슷하게 구현할 수 있는 방법을 설명하겠다.

우선 결론적으로 repository class는 다음과 같이 구현하면 된다.
```jsx
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from './user.entity';

@Injectable()
export class UserRepository extends Repository<User> {
    constructor(
        @InjectRepository(UserEntity)
        private readonly repository: Repository<User>
    ) {
        super(repository.target, repository.manager, repository.queryRunner);
    }

   // 원하는 메서드 알아서 작성
}
```

이제 `UserRepository`를 다른 Service class에서 쓰기 위해서는 Module에 등록을 해야한다.
```jsx
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User])], // here we provide the TypeOrm support as usual, specifically for our UserEntity in this case
  providers: [UserRepository], // 모듈의 providers 배열에 UserRepository class 등록 
  exports: [UserRepository] // 다른 모듈에서 쓸 수 있도록 exports 배열에 UserRepository class를 등록
})
export class UserModule {}
```