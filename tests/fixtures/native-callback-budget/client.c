#define _POSIX_C_SOURCE 200809L
#include <assert.h>
#include <errno.h>
#include <poll.h>
#include <stdint.h>
#include <stdio.h>
#include <string.h>
#include <lbc_c_budget.h>
#include "observer.h"
#define B(x) lbc_c_budget_##x
#ifdef NDEBUG
#error Assertions are part of this installed test.
#endif

struct counter { unsigned calls, dropped, fail; };
static B(status) next(void *ctx, uint32_t n, uint32_t *out, B(callback_error) *e) {
    struct counter *c = ctx;
    c->calls++;
    if (c->fail) {
        static const char text[] = "callback-already-invoked";
        return B(callback_error_set)(e, 17, (B(view)){(const uint8_t *)text, sizeof(text)-1}, c, NULL);
    }
    *out = n + 1; return B(OK);
}
static void drop(void *v) { ((struct counter *)v)->dropped++; }
static void readable(int fd) {
    struct pollfd p = {.fd=fd,.events=POLLIN}; int n;
    do { n = poll(&p, 1, 30000); } while (n < 0 && errno == EINTR);
    assert(n == 1 && (p.revents & POLLIN));
}
#define RUN(name, expected, ...) do { \
    B(name##_handle) h = {0}; assert(B(name##_start)(__VA_ARGS__, &h) == B(OK)); \
    B(status) s; int fd = -1; \
    while ((s = B(name##_poll)(h,&fd)) == B(PENDING)) readable(fd); \
    assert(s == B(OK)); assert(B(name##_take)(&h,&result,&error) == B(expected)); \
    assert(h.id == 0); \
} while (0)
int main(void) {
    struct counter a = {0}, b = {0};
    B(callback_uint32_to_uint32) f = {0}, g = {0};
    assert(B(callback_uint32_to_uint32_make)(next,&a,drop,&f) == B(OK));
    assert(B(callback_uint32_to_uint32_make)(next,&b,drop,&g) == B(OK));
    B(callback_error) error = {0}; uint32_t result = 987;
    RUN(probe, CALLBACK_ALREADY_INVOKED, 1, f, g);
    assert(a.calls == 1 && b.calls == 2 && !error.payload && !error.message.data && result == 987);
    RUN(pair, OK, 40, f, f); assert(a.calls == 3 && result == 42);
    RUN(single, OK, 41, f); assert(a.calls == 4 && result == 42);
    a.fail = 1; RUN(retry, CALLBACK_ALREADY_INVOKED, 1, f); assert(a.calls == 5 && !error.payload);
    RUN(single, CALLBACK_ERROR, 1, f); assert(error.payload == &a && error.code == 17);
    B(callback_error_dispose)(&error); a.fail = 0;
    RUN(during_start, CALLBACK_ALREADY_INVOKED, 1, f); assert(a.calls == 7);
    RUN(replace, TASK_IO_ERROR, 1, f);
    assert(!error.payload && error.message.len == strlen("callback-already-invoked"));
    assert(!memcmp(error.message.data,"callback-already-invoked",error.message.len));
    B(callback_error_dispose)(&error);
    for (unsigned i=0; i<16; i++) {
        unsigned before = a.calls; RUN(race, CALLBACK_ALREADY_INVOKED, i, f);
        assert(a.calls == before+1 && !error.payload);
    }
    assert(B(callback_uint32_to_uint32_release)(&g) == B(OK));
    assert(B(callback_uint32_to_uint32_release)(&f) == B(OK));
    assert(a.dropped == 1 && b.dropped == 1);
    expect_zero_leases();
    puts("C11: one-call admission; 16 worker races; separate start, terminal and original error; both contexts released; zero leases");
}
