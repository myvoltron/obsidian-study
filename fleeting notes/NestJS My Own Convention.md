Created at:  2025-01-15 00:23
Tag: #nestjs #cleancode #convention
References:
- [메서드,클래스 명명규칙 (tistory.com)](https://codediver.tistory.com/5)
- [Newbie's Cheatsheet: Commonly used verbs for naming functions, methods and variables - DEV Community](https://dev.to/maikomiyazaki/beginner-s-cheat-sheet-commonly-used-verbs-for-naming-functions-methods-and-variables-509i)
Link Notes:

# 1. NestJS basic 클래스 네이밍
NestJS에서 기본 클래스들의 네이밍을 다룹니다.
## 1.1 Controller
- Controller file name *must be* `{domain}.controller.ts`
- Controller class name *must be* `{domain}Controller`. suffix is `Controller`
## 1.2 Service
- Service file name *must be* `{domain}.service.ts`
- Service class name *must be* `{domain}Service`. suffix is `Service`
## 1.3 Module
- Module file name *must be* `{domain}.module.ts`
- Module class name *must be* `{domain}Module`. suffix is `Module`
## 1.4 Middleware
- Middleware file name *must be* `{feature}.middleware.ts`
- Middleware class name *must be* `{feature}Middleware`. suffix is `Middleware`
## 1.5 Exception Filter
- Exception Filter file name *must be* `{exception}.filter.ts`
- Controller class name *must be* `{exception}ExceptionFilter`. suffix is `ExceptionFilter`
## 1.6 Pipe
- Pipe file name *must be* `{domain}.pipe.ts`
- Pipe class name *must be* `{domain}Pipe`. suffix is `Pipe`
- `{domain}` must be DTO name.
## 1.7 Guard
- Guard file name *must be* `{feature}.guard.ts`
- Guard class name *must be* `{feature}Guard`. suffix is `Guard`
## 1.8 Interceptor 
- Interceptor file name *must be* `{feature}.interceptor.ts`
- Interceptor class name *must be* `{feature}Interceptor`. suffix is `Interceptor`


# 2. DTO 네이밍 컨벤션
- DTO file name *must be* `{domain}.dto.ts`
- DTO class name *must be* `{controllerMethodName}{type}DTO`
	- `type` can be the following and the other...
		- Null
		- Param
		- 
		- Query
		- Body
		- Response
		- OkResponse
		- ErrorResponse
	- suffix is `DTO`.

