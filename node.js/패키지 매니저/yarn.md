### Yarn berry란? 
Yarn berry란 Node.js를 위한 새롭고 요즘 자주 사용되는 패키지 매니저 프로그램입니다. 기존의 Yarn v1에서 2020년에 정식 버전인 Yarn berry가 출시되었습니다. 
Yarn 공식문서는 [여기](https://yarnpkg.com/)에서 확인하실 수 있습니다. 

> [!info] 먼저 NPM과 Yarn berry의 특징에 대해서 다룹니다. 
> Yarn berry을 빨리 써보고 싶으면 [[#설치해보기]] 섹션으로 가십시오. 


### NPM vs Yarn 비교
NPM에 어떤 문제가 있는지 그리고 Yarn에는 어떤 장점이 있는지 설명합니다. [토스 뱅크의 잘 정리된 글](https://toss.tech/article/node-modules-and-yarn-berry)을 참고했습니다.  

NPM은 기본적으로 Node.js를 설치할 때 같이 설치되는거라 범용적으로 많이 쓰입니다. 하지만 다음과 같이 비효율적인 부분이 많이 있습니다. 

**비효율적인 의존성 검색**
NPM이나 Yarn v1의 경우, 특정 패키지를 탐색하기 위해 해당 패키지를 발견할 때가지 상위 디렉토리의 `node_modules` 디렉토리를 확인하는 과정을 반복합니다. 따라서 패키지를 바로 찾지 못하면 계속해서 상위 디렉토리로 올라가게 되고, 이로 인해 비효율적인 디스크 I/O 연산이 반복됩니다. 

**환경에 따라 달라지는 동작**
위에서 언급했듯이, NPM이나 Yarn v1은 패키지를 찾지 못하면 상위 디렉토리의 node_modules 디렉토리를 계속 검색합니다. 따라서 특정 환경에서는 상위 디렉토리에 node_modules가 있어서 원하는 패키지를 찾을 수도 있습니다. 상위 디렉토리가 어떤지에 따라서 의존성을 불러올 수도 있고 없기도 합니다. 심지어는 잘못된 버전의 의존성을 가져올 수도 있습니다. 
이렇게 환경에 따라 동작이 변하는 건 좋지 않으며, 내부 환경에 의해서만 동작되도록 하는게 좋습니다. 

**비효율적인 설치**
NPM에서 구성하는 node_modules 디렉토리 구조는 매우 큰 공간을 차지합니다. 일반적으로 간단한 CLI 프로젝트도 수백 메가바이트의 node_modules 폴더가 필요합니다. 용량만 많이 차지할 뿐 아니라, 큰 node_modules 디렉토리 구조를 만들기 위해서는 많은 I/O 작업이 필요합니다.

node_modules 폴더는 복잡하기 때문에 설치가 유효한지 검증하기 어렵습니다. 예를 들어, 수백 개의 패키지가 서로를 의존하는 복잡한 의존성 트리에서 node_modules 디렉토리 구조는 깊어집니다.

이렇게 깊은 트리 구조에서 의존성이 잘 설치되어 있는지 검증하려면 많은 수의 I/O 호출이 필요합니다. 일반적으로 디스크 I/O 호출은 메모리의 자료구조를 다루는 것보다 훨씬 느립니다. 이런 문제로 인해 Yarn v1이나 NPM은 기본적인 의존성 트리의 유효성까지만 검증하고, 각 패키지의 내용이 올바른지는 확인하지 않습니다.

**유령 의존성**
NPM 및 Yarn v1에서는 중복해서 설치되는 node_modules를 아끼기 위해 호이스팅 기법을 사용합니다. 즉 다음 그림처럼 중복되는 패키지가 위로 올려집니다. 	
![phantom-dependency][https://zerochae.github.io/assets/images/post/img-2022-05-11-02.png]

왼쪽 트리에서 [A (1.0)]과 [B (1.0)] 패키지는 두 번 설치되므로 디스크 공간을 낭비합니다. 따라서 NPM과 Yarn v1에서는 디스크 공간을 절약하기 위해 왼쪽 트리를 오른쪽 트리처럼 바꿉니다. 
오른쪽 트리로 바뀌면서 원래는 require() 할 수 없었던 [B (1.0)] 패키지를 불러올 수 있게 되었습니다. 
이렇게 끌어올리기에 따라 직접 의존하고 있지 않은 라이브러리를 require() 할 수 있는 현상을 유령 의존성(Phantom Dependency)이라고 부릅니다. 
유령 의존성 현상이 발생할 때, package.json에 명시하지 않은 라이브러리를 조용히 사용할 수 있게 됩니다. 다른 의존성을 package.json 에서 제거했을 때 소리없이 같이 사라지기도 합니다. 이런 특성은 의존성 관리 시스템을 혼란스럽게 만듭니다.

위와 같이 NPM과 Yarn v1은 다양한 문제를 내포하고 있습니다. Yarn berry에서는 이를 어떻게 해결하고 있을까요?

**Plug n Play (PnP)**
Yarn berry에서는 위에서 언급된 문제들을 PnP를 사용해서 해결합니다. 

Yarn berry는 node_modules를 생성하지 않습니다. 대신 `.yarn/cache` 디렉토리에 의존성의 정보가 저장되고 `.pnp.cjs` 파일에 의존성을 찾을 수 있는 정보가 저장됩니다. `.pnp.cjs`를 이용하면 디스크 I/O 없이 어떤 패키지가 어떤 라이브러리에 의존하는지, 각 라이브러리는 어디에 위치하는지 바로 찾을 수 있습니다. 

예를 들어, `@nestjs/common` 패키지는 `.pnp.cjs` 파일에서 다음과 같이 나타납니다. 

```javascript
      ["@nestjs/common", [\
		/* 버전 */
        ["npm:9.3.12", {\
			/* 위치 */
          "packageLocation": "./.yarn/cache/@nestjs-common-npm-9.3.12-1fce422d02-c31a3bc163.zip/node_modules/@nestjs/common/",\
			/* 참고하는 의존성 목록 */
          "packageDependencies": [\

            ["@nestjs/common", "npm:9.3.12"]\

          ],\

          "linkType": "SOFT"\

        }],\
```

npm 9.3.12 버전의 위치와 의존성들 완벽하게 기술하고 있습니다. 

### 설치해보기
NPM으로 Yarn v1을 설치할 수 있습니다. 
```shell
npm install -g yarn
```

그리고 Yarn berry를 쓰길 원하는 프로젝트의 디렉토리에서 다음 명령어를 실행합니다.  
```shell
yarn set version berry 
yarn --version
```

그러면 `.yarn` 폴더와 `.yarnrc.yml` 파일이 생성될겁니다. 이제 해당 프로젝트에서는 Yarn berry를 사용할 수 있게 됩니다.
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

