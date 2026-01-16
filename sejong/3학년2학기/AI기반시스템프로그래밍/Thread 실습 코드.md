# `mini_shell_game_svr.c`
```c
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <sys/wait.h>
#include <errno.h>
#include <signal.h>
#include <termios.h>
#include <pthread.h>

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

// --- 게임 상태 (Boss HP) ---
static double hp_boss = 1000.0;

// --- HP 보호용 뮤텍스(전역) hp_mutex ---
static pthread_mutex_t hp_mutex = PTHREAD_MUTEX_INITIALIZER;

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

// --- 공격 스레드에 쓰일 구조체 ---
typedef struct {
    double damage;
    int thread_id;
} attack_arg_t;

// --- Attack 스레드 함수 ---
// 구현 조건
// 각 스레드는 damage 만큼 hp_boss를 깎음
// 0.01 단위로 나누어 여러번 깎음 (동시성 테스트용)
// 한번에 0.01씩 깎고 1ms 대기
// 뮤텍스로 hp_boss 보호

void* attack_thread(void* arg) {
    attack_arg_t* a = (attack_arg_t*)arg;
        
    double step = 0.01;                      // 한 번에 깎을 양
    int iterations = (int)(a->damage / step); // 반복 횟수 계산
        
    double old_hp = hp_boss; // 스레드 시작 시점의 HP 값.
    for (int i = 0; i < iterations && hp_boss > 0; i++) {
        pthread_mutex_lock(&hp_mutex);
        hp_boss -= step;
        if (hp_boss < 0) hp_boss = 0;    
        pthread_mutex_unlock(&hp_mutex);
        // 출력 대신 딜레이만 — 경쟁을 유도
        usleep(1000); // 1ms 대기 (동시성 테스트용)
    }
    double new_hp = hp_boss;
    
    printf(COLOR_GREEN "  [Thread %d] ⚔️  Hit! Boss HP: %.2f → %.2f\n" COLOR_RESET,
           a->thread_id, old_hp, new_hp);
    free(arg);
    return (void *)NULL;
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
            // attack 명령어 처리
            if (strcmp(argv[0], "attack") == 0) {
                printf(COLOR_CYAN "🎮 [BOSS BATTLE] Current Boss HP: %.2f\n" COLOR_RESET, hp_boss);
                
                // 공격 인자 개수 세기
                int num_attacks = 0;
                for (int i = 1; argv[i] != NULL && i < MAXARGS; i++) {
                    num_attacks++;
                }
                
                if (num_attacks == 0) {
                    printf(COLOR_RED "Usage: attack <damage1> <damage2> ...\n" COLOR_RESET);
                    printf(COLOR_MAGENTA "AI-shell> " COLOR_RESET);
                    fflush(stdout);
                    continue;
                }
                
                // 스레드를 생성할 수 있도록 스레드 배열 준비
                pthread_t threads[MAXARGS];
                int thread_count = 0;
                
                // 각 공격 인자마다 스레드 생성
                for (int i = 1; argv[i] != NULL && i < MAXARGS; i++) {
                    int damage = atoi(argv[i]);
                    // 공격이 음수이면 무시
                    if (damage <= 0) {
                        printf(COLOR_RED "Invalid damage: %s\n" COLOR_RESET, argv[i]);
                        continue;
                    }
                    
                    // 아까 작성한 attack_arg_t 구조체에 인자 채우기
                    attack_arg_t* arg = malloc(sizeof(attack_arg_t));
                    arg->damage = damage;
                    arg->thread_id = i;
                    
                    // 스레드 생성
                    pthread_create(&threads[thread_count++], NULL, attack_thread, arg);
                }
                
                // 모든 스레드 종료 대기
                for (int i = 0; i < thread_count; i++) {
                    pthread_join(threads[i], NULL);
                }
                
                // 보스는 부활하는 걸로 해봅시다. hp가 0 이하가 되면 1000으로 리셋
                printf(COLOR_CYAN "🎮 [RESULT] Boss HP: %.2f" COLOR_RESET, hp_boss);
                if (hp_boss <= 0) {
                    printf(COLOR_GREEN " 💀 BOSS DEFEATED!\n" COLOR_RESET);
                    hp_boss = 1000.0;  // 리셋
                    printf(COLOR_YELLOW "🔄 Boss respawned with 1000 HP!\n" COLOR_RESET);
                } else {
                    printf("\n");
                }
                
                printf(COLOR_MAGENTA "AI-shell> " COLOR_RESET);
                fflush(stdout);
                continue;
            }
            
            // 기존 AI thinking 코드
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

# `mini_shell_game_queue.c`
```c
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <sys/wait.h>
#include <errno.h>
#include <signal.h>
#include <termios.h>
#include <pthread.h>
#include <time.h>

#define MAXLINE 1024
#define MAXARGS 64
#define MAX_QUEUE_SIZE 8 // 큐 최대 크기
#define MAX_WORKER_THREADS 3

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

// --- 게임 상태 (Boss HP) ---
static double hp_boss = 1000.0;

// --- 보호용 락 ---
static pthread_mutex_t hp_mutex = PTHREAD_MUTEX_INITIALIZER;
static pthread_mutex_t queue_mutex = PTHREAD_MUTEX_INITIALIZER;

// --- 조건 변수 ---
static pthread_cond_t not_full  = PTHREAD_COND_INITIALIZER;
static pthread_cond_t not_empty = PTHREAD_COND_INITIALIZER;

// --- 작업 큐 구조 ---
typedef struct job {
    double damage;
    struct job *next;
} job_t;

static job_t *head = NULL, *tail = NULL;
static int queue_len = 0;
static int running = 1;

// --- 작업 큐 함수 ---
// ---------- 큐 조작 ----------
void enqueue_job(double dmg) {
    // 큐를 보호하기 위한 뮤텍스 잠금
    pthread_mutex_lock(&queue_mutex);

    while (queue_len >= MAX_QUEUE_SIZE) {
        printf(COLOR_YELLOW "[Queue] Full, waiting...\n" COLOR_RESET);
        // 큐가 꽉 찼으면 not_full 신호 대기(조건부 뮤텍스 락사용)
        pthread_cond_wait(&not_full, &queue_mutex);
    }

    job_t *j = malloc(sizeof(job_t));
    j->damage = dmg;
    j->next = NULL;
    if (tail)
        tail->next = j;
    else
        head = j;
    tail = j;
    queue_len++;

    // 작업이 추가되었으므로 not_empty 신호 발생
    pthread_cond_signal(&not_empty);
    // 큐를 보호하기 위한 뮤텍스 잠금 해제
    pthread_mutex_unlock(&queue_mutex);
}

job_t* dequeue_job(void) {
    // 큐를 보호하기 위한 뮤텍스 잠금
    pthread_mutex_lock(&queue_mutex);
    while (queue_len == 0 && running)
        // 큐가 비어있으면 not_empty 신호 대기(조건부 뮤텍스 락사용)
        pthread_cond_wait(&not_empty, &queue_mutex);

    // running이 0이면 NULL 반환 (종료 신호)
    if (!running && queue_len == 0) {
        // 큐를 보호하기 위한 뮤텍스 잠금 해제
        pthread_mutex_unlock(&queue_mutex);
        return NULL;
    }

    job_t *j = head;
    if (j) {
        head = j->next;
        if (!head) tail = NULL;
        queue_len--;
        // 작업이 제거되었으므로 not_full 신호 발생. 작업을 추가할 수 있도록
        pthread_cond_signal(&not_full);
    }
    // 큐를 보호하기 위한 뮤텍스 잠금 해제
    pthread_mutex_unlock(&queue_mutex);
    return j;
}

// ---------- 워커 스레드 ----------
void* worker_main(void* arg) {
    int id = (int)(long)arg;
    while (1) {
        job_t *job = dequeue_job();
        if (!job) break;  // NULL이면 종료

        double damage = job->damage;
        free(job);

        // 타임드락 예시 (1초 안에 HP 보호 락 획득 못하면 실패)
        struct timespec ts;
        clock_gettime(CLOCK_REALTIME, &ts);
        ts.tv_sec += 1;
        // 타임드락을 사용하여 HP 보호 락을 획득(1초 대기)
        // 만약 1초 동안 획득 못하면 공격 실패(게임에서 시간 초과로 공격 적용이 안되는 상황, 자주 일어나면 유저들이 화내겠죠...)
        // 만약 일반적인 뮤텍스 락을 이용한다면? 대기가 길어질 수 있음 => 유저가 화남. 
        if (pthread_mutex_timedlock(&hp_mutex, &ts) == ETIMEDOUT) {
            printf(COLOR_YELLOW "[Worker %d] ⏳ Attack missed (timeout)\n" COLOR_RESET, id);
            continue;
        }

        // 크리티컬 섹션 시작. 보스의 체력을 깍아봅시다. 
        double old_hp = hp_boss;
        hp_boss -= damage;
        if (hp_boss < 0) hp_boss = 0;
        double new_hp = hp_boss;
        
        // 보스가 죽었는지 체크 및 부활 처리 (락 안에서!)
        int boss_defeated = 0;
        if (new_hp <= 0 && old_hp > 0) {
            boss_defeated = 1;
            hp_boss = 1000.0;
            new_hp = 1000.0;
        }
        
        // 크리티컬 섹션 끝 hp 뮤텍스 잠금 해제
        pthread_mutex_unlock(&hp_mutex);

        printf(COLOR_GREEN "[Worker %d] ⚔️  Hit! Boss HP: %.2f → %.2f\n" COLOR_RESET, id, old_hp, new_hp);
        
        if (boss_defeated) {
            printf(COLOR_RED "💀 BOSS DEFEATED!\n" COLOR_RESET);
            printf(COLOR_YELLOW "🔄 Boss respawned with 1000 HP!\n" COLOR_RESET);
        }
        usleep(20000); // 20ms 대기 (시각적 효과)
    }
    return NULL;
}

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

// 시그널 핸들러 등록 ---
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

// ---------- 메인 ----------
int main(void) {
    char line[MAXLINE];
    char *argv[MAXARGS];
    pid_t pid;
    int status;
    struct termios orig_termios;

    signal(SIGTTIN, SIG_IGN);
    signal(SIGTTOU, SIG_IGN);
    signal(SIGTSTP, SIG_IGN);
    signal(SIGQUIT, handle_sigquit);
    signal(SIGINT,  handle_sigint);

    setup_terminal(&orig_termios);

    // 워커 스레드 시작
    // 미리 정해진 개수의 워커 스레드 생성
    // 반응성 때문에 실무에서는 이렇게 함
    // pthread_t workers는 상당히 비싼 연산임. 서버 기동시 미리 생성해 두는 것이 좋음.
    pthread_t workers[MAX_WORKER_THREADS];
    for (int i = 0; i < MAX_WORKER_THREADS; i++)
        pthread_create(&workers[i], NULL, worker_main, (void*)(long)i);

    printf(COLOR_CYAN "🚀 Mini Shell with AI Mode + Bounded Queue\n" COLOR_RESET);
    printf(COLOR_YELLOW "MAX_QUEUE = %d, WORKERS = %d\n" COLOR_RESET, MAX_QUEUE_SIZE, MAX_WORKER_THREADS);
    printf(COLOR_GREEN "mini-shell> " COLOR_RESET);
    fflush(stdout);

    while (1) {
        if (fgets(line, MAXLINE, stdin) == NULL) {
            printf("\n");
            break;
        }
        if (line[0] == '\n') {
            printf(ai_mode ? COLOR_MAGENTA "AI-shell> " COLOR_RESET :
                             COLOR_GREEN "mini-shell> " COLOR_RESET);
            fflush(stdout);
            continue;
        }

        parse_line(line, argv);
        if (argv[0] == NULL) continue;
        if (strcmp(argv[0], "exit") == 0)
            break;

        // --- AI 모드 ---
        if (ai_mode) {
            if (strcmp(argv[0], "attack") == 0) {
                printf(COLOR_CYAN "🎯 [QUEUE] Enqueue attacks (bounded %d)\n" COLOR_RESET, MAX_QUEUE_SIZE);
                int has_arg = 0;
                for (int i = 1; argv[i] != NULL && i < MAXARGS; i++) {
                    double dmg = atof(argv[i]);
                    if (dmg <= 0) continue;
                    // 큐에 공격 구조체를 추가
                    enqueue_job(dmg);
                    has_arg = 1;
                }
                if (!has_arg)
                    printf(COLOR_RED "Usage: attack <damage1> <damage2> ...\n" COLOR_RESET);

                printf(COLOR_MAGENTA "AI-shell> " COLOR_RESET);
                fflush(stdout);
                continue;
            }
            ai_thinking = 1;
            printf(COLOR_CYAN "🤖 [AI] Thinking deeply about '%s'...\n" COLOR_RESET, argv[0]);
            fflush(stdout);
            for (int i = 0; i < 5; i++) {
                if (!ai_thinking) break;
                printf(COLOR_CYAN "●" COLOR_RESET);
                fflush(stdout);
                sleep(1);
            }
            if (ai_thinking)
                printf("\n" COLOR_GREEN "✓ [AI] Thought complete!\n" COLOR_RESET);
            ai_thinking = 0;
            printf(COLOR_MAGENTA "AI-shell> " COLOR_RESET);
            fflush(stdout);
            continue;
        }

        // --- 외부 명령 ---
        pid = fork();
        if (pid < 0) perror("fork");
        else if (pid == 0) {
            restore_terminal(&orig_termios);
            setpgid(0, 0);
            execvp(argv[0], argv);
            perror("execvp");
            exit(127);
        } else {
            restore_terminal(&orig_termios);
            setpgid(pid, pid);
            tcsetpgrp(STDIN_FILENO, pid);
            if (waitpid(pid, &status, WUNTRACED) < 0)
                perror("waitpid");
            tcsetpgrp(STDIN_FILENO, getpgrp());
            setup_terminal(&orig_termios);
        }

        printf(COLOR_GREEN "mini-shell> " COLOR_RESET);
        fflush(stdout);
    }

    // --- 쉘 및 서버 종료 ---
    running = 0;
    // 끝나기 전에 모든 워커 스레드 깨우기
    // 그냥 서버 내리면, 게임 중에 남아있는 작업들이 처리되지 못하고 날아감 => 재화가 날아가게 되면 유저들이 화내겠죠...
    // 우선 큐에 대한 뮤텍스 잠금
    pthread_mutex_lock(&queue_mutex);
    // 비어있는 워커 깨움
    pthread_cond_broadcast(&not_empty); // 비어있는 워커 깨움
    // 꽉 찬 워커 깨움
    pthread_cond_broadcast(&not_full);  // 꽉 찬 프로듀서 깨움 (중요!)

    // 큐 뮤텍스 잠금 해제
    pthread_mutex_unlock(&queue_mutex);

    // 모든 워커 스레드 종료 대기
    for (int i = 0; i < MAX_WORKER_THREADS; i++)
        pthread_join(workers[i], NULL);

    restore_terminal(&orig_termios);
    printf(COLOR_CYAN "\n👋 Goodbye!\n" COLOR_RESET);
    return 0;
}
```