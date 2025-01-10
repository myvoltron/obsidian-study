#nestjs 

- NestJS의 모든 요소들은 Nest에 의해 관리되는 lifecycle을 가지고 있습니다. 
- 그리고 이러한 lifecycle events에 접근할 수 있는 lifecycle hooks가 제공됩니다.

# 1. Lifecycle 절차
![lifecycleSequence](https://docs.nestjs.com/assets/lifecycle-events.png)
- 위 다이어그램은 주요한 application lifecycle 이벤트들을 나열한 것입니다.
- 전체적인 lifecycle은 **initializing**, **running** 그리고 **terminating**으로 나뉩니다.
# 2. Lifecycle 이벤트
- lifecycle 이벤트들에 대해서 modules, providers, controller 같은 Nest 클래스에서 lifecycle hook 메서드를 호출할 수 있습니다.
## 2.1 Lifecycle 이벤트 종류
|Lifecycle hook method|Lifecycle event triggering the hook method call|
|---|---|
|`onModuleInit()`|Called once the host module's dependencies have been resolved.|
|`onApplicationBootstrap()`|Called once all modules have been initialized, but before listening for connections.|
|`onModuleDestroy()`*|Called after a termination signal (e.g., `SIGTERM`) has been received.|
|`beforeApplicationShutdown()`*|Called after all `onModuleDestroy()` handlers have completed (Promises resolved or rejected);  <br>once complete (Promises resolved or rejected), all existing connections will be closed (`app.close()` called).|
|`onApplicationShutdown()`*|Called after connections close (`app.close()` resolves).|

## 2.2 Lifecycle initializing 이벤트에 접근하기
- Nest에선 각 이벤트에 접근할 수 있는 interface를 제공합니다. 따라서 적절한 interface를 선택해 메서드를 구현해서 lifecycle hook을 등록할 수 있습니다.
```typescript
import { Injectable, OnModuleInit } from '@nestjs/common';

@Injectable()
export class UsersService implements OnModuleInit {
  onModuleInit() {
    console.log(`The module has been initialized.`);
  }
}
```
## 2.3 Lifecycle terminating 이벤트에 접근하기
- `onModuleDestroy()`, `beforeApplicationShutdown()` 그리고 `onApplicationShutdown()` hook들은 terminating 페이즈에서 호출됩니다.
- 이러한 shutdown hook들을 사용하려면 `enableShutdownHooks()`를 호출해서 listener들을 활성화 시켜야합니다. 
- 이러한 shutdown hook들을 listener들을 시작시키면서 메모리를 소비합니다. 따라서 여러 개의 인스턴스를 사용할 시 주의해서 사용해야합니다.
```typescript
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Starts listening for shutdown hooks
  app.enableShutdownHooks();

  await app.listen(3000);
}
bootstrap();
```
