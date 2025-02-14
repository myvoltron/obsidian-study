Created at:  2025-01-15 15:26
Tag: #nestjs #typeorm #database 
References:
- [https://typeorm.io/using-cli](https://typeorm.io/using-cli)
- [https://typeorm.io/migrations#using-migration-api-to-write-migrations](https://typeorm.io/migrations#using-migration-api-to-write-migrations)
- [https://github.com/typeorm/typeorm/blob/master/src/commands/MigrationRunCommand.ts](https://github.com/typeorm/typeorm/blob/master/src/commands/MigrationRunCommand.ts)
- [https://chanyeong.com/blog/post/35](https://chanyeong.com/blog/post/35)
- https://velog.io/@dev_leewoooo/TypeORM%EC%9D%98-built-in-migration-%EC%9D%B4%EC%9A%A9%ED%95%98%EA%B8%B0)[https://velog.io/@dev_leewoooo/TypeORM의-built-in-migration-이용하기](https://velog.io/@dev_leewoooo/TypeORM%EC%9D%98-built-in-migration-%EC%9D%B4%EC%9A%A9%ED%95%98%EA%B8%B0)
- [https://wanago.io/2022/07/25/api-nestjs-database-migrations-typeorm/](https://wanago.io/2022/07/25/api-nestjs-database-migrations-typeorm/)
- [https://github.com/myvoltron/typeorm-migration](https://github.com/myvoltron/typeorm-migration)
Link Notes:

# migration이란?
TypeORM에서 `synchronize: true` 기능을 사용하게 되면 Entity의 수정사항을 자동으로 DB에 갱신시킨다. 이 기능이 편한건 맞지만 테이블의 데이터를 아예 밀어버릴 수 있기 때문에 **production 레벨에서는 보통 쓰지 않는다.**
이런 경우에 수동으로 데이터베이스 수정사항을 적용하기 위해서 **Migration**을 진행한다.

TypeORM에서는 데이터베이스 스키마를 업데이트하는 sql 쿼리를 모은 하나의 파일을 migration이라고 합니다.
이번 섹션에서는 NestJS 환경에서 typeorm을 쓸 때 migration을 어떻게 진행할 수 있는지 서술합니다.
# Migration을 위한 셋업
우선 아래의 의존성들을 설치한다. 
```jsx
npm install -D ts-node tsconfig-paths
```

그리고 루트 디렉토리에 `data-source.ts` 라는 파일을 만들고 다음 코드를 작성합니다.
```jsx
import { ConfigService } from '@nestjs/config';
import { config } from 'dotenv';
import { DataSource } from 'typeorm';

config();

const configService = new ConfigService();

export default new DataSource({
  type: 'mysql',
  host: configService.get('DB_HOST'),
  port: configService.get<number>('DB_PORT'),
  username: configService.get('DB_USERNAME'),
  password: configService.get('DB_PASSWORD'),
  database: configService.get('DB_DATABASE'),
  synchronize: false,
  entities: ['src/**/*.entity.ts'],
  migrations: ['src/database/migrations/*.ts'],
  migrationsTableName: 'migrations',
});
```
> 파일 이름이나 코드 내용은 어느 정도 커스텀하셔도 상관없다!

그리고 `package.json`의 `scripts`에 **TypeORM Migration** 관련 스크립트를 넣습니다.
```json
"scripts": {
    "prebuild": "rimraf dist",
    "build": "nest build",
    "format": "prettier --write \\"src/**/*.ts\\" \\"test/**/*.ts\\"",
    "start": "nest start",
    "start:dev": "nest start --watch",
    "start:debug": "nest start --debug --watch",
    "start:prod": "node dist/main",
		// typeorm 스크립트
    "typeorm": "ts-node -r tsconfig-paths/register ./node_modules/typeorm/cli.js --dataSource ./data-source.ts",
    "migration:create": "ts-node -r tsconfig-paths/register ./node_modules/typeorm/cli.js migration:create ./src/database/migrations/Migration",
    "migration:generate": "npm run typeorm migration:generate ./src/database/migrations/Migration",
    "migration:run": "npm run typeorm  migration:run",
    "migration:revert": "npm run typeorm migration:revert",
    "lint": "eslint \\"{src,apps,libs,test}/**/*.ts\\" --fix",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:cov": "jest --coverage",
    "test:debug": "node --inspect-brk -r tsconfig-paths/register -r ts-node/register node_modules/.bin/jest --runInBand",
    "test:e2e": "jest --config ./test/jest-e2e.json"
  },
```
TypeORM의 [공식문서 설명](https://typeorm.io/migrations#running-and-reverting-migrations)과는 좀 다른 스크립트이다. 
왜냐하면 TypeORM CLI가 절대경로를 이해하지 못해서 공식문서대로 따라하다가는 `can not found module` 같은 에러를 보게된다. 그래서 임의로 절대경로를 이해시키기 위해 `ts-node -r tsconfig-paths/register` 가 들어간 것을 볼 수 있다.
> ts-config-paths 모듈에 관한 내용은 [여기](https://www.npmjs.com/package/tsconfig-paths)에서 확인하실 수 있다.

아무튼 여기서 `npm run migration:generate` 명령어를 실행해서 Entity의 변경사항에 대한 파일이 생성된다면 성공한 것이다.
# Migration 해보기
먼저 다음 entity가 존재하고 DB에도 적용되어있다고 가정한다.
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

여기서 고객의 요구로 (가정) `Cat` 에 `kind` 컬럼을 추가해야하는 상황이라고 가정하자. 그러면,
```jsx
import { BaseEntity } from 'src/app/base/base.entity';
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class Cat extends BaseEntity {
  @PrimaryGeneratedColumn()
  idx: number;

  @Column()
  name: string;

  @Column()
  kind: string;
}
```
으로 수정될 수 있다.

기존에는 Typeorm의 synchronize 기능을 통해 자동으로 변경되었겠지만, 이번에는 synchronize 기능을 끄고 migration 방식으로 진행해보자.

위의 [migration을 위한 셋업](https://www.notion.so/migration-eab9396bf04c48069a314255f212d611?pvs=21) 과정을 잘 진행했다면 `npm run migration:generate` 명령어를 터미널에서 실행했을 때 `src/database/migartions` 디렉토리에 `{timestamp}-Migration.ts`파일이 생성된 것을 보실 수 있다.
```jsx
import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration1675868794851 implements MigrationInterface {
  name = 'Migration1675868794851';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \\`cat\\` ADD \\`kind\\` varchar(255) NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \\`cat\\` DROP COLUMN \\`kind\\``);
  }
}
```
- up은 `npm run migration:run`
- down은 `npm run migration:revert`

`npm run migration:run`을 실행해서 Migration을 진행할 수 있다.
# migration 파일 생성할 때 create vs generate
아마 공식문서를 보면 migration 파일을 만드는 방법이 generate 말고도 create 방식이 있다는걸 알 수 있다.

`npm run migration:create` 명령어를 실행하면 다음과 같은 파일이 생성된다.
```jsx
// src/database/migrations/1675869805076-Migration.ts

import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration1675869805076 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {}

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
```
generate와는 달리 up과 down 메서드 부분에 내용이 아무것도 없다.

- generate: 읽어들인 모든 entity 파일과 실제 데이터베이스를 비교해서 테이블을 추가 및 수정하는 migration 파일을 생성한다.
- create: 빈 migration 파일을 생성한다. 따라서 스스로 테이블을 수정시키는 sql 쿼리문을 작성해야한다.

generate는 컬럼을 아예 [DROP 시키고 나서 재생성하는 쿼리문을 작성](https://velog.io/@heumheum2/typeORM-Migration-%EC%9D%B4%EC%8A%88)해줄 때가 종종 있다. 따라서 generate 방식을 쓸 땐 쿼리문을 확인해서 DROP하는 쿼리문이 있다면, 직접 모두 수동으로 작성하는 create 방식으로 진행하는게 좋다.
# migration 파일 위치 src vs dist 비교
```jsx
import { ConfigService } from '@nestjs/config';
import { config } from 'dotenv';
import { DataSource } from 'typeorm';

config();

const configService = new ConfigService();

export default new DataSource({
  type: 'mysql',
  host: configService.get('DB_HOST'),
  port: configService.get<number>('DB_PORT'),
  username: configService.get('DB_USERNAME'),
  password: configService.get('DB_PASSWORD'),
  database: configService.get('DB_DATABASE'),
  synchronize: false,
  entities: ['src/**/*.entity.ts'],
  migrations: ['src/database/migrations/*.ts'],
  migrationsTableName: 'migrations',
});
```

여기서 `migrations: ['src/database/migrations/*.ts']` 부분에 의문이 갔던게, 저기를 dist 폴더 기준으로 하시는 사람도 종종 있는 것 같다.

src 폴더 기준으로 넣어야할지 dist 폴더 기준으로 넣을지 고민이 되어서 뭐가 좋을지 고민해봤는데 그냥 src 폴더 기준으로 넣는게 좋을 것 같다. 다음 chatGPT 답변을 참고하자:)

<aside> 💡 이는 TypeORM이 개발 단계에서 사용하는 소스 코드를 기준으로 마이그레이션을 수행할 수 있기 때문입니다. dist 기준으로 설정하면 빌드 과정에서 생성된 파일을 기준으로 마이그레이션을 수행하기 때문에, 소스 코드와 빌드 결과가 맞지 않을 경우 문제가 발생할 수 있습니다.

</aside>