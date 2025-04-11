Created at:  2025-01-14 23:47
Tag: #vim 
References:
Link Notes:

# Overview
vscode나 jetbrain IDE 혹은 크롬같은 브라우져에 나오는 windows와 tabs 개념에 익숙해져 있었는데, vim에
서 쓰이는 windows, tabs 개념이 이것과는 다른 것 같아 한번 정리한다. 
## Reference
- https://bakyeono.net/post/2015-08-13-vim-tab-madness-translate.html
- https://learnvim.irian.to/basics/buffers_windows_tabs

# Buffers
버퍼란 텍스트를 편집할 수 있는 메모리 상의 공간을 의미한다. Vim에서 파일을 열 때 해당 파일 데이터가 버퍼에 로드된다.

따라서 다음과 같은 명령을 실행하면,
```shell
vim .vimrc
```
`.vimrc` 파일의 내용을 담은 하나의 버퍼가 생기며 vim이 실행된다.

한번에 두 개 이상의 버퍼를 가질 수 도 있다. 다음과 같은 명령을 실행하면,
```shell
vim .vimrc .zshrc
```
`.vimrc`에 대한 버퍼와 `.zshrc`에 대한 버퍼로 총 2개의 버퍼가 생기며 vim이 실행된다.

그리고 vim 내부에서 버퍼를 다루는 기초적인 명령어를 알아보자. 
- `:buffers` -> 모든 버퍼 목록을 볼 수 있다. (alternatively, you can use `:ls`)
- `:bnext` -> 다음 버퍼로 이동할 수 있다.
- `:buffer` + filename -> filename은 `<Tab>`을 통해서 자동 완성할 수 있다.
- `:buffer` + `n`, `n`은 버퍼 넘버이다. 
- `:bdelete` -> 버퍼를 삭제한다. filename이나 `n` 과 함께 쓰일 수 있다. 
이 외에는 `:h buffer-list` 를 실행해서 다양한 명령어들을 볼 수 있다.

# Windows
윈도우란 메모리상의 버퍼를 실제로 보여주는 창구라고 생각하면 된다. 
나는 버퍼를 백엔드로 윈도우로 프론트엔드로 대입해서 이해했다.

다음 명령어를 실행하면,
```shell
vim .vimrc
```
`.vimrc` 파일의 내용을 담은 버퍼를 볼 수 있는데, 사실 이건 정확한 표현이 아니다. **윈도우**를 통해서 `.vimrc` 버퍼를 본다고 하는게 좀 더 정확하다.

윈도우와 관련된 유용한 명령어를 알아보자.
- `:vsplit` -> Split window vertically 
- `:split` -> Split window horizontally

# Tabs
탭은 윈도우의 집합이다. 일반적인 IDE에서는 탭 하나 당 파일 하나를 편집할 수 있는데 vim에서는 이렇게 쓰면 많이 아쉽다. 
탭 하나 당 하나의 프로젝트를 할당시키거나 같은 프로젝트라도 여러 윈도우 집합을 구성하는 탭을 활용해서 효율적으로 작업할 수 있다.

이러한 탭과 관련된 기초적인 명령어를 알아보자.
- `:tabnew` -> 새로운 탭을 연다. filename과 조합해서 특정 파일을 새로운 탭에서 열 수 있다.
- `:tabclose` -> 현재 탭을 닫는다.
- `:tabnext` -> 다음 탭으로 이동한다.
- `:tabprevious` -> 이전 탭으로 이동한다.