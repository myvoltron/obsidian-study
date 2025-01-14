Created at:  2025-01-13 17:05
Tag: #javascript #syntax 
References:
Link Notes:

### 모듈의 의미

<aside> 💡 간단히 말해서, 재사용 가능한 코드 조각.

</aside>

- 일반적으로 모듈은 파일 단위로 분리되는데, 보통 모듈들은 자신만의 파일 스코프를 가진다.
- 자신만의 파일 스코프를 가지는 모듈은 모듈의 자산(,즉 변수 함수 객체 등)은 비공개 상태로 되어있다. 그래서 다른 모듈에서 이 모듈에 접근할 수 없다.
- 이 상황에서 모듈에서 공개가 필요한 친구에 한정해서 공개시킬 수 있는 키워드가 `export` 이다.
- 그리고 export된 자산은 다른 모듈에서 재사용될 수 있는데 이거를 그냥 쓰고싶다고 써지는게 아니고... 모듈이 export한 자산 중 일부 or 전체를 선택하는 키워드 `import` 를 써서 재사용할 수 있다.
- 이런 모듈은 기능별로 잘 분리해서 쓴다면 재사용성이 좋아서 개발 효율성 및 유지보수성을 높일 수 있다.

### then,,, 자바스크립트에서의 모듈은?

원래, 자바스크립트에서는 모듈 기능이 지원되지 않았다. 그러니까 파일 스코프, export, import가 없다는 말이다.

이러한 상황에서 모듈 시스템으로서 제안된 친구들이 CommonJS와 AMD 이다.

- Node.js는 모듈 시스템으로서 CommonJS를 선택해서 100%는 아니지만 대략적으로 CommonJS를 따르고 있다고 보면 된다.
- 따라서 Node.js 환경에서는 파일별로 독립적인 파일 스코프를 가지고 있다.

### ES6 모듈(ESM)

이러한 상황에서 또 ES6에서 클라이언트에서 동작하는 모듈 기능을 추가했다.

- 모듈 스코프 : ESM에서는 파일 자체의 **독자적인 모듈 스코프**를 제공한다. 따라서 모듈 스코프 내부에서 선언한 식별자는 모듈 외부에서는 참조할 수 없다. (`export`를 사용하지 않는한)
- `export` : 독자적인 모듈 스코프를 가지기 때문에, 외부에 공개하기 위해서는 `export`라는 키워드를 사용해야한다. `export`키워드는 선언문 앞에다가 쓰는데, 그래서 변수, 함수, 클래스 등 모든 식별자를 `export`할 수 있다.

```jsx
// lib.mjs
// 변수의 공개
export const pi = Math.pi; 

// 함수의 공개
export function square(x) {
	return x * x; 
}

// 클래스의 공개 
export class Person {
	constructor(name) {
		this.name = name; 
	}
}
```

- `import` : 다른 모듈에서 `export`한 식별자들은 자기자신의 모듈 스코프로 데려오기 위해서 `import`라는 키워드를 사용한다.

```jsx
import { pi, square, Person } from './lib.mjs'; 

console.log(pi);                 // 3.14....
console.log(square(10));         // 100
console.log(new Person('Lee'));  // Person { name: 'Lee' } 
```

```jsx
// 모듈이 export한 모든 식별자들은 lib 객체의 프로퍼티로 모아서 import
import * as lib from './lib.mjs';

console.log(lib.pi);                 // 3.14....
console.log(lib.square(10));         // 100
console.log(new lib.Person('Lee'));  // Person { name: 'Lee' } 
```

```jsx
// 모듈이 export한 식별자 이름을 변경하여 import
import { pi as PI, square as sq, Person as P } from './lib.mjs';

console.log(PI);                 // 3.14....
console.log(sq(10));         // 100
console.log(new P('Lee'));  // Person { name: 'Lee' } 
```

- 타입스크립트 : 타입스크립트 환경에서도 거의 유사하게 동작함.