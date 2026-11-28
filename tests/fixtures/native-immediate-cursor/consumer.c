#include <lbc_dials.h>
#include <assert.h>
#include <dlfcn.h>
#include <pthread.h>
#include <string.h>

#define P(n) lbc_dials_##n
static uint32_t counts(void) {
    uint32_t n; assert(P(counts_call)(&n) == P(OK)); return n;
}
static int equal(P(buffer) b, const char *s) {
    return b.len == strlen(s) && !memcmp(b.data, s, b.len);
}
static void *foreign(void *handle) {
    uint32_t n;
    assert(P(sequence_next)(handle, &n) == P(WRONG_CONTEXT));
    assert(P(sequence_close)(handle) == P(WRONG_CONTEXT));
    return NULL;
}
int main(void) {
    assert(!dlsym(RTLD_DEFAULT, "lbc_dials_sequence_poll"));
    assert(!dlsym(RTLD_DEFAULT, "lbc_dials_sequence_take"));
    P(sequence_handle) h = {0}; uint32_t n = 42;
    assert(counts() == 0);
    assert(P(sequence_open)(2, &h) == P(OK) && counts() == 10000);
    P(sequence_handle) stale = h, other = h; other.domain++;
    P(checked_handle) wrong = {h.id, h.domain}; P(buffer) err = {0};
    assert(P(checked_next)(&wrong, &n, &err) == P(CLOSED));
    assert(P(sequence_next)(&other, &n) == P(CLOSED));
    pthread_t t; assert(!pthread_create(&t, NULL, foreign, &h)); assert(!pthread_join(t, NULL));
    assert(P(sequence_next)(&h, NULL) == P(INVALID) && counts() == 10000);
    assert(P(sequence_next)(&h, &n) == P(OK) && n == 0 && counts() == 10100);
    assert(P(sequence_close)(&h) == P(OK) && counts() == 10101);
    assert(P(sequence_close)(&h) == P(OK) && P(sequence_next)(&stale, &n) == P(CLOSED));
    assert(P(sequence_open)(2, &h) == P(OK));
    assert(P(sequence_next)(&h, &n) == P(OK) && n == 0);
    assert(P(sequence_next)(&h, &n) == P(OK) && n == 1);
    assert(P(sequence_next)(&h, &n) == P(END) && !h.id && counts() == 20402);
    P(checked_handle) c = {0};
    assert(P(checked_open)(0, &c, &err) == P(TYPED_ERROR) && !c.id && equal(err, "factory"));
    P(buffer_dispose)(&err);
    assert(P(checked_open)(1, &c, &err) == P(OK));
    assert(P(checked_next)(&c, &n, &err) == P(OK) && !n);
    assert(P(checked_next)(&c, &n, &err) == P(TYPED_ERROR) && equal(err, "step"));
    P(buffer_dispose)(&err);
    assert(!c.id && counts() == 30603);
    P(units_handle) u = {0}; uint8_t unit = 7;
    assert(P(units_open)(1, &u, &err) == P(OK));
    assert(P(units_next)(&u, &unit, &err) == P(OK) && !unit);
    assert(P(units_next)(&u, &unit, &err) == P(IO_ERROR) && equal(err, "unit step"));
    P(buffer_dispose)(&err);
    assert(!u.id && counts() == 40804);
    assert(P(units_open)(4, &u, &err) == P(OK));
    assert(P(units_next)(&u, &unit, &err) == P(OK));
    assert(P(units_next)(&u, &unit, &err) == P(OK));
    assert(P(units_next)(&u, &unit, &err) == P(END));
    assert(counts() == 51105);
}
