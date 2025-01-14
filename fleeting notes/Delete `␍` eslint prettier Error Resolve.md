Created at:  2025-01-14 23:58
Tag: #error #javascript #formatter
References:
Link Notes:

프로젝트의 `.eslinttrc.js`로 가서 `rules`에 다음 코드를 추가한다.
```json
'prettier/prettier': [
      'error',
      {
        endOfLine: 'auto',
      }, 
    ]
```