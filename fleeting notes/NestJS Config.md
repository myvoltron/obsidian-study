Created at:  2025-01-15 00:27
Tag: #nestjs 
References:
- [https://darrengwon.tistory.com/965](https://darrengwon.tistory.com/965)
Link Notes:

# Configuration 개요
애플리케이션은 항상 다른 `environment`에서 실행된다. 서버에서 실행될 수도 있고 개발 컴퓨터에서도 실행될 수 있다. 설정 변수가 바뀔 때, 최고의 방법은 설정 변수를 `environment`에 저장하는 것이다.

그런데 환경이 고정된 환경이 아니라 여러 개의 환경이라면 어떻게 해야할까? `Node.js`에서는 `.env` 파일을 이용해서 다른 환경에서는 적절한 `.env` 파일로 바꿔주는 방법을 사용한다.

`NestJS`에서는 적절한 `.env` 파일을 로드해주는 `ConfigService`를 노출시켜주는 `ConfigModule`을 사용한다!
# NestJS Config Install
위의 `ConfigModule`을 사용하기 위해서 다음과 같은 의존성을 설치한다.

`$ npm i --save @nestjs/config`
- 내부적으로 `dotenv` 를 사용함
# Getting started
위에서 패키지를 설치했으면 `ConfigModule`을 `import` 할 수 있다.

```jsx
// app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule.forRoot()],
})
export class AppModule {}
```
- 위 과정으로 **default location**의 `.env` 파일이 load되고 `process.env` 객체에 parse되어 담긴다.
# .ENV 파일의 위치 명시하기
- 위의 방법으로 `.env` 파일을 load하면 root 디렉터리의 `.env` 파일만 인식한다.
- 따라서 특정한 `.env` 파일을 명시하게 하려면 `envFilePath` 프로퍼티를 지정해두자.

```jsx
ConfigModule.forRoot({
  envFilePath: '.development.env',
});
```
# .ENV 파일 무시하기
- env 파일을 사용하고 싶지 않을 때 사용하는 것.

```jsx
ConfigModule.forRoot({
  ignoreEnvFile: true,
});
```

# Use Config module globally
- 다른 곳에서도 환경 변수를 쉽게 불러와 사용하기 위해서 ConfigModule을 global module로 만들 수 있다.

```jsx
ConfigModule.forRoot({
  isGlobal: true,
});
```