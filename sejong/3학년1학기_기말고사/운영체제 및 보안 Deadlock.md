---
mindmap-plugin: basic
---

# 7. Deadlocks

## 7.1 Deadlock Problem
- 정의: 프로세스 집합이 서로 자원을 기다리며 영원히 blocked 상태에 빠지는 현상
- 예시
  - 두 개 디스크 드라이브: P1과 P2가 서로 반대 자원 기다림
  - 세마포어 deadlock: wait(A), wait(B) → wait(B), wait(A)

## 7.2 System Model
- Resource types: R1 ~ Rm
- 자원은 request → use → release 순서로 사용됨
- 자원 인스턴스 수: Wi

## 7.3 Deadlock Characterization
- Deadlock 발생 조건 (4가지 필요조건)
  - Mutual Exclusion
  - Hold and Wait
  - No Preemption
  - Circular Wait

## 7.4 Resource Allocation Graph (RAG)
- P = 프로세스 집합, R = 자원 집합
- 요청 간선: Pi → Rj
- 할당 간선: Rj → Pi
- 사이클 없음 → deadlock 없음
- 사이클 있음
  - 단일 인스턴스: deadlock 확정
  - 다중 인스턴스: deadlock 가능성 있음

## 7.5 Handling Deadlocks

### 7.5.1 Prevention
- 4가지 조건 중 하나 이상 **사전에 무효화**
- Mutual Exclusion → 공유 자원만 사용
- Hold and Wait → 자원 전부 한 번에 요청
- No Preemption → 자원 요청 실패 시 기존 자원 회수
- Circular Wait → 자원 순서 정해서 순서대로 요청

### 7.5.2 Avoidance
- 사전 정보 필요: 최대 자원 요구량
- Safe State 개념 도입
- Safe → Deadlock 없음
- Unsafe → Deadlock 발생 가능
- 알고리즘
  - Single instance: RAG 확장 모델
  - Multiple instances: Banker's Algorithm
    - 자료구조: Max, Allocation, Need, Available
    - Resource Request Algorithm: 요청을 시뮬레이션 후 Safety 확인
    - Safety Algorithm: 모든 프로세스가 종료 가능하면 Safe

### 7.5.3 Detection & Recovery
- Detection: Deadlock 발생 여부를 주기적으로 확인
  - Wait-for Graph: 단일 인스턴스 자원 전용
  - Detection Algorithm: 다중 인스턴스용
    - 자료구조: Allocation, Request, Available
    - Finish[i] == false인 프로세스가 존재하면 Deadlock 발생 중
- Recovery
  - 프로세스 종료
  - 자원 선점
    - Rollback 필요
    - Starvation 주의

### 7.5.4 Ignore (Do nothing)
- 대부분의 OS는 deadlock 무시함 (예: UNIX)