Created at:  2025-01-13 15:36
Tag: #javascript #syntax
References:
Link Notes:

### `includes`
- 배열 내에 특정 요소가 포함되어 있는지 확인해 `true` 또는 `false`를 반환합니다.
- 첫 번째 인수로 검색할 대상을 지정합니다.
- 두 번째 인수로 검색을 시작할 인덱스를 전달할 수 있습니다. 디폴트는 0입니다.

```jsx
const arr = [1, 2, 3]; 

arr.includes(2); // -> true
arr.includes(1, 1); // -> false
```
### `join`
- 원본 배열의 모든 요소를 문자열로 변경하고, 인수로 받은 문자열(**구분자**)로 연결된 문자열을 반환하게 됩니다.
- **구분자**의 디폴트값은 콤마(’,’)입니다.

```jsx
const arr = [1, 2, 3, 4];

arr.join(); // '1,2,3,4,'
arr.join(''); // '1234'
arr.join(':'); // '1:2:3:4'
```
### `fill`
- 원본 배열이 변경됩니다.
- 첫 번째 인수로 전달받은 값으로 배열에 꽉 채워넣습니다.
- 두 번째 인수로 요소 채우기를 시작할 인덱스를 지정합니다.
- 세 번째 인수로 요소 채우기를 멈출 인덱스를 지정합니다.

```jsx
const arr = [1, 2, 3];

arr.fill(0); // -> [0, 0, 0]

//

arr.fill(0, 1); // -> [1, 0, 0]
```
### `sort`
- 배열의 요소들을 정렬합니다.
- 원본 배열을 직접 **변경**하고 정렬된 배열을 반환합니다.
- 기본적으로 오름차순으로 정렬합니다.
- 숫자 요소를 정렬할 때는 `sort` 메서드에 **정렬 순서를 정의**하는 **비교 함수**를 인수로 전달해야합니다.
	- 해당 비교 함수는 양수, 음수, 0을 반환할 수 있습니다.
	- 음수 → 비교 함수의 첫 번째 요소를 먼저 정렬
	- 양수 → 비교 함수의 두 번째 요소를 먼저 정렬
	- 0 → 아무것도 안함

```jsx
const fruits = ['Banana', 'Orange', 'Apple'];
fruits.sort(); // -> ['Apple', 'Banana', 'Orange']

const points = [40, 100, 1, 5, 2, 25, 10]; 
points.sort((a, b) => a -b); // -> [1, 2, 5, 10, 25, 40, 100]
```
### `forEach`
- `for`문을 대체할 수 있는 메서드입니다. 즉, 자신의 **내부**에서 **반복문**을 실행합니다.
- 배열의 모든 요소를 순회하면서 인수로 받은 **콜백 함수**를 반복해서 호출합니다.
- 반환값은 `undefined`입니다.

```jsx
const numbers = [1, 2, 3];
const pows = [];

numbers.forEach(item => pows.push(item ** 2)); 
// pows -> [1, 4, 9] 
```
### `map`
- 배열의 모든 요소를 순회하면서 인수로 받은 **콜백 함수**를 반복해서 호출합니다.
- 호출된 **콜백 함수**의 반환값들로 구성된 **새로운 배열을 반환**합니다.

```jsx
const numbers = [1, 4, 9];

const roots = numbers.map(item => Math.sqrt(item)); 
// roots -> [ 1, 2, 3 ]
```
### `filter`
- 배열의 모든 요소를 순회하면서 인수로 받은 **콜백 함수**를 반복해서 호출합니다.
- **콜백 함수**의 반환값이 `true`인 요소로만 구성된 **새로운 배열**을 반환합니다.

```jsx
const numbers = [1, 2, 3, 4, 5];
const odds = numbers.filter(item => item % 2);
// odds -> [1, 3, 5] 
```

