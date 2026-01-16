# `mini_shell_ai_pipe.c`
```c
#include <stdio.h>
#include <unistd.h>
#include <string.h>
#include <sys/wait.h>

// 간단한 미니 셸: ai_helper_chat 프로그램과 파이프로 통신

int main(void) {
    // 파이프를 위한 파일 디스크립터 배열
    int to_child[2];
    int from_child[2];

    // 파이프 생성: 부모 -> 자식, 자식 -> 부모
    // 둘 중 하나라도(hint : or 연산) 실패하면 종료
    if (pipe(to_child) != 0 || pipe(from_child) != 0) {
        perror("pipe");
        return 1;
    }

    // 자식 프로세스 생성
    pid_t pid = fork();

    if (pid == 0) {
        // 자식 프로세스: ai_helper_chat 실행

        // 표준 입력을 파이프로 리다이렉트
        dup2(to_child[0], STDIN_FILENO);
        // 표준 출력을 파이프로 리다이렉트
        dup2(from_child[1], STDOUT_FILENO);
        
        // 사용하지 않는 파이프 끝 닫기
        close(to_child[1]);
        close(from_child[0]);
        // ai_helper_chat 실행
        execl("./ai_helper_chat_repl", "ai_helper_chat_repl", (char *)NULL);
        perror("execl");
        _exit(127);
    }

    // 부모인 경우 자식에게는 쓰기 파이프 열고, 자식으로부터는 읽기 파이프 열기
    // 나머지는 닫음. 
    close(to_child[0]);
    close(from_child[1]);

    char buf[1024];
    while (1) {
        printf("mini-shell> ");
        fflush(stdout);

        // 사용자 입력 읽기 fgets() 사용, stdin에서 읽기
        if (!fgets(buf, sizeof(buf), stdin))  
            break;
        if (strncmp(buf, "exit", 4) == 0) 
            break;

        // 자식에게 가는 파이프에 입력 전송
        write(to_child[1], buf, strlen(buf));

        // 자식한테서 오는 파이프에 한 줄 응답 읽기, 오기 전까지는 blocking이 됨
        ssize_t n = read(from_child[0], buf, sizeof(buf)-1);
        if (n > 0) {
            buf[n] = '\0';
            printf("[AI] %s", buf);
        } else {
            break;
        }
    }

    // 파이프 둘다 닫기 
    close(to_child[1]);
    close(from_child[0]);
    // 자식 프로세스 대기
    waitpid(pid, NULL, 0);
    return 0;
}
```

# `mini_shell_ai_fifo.c`
```c
#include <stdio.h>
#include <unistd.h>
#include <string.h>
#include <sys/wait.h>
#include <fcntl.h>
#include <sys/stat.h>

int main(void) {
    // FIFO 이름
    const char *fifo_to_child = "to_child_fifo";
    const char *fifo_from_child = "from_child_fifo";

    // FIFO 생성 (이미 존재하면 에러 무시), 모드는 0666
    mkfifo(fifo_to_child, 0666);
    mkfifo(fifo_from_child, 0666);

    // 자식 프로세스 생성
    pid_t pid = fork(); 

    // 자식 프로세스. pid 체크 해야겠죠?
    if (pid == 0) {
        //------------------------------------------------------------------
        // 자식 프로세스
        //------------------------------------------------------------------

        // FIFO 열기 (부모 → 자식 : 자식은 READ)
        int to_child_fd = open(fifo_to_child, O_RDONLY);
        // FIFO 열기 (자식 → 부모 : 자식은 WRITE)
        int from_child_fd = open(fifo_from_child, O_WRONLY);

        // dup2: 자식 표준입력/출력을 FIFO로 연결
        dup2(to_child_fd, STDIN_FILENO);
        dup2(from_child_fd, STDOUT_FILENO);

        // 사용하지 않는 FIFO 끝 닫기
        close(to_child_fd);
        close(from_child_fd);

        // ai_helper_chat 실행. 
        execl("./ai_helper_chat_repl", "ai_helper_chat_repl", (char *)NULL);
        perror("execl");
        _exit(127);
    }

    //----------------------------------------------------------------------
    // 부모 프로세스
    //----------------------------------------------------------------------

    // 부모 → 자식 : 부모는 WRITE
    int to_child_fd = open(fifo_to_child, O_WRONLY);
    // 자식 → 부모 : 부모는 READ
    int from_child_fd = open(fifo_from_child, O_RDONLY);

    char buf[1024];

    // fd --> FILE 로 변환 하기 위해서 fdopen() 사용. fgets() 사용하려고.
    FILE *fp = fdopen(from_child_fd, "r");

    while (1) {
        printf("mini-shell> ");
        fflush(stdout);

        // 한 줄씩만 입력 받는걸로 하죠. 
        if (!fgets(buf, sizeof(buf), stdin)) 
            break;

        if (strncmp(buf, "exit", 4) == 0)
            break;

        // 자식에게 전달
        write(to_child_fd, buf, strlen(buf));
       
        printf("[AI] ");
        // 자식의 응답 읽기
        // 한 줄씩 읽어서 <<<END>>> 나오면 종료. ai_helper_chat_repl.c에서 끝을 알기 위해서 태그 붙여서 보냄. 
        while (fgets(buf, sizeof(buf), fp)) {
            // <<<END>>> 나오면 응답 끝
            if (strncmp(buf, "<<<END>>>", 9) == 0)
                break;
            printf("%s", buf);
        }
    }

    // FIFO을 fopen()으로 열었어니 fclose() 사용. 
    fclose(fp);
    
    // FIFO 닫기 
    close(to_child_fd);
    close(from_child_fd);

    // 자식 프로세스 대기
    waitpid(pid, NULL, 0);

    return 0;
}
```