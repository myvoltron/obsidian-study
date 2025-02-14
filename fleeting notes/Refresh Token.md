Created at:  2025-01-13 16:10
Tag: #web #auth 
References:
Link Notes: [[Json Web Tokens(JWT) - Access Token]]

# Access Token
- 기존의 JWT 인증방식은 **Access Token**라고 불리는 토큰을 사용한다.
- 유효기간을 짧게 설정하면 탈취당해도 그나마 보안에 강할 수 있음. 그러나 자주 로그인을 해야한다는 단점이 있다.
- 유효기간을 길게 설정하면 탈취당했을 때 보안에 더 취약해짐. 그러나 로그인을 자주하지 않아도 된다.
- 그렇다면 유효기간을 짧게 설정해서 보안성의 장점을 가져가고 로그인을 자주해야한다는 단점을 지울 수 없을까?
# Refresh Token
- 위의 답으로 나온 것이 바로 **Refresh Token**. 이것 또한 **Access Token**과 똑같은 형태의 JWT이다.
- 처음 로그인을 할 때 **Access Token**과 **Refresh Token**을 받는다.
    - **Access Token**은 유효 기간을 짧게 설정.
    - **Refresh Token**은 유효 기간을 길게 설정.
- **Refresh Token**의 긴 유효 기간 덕분에 **Access Token**이 빠르게 만료되었더라도 다시 발급받을 수 있는 키 역할을 하게 된다.
### Access Token + Refresh Token Flow
![access token and refresh token flow](https://img1.daumcdn.net/thumb/R1280x0/?scode=mtistory2&fname=https%3A%2F%2Ft1.daumcdn.net%2Fcfile%2Ftistory%2F99DB8C475B5CA1C936)