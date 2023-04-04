### Yarn berry란? 
Yarn berry란 Node.js를 위한 새롭고 요즘 자주 사용되는 패키지 매니저 프로그램입니다. 기존의 Yarn v1에서 2020년에 정식 버전인 Yarn berry가 출시되었습니다. 
Yarn 공식문서는 [여기](https://yarnpkg.com/)에서 확인하실 수 있습니다. 

> [!info] 먼저 npm과 yarn에 대해서 다룹니다. 
> yarn을 빨리 써보고 싶으면 [[#설치해보기]] 섹션으로 가십시오. 


### NPM vs Yarn (작성 중)
npm에 어떤 문제가 있는지 그리고 Yarn에는 어떤 장점이 있는지 설명합니다. [토스 뱅크의 잘 정리된 글](https://toss.tech/article/node-modules-and-yarn-berry)을 참고했습니다.  
**npm**
npm은 기본적으로 Node.js를 설치할 때 같이 설치되는거라 범용적으로 많이 쓰입니다. 하지만 다음과 같이 비효율적인 부분이 많이 있습니다. 
- 비효율적인 의존성 검색
- 환경에 따라 달라지는 동작
- 비효율적인 설치
- 유령 의존성


### 설치해보기
npm으로 yarn을 설치할 수 있습니다. 
```shell
npm install -g yarn
```

그리고 Yarn berry를 쓰길 원하는 프로젝트의 디렉토리에서 다음 명령어를 실행한다. 
```shell
yarn set version berry 
yarn --version
```

그러면 `.yarn` 폴더와 `.yarnrc.yml` 파일이 생성될겁니다. 
이제 yarn을 설치했으면 해당 프로젝트에서 `node_modules` 폴더와 `package-lock.json` 파일이 필요없으니 지워도 됩니다. 


### .gitignore
**제로 인스톨**을 사용할지 안할지에 따라서 `.gitignore`를 다르게 씁니다. 
선호하시는 대로 다음 코드를 `.gitignore`에 붙여넣기 하시면 됩니다. 
```.gitignore
### yarn ### 
# used Zero-Install 
.yarn/* 
!.yarn/cache 
!.yarn/patches 
!.yarn/plugins 
!.yarn/releases 
!.yarn/sdks 
!.yarn/versions 

# unused Zero-Install 
.yarn/* 
!.yarn/patches 
!.yarn/releases 
!.yarn/plugins 
!.yarn/sdks 
!.yarn/versions 
.pnp.*
```


### VSCode ZipFs 익스텐션
![[ZipFs.png]]
Yarn berry에서는 의존성을 zip 파일로 관리하기 때문에 직접 파일을 보려면 VSCode에서 [ZipFS](https://marketplace.visualstudio.com/items?itemName=arcanis.vscode-zipfs)라는 익스텐션을 추가적으로 설치해야합니다. 
이제 VSCode에서 Go to Definition 기능이 원활하게 작동될겁니다. 


### VSCode SDK 
Nest.js에서 개발을 할 때 기본적으로 Typescript, eslint, prettier 같은 개발 도구들을 무조건 사용하게 됩니다. 이러한 개발 도구들을 Yarn의 PnP 기능과 함께 쓸려면 추가적인 구성이 필요합니다. 
Yarn 측에서는 해당 [Editor SDK](https://yarnpkg.com/getting-started/editor-sdks)를 배포하고 있습니다. 
```shell
yarn dlx @yarnpkg/sdks vscode
```

> [!error] 혹시 다음과 같은 에러가 뜨나요?
> `Internal Error: This tool can only be used with projects using Yarn Plug'n'Play`
> 그렇다면 `yarn add` 명령어를 입력해서 의존성을 설치해주세요.


### 기본 명령어

**npm과 비교해서 같은 명령어** 
| command                  | npm | yarn |
| ------------------------ | --- | ---- |
| install dependencies     |  npm install   |   yarn   |
| install package          |  npm install [package]  |   yarn add [package]   |
| install dev package      |  npm install --save-dev [package]   |   yarn add --dev [package]   |
| uninstall package        |  npm uninstall [package]  |   yarn remove [package]   |
| uninstall dev package    |  npm uninstall --save-dev [package]   |   yarn remove [package]   |
| update                   |  npm update  |   yarn upgrade   |
| update package           |  npm update [package]  |   yarn upgrade [package]   |
| global install package   |  npm install --global [package]  |   yarn global add [package]   |
| global uninstall package |  npm uninstall --global [package] |   yarn global remove [package]   |

**npm과 다른 명령어** 
| npm                    | yarn      |
| ---------------------- | --------- |
| npm init               | yarn init |
| npm run                | yarn run          |
| npm test               | yarn test          |
| npm login (and logout) | yarn login          |
| npm link               | yarn link          |
| npm publish            | yarn publish          |
| npm cache clean        | yarn cache clean          |

