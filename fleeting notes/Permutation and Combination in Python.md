Created at:  2025-08-21 22:35
Tag:
References:
Link Notes:

# 1. Permutation
```python
def permutations(arr, r):
    result = []
    used = [False] * len(arr)

    def backtrack(path):
        if len(path) == r:
            result.append(tuple(path))
            return
        for i in range(len(arr)):
            if not used[i]:
                used[i] = True
                backtrack(path + [arr[i]])
                used[i] = False

    backtrack([])
    return result
```
## 1.1 주요 변수와 개념
- **arr**: 순열을 뽑을 원소들.
- **r**: 순열 길이.
- **result**: 완성된 순열들을 저장하는 리스트.
- **used**: 각 원소가 현재 경로(path)에 사용 중인지 표시하는 배열.
- **path**: 현재까지 선택된 원소들의 리스트 (부분 순열).
## 1.2 동작 흐름
1. **시작**
    - backtrack([]) 호출로 빈 경로에서 출발.
    - 모든 used[i]는 False → 아직 아무 원소도 안 썼음.
2. **베이스 케이스**
    - if len(path) == r:
    - 경로 길이가 목표(r)에 도달하면, 그 순간이 하나의 **완성된 순열**.
    - tuple(path)로 변환해서 result에 추가 후 리턴.
3. **재귀 탐색**
    - for i in range(len(arr)):
        모든 원소 인덱스를 순회하면서 아직 안 쓴 원소 (if not used[i])를 고름.
    - used[i] = True → 이 원소는 지금 경로에 포함됐다고 표시.
    - backtrack(path + [arr[i]]) → 경로 확장해서 더 깊이 탐색.
    - 탐색 끝나면 used[i] = False → 원상복구(backtracking).
        → 이렇게 해서 다음 분기에서 다시 이 원소를 쓸 수 있게 됨.
## 1.3 왜 ‘순열’이 되는가?
- 조합과 달리 **start가 없고, 매번 0부터 전체 arr를 돈다.**
- 대신 used[i]로 중복 방지.
- 이 때문에 뽑는 순서가 바뀌면 **다른 결과**로 들어감 → 순열.
## 1.4 예제 실행 (arr=[1,2,3]**,** r=2)
1. 시작: backtrack([])
    - i=0 → [1], used[0]=True
        - i=1 → [1,2] → 길이 2 도달 → (1,2)
        - i=2 → [1,3] → 길이 2 도달 → (1,3)
    - i=1 → [2], used[1]=True
        - i=0 → [2,1] → (2,1)
        - i=2 → [2,3] → (2,3)
    - i=2 → [3], used[2]=True
        - i=0 → [3,1] → (3,1)
        - i=1 → [3,2] → (3,2)
최종 결과:
[(1,2),(1,3),(2,1),(2,3),(3,1),(3,2)]
## 1.5 복잡도
- 순열 개수는 **P(n,r) = n! / (n-r)!**
- 매 경로마다 path+[arr[i]]에서 리스트 새로 복사하니 원소당 O(r) 비용.
- 총 시간 대략 **O(P(n,r) · r)**.
# 2. Combination
```python
def combinations(arr, r):
    result = []

    def backtrack(start, path):
        if len(path) == r:
            result.append(tuple(path))
            return
        for i in range(start, len(arr)):
            backtrack(i + 1, path + [arr[i]])

    backtrack(0, [])
    return result
```
## 2.1 주요 변수와 개념
- `start`: 다음에 뽑을 수 있는 **시작 인덱스**. 이전에 뽑은 인덱스보다 **오른쪽만** 보게 해서 중복 제거.
- `path`: 지금까지 뽑아놓은 원소들(부분해). 길이가 r되면 결과에 추가.
## 2.2 동작 흐름
1. backtrack(0, [])에서 시작.
2. 매 호출에서
    - **베이스케이스**: len(path) == r면 result.append(tuple(path)) 하고 리턴.
    - **반복**: for i in range(start, len(arr))
        → arr[i]를 뽑고 다음은 i+1부터 계속(왼쪽은 다시 안 봄).
이렇게 하면 **(i1 < i2 < … < ir)**처럼 **인덱스가 증가하는 조합**만 생긴다.
즉, (1,2)만 나오고 (2,1)은 절대 안 나온다. 그래서 **중복 없는 조합**이 되는 거다.
## 2.3 왜 ‘조합’이 되는가?
- **중복 방지**: start를 쓰니까 이미 뽑은 인덱스보다 작은 인덱스는 다시 못 뽑음.
- **순서 무시**: 경로가 항상 **오름차순 인덱스**로 쌓이니, 같은 원소 집합이 다른 순서로 나오는 일 자체가 없다.
## 2.4 예제 (arr=[1,2,3,4],r=2)
- backtrack(0, [])
    - i=0 → backtrack(1, [1])
        - i=1 → backtrack(2, [1,2]) → 길이 2니까 결과에 (1,2)
        - i=2 → backtrack(3, [1,3]) → (1,3)
        - i=3 → backtrack(4, [1,4]) → (1,4)
    - i=1 → backtrack(2, [2])
        - i=2 → (2,3)
        - i=3 → (2,4)
    - i=2 → backtrack(3, [3])
        - i=3 → (3,4)
    - i=3 → backtrack(4, [4]) → 더 못 뽑음 → 종료
        → 최종: (1,2),(1,3),(1,4),(2,3),(2,4),(3,4)
## 2.5 복잡도
- 조합 개수는 **C(n, r)**.
- 각 해를 만들 때 path + [arr[i]]에서 리스트 복사가 일어나므로 해 하나당 O(r) 정도 부가비용.
- 총 시간 대략 **O(C(n,r) · r)**, 공간은 **재귀 깊이 O(r)** (+ 결과 저장 공간).
## 2.6 엣지 케이스
- r == 0 → [()] (공집합 하나) 잘 나온다.
- r > len(arr) → 만들 수 있는 조합 없음 → [].