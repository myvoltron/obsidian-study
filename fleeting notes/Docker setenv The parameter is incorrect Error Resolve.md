Created at:  2025-01-14 23:51
Tag: #docker #error
References:
Link Notes:

알고 보니 `.env` 파일에 잘못 적은게 있어서 해당 에러가 떴던 것이였다...

key - value 형식으로 써야하는데 key 쓰고 docker로 env 파일을 전달하면 setenv The parameter is incorrect 에러가 뜬다. 