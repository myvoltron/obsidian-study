#javascript #nodejs #promise
# References
- https://merrily-code.tistory.com/214
- https://velog.io/@hiro2474/understandfor-await-of

# 1. `Promise.all()`
**먼저 어떻게 쓰는가?**
우선 mdn 문서는 [여기](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/all#description)를 참고하길 바란다.  


## 1.1 문법
```javascript
Promise.all(iterable);
```

`iterable`
[`Array`](https://developer.mozilla.org/ko/docs/Web/JavaScript/Reference/Global_Objects/Array)와 같이 [순회 가능](https://developer.mozilla.org/ko/docs/Web/JavaScript/Reference/Iteration_protocols#the_iterable_protocol)한(iterable) 객체.

반환 값
-   매개변수로 주어진 순회 가능한 객체가 비어 있으면 **이미 이행한** [`Promise`](https://developer.mozilla.org/ko/docs/Web/JavaScript/Reference/Global_Objects/Promise).
-   객체에 프로미스가 없으면, **비동기적으로 이행하는** [`Promise`](https://developer.mozilla.org/ko/docs/Web/JavaScript/Reference/Global_Objects/Promise). 단, Google Chrome 58은 **이미 이행한** 프로미스를 반환합니다.
-   그렇지 않은 경우, **대기 중**인 [`Promise`](https://developer.mozilla.org/ko/docs/Web/JavaScript/Reference/Global_Objects/Promise). 결과로 반환하는 프로미스는 인자의 모든 프로미스가 이행하거나 어떤 프로미스가 거부할 때 (호출 스택이 비는 즉시) **비동기적으로** 이행/거부합니다. "`Promise.all`의 동기성/비동기성" 예제를 참고하세요. 반환하는 프로미스의 이행 값은 매개변수로 주어진 프로미스의 순서와 일치하며, 완료 순서에 영향을 받지 않습니다.

## 1.2 설명
이 메서드는 여러 프로미스의 결과를 집계할 때 유용하게 사용할 수 있습니다. 일반적으로 다음 코드를 계속 실행하기 전에 서로 연관된 비동기 작업 여러 개가 모두 이행되어야 하는 경우에 사용됩니다.

입력 값으로 들어온 프로미스 중 **하나라도** 거부 당하면 `Promise.all()`은 즉시 거부합니다. 이에 비해, [`Promise.allSettled()`](https://developer.mozilla.org/ko/docs/Web/JavaScript/Reference/Global_Objects/Promise/allSettled)가 반환하는 프로미스는 이행/거부 여부에 관계없이 주어진 프로미스가 모두 완료될 때까지 기다립니다. 결과적으로, 주어진 이터러블의 모든 프로미스와 함수의 결과 값을 최종적으로 반환합니다.

이행
반환한 프로미스의 이행 결과값은 (프로미스가 아닌 값을 포함하여) 매개변수로 주어진 순회 가능한 객체에 포함된 **모든** 값을 담은 배열입니다.

-   빈 객체를 전달한 경우, (동기적으로) 이미 이행한 프로미스를 반환합니다.
-   전달받은 모든 프로미스가 이미 이행되어 있거나 프로미스가 없는 경우, 비동기적으로 이행하는 프로미스를 반환합니다.

거부
주어진 프로미스 중 하나라도 거부하면, 다른 프로미스의 이행 여부에 상관없이 첫 번째 거부 이유를 사용해 거부합니다.

**async/await이 있는데 Promise.all(), 왜 써야할까?**
보통 Promise를 처리할 때 동기적으로 처리하기 위해서 async/await 문법을 많이 사용한다. 하지만 여러 개의 비동기 작업을 병렬적으로 처리하고 싶을 땐 어떻게 해야할까? 
여러 개의 비동기 작업을 병렬적으로 처리한다 즉, 순서가 중요하지 않은 작업을 뜻합니다. 다음과 같은 예시 상황들이 있습니다. 

1.  여러 개의 API 요청을 병렬로 호출해야하는 경우 예를 들어, 사용자가 검색어를 입력하면 검색어에 대한 결과를 제공하는 데 필요한 여러 개의 API가 있다면, 이러한 API를 모두 병렬적으로 호출할 수 있습니다.
2.  여러 개의 이미지를 병렬적으로 다운로드해야하는 경우 웹 페이지에서 이미지를 보여줘야 할 때, 이미지를 병렬적으로 다운로드하여 로딩 시간을 단축할 수 있습니다.

![비교][https://blog.kakaocdn.net/dn/1yV49/btqGYpxYRYP/zuhA7oic2ZxkZVQpQCwKT1/img.png]
