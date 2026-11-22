#define _POSIX_C_SOURCE 200809L
#include <lbc_c_retained.h>
#include <lbc_c_peer.h>
#include <assert.h>
#include <errno.h>
#include <poll.h>
#include <pthread.h>
#include <stdio.h>
#include <string.h>
#include <sys/wait.h>
#include <unistd.h>
#ifdef NDEBUG
#error "C11 installed acceptance requires assertions"
#endif
#define A(x) lbc_c_retained_##x
#define B(x) lbc_c_peer_##x
#include "audit.h"
#include "scalars.h"
#include "example.h"

static A(view) view(const char *s) { return (A(view)){(const uint8_t *)s, strlen(s)}; }
static int equal(A(buffer) b, const char *s) { return b.len == strlen(s) && !memcmp(b.data, s, b.len); }
static void count_drop(void *p) { same_thread(); ++*(int *)p; }
static B(status) echo_peer(void *ctx, B(view) v, B(buffer) *out, B(callback_error) *e) {
    (void)ctx; (void)e; same_thread(); return B(buffer_set)(out, v);
}
enum behavior { NEST, FAIL, REVOKE, CANCEL, TRAP, CANCEL_TRAP, INVALID_UTF8, OVERSIZE, INVALID_STATUS };
struct context {
    enum behavior mode;
    int invoked, destroyed, payload_drops;
    A(callback_string_to_string) lease;
    A(repeat_call_handle) task;
};
static void destroy_context(void *p) { struct context *c = p; same_thread(); ++c->destroyed; }
static A(status) text_callback(void *p, A(view) v, A(buffer) *out, A(callback_error) *e) {
    struct context *c = p; same_thread(); c->invoked++; assert(!c->destroyed);
    if (c->mode == FAIL) return A(callback_error_set)(e, 701, view("identical"), &c->payload_drops, count_drop);
    if (c->mode == REVOKE) {
        assert(A(callback_string_to_string_close)(&c->lease) == A(OK) && !c->destroyed);
        return A(buffer_set)(out, v);
    }
    if (c->mode == CANCEL || c->mode == CANCEL_TRAP) {
        assert(A(repeat_call_close)(&c->task) == A(OK) && !c->destroyed);
        return c->mode == CANCEL ? A(OK) : A(CALLBACK_TRAP);
    }
    if (c->mode == TRAP) return A(CALLBACK_TRAP);
    if (c->mode == INVALID_STATUS) return A(IDLE); /* undeclared callback status */
    if (c->mode == INVALID_UTF8) return A(buffer_set)(out, (A(view)){(const uint8_t *)"\xff", 1});
    if (c->mode == OVERSIZE) return A(buffer_set)(out, (A(view)){(const uint8_t *)"x", 16777217});

    int fd; if (c->task.id) {
        A(buffer) unused = {0}; A(callback_error) err = {0};
        assert(A(repeat_call_poll)(c->task, &fd) == A(BUSY));
        assert(A(repeat_call_take)(&c->task, &unused, &err) == A(BUSY));
    }
    /* Drive an independently installed component on the same main thread. */
    B(callback_string_to_string) f = {0}; B(repeat_call_handle) task = {0};
    B(buffer) b = {0}; B(callback_error) error = {0};
    assert(B(callback_string_to_string_make)(echo_peer,NULL,NULL,&f) == B(OK));
    assert(B(repeat_call_start)((B(view)){v.data,v.len},f,&task) == B(OK));
    assert(B(callback_string_to_string_release)(&f) == B(OK));
    READY(B(repeat_call_poll),task,B); assert(B(repeat_call_take)(&task,&b,&error) == B(OK));
    A(status) s = A(buffer_set)(out,(A(view)){b.data,b.len}); B(buffer_dispose)(&b); return s;
}
static void text_task(enum behavior mode) {
    struct context c = {.mode=mode}; A(buffer) result = {0}; A(callback_error) error = {0};
    assert(A(callback_string_to_string_make)(text_callback,&c,destroy_context,&c.lease) == A(OK));
    A(callback_string_to_string) clone = {0}, stale = c.lease;
    assert(A(callback_string_to_string_retain)(c.lease,&clone) == A(OK));
    uint8_t input[] = {'x',0,'z'}; assert(A(repeat_call_start)((A(view)){input,3},clone,&c.task) == A(OK)); input[0] = 3;
    assert(A(callback_string_to_string_release)(&clone) == A(OK));
    if (mode != REVOKE) {
        assert(A(callback_string_to_string_release)(&c.lease) == A(OK) && !c.destroyed);
        assert(A(callback_string_to_string_retain)(stale,&clone) == A(CLOSED));
    }
    A(repeat_call_handle) alias = c.task; A(status) s;
    /* Drive with _take alone as an alternative to _poll. A PENDING take
       leaves both outputs unchanged; _poll then supplies the waitable fd. */
    while ((s = A(repeat_call_take)(&c.task,&result,&error)) == A(PENDING)) {
        int fd = -2; assert(!result.data && !error.payload);
        s = A(repeat_call_poll)(c.task,&fd);
        if (s == A(PENDING)) readable(fd); else if (s != A(OK)) break;
    }
    switch (mode) {
    case NEST: assert(s == A(OK) && c.invoked == 2 && result.len == 3 && !memcmp(result.data,"x\0z",3)); break;
    case FAIL: assert(s == A(CALLBACK_ERROR) && error.payload == &c.payload_drops && error.code == 701);
        assert(equal(error.message,"identical") && !c.payload_drops); break;
    case REVOKE: assert(s == A(CALLBACK_CLOSED) && c.invoked == 1 && equal(error.message,"retained callback is closed")); break;
    case CANCEL: case CANCEL_TRAP: assert(s == A(CLOSED) && c.invoked == 1); break;
    case INVALID_UTF8: assert(s == A(INVALID)); break;
    case OVERSIZE: assert(s == A(LIMIT)); break;
    case TRAP: case INVALID_STATUS: assert(s == A(CALLBACK_TRAP)); break;
    }
    assert(c.destroyed == 1 && !c.task.id && A(repeat_call_close)(&alias) == A(CLOSED));
    A(buffer_dispose)(&result); A(callback_error_dispose)(&error); A(callback_error_dispose)(&error);
    assert(c.payload_drops == (mode == FAIL));
}
static A(status) fail_nat(void *ctx, mpz_srcptr n, mpz_ptr reply, A(callback_error) *e) {
    (void)n; (void)reply; return A(callback_error_set)(e,702,view("identical"),ctx,count_drop);
}
static A(status) invalid_nat(void *ctx, mpz_srcptr n, mpz_ptr reply, A(callback_error) *e) {
    (void)ctx; (void)n; (void)e; mpz_set_si(reply,-2); return A(OK);
}
static A(status) echo_bytes(void *ctx,A(view) v,A(buffer) *out,A(callback_error) *e) {
    (void)ctx; (void)e; return A(buffer_set)(out,v);
}
static void outcomes(void) {
    A(callback_error) e = {0}; A(buffer) msg = {0}; uint32_t n = 77;
    assert(call_factory(&n,&e) == A(OK) && n == 18);
    A(local_factory_handle) eager = {0};
    assert(A(local_factory_start)(true,&eager,&msg) == A(IO_ERROR) && !eager.id && equal(msg,"eager factory IO"));
    A(buffer_dispose)(&msg);
    A(terminal_handle) terminal = {0}; assert(A(terminal_start)(true,&terminal) == A(OK));
    READY(A(terminal_poll),terminal,A);
    assert(A(terminal_take)(&terminal,&n,&msg) == A(TASK_IO_ERROR) && equal(msg,"late IO") && n == 18); A(buffer_dispose)(&msg);
    A(callback_uint32_to_uint32) f32 = {0}; assert(A(callback_uint32_to_uint32_make)(twice,NULL,NULL,&f32) == A(OK));
    A(factory_handle) early = {0}; assert(A(factory_start)(f32,true,&early) == A(OK)); READY(A(factory_poll),early,A);
    assert(A(factory_take)(&early,&n,&e) == A(IO_ERROR) && equal(e.message,"early factory IO") && n == 18);
    A(callback_error_dispose)(&e); assert(A(callback_uint32_to_uint32_release)(&f32) == A(OK));
    A(callback_bytes_to_bytes) b = {0}; assert(A(callback_bytes_to_bytes_make)(echo_bytes,NULL,NULL,&b) == A(OK));
    A(typed_start_handle) t = {0}; A(buffer) v = {0};
    assert(A(typed_start_start)(b,true,view("bytes"),&t) == A(OK)); READY(A(typed_start_poll),t,A);
    assert(A(typed_start_take)(&t,&v,&msg,&e) == A(TYPED_ERROR) && equal(msg,"factory refused") && !v.data); A(buffer_dispose)(&msg);
    assert(A(callback_bytes_to_bytes_release)(&b) == A(OK));
    int drops = 0; A(callback_nat_to_nat) nat = {0}; mpz_t z; mpz_init_set_ui(z,321);
    assert(A(callback_nat_to_nat_make)(fail_nat,&drops,NULL,&nat) == A(OK));
    A(replace_error_handle) rep = {0}; assert(A(replace_error_start)(nat,&rep) == A(OK)); READY(A(replace_error_poll),rep,A);
    assert(A(replace_error_take)(&rep,z,&e) == A(TASK_IO_ERROR) && equal(e.message,"identical") && !e.payload && drops == 1);
    assert(mpz_cmp_ui(z,321) == 0); A(callback_error_dispose)(&e);
    A(recover_handle) rec = {0}; A(recover_value) value = {0};
    assert(A(recover_start)(nat,z,&rec) == A(OK)); READY(A(recover_poll),rec,A);
    assert(A(recover_take)(&rec,&value,&e) == A(OK) && !value.ok && equal(value.as.error,"caught in Lean") && drops == 2);
    A(recover_value_dispose)(&value); assert(A(callback_nat_to_nat_release)(&nat) == A(OK));
    assert(A(callback_nat_to_nat_make)(invalid_nat,NULL,NULL,&nat) == A(OK));
    assert(A(replace_error_start)(nat,&rep) == A(OK)); READY(A(replace_error_poll),rep,A);
    assert(A(replace_error_take)(&rep,z,&e) == A(INVALID) && mpz_cmp_ui(z,321) == 0);
    assert(A(callback_nat_to_nat_release)(&nat) == A(OK)); mpz_clear(z);
}
static void early_callbacks(void) {
    for (int fail = 0; fail < 2; fail++) {
        struct context c = {.mode=fail ? FAIL : NEST}; A(callback_error) e = {0}; A(buffer) result = {0};
        assert(A(callback_string_to_string_make)(text_callback,&c,destroy_context,&c.lease) == A(OK));
        A(during_start_handle) h = {0}; assert(A(during_start_start)(c.lease,c.lease,view("three"),&h) == A(OK));
        assert(A(callback_string_to_string_release)(&c.lease) == A(OK)); READY(A(during_start_poll),h,A);
        A(status) s = A(during_start_take)(&h,&result,&e);
        if (fail) assert(s == A(CALLBACK_ERROR) && c.invoked == 1 && e.code == 701 && e.payload == &c.payload_drops);
        else assert(s == A(OK) && c.invoked == 3 && equal(result,"three"));
        assert(c.destroyed == 1 && !c.payload_drops); A(buffer_dispose)(&result); A(callback_error_dispose)(&e);
        assert(c.payload_drops == fail);
    }
}
static void phase(uint32_t want) {
    uint32_t n; A(buffer) io = {0};
    for (int i = 0; i < 5000; i++) {
        assert(A(state_call)(&n,&io) == A(OK)); if (n == want) return; pause_ms();
    }
    assert(0 && "Lean worker missed expected cancellation phase");
}
static int unexpected_calls;
static A(status) unused_callback(void *ctx, uint32_t v, uint32_t *out, A(callback_error) *e) {
    (void)ctx; (void)e; unexpected_calls++; *out = v; return A(OK);
}
static void lifetimes(void) {
    uint8_t u; uint32_t n; A(buffer) io = {0}; A(callback_error) e = {0};
    A(callback_uint32_to_uint32) f = {0}; int drops = 0;
    assert(A(callback_uint32_to_uint32_make)(unused_callback,&drops,count_drop,&f) == A(OK));
    A(remember_handle) keep = {0}; assert(A(remember_start)(f,&keep) == A(OK)); READY(A(remember_poll),keep,A);
    assert(A(remember_take)(&keep,&n,&e) == A(OK) && n == 17);
    A(use_expired_handle) expired = {0}; assert(A(use_expired_start)(&expired) == A(OK)); READY(A(use_expired_poll),expired,A);
    assert(A(use_expired_take)(&expired,&n,&io) == A(TASK_IO_ERROR) && equal(io,"retained callback has expired"));
    A(buffer_dispose)(&io); assert(A(forget_call)(&u,&io) == A(OK));

    assert(A(reset_call)(&u,&io) == A(OK));
    A(queued_handle) q = {0}; assert(A(queued_start)(f,&q) == A(OK)); phase(3);
    int fd; assert(A(queued_poll)(q,&fd) == A(PENDING)); n = 999;
    assert(A(queued_take)(&q,&n,&e) == A(PENDING) && n == 999 && !e.message.data && !e.payload);
    assert(A(release_call)(&u,&io) == A(OK)); readable(fd); /* request queued, no host call yet */
    assert(!unexpected_calls && A(queued_close)(&q) == A(OK)); phase(4);
    assert(A(reset_call)(&u,&io) == A(OK));
    A(cancel_late_handle) late = {0}; assert(A(cancel_late_start)(f,&late) == A(OK)); phase(1);
    assert(A(cancel_late_close)(&late) == A(OK)); assert(A(release_call)(&u,&io) == A(OK)); phase(2);
    assert(A(callback_uint32_to_uint32_release)(&f) == A(OK)); assert(!unexpected_calls && drops == 1);
}
struct foreign { A(until_canceled_handle) task; A(callback_uint32_to_uint32) f; };
static void *wrong_thread(void *p) {
    struct foreign x = *(struct foreign *)p; int fd = 77;
    assert(A(until_canceled_poll)(x.task,&fd) == A(WRONG_CONTEXT) && fd == 77);
    assert(A(until_canceled_close)(&x.task) == A(WRONG_CONTEXT));
    assert(A(callback_uint32_to_uint32_release)(&x.f) == A(WRONG_CONTEXT));
    return NULL;
}
static void contexts(void) {
    struct foreign x = {0}; int drops = 0;
    assert(A(callback_uint32_to_uint32_make)(unused_callback,&drops,count_drop,&x.f) == A(OK));
    assert(A(until_canceled_start)(x.f,&x.task) == A(OK));
    pthread_t thread; assert(!pthread_create(&thread,NULL,wrong_thread,&x)); assert(!pthread_join(thread,NULL));
    pid_t pid = fork(); assert(pid >= 0);
    if (!pid) { wrong_thread(&x); _exit(0); }
    int status; assert(waitpid(pid,&status,0) == pid && WIFEXITED(status) && WEXITSTATUS(status) == 0);
    B(callback_uint32_to_uint32) other = {0}, extra = {0}; memcpy(&other,&x.f,sizeof other);
    assert(B(callback_uint32_to_uint32_retain)(other,&extra) == B(CLOSED));
    A(callback_string_to_string) shape = {0}, second = {0}; memcpy(&shape,&x.f,sizeof shape);
    assert(A(callback_string_to_string_retain)(shape,&second) == A(CLOSED));
    assert(A(until_canceled_close)(&x.task) == A(OK)); assert(A(callback_uint32_to_uint32_release)(&x.f) == A(OK));
    assert(drops == 1);
}
static B(status) peer_never(void *p,uint32_t v,uint32_t *r,B(callback_error) *e) {
    (void)p; (void)v; (void)r; (void)e; assert(0 && "parked task invoked its callback"); return B(CALLBACK_TRAP);
}
static void retire_case(const char *mode, unsigned baseline) {
    B(until_canceled_handle) parked = {0}; B(callback_uint32_to_uint32) f = {0}; int drops = 0;
    assert(B(callback_uint32_to_uint32_make)(peer_never,&drops,count_drop,&f) == B(OK));
    assert(B(until_canceled_start)(f,&parked) == B(OK)); assert(B(callback_uint32_to_uint32_release)(&f) == B(OK));
    int descriptor; assert(B(until_canceled_poll)(parked,&descriptor) == B(PENDING));
    struct pollfd before = {.fd=descriptor,.events=POLLIN}; assert(poll(&before,1,0) == 0);
    if (!strcmp(mode,"retire")) {
        void (*retire)(void) = dlsym(RTLD_DEFAULT,"lean_bridge_native_runtime_retire"); assert(retire); retire();
    } else text_task(!strcmp(mode,"cancel-trap") ? CANCEL_TRAP : !strcmp(mode,"peer-trap") ? INVALID_STATUS : TRAP);
    readable(descriptor);
    READY(B(until_canceled_poll),parked,B);
    uint32_t v = 55; B(callback_error) e = {0};
    assert(B(until_canceled_take)(&parked,&v,&e) == B(UNAVAILABLE) && v == 55 && !parked.id && drops == 1);
    assert(B(callback_uint32_to_uint32_make)(peer_never,&drops,count_drop,&f) == B(UNAVAILABLE) && drops == 1);
    A(buffer) msg = {0}; assert(A(plain_call)(0,&v,&msg) == A(UNAVAILABLE));
    quiescent(baseline);
}
int main(int argc, char **argv) {
    main_thread = pthread_self();
    A(buffer) a = {0}; B(buffer) b = {0}; uint32_t v;
    assert(A(plain_call)(3,&v,&a) == A(OK) && B(plain_call)(4,&v,&b) == B(OK));
    unsigned fds = descriptors(); assert(!live());
    if (argc > 1) { retire_case(argv[1],fds); return 0; }
    scalar_tour(); outcomes(); early_callbacks();
    for (int i = 0; i < 6; i++) text_task((enum behavior[]){NEST,FAIL,REVOKE,CANCEL,INVALID_UTF8,OVERSIZE}[i]);
    lifetimes(); contexts(); quiescent(fds);
    puts("C11: one-descriptor dispatch, error identity, cancellation and cleanup passed"); return 0;
}
