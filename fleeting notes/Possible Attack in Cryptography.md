Created at:  2025-02-23 13:01
Tag: #cryptography 
References:
Link Notes:

암호학에서 4가지 공격 유형은 다음과 같다.

# 1. Ciphertext only
- 오직 암호문을 가지고 평문이나 키를 찾는 방법
- 공격자에게 굉장히 불리함
# 2. Known plaintext only
- 암호문과 그 암호문에 대응하는 일부 혹은 전체 평문을 알고 있는 경우.
- 공격자가 키를 알아낸다면 같은 키로 암호화된 모든 암호문을 복호화할 수 있다.
# 3. Chosen plaintext
- 평문을 선택하면 그에 대한 암호문을 알 수 있는 상황 -> encryption machine!!
# 4. Chosen ciphertext
- 암호문을 선택하면 그에 대한 평문을 알 수 있는 상황 -> decryption machine!!
