/* The same executable runs with either installed runtime first. */
#include <lbc_pulse.h>
#include <lbc_c_retained.h>
#include <assert.h>
#include <dlfcn.h>
#include <errno.h>
#include <poll.h>
#include <string.h>
#define A(x) lbc_c_retained_##x
#define P(x) lbc_pulse_##x
#ifdef NDEBUG
#error "Coexistence assertions must be enabled"
#endif
static A(status) plus_one(void *p,uint32_t n,uint32_t *out,A(callback_error) *e) {
    (void)e; (*(int *)p)++; *out = n + 1; return A(OK);
}
int main(int argc, char **argv) {
    assert(argc == 2);
    int current = !strcmp(argv[1],"new-first");
    assert((dlsym(RTLD_DEFAULT,"lean_bridge_native_retirement_watch") != NULL) == current);
    P(bytes_handle) prior = {0}; P(buffer) bytes = {0}; int fd;
    assert(P(bytes_start)((P(view)){(const uint8_t *)"old",3},&prior) == P(OK));
    assert(P(bytes_poll)(prior,&fd) == P(OK) && P(bytes_take)(&prior,&bytes) == P(OK));
    assert(bytes.len == 3 && !memcmp(bytes.data,"old",3)); P(buffer_dispose)(&bytes);
    uint32_t n = 0; assert(A(plain_call)(4,&n,NULL) == A(OK) && n == 5);
    A(callback_uint32_to_uint32) f = {0}; A(factory_handle) task = {0}; A(callback_error) e = {0}; int calls = 0;
    assert(A(callback_uint32_to_uint32_make)(plus_one,&calls,NULL,&f) == A(OK));
    A(status) s = A(factory_start)(f,false,&task);
    if (current) {
        assert(s == A(OK));
        while ((s = A(factory_poll)(task,&fd)) == A(PENDING)) {
            struct pollfd p = {.fd=fd,.events=POLLIN}; int r;
            do { r = poll(&p,1,10000); } while (r < 0 && errno == EINTR);
            assert(r == 1 && p.revents == POLLIN);
        }
        assert(s == A(OK) && A(factory_take)(&task,&n,&e) == A(OK) && n == 10 && calls == 1);
    } else assert(s == A(UNAVAILABLE) && !task.id && !calls);
    assert(A(callback_uint32_to_uint32_release)(&f) == A(OK));
    return 0;
}
