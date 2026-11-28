#include <lbc_effects.h>
#include <assert.h>
#include <errno.h>
#include <poll.h>
#include <string.h>

#define P(n) lbc_effects_##n
#define WAIT(n, h) do { int fd = -1; P(status) s = P(n##_poll)(h, &fd); \
    if (s == P(PENDING)) { struct pollfd p = {fd, POLLIN, 0}; int nready; \
        do { nready = poll(&p, 1, 10000); } while (nready < 0 && errno == EINTR); \
        assert(nready == 1 && (p.revents & POLLIN)); } \
    else assert(s == P(OK)); } while (0)

int main(void) {
    P(buffer) boot = {0}; assert(P(read_boot_call)(&boot, NULL) == P(OK));
    assert(boot.len == 8 && !memcmp(boot.data, "from-app", 8)); P(buffer_dispose)(&boot);
    P(view) path = {(const unsigned char *)"state", 5}; uint32_t value = 0;
    assert(P(observe_call)(path, &value, NULL) == P(OK) && value == 37);
    P(worker_handle) task = {0}; assert(P(worker_start)(path, &task) == P(OK));
    WAIT(worker, task); assert(P(worker_take)(&task, &value) == P(OK) && value == 37);
    P(walk_handle) cursor = {0}; assert(P(walk_start)(path, &cursor) == P(OK));
    assert(P(walk_pull)(cursor) == P(OK)); WAIT(walk, cursor);
    assert(P(walk_take)(&cursor, &value) == P(OK) && value == 37);
    assert(P(walk_close)(&cursor) == P(OK));
    assert(P(observe_call)(path, &value, NULL) == P(OK) && value == 0);
}
