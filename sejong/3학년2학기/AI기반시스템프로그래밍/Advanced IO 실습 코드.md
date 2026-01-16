# `blocking_test.c`
```c
#include <fcntl.h>
#include <unistd.h>
#include <stdio.h>
#include <errno.h>
#include <sys/wait.h>

const char* mode_str(int mode) {
    if (mode == 0)
        return "non-blocking";
    else
        return "blocking";
}

// mode: 0 = (       )  (non-blocking)
//       1 = (       )  (blocking)
int try_lock(int fd, int mode, const char *who) {
    struct flock fl;
    fl.l_type   = F_WRLCK;
    fl.l_whence = SEEK_SET;
    fl.l_start  = 0;
    fl.l_len    = 0;

    int ret;

    if (mode == 0) {
        // non-blocking 으로 잠금 시도
        ret = fcntl(fd, F_SETLK, &fl);
    } else {
        // blocking 으로 잠금 시도
        ret = fcntl(fd, F_SETLKW, &fl);
    }

    if (ret < 0)
        perror(who);
    else
        printf("%s: locked\n", who);

    return ret;
}

void run_test(int child_mode, int parent_mode) {
    printf("\n[Test child=%s, parent=%s]\n",
           mode_str(child_mode), mode_str(parent_mode));

    int fd = open("lockdemo.txt", O_RDWR | O_CREAT, 0666);
    if (fd < 0) { perror("open"); return; }

    write(fd, "X", 1);

    pid_t pid = fork();

    if (pid == 0) { // child
        printf("child(%s): trying lock...\n", mode_str(child_mode));
        try_lock(fd, child_mode, "child");
        sleep(10);
        close(fd);
        _exit(0);
    }

    sleep(1);
    printf("parent(%s): trying lock...\n", mode_str(parent_mode));
    try_lock(fd, parent_mode, "parent");

    close(fd);
    waitpid(pid, NULL, 0);
}

int main() {
    printf("=== fcntl() locking 4-case test ===\n");
    // 여러분이 blocking vs non-blocking 모드를 조합하여, 어떤 현상이 일어나는지 관찰해봅시다. 
    // 먼저 잡은 lock의 종류에 따라 이 후 lock 을 각각 모드에서 획득하려 할 때 어떻게 변하죠? 
    run_test(0, 0); // non-blocking vs non-blocking
    run_test(1, 0); // blocking vs non-blocking
    run_test(0, 1); // non-blocking vs blocking
    run_test(1, 1); // blocking vs blocking

    printf("\n=== done ===\n");
    return 0;
}
```

# `poll_test.c`
```c
#include <stdio.h>
#include <unistd.h>
#include <poll.h>
#include <fcntl.h>

int main(int argc, char *argv[]) {
    // 명령행 인자 확인: FIFO 경로 필요
    if (argc != 2) {
        fprintf(stderr, "usage: %s fifo_path\n", argv[0]);
        return 1;
    }

    // FIFO를 논블로킹 읽기 모드로 열기
    int fd = open(argv[1], O_RDONLY | O_NONBLOCK);
    if (fd < 0) { perror("open"); return 1; }

    // poll용 파일 디스크립터 배열 설정 2개 
    struct pollfd fds[2]; // 2개 감시할꺼니까 2개 배열
    
    // 표준입력을 위한 설정
    fds[0].fd = STDIN_FILENO;       // 표준 입력
    fds[0].events = POLLIN;         // 읽기 이벤트 감지

    // FIFO를 위한 설정
    fds[1].fd = fd;                 // FIFO 파일
    fds[1].events = POLLIN;         // 읽기 이벤트 감지

    char buf[1024];

    while (1) {
        // 둘 중 하나라도 읽을 데이터가 생길 때까지 대기 (무한 타임아웃)
        poll(fds, 2, -1); // 무한 대기

        // 표준 입력에 데이터 도착. 어떤 이벤트가 발생했는지 확인(힌트 : AND 연산자)
        if (fds[0].revents & POLLIN) { 
            int r = read(STDIN_FILENO, buf, sizeof(buf));
            if (r == 0) {
                // EOF 처리: 표준 입력 종료 시 프로그램 종료
                printf("STDIN EOF, exiting...\n");
                break;
            }
            write(STDOUT_FILENO, "[STDIN] ", 8); // 접두사 출력 
            write(STDOUT_FILENO, buf, r); // 입력 데이터 출력
        }

        // FIFO에서 데이터 도착
        if (fds[1].revents & POLLIN) {
            int r = read(fd, buf, sizeof(buf));
            if (r > 0) {
                write(STDOUT_FILENO, "[FIFO] ", 7);
                write(STDOUT_FILENO, buf, r); // FIFO 데이터 출력     
            }
        }
    }
}

// poll() 실습: STDIN + FIFO 동시 감시
//
// 터미널 1:
//   $ mkfifo myfifo
//   $ echo "hello" > myfifo
//
// 터미널 2:
//   $ ./poll_test myfifo
//   - 키보드 입력  → [STDIN]
//   - FIFO 입력    → [FIFO]
//   - FIFO 종료    → [FIFO EOF]
```

# `ai_helper_chat.c`
```c
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <curl/curl.h>
#include <unistd.h>
#include <fcntl.h>
#include <cjson/cJSON.h>
#include <sys/mman.h>
#include <sys/stat.h>

#define GENERATE_API_URL "http://localhost:11434/api/generate" // 단순 질의용 API URL
#define CHAT_API_URL "http://localhost:11434/api/chat" // 컨텍스트 기반 대화용 API URL
#define MODEL_NAME_QWEN3 "qwen3:0.6b" // Qwen3, r 모델이라 좀 느림
#define MODEL_NAME_GEMMA3_270M "gemma3:270m" // Gemma3, 270m 밖에 안해서 빠름
#define MODEL_NAME_GEMMA3_1B "gemma3:1b" // Gemma3 1B
#define MODEL_NAME_GPT_OSS "gpt-oss:20b" // gpu 좋은 것 있으신 분은 gpt-oss:20b 혹은 gpt-oss:120b 써보세요.

// libcurl4, cJSON 설치
// sudo apt-get install libcurl4-openssl-dev libcjson-dev
// 컴파일시 라이브러리 링크 옵션 추가 필요:
// gcc -o test_ai_helper test_ai_helper.c -lcurl -lcjson
// 혹은 ./vscode/tasks.json 에서 링크 옵션 추가(args: ["-lcurl", "-lcjson"])

// ---------------------------------------------------------
// 함수 원형 선언
// ---------------------------------------------------------
int ai_chat_with_context(char *log_mem, size_t *log_size, const char *user_input,
                         char *assistant_output, size_t out_size, const char *model);
static size_t write_callback(void *contents, size_t size, size_t nmemb, void *userp);
static void append_log(char *context_mem, size_t *cm_size, const char *role, const char *text);
static cJSON* build_messages_json(char *context_mem, size_t cm_size);
static int call_chat_api(cJSON *messages, const char *model, char *out, size_t out_sz);

// libcurl 응답 저장용 구조체
typedef struct {
    char *data;
    size_t size;
} MemoryStruct;

// ---------------------------------------------------------
// 테스트 main 
// ---------------------------------------------------------
int main(void) {
    const char *LOG_PATH = "prompt.log";
    
    int fd = open(LOG_PATH, O_RDWR | O_CREAT, 0644);
    if (fd < 0) {
        perror("open");
        return 1;
    }

    // mmap 초기화 (1MB 용량)
    size_t capacity = 1024 * 1024;
    ftruncate(fd, capacity); // 파일 크기 설정
    
    // 메모리 매핑. READ | WRITE 권한, 공유 매핑
    char *context_mem = (char *)mmap(NULL, capacity, PROT_READ | PROT_WRITE, MAP_SHARED, fd, 0);
    // 만약 매핑 실패 시 처리
    if (context_mem == MAP_FAILED) {
        perror("mmap");
        close(fd);
        return 1;
    }
    
    size_t cm_size = 0; // 현재 컨텍스트 크기
    char response[8192];

    // 테스트 1
    printf("=== Test 1 (gemma3:1b) ===\n");
    const char *input1 = "제 이름은 최창희입니다.";
    printf("User: %s\n", input1);
    if (ai_chat_with_context(context_mem, &cm_size, input1, response, sizeof(response), MODEL_NAME_GEMMA3_1B) == 0) {
        printf("AI: %s\n\n", response);
    } else {
        printf("Error\n");
    }

    // 테스트 2
    printf("=== Test 2 ===\n");
    const char *input2 = "내 이름이 뭐라고 했죠?";
    printf("User: %s\n", input2);
    if (ai_chat_with_context(context_mem, &cm_size, input2, response, sizeof(response), MODEL_NAME_GEMMA3_1B) == 0) {
        printf("AI: %s\n\n", response);
    } else {
        printf("Error\n");
    }

    // 테스트 3
    printf("=== Test 3 ===\n");
    const char *input3 = "내 이름은 어때?";
    printf("User: %s\n", input3);
    if (ai_chat_with_context(context_mem, &cm_size, input3, response, sizeof(response), MODEL_NAME_GEMMA3_1B) == 0) {
        printf("AI: %s\n\n", response);
    } else {
        printf("Error\n");
    }

    // 메모리 매핑 정리
    ftruncate(fd, cm_size);  // 실제 사용 크기로 자르기
    msync(context_mem, capacity, MS_SYNC); // 변경사항 동기화
    munmap(context_mem, capacity); // 메모리 매핑 해제
    close(fd); // fd 닫기 
    
    printf("로그: %s\n", LOG_PATH);
    return 0;
}

// libcurl 콜백 함수
static size_t write_callback(void *contents, size_t size, size_t nmemb, void *userp) {
    size_t realsize = size * nmemb;
    MemoryStruct *mem = (MemoryStruct *)userp;
    
    char *ptr = realloc(mem->data, mem->size + realsize + 1);
    if (!ptr) return 0;
    
    mem->data = ptr;
    memcpy(&(mem->data[mem->size]), contents, realsize);
    mem->size += realsize;
    mem->data[mem->size] = 0;
    
    return realsize;
}

// 메모리에 직접 로그 추가
static void append_log(char *context_mem, size_t *cm_size, const char *role, const char *text) {
    size_t max_write = 1024 * 1024 - *cm_size; // 남은 공간 계산
    if (max_write < 100) return; // 공간 부족 시 중단
    
    int len = snprintf(context_mem + *cm_size, max_write, "%s: %s\n", role, text);
    if (len > 0 && (size_t)len < max_write) {
        *cm_size += len;
    }
}

// 메모리에서 직접 읽어서 cJSON 배열 구성
static cJSON* build_messages_json(char *context_mem, size_t cm_size) {
    if (cm_size == 0) {
        return cJSON_CreateArray();
    }

    cJSON *messages = cJSON_CreateArray();
    char *ptr = context_mem;
    char *end = context_mem + cm_size;

    // 메모리에서 직접 파싱 (디스크 I/O 최소화)
    while (ptr < end) {
        char *line_end = memchr(ptr, '\n', end - ptr); // 한 줄의 끝 찾기, memchr : 메모리 블록에서 특정 문자 찾기
        if (!line_end) line_end = end;

        size_t line_len = line_end - ptr;
        
        // USER: 파싱
        if (line_len > 6 && strncmp(ptr, "USER: ", 6) == 0) {
            char content[4096];
            size_t content_len = line_len - 6;
            if (content_len >= sizeof(content)) content_len = sizeof(content) - 1;
            // USER: 이후 내용 복사, memcpy 사용 
            memcpy(content, ptr + 6, content_len); 
            content[content_len] = '\0';

            cJSON *msg = cJSON_CreateObject();
            cJSON_AddStringToObject(msg, "role", "user");
            cJSON_AddStringToObject(msg, "content", content);
            cJSON_AddItemToArray(messages, msg);
        }
        // ASSISTANT: 파싱
        else if (line_len > 11 && strncmp(ptr, "ASSISTANT: ", 11) == 0) {
            char content[4096];
            size_t content_len = line_len - 11;
            if (content_len >= sizeof(content)) content_len = sizeof(content) - 1;
            // ASSISTANT: 이후 내용 복사. memcpy 사용
            memcpy(content, ptr + 11, content_len); 
            content[content_len] = '\0';

            cJSON *msg = cJSON_CreateObject();
            cJSON_AddStringToObject(msg, "role", "assistant");
            cJSON_AddStringToObject(msg, "content", content);
            cJSON_AddItemToArray(messages, msg);
        }

        ptr = line_end + 1;
    }

    return messages;
}

// /api/chat 호출 (cJSON 사용)
static int call_chat_api(cJSON *messages, const char *model, char *out, size_t out_sz) {
    CURL *curl = curl_easy_init();
    if (!curl) return -1;

    // JSON payload 생성
    cJSON *root = cJSON_CreateObject();
    cJSON_AddStringToObject(root, "model", model);
    cJSON_AddItemToObject(root, "messages", messages);
    cJSON_AddBoolToObject(root, "stream", 0);
    
    char *json_payload = cJSON_PrintUnformatted(root);
    
    // libcurl 응답 저장 구조체 초기화 (realloc이 NULL 처리하므로 malloc 불필요)
    MemoryStruct resp = {0};

    struct curl_slist *headers = NULL;
    headers = curl_slist_append(headers, "Content-Type: application/json");

    curl_easy_setopt(curl, CURLOPT_URL, CHAT_API_URL);
    curl_easy_setopt(curl, CURLOPT_POSTFIELDS, json_payload);
    curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, write_callback);
    curl_easy_setopt(curl, CURLOPT_WRITEDATA, &resp);
    curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);

    CURLcode res = curl_easy_perform(curl);
    curl_slist_free_all(headers);
    curl_easy_cleanup(curl);
    free(json_payload);
    cJSON_Delete(root);

    if (res != CURLE_OK) {
        free(resp.data);
        return -1;
    }

    // 응답 데이터 유효성 체크
    if (!resp.data || resp.size == 0) {
        free(resp.data);
        return -1;
    }

    // cJSON으로 응답 파싱
    cJSON *parsed = cJSON_Parse(resp.data);
    if (!parsed) {
        free(resp.data);
        return -1;
    }

    cJSON *msg = cJSON_GetObjectItem(parsed, "message");
    cJSON *content = msg ? cJSON_GetObjectItem(msg, "content") : NULL;

    if (content && content->valuestring) {
        strncpy(out, content->valuestring, out_sz - 1);
        out[out_sz - 1] = '\0';
    } else {
        cJSON_Delete(parsed);
        free(resp.data);
        return -1;
    }

    cJSON_Delete(parsed);
    free(resp.data);
    return 0;
}

// 컨텍스트 기반 AI 대화 (메모리 주소 기반)
int ai_chat_with_context(char *context_mem, size_t *cm_size, const char *user_input,
                         char *assistant_output, size_t out_size, const char *model) {
    // 1) USER 입력 로그에 추가 (메모리 직접 쓰기)
    append_log(context_mem, cm_size, "USER", user_input);

    // 2) 메모리에서 직접 읽어서 messages JSON 생성
    cJSON *messages_json = build_messages_json(context_mem, *cm_size);
    if (!messages_json) return -1;

    // 3) /api/chat 호출 (call_chat_api가 messages_json의 소유권을 가져감)
    int ret = call_chat_api(messages_json, model, assistant_output, out_size);
    
    // ret 가 0이 아니면 에러
    if (ret != 0) return -1;

    // 4) ASSISTANT 응답 로그에 추가 (메모리 직접 쓰기)
    append_log(context_mem, cm_size, "ASSISTANT", assistant_output);

    return 0;
}
```