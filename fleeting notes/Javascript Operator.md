Created at:  2025-01-13 15:46
Tag: #javascript #syntax 
References:
Link Notes: [[Javascript Array Methods]] 

### Nullish coalescing 연산자
- `??` 연산자는 왼쪽 피연산자값이 `null`이거나 `undefined`일 때 오른쪽 피연산자를 반환합니다.

```jsx
const data= null ?? 'data';
// expected output: "data"

const data1 = 1 ?? 4;
// expected output: 1
```
### Spread 연산자
- Spread 문법인 `…`은 하나로 뭉쳐 있는 여러 값들의 집합(`Array`, `String` 등)을 펼쳐서 개별적인 값들로 만들어 버립니다.

```jsx
console.log(...[1, 2, 3]); // 1 2 3
console.log(...[1, 2], ...[3, 4]); // [1, 2, 3, 4]
```
