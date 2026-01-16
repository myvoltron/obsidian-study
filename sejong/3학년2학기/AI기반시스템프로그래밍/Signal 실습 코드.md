# `mini_shell_toggle.c`
```c
// Ctrl+\ (SIGQUIT) 사용하여 AI 모드 토글
// AI 모드에서는 exec 금지하고 안내 메시지만 출력

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <sys/wait.h>
#include <errno.h>
#include <signal.h>

#define MAXLINE 1024
#define MAXARGS 64

// --- AI Mode 상태 ---
static volatile int ai_mode = 0;

// 문자열 파싱
void parse_line(char *line, char **argv) {
    int i = 0;
    char *token = strtok(line, " \t\n");
    while (token != NULL && i < MAXARGS - 1) {
        argv[i++] = token;
        token = strtok(NULL, " \t\n");
    }
    argv[i] = NULL;
}

// --- SIGQUIT 핸들러 (Ctrl+\) ---
void handle_sigquit(int signo) {
    (void)signo;
    const char msg_on[] = "\n[AI MODE ON]\nAI-shell> ";
    const char msg_off[] = "\n[AI MODE OFF]\nmini-shell> ";
    
    ai_mode = !ai_mode;
    if (ai_mode) {
        write(STDOUT_FILENO, msg_on, sizeof(msg_on) - 1);
    } else {
        write(STDOUT_FILENO, msg_off, sizeof(msg_off) - 1);
    }
}

int main(void) {
    char line[MAXLINE];
    char *argv[MAXARGS];
    pid_t pid;
    int status;

    // 쉘의 기본 시그널 제어 ---     
    signal(SIGTTIN, SIG_IGN); // background 프로세스가 터미널에서 읽으려고 하면, 무시
    signal(SIGTTOU, SIG_IGN); // background 프로세스가 터미널에 쓰려고 하면, 무시
    signal(SIGTSTP, SIG_IGN); // Ctrl+Z (SIGTSTP) 무시 (쉘은 멈추면 안됨)
    signal(SIGQUIT, handle_sigquit);   // Ctrl+\ 로 AI 모드 토글

    
    while (1) {
        // --- 프롬프트 출력 ---
        if (ai_mode)
            printf("AI-shell> ");
        else
            printf("mini-shell> ");
        fflush(stdout);

        // --- 입력 받기 ---
        if (fgets(line, sizeof(line), stdin) == NULL) {
            printf("\n");
            break; // EOF (Ctrl+D)
        }
        if (line[0] == '\n') {
            continue;
        }

        parse_line(line, argv);
        if (argv[0] == NULL) {
            continue;
        }        if (ai_mode) {
            // exit만 허용
            if (strcmp(argv[0], "exit") == 0) break;
            
            printf("[AI] AI 기능이 아직 구현되지 않았습니다.  (exit는 가능)\n");
            continue;
        }

        // --- 내부 명령어: exit ---
        if (strcmp(argv[0], "exit") == 0) break;

        // --- 내부 명령어: cd ---
        if (strcmp(argv[0], "cd") == 0) {
            if (argv[1] == NULL) {
                fprintf(stderr, "cd: missing argument\n");
            } else if (chdir(argv[1]) != 0) {
                perror("cd");
            }
            continue;
        }

        // --- 일반 모드: fork → exec ---
        pid = fork();
        if (pid < 0) {
            perror("fork");
            continue;
        } else if (pid == 0) {
            setpgid(0, 0);
            execvp(argv[0], argv);
            perror("execvp");
            exit(127);
        } else {
            setpgid(pid, pid);
            tcsetpgrp(STDIN_FILENO, pid);

            if (waitpid(pid, &status, WUNTRACED) < 0) {
                perror("waitpid");
            }

            tcsetpgrp(STDIN_FILENO, getpgrp());
        }
    }

    return 0;
}
```

# `mini_shell_ai.c`
```c
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <sys/wait.h>
#include <errno.h>
#include <signal.h>
#include <termios.h>

#define MAXLINE 1024
#define MAXARGS 64

// --- ANSI 색상 코드 ---
#define COLOR_RESET   "\033[0m"
#define COLOR_RED     "\033[1;31m"
#define COLOR_GREEN   "\033[1;32m"
#define COLOR_YELLOW  "\033[1;33m"
#define COLOR_BLUE    "\033[1;34m"
#define COLOR_MAGENTA "\033[1;35m"
#define COLOR_CYAN    "\033[1;36m"
#define COLOR_WHITE   "\033[1;37m"
#define COLOR_GRAY    "\033[0;90m"

// --- 전역 상태 ---
static volatile int ai_mode = 0;
static volatile int ai_thinking = 0;

// 문자열 파싱
void parse_line(char *line, char **argv) {
    int i = 0;
    char *token = strtok(line, " \t\n");
    while (token != NULL && i < MAXARGS - 1) {
        argv[i++] = token;
        token = strtok(NULL, " \t\n");
    }
    argv[i] = NULL;
}

// --- SIGQUIT : AI 모드 토글 ---
void handle_sigquit(int signo) {
    (void)signo; // signo 사용 안함. 안쓰면 경고가 뜸.
    const char msg_on[]  = "\n" COLOR_CYAN "╔════════════════════╗\n"
                           "║   AI MODE ON 🤖    ║\n"
                           "╚════════════════════╝" COLOR_RESET "\n"
                           COLOR_MAGENTA "AI-shell> " COLOR_RESET;
    const char msg_off[] = "\n" COLOR_YELLOW "╔════════════════════╗\n"
                           "║  AI MODE OFF 💤    ║\n"
                           "╚════════════════════╝" COLOR_RESET "\n"
                           COLOR_GREEN "mini-shell> " COLOR_RESET;
    ai_mode = !ai_mode;
    write(STDOUT_FILENO, ai_mode ? msg_on : msg_off,
          ai_mode ? sizeof(msg_on) - 1 : sizeof(msg_off) - 1);
}

// --- SIGINT (Ctrl+\) : AI reasoning 중단 ---
void handle_sigint(int signo) {
    (void)signo; // signo 사용 안함. 안쓰면 경고가 뜸. 
    const char msg[] = "\n" COLOR_RED "⚠️  AI REASONING INTERRUPTED ⚠️" COLOR_RESET "\n";                        
    if (ai_mode && ai_thinking) {
        ai_thinking = 0;
        
        write(STDOUT_FILENO, msg, sizeof(msg) - 1);
    }
}

// --- 터미널 모드 제어 ---
void setup_terminal(struct termios *orig) {
    struct termios new_term;
    tcgetattr(STDIN_FILENO, orig);
    new_term = *orig;
    // ICANON은 유지 (라인 편집 가능), ISIG는 켜서 Ctrl+C 등을 시그널로 변환
    new_term.c_lflag |= ISIG;  // 시그널 활성화
    // Ctrl+T를 VQUIT에 매핑 (SIGQUIT 발생) - AI 모드 토글
    new_term.c_cc[VQUIT] = 20;  // Ctrl+T
    // Ctrl+\를 VINTR에 매핑 (SIGINT 발생) - AI thinking 중단
    new_term.c_cc[VINTR] = 28;  // Ctrl+\ (ASCII 28)
    tcsetattr(STDIN_FILENO, TCSAFLUSH, &new_term);
}
void restore_terminal(struct termios *orig) {
    tcsetattr(STDIN_FILENO, TCSAFLUSH, orig);
}

int main(void) {
    char line[MAXLINE];
    char *argv[MAXARGS];
    pid_t pid;
    int status;
    struct termios orig_termios;

    // --- 시그널 핸들러 등록 ---
    signal(SIGTTIN, SIG_IGN); // background 프로세스가 터미널에서 읽으려고 하면, 무시
    signal(SIGTTOU, SIG_IGN); // background 프로세스가 터미널에 쓰려고 하면, 무시
    signal(SIGTSTP, SIG_IGN); // Ctrl+Z 무시 (쉘은 멈추면 안됨)
    signal(SIGQUIT, handle_sigquit);  // Ctrl+T
    signal(SIGINT,  handle_sigint);   // Ctrl+backslash

    setup_terminal(&orig_termios);

    printf(COLOR_CYAN "╔═══════════════════════════════════════════════════════════╗\n");
    printf("║         🚀 Mini Shell with AI Mode 🤖                     ║\n");
    printf("╠═══════════════════════════════════════════════════════════╣\n");
    printf("║  " COLOR_YELLOW "Ctrl+T" COLOR_CYAN "  : Toggle AI Mode                                 ║\n");
    printf("║  " COLOR_YELLOW "Ctrl+\\" COLOR_CYAN "  : Stop AI Thinking                               ║\n");
    printf("║  " COLOR_YELLOW "Ctrl+D" COLOR_CYAN "  : Exit Shell                                     ║\n");
    printf("╚═══════════════════════════════════════════════════════════╝" COLOR_RESET "\n");
    printf(COLOR_GREEN "mini-shell> " COLOR_RESET);
    fflush(stdout);

    while (1) {
        // fgets로 라인 단위 입력 (편집 가능!)
        if (fgets(line, MAXLINE, stdin) == NULL) {
            printf("\n");
            break;  // EOF (Ctrl+D)
        }

        // 빈 줄 처리
        if (line[0] == '\n') {
            printf(ai_mode ? COLOR_MAGENTA "AI-shell> " COLOR_RESET : COLOR_GREEN "mini-shell> " COLOR_RESET);
            fflush(stdout);
            continue;
        }

        parse_line(line, argv);
        if (argv[0] == NULL) {
            printf(ai_mode ? COLOR_MAGENTA "AI-shell> " COLOR_RESET : COLOR_GREEN "mini-shell> " COLOR_RESET);
            fflush(stdout);
            continue;
        }

        if (strcmp(argv[0], "exit") == 0)
            break;

        // --- AI 모드 ---
        if (ai_mode) {
            ai_thinking = 1;
            printf(COLOR_CYAN "🤖 [AI] " COLOR_YELLOW "Thinking deeply about '%s'..." COLOR_RESET "\n", argv[0]);
            fflush(stdout);

            for (int i = 0; i < 5; i++) { // 현재는 AI 기능 미구현, 단순 대기
                if (!ai_thinking) break;  // Ctrl+\ 로 중단됨
                printf(COLOR_CYAN "●" COLOR_RESET);
                fflush(stdout);
                sleep(1);
            }

            if (ai_thinking)
                printf("\n" COLOR_GREEN "✓ [AI] Thought complete!" COLOR_RESET "\n");            

            ai_thinking = 0;
            printf(COLOR_MAGENTA "AI-shell> " COLOR_RESET);
            fflush(stdout);
            continue;
        }

        // --- 내부 명령어: cd ---
        if (strcmp(argv[0], "cd") == 0) {
            if (argv[1] == NULL)
                fprintf(stderr, COLOR_RED "cd: missing argument" COLOR_RESET "\n");
            else if (chdir(argv[1]) != 0)
                perror("cd");
            printf(COLOR_GREEN "mini-shell> " COLOR_RESET);
            fflush(stdout);
            continue;
        }

        // --- 외부 명령 실행 ---
        pid = fork();
        if (pid < 0) {
            perror("fork");
        } else if (pid == 0) {
            // 자식: 원래 터미널 모드로 복원
            restore_terminal(&orig_termios);
            setpgid(0, 0);
            execvp(argv[0], argv);
            perror("execvp");
            exit(127);
        } else {
            // 부모: 원래 터미널 모드로 복원
            restore_terminal(&orig_termios);
            setpgid(pid, pid);
            tcsetpgrp(STDIN_FILENO, pid);

            if (waitpid(pid, &status, WUNTRACED) < 0)
                perror("waitpid");

            // 복귀 후 다시 설정
            tcsetpgrp(STDIN_FILENO, getpgrp());
            setup_terminal(&orig_termios);
        }

        printf(COLOR_GREEN "mini-shell> " COLOR_RESET);
        fflush(stdout);
    }

    restore_terminal(&orig_termios);
    printf(COLOR_CYAN "\n👋 Goodbye!\n" COLOR_RESET);
    return 0;
}
```