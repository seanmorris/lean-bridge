/* Build from the installed public header and pkg-config metadata only. */
#define _POSIX_C_SOURCE 200809L
#include <lbc_pulse.h>
#include <assert.h>
#include <dlfcn.h>
#include <errno.h>
#include <fcntl.h>
#include <poll.h>
#include <pthread.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/wait.h>
#include <time.h>
#include <unistd.h>

#define P(x) lbc_pulse_##x
#define IS(expr, expected) do { P(status) s_ = (expr); if (s_ != P(expected)) { \
    fprintf(stderr, "line %d: %s gave status %d, expected %s\n", __LINE__, #expr, (int)s_, #expected); abort(); } } while (0)
static void readable(int fd) {
    struct pollfd p = {fd, POLLIN, 0}; int n;
    do { n = poll(&p, 1, 5000); } while (n < 0 && errno == EINTR);
    assert(n == 1 && (p.revents & POLLIN));
}
#define WAIT(name,h) do { int fd_; P(status) s_ = P(name##_poll)(h, &fd_); \
    if (s_ == P(PENDING)) { readable(fd_); IS(P(name##_poll)(h, &fd_), OK); } else assert(s_ == P(OK)); } while (0)
static void wait_state(uint32_t target) {
    for (int i = 0; i < 5000; i++) {
        uint32_t v = 0; IS(P(state_call)(&v, NULL), OK); if (v == target) return;
        nanosleep(&(struct timespec){.tv_nsec = 1000000}, NULL);
    }
    abort();
}
static void *wrong_thread(void *arg) {
    int fd; IS(P(late_poll)(*(P(late_handle) *)arg, &fd), WRONG_CONTEXT); return NULL;
}
static void equal(P(buffer) value, P(view) expected) {
    assert(value.len == expected.len && !memcmp(value.data, expected.data, value.len));
}
int main(void) {
    alarm(60);
    const uint8_t data[] = {'c', 0, 0xc3, 0xa9};
    P(view) text = {data, sizeof data};
    P(buffer) error = {0};
    P(checked_handle) checked = {0};
    IS(P(checked_start)(true, false, text, &checked, &error), TYPED_ERROR);
    equal(error, text); P(buffer_dispose)(&error); assert(!checked.id);
    IS(P(checked_start)(false, true, (P(view)){(const uint8_t *)"\xc0\xaf", 2}, &checked, &error), INVALID);
    IS(P(checked_start)(false, true, text, &checked, &error), OK);
    int fd = 50; IS(P(checked_poll)(checked, &fd), OK); assert(fd == -1);
    P(checked_value) result = {0};
    IS(P(checked_take)(&checked, &result), OK);
    assert(!result.ok); equal(result.as.error, text); P(checked_value_dispose)(&result);
    IS(P(checked_take)(&checked, &result), CLOSED);
    IS(P(checked_start)(false, false, text, &checked, &error), OK);
    IS(P(checked_take)(&checked, &result), OK); assert(result.ok && result.as.value == 42);
    P(checked_value_dispose)(&result);
    P(io_task_handle) io = {0}; uint8_t unit = 99;
    IS(P(io_task_start)(true, &io, &error), IO_ERROR);
    equal(error, (P(view)){(const uint8_t *)"IO refusal", 10}); P(buffer_dispose)(&error);
    IS(P(io_task_start)(false, &io, NULL), OK); IS(P(io_task_take)(&io, &unit), OK); assert(unit == 0);
    P(bytes_handle) bytes = {0};
    IS(P(bytes_start)((P(view)){NULL, 17000000}, &bytes), LIMIT);
    IS(P(bytes_start)(text, &bytes), OK); IS(P(bytes_take)(&bytes, &error), OK); equal(error, text); P(buffer_dispose)(&error);
    P(late_handle) task = {0}; int64_t x = 111;
    IS(P(reset_call)(&unit, NULL), OK); IS(P(late_start)(false, INT64_MIN, &task), OK);
    wait_state(1); IS(P(late_take)(&task, &x), PENDING); assert(x == 111);
    IS(P(late_poll)(task, &fd), PENDING); assert(fd >= 0 && (fcntl(fd, F_GETFD) & FD_CLOEXEC));
    P(late_handle) foreign = task; foreign.domain ^= 1; int other;
    IS(P(late_poll)(foreign, &other), CLOSED);
    IS(P(checked_poll)((P(checked_handle)){task.id, task.domain}, &other), CLOSED);
    pthread_t worker; assert(!pthread_create(&worker, NULL, wrong_thread, &task)); assert(!pthread_join(worker, NULL));
    pid_t child = fork(); assert(child >= 0);
    if (!child) { IS(P(late_close)(&task), WRONG_CONTEXT); _exit(0); }
    int ws; assert(waitpid(child, &ws, 0) == child && WIFEXITED(ws) && !WEXITSTATUS(ws));
    IS(P(release_call)(&unit, NULL), OK); readable(fd); P(late_handle) stale = task;
    IS(P(late_take)(&task, &x), OK); assert(x == INT64_MIN);
    assert(fcntl(fd, F_GETFD) < 0 && errno == EBADF);
    IS(P(reset_call)(&unit, NULL), OK); IS(P(late_start)(true, 5, &task), OK); wait_state(1);
    IS(P(late_close)(&stale), CLOSED); IS(P(late_close)(&task), OK); wait_state(2);
    IS(P(late_close)(&task), CLOSED);

    P(series_handle) stream = {0}; uint32_t count; uint16_t step_error = 99;
    for (int fail = 0; fail <= 1; fail++) {
        IS(P(series_start)(fail, false, text, &stream, NULL), OK);
        uint32_t before; IS(P(pulls_call)(&before, NULL), OK); assert(before == (fail ? 3u : 0u));
        IS(P(series_poll)(stream, &fd), IDLE); P(series_value) item = {0};
        IS(P(series_take)(&stream, &item, &step_error), IDLE); IS(P(pulls_call)(&count, NULL), OK); assert(count == before);
        IS(P(series_pull)(stream), OK); IS(P(series_pull)(stream), BUSY); WAIT(series, stream);
        IS(P(series_take)(&stream, &item, &step_error), OK); assert(!item.ok); equal(item.as.error, text); P(series_value_dispose)(&item);
        IS(P(pulls_call)(&count, NULL), OK); assert(count == before + 1);
        IS(P(series_pull)(stream), OK); WAIT(series, stream);
        if (fail) { IS(P(series_take)(&stream, &item, &step_error), TYPED_ERROR); assert(step_error == 413); }
        else {
            IS(P(series_take)(&stream, &item, &step_error), OK); assert(item.ok && item.as.value == 73); P(series_value_dispose)(&item);
            IS(P(series_pull)(stream), OK); WAIT(series, stream); IS(P(series_take)(&stream, &item, &step_error), END);
        }
        IS(P(series_close)(&stream), CLOSED); IS(P(closes_call)(&count, NULL), OK); assert(count == (uint32_t)(fail + 1));
    }
    IS(P(reset_call)(&unit, NULL), OK); IS(P(series_start)(false, true, text, &stream, NULL), OK);
    IS(P(series_pull)(stream), OK); wait_state(1); IS(P(series_poll)(stream, &fd), PENDING);
    IS(P(series_close)(&stream), OK); assert(fcntl(fd, F_GETFD) < 0 && errno == EBADF);
    IS(P(closes_call)(&count, NULL), OK); assert(count == 3);
    IS(P(release_call)(&unit, NULL), OK); wait_state(3);
    IS(P(series_start)(false, false, text, &stream, NULL), OK); IS(P(series_close)(&stream), OK);
    IS(P(closes_call)(&count, NULL), OK); assert(count == 4);

    /* Test-only lifecycle probe: ordinary consumers never call broker functions. */
    IS(P(bytes_start)(text, &bytes), OK);
    void *broker = dlopen("liblean_bridge_native.so", RTLD_NOW | RTLD_NOLOAD); assert(broker);
    void (*retire)(void) = (void (*)(void))dlsym(broker, "lean_bridge_native_runtime_retire"); assert(retire); retire();
    IS(P(bytes_poll)(bytes, &fd), UNAVAILABLE); IS(P(bytes_close)(&bytes), OK);
    IS(P(bytes_start)(text, &bytes), UNAVAILABLE); dlclose(broker);
    puts("installed C tasks and demand-driven streams: ok");
    return 0;
}
