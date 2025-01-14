Created at:  2025-01-14 23:21
Tag: #git 
References:
- [https://itholic.github.io/git-pull-request/](https://itholic.github.io/git-pull-request/)
- [https://jedidev.tistory.com/4](https://jedidev.tistory.com/4)

# PR(Pull Request)이란 
- 깃허브나 비트버켓 등에서 쓰이는 개념
- 핵심은, 내가 작업한 코드가 원본 저장소에 합쳐져도 괜찮은지 **검수**를 받는것
- 혼자 사용하는 repository라면 상관없겠지만, 여러 명이 사용하는 경우라면 코드를 하나하나 merge할 때 신중해야하기 때문이다.

PR은 크게 두 가지 방식으로 할 수 있다.
- write권한이 있는 repository의 원본 저장소를 받아 작업 후 PR
    - 예) 내게 write 권한이 있으며, 여러 사람이 작업하는 사내 프로젝트의 경우
- write권한이 없는 repository의 fork 저장소를 받아 작업 후 PR
    - 예) 오픈소스처럼 write 권한이 없는 프로젝트에 기여하고 싶을때
## 원본 저장소를 바로 clone해서 PR하기
1. git repository 받아오기
    `git clone <clone url>`
    - 해당 명령어를 통해서 작업할 git repository를 받아온다.
2. 따로 작업 branch 만들기
    `git branch my_branch`
    - git branch 기능을 활용해, 나만의 작업공간을 만든다.
    
    `git checkout my_branch`
    - checkout 명령으로 브랜치를 변경해서 새로 만든 작업공간을 쓰자.
3. 내 작업 branch에 commit
    - 하고자 했던 작업들을 완료했다면 그 결과를 commit해서 새로 만든 브랜치에 저장한다.
4. PR 보내기
5. merge되기까지 기다리기