Created at:  2025-01-14 23:56
Tag: #개발도구 #obsidian #git
References:
Link Notes:

`.gitignore` 파일은 다음과 같이 설정한다.
```.gitignore
.obsidian/workspace
```

`.gitignore` 파일을 커밋하고 캐시된 `.obsidian/workspace`를 제거한다.
-> `git rm --cached .obsidian/workspace`

다시 커밋한다.