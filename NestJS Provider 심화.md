#nestjs 

NestJS에서 Provider가 DI되는 방식과 Provider의 다양한 형태에 대해서 정리합니다. 
# Reference
- [NestJS Custom providers](https://docs.nestjs.com/fundamentals/custom-providers)
# 1. DI fundamentals
## 1.1 DI 개요
Dependency injection은 클래스 초기화의 의무를 IoC container에게 위임하는 기술입니다. 따라서 매번 클래스 초기화를 할 필요가 없고 한번 초기화된 클래스의 인스턴스를 여러번 재사용하는 Singleton 패턴도 손쉽게 구현할 수 있습니다. 
## 1.2 NestJS Provider DI 
기본적으로 NestJS에서 `@Injectable()` 데코레이터를 사용해서 클래스를 provider로 지정할 수 있습니다. 다음 코드는 `CatsService`를 `@Injectable()` 데코레이터를 사용해 provider로 지정한 모습입니다.
```typescript
import { Injectable } from '@nestjs/common';
import { Cat } from './interfaces/cat.interface';

@Injectable()
export class CatsService {
  private readonly cats: Cat[] = [];

  findAll(): Cat[] {
    return this.cats;
  }
}
```
그리고 이러한 provider는 다른 클래스에서 주입받아 사용할 수 있습니다. 다음은 controller 클래스에서 Nest Inject를 요청하는 모습입니다.
```typescript
import { Controller, Get } from '@nestjs/common';
import { CatsService } from './cats.service';
import { Cat } from './interfaces/cat.interface';

@Controller('cats')
export class CatsController {
  constructor(private catsService: CatsService) {}

  @Get()
  async findAll(): Promise<Cat[]> {
    return this.catsService.findAll();
  }
}
```
그리고 실제로 provider를 Nest로부터 주입받기 위해서는 Nest IoC container에 등록해야합니다.
```typescript
import { Module } from '@nestjs/common';
import { CatsController } from './cats/cats.controller';
import { CatsService } from './cats/cats.service';

@Module({
  controllers: [CatsController],
  providers: [CatsService],
})
export class AppModule {}
```

위 과정을 정리하자면 다음과 같습니다.
1. `@Injectable()` 데코레이터로 `CatsService` 클래스를 Nest IoC container에 의해 관리될 수 있는 클래스로 정의했습니다. 중요한 건 관리될 수 있다는 것이지 실제로 관리되도록 등록된 건 아닙니다. 
2. `CatsController`에서 constructor injection에서 `CatsService` 토큰에 대한 의존성을 정의했습니다. 다음 코드가 construction injection의 예시입니다.
```typescript
constructor(private catsService: CatsService)
```
3. `AppModule` 클래스에서 `CatsService` 토큰과 실제 `CatsService` 클래스를 연관 시켰습니다. 아직은 이게 무슨 말인지 이해가 안될 겁니다.

그러면 실제로 위 상황에서 Nest application bootstrapping을 할 때 어떤 일이 벌어지는 지 알아봅시다.
1. 먼저 Nest에서 `CatsController`를 초기화할겁니다. 먼저 `CatsController`에 정의된 의존성을 살펴보게 됩니다.
2. `CatsController`에 `CatsService` 의존성이 정의되어 있습니다. 
3. `CatsService` 토큰을 통해 실제로 연관된 것을 살펴보고 위 과정의 step 3에서 등록된 것 처럼, `CatsService` 클래스를 반환하게 됩니다. 
   기본적으로 Nest는 `SINGLETON` scope로 작동되는데, 이 때 `CatsService`의 인스턴스를 초기화해서 반환합니다. 혹은 이미 초기화된 인스턴스가 있다면 그걸 재 반환시켜줍니다. 
# 2. Provider 구조에 대해서 알아보자
일단 우리가 provider를 module에 등록할 때 보통 이렇게 합니다.
```typescript
@Module({
  controllers: [CatsController],
  providers: [CatsService],
})
```

하지만, providers 필드에 `CatsService` 클래스 하나만 써놓는건 복잡한 문법을 단순화시킨겁니다. 실제로는 다음과 같은 모습입니다.
```typescript
providers: [
  {
    provide: CatsService,
    useClass: CatsService,
  },
];
```
이제 `CatsService` 토큰에 `CatsService` 클래스를 연관시켰다는 말이 좀 더 명확하게 보일 것입니다. 

- `provide` 필드에 들어오는 값은 토큰입니다. 해당 토큰을 가지고 실제 provider 인스턴스를 요청할 수 있습니다.
- `useClass`, `useValue`, `useFactory`, `useExisting` 필드에 들어오는 값은 토큰에 대해서 주입할 어떤 값이라고 볼 수 있습니다.

# 3. Provider tokens의 종류
provider tokens는 보통 두 가지로 나뉘게 됩니다. 
- class based provider tokens
	- `provider` 필드에 class를 전달
	- construction injection이 간편
- non-class based provider tokens
	- `provider` 필드에 class가 아닌 문자열이나 심볼을 전달
	- construction injection 시 `@Inject()` 데코레이터 사용 필수
	- 따로 정의한 토큰을 통해 exports 가능
## 3.1 class based provider tokens
우리가 지금까지 써왔던 token이 클래스 기반 토큰입니다. 다음과 같이 provide에 class를 전달합니다.
```typescript
providers: [
  {
    provide: CatsService,
    useClass: CatsService,
  },
];
```
그리고 class based provider tokens에서는 contructor injection을 진행할 때 좀 더 간결하게 쓸 수 있습니다. 
```typescript
constructor(private catsService: CatsService)
```
## 3.2 non-class based provider tokens
때때로, DI token으로서 클래스 보단 문자열이나 심볼을 사용해서 유연함을 챙기고 싶을 수도 있습니다. 다음 예제에서 문자열 토큰을 쓰는 걸 볼 수 있습니다.
```typescript
import { connection } from './connection';

@Module({
  providers: [
    {
      provide: 'CONNECTION',
      useValue: connection,
    },
  ],
})
export class AppModule {}
```
`'CONNECTION'` 문자열 값인 토큰을 외부 파일에서의 `connection`과 연관시키는 것을 볼 수 있습니다. 

이러한 provider를 주입하기 위해서는 `@Inject()` 데코레이터를 사용해야합니다. 인자로 정의했던 토큰을 넘겨주면 됩니다.
```typescript
@Injectable()
export class CatsRepository {
  constructor(@Inject('CONNECTION') connection: Connection) {}
}
```
## 3.3 non-class based provider tokens의 export
token만 exports하면 됩니다. 
```typescript
const connectionFactory = {
  provide: 'CONNECTION',
  useFactory: (optionsProvider: OptionsProvider) => {
    const options = optionsProvider.get();
    return new DatabaseConnection(options);
  },
  inject: [OptionsProvider],
};

@Module({
  providers: [connectionFactory],
  exports: ['CONNECTION'],
})
export class AppModule {}
```
# 4. Provider를 정의하는 다양한 방법
기존에 계속 써왔던 `useClass` 필드 말고도 providers를 정의할 수 있는 다양한 필드들이 있습니다. 
- `useClass`
- `useValue`
- `useFactory`
- `useExisting`
## 4.1 Class providers: `useClass`
- `useClass`에 class를 전달해서 Nest가 인스턴스를 초기화하고 주입하도록 합니다.
- 다형성을 위해 `provide`에는 추상 레벨의 class를 전달하고 실제 `useClass`에는 구현체 class를 전달할 수 있습니다. 
```typescript
const configServiceProvider = {
  provide: ConfigService,
  useClass:
    process.env.NODE_ENV === 'development'
      ? DevelopmentConfigService
      : ProductionConfigService,
};

@Module({
  providers: [configServiceProvider],
})
export class AppModule {}
```
## 4.2 Value providers: `useValue`
- `useValue`는 보통 constant value, external library, mock object 등 어떤 값을 주입할 때 쓰입니다. 
- 다음은 테스팅 목적으로 `CatsService`에 대한 mock를 사용하도록 하는 예제입니다. 
```typescript
import { CatsService } from './cats.service';

const mockCatsService = {
  /* mock implementation
  ...
  */
};

@Module({
  imports: [CatsModule],
  providers: [
    {
      provide: CatsService,
      useValue: mockCatsService,
    },
  ],
})
export class AppModule {}
```
- 이러한 방식으로 `CatsService`에 대한 토큰으로 `mockCatsService` 값을 지정했다면, `CatsService` 의존성에 대해서 실제로 주입받는 것은 `mockCatsService`가 됩니다.
  ```typescript
  constructor(private catsService: CatsService) // 실제로는 mockCatsService를 주입받음
```
- 그리고 `useValue` 필드에서는 value를 필요로합니다. 따라서 class는 value가 아니므로 여기서는 못 씁니다.
## 4.3 Factory providers: `useFactory`
- `useFactory`를 통해 동적으로 providers를 생성할 수 있습니다. 
- factory 함수에서 반환된 값이 provider로서 주입됩니다. 
- factory 함수는 인자를 받을 수 있으며 `inject` 필드를 통해 인자를 전달할 수 있습니다. 
```typescript
const connectionProvider = {
  provide: 'CONNECTION',
  useFactory: (optionsProvider: OptionsProvider, optionalProvider?: string) => {
    const options = optionsProvider.get();
    return new DatabaseConnection(options);
  },
  inject: [OptionsProvider, { token: 'SomeOptionalProvider', optional: true }],
  //       \_____________/            \__________________/
  //        This provider              The provider with this
  //        is mandatory.              token can resolve to `undefined`.
};

@Module({
  providers: [
    connectionProvider,
    OptionsProvider,
    // { provide: 'SomeOptionalProvider', useValue: 'anything' },
  ],
})
export class AppModule {}
```
## 4.4 Alias providers: `useExisting`
- `useExisting`은 이미 존재하는 providers에 대해 별칭을 만들 수 있게합니다. 
- 다음 예제는 같은 provider에 대해서 두 가지 접근법을 만듭니다. 
```typescript
@Injectable()
class LoggerService {
  /* implementation details */
}

const loggerAliasProvider = {
  provide: 'AliasedLoggerService',
  useExisting: LoggerService,
};

@Module({
  providers: [LoggerService, loggerAliasProvider],
})
export class AppModule {}
```