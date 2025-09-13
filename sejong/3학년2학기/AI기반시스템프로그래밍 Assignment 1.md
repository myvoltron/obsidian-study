> [!NOTE]
> 본 레포트 작성에선 AI를 사용하지 않았습니다. 
# 1. VMware에 Ubuntu server 설치
## 1.1 Ubuntu server 초기 설치
대부분 교안에 나와 있는 설정법을 따라갔으므로 일부분은 생략했습니다.

![[Ubuntu 64-bit-2025-09-12-23-21-47.png]]
언어 설정 관련된 것은 모두 English로 맞추고 진행합니다.

![[Ubuntu 64-bit-2025-09-12-23-22-32.png]]
Ubuntu Server로 선택하고 진행합니다. 

![[Ubuntu 64-bit-2025-09-12-23-26-04.png]]
드디어 Profile config 단계입니다. 여러 가지 name과 password를 설정합니다. 
username은 제 학번으로 하였습니다. 

![[Ubuntu 64-bit-2025-09-12-23-26-50.png]]
다음에 Openssh를 써야하므로 설치한다는 것에체크하고 넘어갑니다. 
여러 초기 설정이 끝나고 설치가 진행됩니다. 

![[Ubuntu 64-bit-2025-09-12-23-34-34.png]]
재부팅 이후 **s20011705** 계정으로 로그인을 합니다.

![[Ubuntu 64-bit-2025-09-13-15-03-25.png]]
`lsb_release -a` 명령어를 실행하여 설치된 Ubuntu 버전을 확인 합니다. Ubuntu 24.04 LTS 버전으로 잘 설치된 것을 확인할 수 있습니다.
# 2. Ubuntu 기본적인 tool 설치
## 1.2 Ubuntu 기본적인 tool 설치
```shell
sudo apt update && sudo apt upgrade
```
우선 설치되어 있는 package를 최신화합니다. 
- apt update는 설치된 package 들의 최신 정보를 가져오고 apt upgrade를 통해 설치된 package 들을 실제로 업데이트할 수 있습니다. 

그리고 `gcc` 컴파일러를 설치하기 위해서 다음 명령어를 실행합니다. 
```shell
sudo apt install build-essential
gcc --version # 설치 확인
```

`gcc --version` 결과는 다음과 같습니다.
![[Ubuntu 64-bit-2025-09-12-23-38-09.png]]

마지막으로 ip 확인을 위해서 필요한 도구를 설치합니다. 
```shell
sudo apt install net-tools
ifconfig # 자신의 ip 확인
```

`ifconfig` 결과는 다음과 같습니다. 
![[Ubuntu 64-bit-2025-09-12-23-38-39.png]]
해당 Virtual Machine에 할당된 내부 IP가 192.168.150.134 라는 것을 확인할 수 있습니다. 
# 2. Ubuntu server에 ssh 연결
ubuntu에 ssh 연결을 하기 위해선 ssh server를 설치해야 합니다. 보통은 openssh가 기본적으로 설치됩니다. 
```shell
sudo systemctl status ssh
```

![[Ubuntu 64-bit-2025-09-12-23-39-11.png]]
ssh 서버가 설치되어 있고 실행 중인 것을 확인할 수 있습니다.
## 2.1 로컬 환경에서 ssh 연결
VMware를 설치한 로컬 환경은 Windows11입니다. 따라서 cmd를 통해 ssh 연결을 진행할 수 있습니다. 
![[Pasted image 20250913012127.png]]
역시 로컬에서 연결하는 거라서 별다른 작업 없이 비밀번호만 입력해서 연결할 수 있었습니다.
## 2.2 외부 환경에서 ssh 연결
제가 주로 들고 다니는 노트북은 맥북 즉, MacOS를 씁니다. 따라서 VMware를 통해 Ubuntu를 설치할 수 없어서, Windows11 데스크탑에 띄워진 Ubuntu로 접속해야 합니다. 

> [!info]
> 사실 엄밀히 따지면 MacOS 전용 VMware가 있긴 하지만, 제가 쓰는 맥북이 ARM 아키텍처라서 x86의 Ubuntu를 설치해서 쓸 수 없습니다. 수업 진행에 있어 어떤 애로사항이 있을지 모르니 안전하게 Windows11에서 띄워진 Ubuntu 서버로 접속하는 게 안전하다고 생각됩니다.
### 2.2.1 VMware 포트포워딩
먼저 보안을 위해 well-known 포트인 22가 아니라 다른 임의의 포트를 쓰기 위해서 VMware에서 포트포워딩 설정을 진행합니다. 
VMware -> Edit -> Virtual Network Editor로 들어갑니다. 
![[Pasted image 20250913012624.png]]
그리고 설정 변경을 위해 하단의 **Change Settings**을 눌러서 어드민 권한을 부여 해줍니다. 
이후 VMnet8을 클릭 후 NAT Settings로 들어갑니다. 

![[Pasted image 20250913012930.png]]
여기서 Add 버튼을 눌러서 포트포워딩을 추가합니다. 
- 저는 `Host port`로 8129를 설정했습니다. 따라서 로컬 주소에 8129 포트로도 Virtual machine에 연결할 수 있을 것입니다. 
- `Virtual machine IP address`는 이전에 `ifconfig`에서 나온 ip 주소를 입력했습니다. 
- ssh 연결만을 위한 것이므로 `Virtual machine port`는 22로 설정했습니다. 
이후 Apply를 누르고 빠져나옵니다. 

![[Pasted image 20250913013808.png]]
`ssh s20011705@127.0.0.1 -p 8129` 명령어를 실행 해보니 로컬 주소와 8129 포트로도 잘 연결되는 것을 확인할 수 있었습니다. 
### 2.2.2 공유기 포트포워딩
외부에서 외부 ip를 통해 공유기에 연결된 Windows11 데스크탑으로 접속할 수 있도록 공유기 포트포워딩을 진행해 줍니다. 

그러기 위해선 우선 공유기 설정화면으로 들어가야 합니다.
![[Pasted image 20250913014302.png]]
Windows11 기준으로 cmd에서 `ipconfig` 명령어를 실행시켜서 **Default Gateway** 주소를 확인합니다.
제 **Default Gateway** 주소는 192.168.219.1 인 것을 확인할 수 있습니다. 

![[Pasted image 20250913014411.png]]
해당 주소를 웹 브라우저에 입력해서 공유기 설정 화면으로 들어올 수 있습니다. 

![[Pasted image 20250913014900.png]]
공유기 회사마다 인터페이스가 다르지만, 보통은 다 포트포워딩하는 화면이 있습니다. 이런 식으로 포트포워딩을 추가해서 적용하면 됩니다. 
- 내부 IP 주소는 Virtual machine IP address가 아니라 cmd에서 `ipconfig`를 실행시켰을 때 나오는 내부 IP 주소를 입력합니다.
- 서비스 포트와 내부 포트 모두 동일하게 8129로 맞춰주었습니다. 
따라서 외부에서 우리 집의 외부 IP와 8129포트로 접속을 하면 내부 IP인 192.168.219.104에 8129 포트로 접속이 될 것입니다. 그리고 내부 IP에 8129 포트로 접속하면 Virtual machine IP address에 22포트로 접속이 될 것 입니다. 
### 2.2.3 Windows11 방화벽 inbound 설정
마지막으로 외부에서 Windows11로 접속할 수 있도록 방화벽 inbound 설정을 진행합니다. 
방화벽 및 네트워크 보호 -> 고급 설정으로 들어갑니다. 
그 후 Inbound Rules에서 New Rule을 눌러서 새로운 규칙을 추가합니다. 
![[Pasted image 20250913015516.png]]
![[Pasted image 20250913015531.png]]
위와 같이 규칙을 추가합니다. 당연히 허용할 포트는 8129입니다. 
규칙을 추가했다면 Refresh 버튼을 눌러서 잘 추가되었는지 확인할 수 있습니다. 
### 2.2.4 최종 접속 시도
![[Pasted image 20250913020248.png]]
최종적으로 외부 환경의 MacOS에서 ssh 접속을 시도했고 성공한 것을 볼 수 있습니다.
# 3. C 프로그램 작성 및 컴파일
![[Pasted image 20250913020936.png]]
먼저 vscode에서 Ubuntu server로 ssh 접속을 합니다.

![[Pasted image 20250913021245.png]]
그리고 위와 같이 코드를 작성 후 컴파일 및 실행합니다. 저는 홈 디렉터리에서 `aisys` 디렉터리를 추가 후 해당 디렉터리 내부에서 c 소스코드를 추가했습니다. 
```shell
mkdir aisys
cd aisys

# 코드 작업 후

gcc ./20011705.c -o 20011705
./20011705
```
최종 결과로 `Hello Jiseop 20011705`가 잘 출력되는 것을 확인할 수 있습니다.