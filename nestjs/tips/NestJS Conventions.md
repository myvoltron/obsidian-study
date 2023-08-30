- [메서드,클래스 명명규칙 (tistory.com)](https://codediver.tistory.com/5)
- [Newbie's Cheatsheet: Commonly used verbs for naming functions, methods and variables - DEV Community](https://dev.to/maikomiyazaki/beginner-s-cheat-sheet-commonly-used-verbs-for-naming-functions-methods-and-variables-509i)


This docs cover with NestJS naming conventions.

### NestJS Feature naming
**NestJS Controller**
- Controller file name *must be* `{domain}.controller.ts`
- Controller class name *must be* `{domain}Controller`. suffix is `Controller`
**NestJS Service**
- Service file name *must be* `{domain}.service.ts`
- Service class name *must be* `{domain}Service`. suffix is `Service`
**NestJS Module**
- Module file name *must be* `{domain}.module.ts`
- Module class name *must be* `{domain}Module`. suffix is `Module`
NestJS Middleware
- Middleware file name *must be* `{feature}.middleware.ts`
- Middleware class name *must be* `{feature}Middleware`. suffix is `Middleware`
NestJS Exception Filter
- Exception Filter file name *must be* `{exception}.filter.ts`
- Controller class name *must be* `{exception}ExceptionFilter`. suffix is `ExceptionFilter`
NestJS Pipe
- Pipe file name *must be* `{domain}.pipe.ts`
- Pipe class name *must be* `{domain}Pipe`. suffix is `Pipe`
- `{domain}` must be DTO name.
NestJS Guard
- Guard file name *must be* `{feature}.guard.ts`
- Guard class name *must be* `{feature}Guard`. suffix is `Guard`
NestJS Interceptor 
- Interceptor file name *must be* `{feature}.interceptor.ts`
- Interceptor class name *must be* `{feature}Interceptor`. suffix is `Interceptor`


### DTO naming
- DTO file name *must be* `{domain}.dto.ts`
- DTO class name *must be* `{controllerMethodName}{type}DTO`
	- `type` can be the following and the other...
		- Null
		- Param
		- Query
		- Body
		- Response
		- OkResponse
		- ErrorResponse
	- suffix is `DTO`.

