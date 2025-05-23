Created at:  2025-01-15 00:26
Tag: #nestjs 
References:
Link Notes:

NestJS의 Guard, Exception filter, Interceptor 등 다양한 클래스에서 execution context를 쉽게 조회할 수 있게 도와주는 `ArgumentsHost` 그리고 `ExecutionContext` 클래스에 대해서 알아봅니다.

# 1. `ArgumentsHost` class
- `ArgumentsHost` 클래스는 실제 컨트롤러에 전달되고 있는 인자들을 반환합니다.
- HTTP, RPC, WebSockets 등 적절한 context에 대한 선택권을 제공합니다.
- Exception filter, Guard, Interceptor에서 `ArgumentsHost`의 인스턴스를 받아서 사용할 수 있습니다.
> [!info]
> 엄밀히 따지면 Guard, Interceptor에서는 `ArgumentsHost` 클래스를 상속한 `ExecutionContext` 클래스를 제공해줍니다.
## 1.1 현재 애플리케이션의 context 알아내기
Guard, Exception filter, Interceptor를 구축할 때 우리는 실제로 애플리케이션이 어떤 환경 에서 실행되는지 알아야할 필요가 있습니다. `ArgumentsHost` 에서 `getType()` 메서드를 제공합니다.
> [!info]
> 여기서 말하는 환경은 HTTP, RPC, WebSockets 같은 통신 프로토콜을 칭합니다.

```typescript
if (host.getType() === 'http') {
  // do something that is only important in the context of regular HTTP requests (REST)
} else if (host.getType() === 'rpc') {
  // do something that is only important in the context of Microservice requests
} else if (host.getType<GqlContextType>() === 'graphql') {
  // do something that is only important in the context of GraphQL requests
}
```
## 1.2 Host handler 인자들을 뽑아내기
### 1.2.1 context를 지정해서 인자 뽑아내기 (권장됨)
`ArgumentsHost` 객체를 적절한 context로 변환시킬 수 있습니다.
```typescript
/**
 * Switch context to RPC.
 */
switchToRpc(): RpcArgumentsHost;
/**
 * Switch context to HTTP.
 */
switchToHttp(): HttpArgumentsHost;
/**
 * Switch context to WebSockets.
 */
switchToWs(): WsArgumentsHost;
```
`switchToHttp()` 메서드를 썻다고 가정했을 때 요청과 응답 객체를 뽑아내는 방법은 다음과 같습니다. 
```typescript
const ctx = host.switchToHttp();
const request = ctx.getRequest<Request>();
const response = ctx.getResponse<Response>();
```

### 1.2.2 context를 지정하지 않고 인자 뽑아내기
`getArgs()`와 `getArgsByIndex()` 메서드를 사용할 수 있습니다. context 마다 추상화하고 있는 인자가 다릅니다. 그래서 이러한 방식은 별로 권장되진 않습니다.
```typescript
const [req, res, next] = host.getArgs();
const request = host.getArgByIndex(0);
const response = host.getArgByIndex(1);
```

# 2. `ExecutionContext` class
- `ExecutionContext`는 `ArgumentsHost` 클래스를 상속했습니다. 
- Guard 혹은 Interceptor에서 `ExecutionContext`의 인스턴스를 받아서 사용할 수 있습니다.
## 2.1 추가 제공되는 메서드들
- `getHandler()` 메서드는 호출될 handler 함수의 참조를 반환합니다.
- `getClass()` 메서드는 호출될 handler 함수가 속한 Controller 클래스를 반환합니다.

예를 들어 POST 요청으로 `CatsController` 클래스에 속한 `create()` 메서드를 호출했다고 가정했을 때,
- `getHandler()` 메서드는 호출될 함수인 `create()` 메서드에 대한 참조를 반환합니다.
- `getClass(`) 메서드는 호출될 함수인 `create()` 메서드가 속한 Controller 클래스인 `CatsController`에 대한 참조를 반환합니다.
```typescript
const methodKey = ctx.getHandler().name; // "create"
const className = ctx.getClass().name; // "CatsController"
```