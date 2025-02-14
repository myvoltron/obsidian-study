Created at:  2025-01-15 15:26
Tag: #nestjs #typeorm #database 
References:
- [typeorm-extension docs](https://typeorm-extension.tada5hi.net/guide/)
- [https://min-nine.tistory.com/80](https://min-nine.tistory.com/80)
- [https://github.com/tada5hi/typeorm-extension](https://github.com/tada5hi/typeorm-extension)
- [https://github.com/myvoltron/typeorm-seeding](https://github.com/myvoltron/typeorm-seeding)
Link Notes: [[TypeORM Migration]]

# Seeder란?
데이터베이스에 초기 데이터 및 테스트 용 더미 데이터를 입력해주는 도구이다.
- **권한 정보나 관리자 계정같은 데이터**는 초기에 필요한 정보인데 이를 Seeder를 사용해서 미리 입력할 수 있다.
- 테스트할 때 필요한 데이터들을 편리하게 채워넣을 수 있다.

우선 셋업을 설명하기 전에, 보통 TypeORM Seeding을 위해서 구글링을 해보면 `typeorm-seeding`이라는 패키지를 사용한다는걸 알 수 있다. 하지만 두 가지 이유로 권장하지 않는다.
- 더 이상 관리되고 있지 않음: [여기](https://www.npmjs.com/package/typeorm-seeding)에서 확인해보시면 마지막 업데이트가 3년전.
- 따라서 여전히 ormconfig를 사용해야함: **dataSource** 사용이 좀 더 권장됨. 왜 ormconfig를 쓰면 안되는지는 [여기](https://typeorm.io/changelog#breaking-changes-1)에서 확인하실 수 있다.

 현재는 `typeorm-extension`라는 패키지를 주로 쓰는 듯 하다.
- [https://www.npmjs.com/package/typeorm-extension](https://www.npmjs.com/package/typeorm-extension)
- 지속적으로 관리되고 있다.
- TypeORM 공식문서에도 소개되어 있다. - [여기](https://typeorm.io/#extensions)를 보시면 확인하실 수 있다.
- **dataSource**를 사용
# TypeORM Seeding 셋업 및 실행
우선 다음과 같이 `typeorm-extension` 패키지를 설치한다.
```bash
npm install typeorm-extension --save
```

`package.json`의 `scripts` 섹션에 다음 스크립트를 넣는다.
```bash
"seed": "ts-node -r tsconfig-paths/register ./node_modules/typeorm-extension/dist/cli/index.js seed",
```

`typeorm-extension` cli의 경우에도 절대경로를 이해하지 못해서 `tsconfig-paths` 패키지를 활용해야만 한다.
- `typeorm-extension`은 `DataSource` 파일의 디폴트 경로로 루트 디렉토리의 `data-source.ts` 파일을 찾는다. 따로 지정할 수 있다.
- `typeorm-extension`의 seed 명령어는 seeder 파일의 디폴트 경로를  `src/database/seeds/**/*{.ts,.js}` 로 간주함. 따로 지정할 수 있다.

`typeorm-extension` 패키지도 typeorm의 dataSource를 사용하기 때문에 `data-source.ts` 가 필요하다. 루트 디렉토리에 추가해보자.
```typescript
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

이제 우리의 Cat Entity에 대한 초기 데이터 삽입을 위해서 `src/database/seeds` 경로에 `cats.seeder.ts` 파일을 추가하자.

해당 파일에서 어떤 데이터를 넣을지 정의할 수 있다.
```jsx
import { Cat } from 'src/cats/entities/cat.entity';
import { DataSource } from 'typeorm';
import { Seeder } from 'typeorm-extension';

export default class CatsSeeder implements Seeder {
  async run(dataSource: DataSource): Promise<any> {
    const repository = dataSource.getRepository(Cat);
    await repository.insert([
      {
        name: 'cat1',
        kind: 'cat',
      },
    ]);
  }
}
```
 - `typeorm-extension`의 Seeder 인터페이스를 구현한 것을 볼 수 있다. 
 - 내부적으로 `DataSource`를 주입받고 repository를 사용해서 실제 데이터를 입력하는 방식으로 진행된다는걸 알 수 있다.

이제 터미널에서 다음 명령어를 실행해서 데이터를 저장할 수 있다. 따로 성공했다는 메시지는 나오지 않고 저장될 것이다.
```bash
npm run seed
```