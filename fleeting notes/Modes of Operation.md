Created at:  2025-03-04 13:58
Tag: #cryptography 
References:
Link Notes: 

블록 암호화는 여러가지 요구사항들을 충족시키기 위해서 모드 운영 방식을 도입했고 여기서 5가지의 모드 운영 방식들을 소개한다.
1. **패턴 노출 방지:** 반복되는 패턴 문제 해결.
2. **패딩 문제 해결:** 스트림처럼 처리해 패딩 없이 유연하게.
3. **오류 전파 방지:** 신뢰성 강화.
4. **병렬 처리 가능:** 속도와 효율성 향상.
5. **스트림 암호처럼 사용:** 실시간 통신에 유리.
# Electronic Codebook (ECB)
- 평문을 적절한 사이즈의 블록으로 쪼개서 각 평문 블록들을 암호화하는 가장 기본적인 방식.
-  $C_i = E_K(P_i) \quad \text{for } i = 1, 2, \dots, N$  따라서 암호문은 $C = C_1 \Vert C_2 \Vert \dots \Vert C_N$ 이다.
- 초기화 벡터가 없어서 Randomness가 부족, 동일한 평문 + 동일한 키 = 동일한 암호문
- 오류 변조 탐지 불가능, 오류 전파가 없어서 암호문 일부가 변조되어도 해당 블록만 복호화 오류가 발생한다.

# Cipher Block Chaining (CBC)
- 각 암호문 블록이 이전 암호문 블록에 의존한다.
- IV라는 초기화 벡터를 사용해서 첫 번째 블록 암호화.
- 암호화 => $C_j = E_K(P_j \oplus C_{j-1})$
	- $C_0$는 IV라는 랜덤한 값을 쓴다.
- 복호화 => $P_j = D_K(C_j) \oplus C_{j-1}$ 

![CBC](https://delta.cs.cinvestav.mx/~francisco/cripto/modes_archivos/Cbc_encryption.png)
# Cipher Feedback (CFB)
- ECB나 CBC는 평문에 대한 완전한 블록이 되기 전 까지는 암호화를 시작할 수 없다. (패딩이 필요함)
- 반면에 CFB는 1비트 모드 혹은 8비트 모드를 통한 **steam** 모드를 지원한다.
- 64비트 블록을 암호화하고 그 output 또한 64비트라고 가정하자. 그러나 ECB나 CBC와는 달리, 평문을 8비트의 조각들로 쪼개어서 block cipher로 만들어진 pseudorandom bit stream과 XORing해서 암호화를 진행한다.
	- $X_1$ 가 초기 64비트 값을 가질 때, $\text{for } j = 1, 2, 3, \dots,$ 암호화 과정은 다음과 같다.
		- $O_j = L_8(E_K(X_j))$
		- $C_j = P_j \oplus O_j$
		- $X_{j+1} = R_{56}(X_j) || C_j$
	- 복호화는 다음과 같다.
		- $P_j = C_j \oplus L_8(E_K(X_j))$
		- $X_{j+1} = R_{56}(X_j) || C_j$
		- 복호화 과정에 복호화 함수, $D_K$가 없는 것을 명심하자.
- Ciphertext에 에러가 발생하더라도 복호화 과정에서 복구가 가능하다.

![CFB](https://i.sstatic.net/jaqUc.png)
# Output Feedback (OFB)
- CBC와 CFB 모드는 에러 전파라는 단점이 존재한다. OFB는 에러 전파를 피할 수 있다!
- CFB 모드와 거의 비슷하다. 여기서도 8비트 모드 기준으로 설명한다.
- CFB 모드에서는 레지스터 $X_2$를 업데이트할 때 $X_1$에 ciphertext를 덧붙인다. 반면에, OFB에서는 암호화의 output을 덧붙인다!
	- $\text{for }j = 1,2,3,\dots:$
	- $O_j = L_8(E_K(X_j))$
	- $X_{j+1} = R_{56}(X_j) || O_j$
	- $C_j = P_j \oplus O_j$
- 이러한 $O_j$ output key들은 어떠한 평문없이도 완전하게 생성될 수 있다.
- ciphertext에 대한 에러가 전파되지 않는다.
- 그러나 이러한 output key들이 노출되면 위험하다.

![OFB](https://www.researchgate.net/publication/273260684/figure/fig4/AS:391769960271878@1470416645589/OFB-Output-Feedback-mode-Counter-CTR-Mode-Counter-mode-is-a-stream-cipher-such-as.png)
# Counter (CTR)
- output key stream을 쓴다는 점에서 OFB와 비슷하다!
- 그러나 가장 큰 차이점은 CTR에서는 $O_j$가 이전의 output streams에 연결되어 있지 않다.
- 일반적으로 CTR의 절차는 다음과 같다.
	- $X_j = X_{j-1} + 1$
	- $O_j = L_8(E_K(X_j))$
	- $C_j = P_j \oplus O_j$
- CTR 또한 OFB와 비슷하게 ciphertext에 대한 에러 전파가 없다.
- 그리고 많은 양의 output chunks $O_j$를 병렬로 계산할 수 있어서 빠르다!

![CTR](https://delta.cs.cinvestav.mx/~francisco/cripto/modes_archivos/Ctr_encryption.png)

