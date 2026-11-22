#define _GNU_SOURCE
#include <lbc_depot.h>
#include <lbc_depot_peer.h>
#include "audit.h"
#include <errno.h>
#include <poll.h>
#include <pthread.h>
#include <stdio.h>
#include <string.h>
#include <sys/wait.h>
#define P(x) lbc_depot_##x
#define Q(x) lbc_depot_peer_##x
#define OK(x) assert((x) == P(OK))
#define PEER(x) assert((x) == Q(OK))
#define WAIT(name,h) do { int fd; P(status) s = P(name##_poll)(h, &fd); \
    if (s == P(PENDING)) { struct pollfd p = {fd, POLLIN, 0}; int n; \
        do { n = poll(&p, 1, 10000); } while (n < 0 && errno == EINTR); assert(n == 1); } else assert(s == P(OK)); } while (0)
static void phase(uint32_t n) {
    for (int i = 0; i < 5000; ++i) { uint32_t s; OK(P(state_call)(&s, NULL)); if (n == s) return; tick(); }
    assert(0);
}
static void *wrong_thread(void *ptr) {
    assert(P(resource_ticket_release)(ptr) == P(WRONG_CONTEXT)); return NULL;
}
int main(void) {
    alarm(90);
    uint8_t unit = 99; uint32_t n; bool same;
    OK(P(reset_call)(&unit, NULL)); uint32_t base = live(); unsigned files = descriptors();
    P(resource_ticket_t) a = {0}, b = {0}, other = {0}, out = {0}, err = {0};
    P(resource_badge_t) badge = {0};
    P(view) label = {(const uint8_t *)"ticket", 6};
    OK(P(make_call)(40, label, &a, NULL)); OK(P(make_call)(40, label, &other, NULL));
    descriptors_at(files + 2);
    PEER(Q(alias_call)(a, &b, NULL));
    PEER(Q(resource_ticket_same)(a, b, &same)); assert(same);
    OK(P(resource_ticket_same)(b, other, &same)); assert(!same);
    PEER(Q(add_call)(b, 1, &unit, NULL)); OK(P(count_call)(a, &n, NULL)); assert(n == 41);
    assert(P(alias_call)(a, &b, NULL) == P(INVALID)); /* don't overwrite a live output */
    pthread_t worker; assert(!pthread_create(&worker, NULL, wrong_thread, &a)); assert(!pthread_join(worker, NULL));
    pid_t child = fork(); assert(child >= 0);
    if (!child) _exit(P(resource_ticket_release)(&a) == P(WRONG_CONTEXT) ? 0 : 1);
    int ws; assert(waitpid(child, &ws, 0) == child && WIFEXITED(ws) && !WEXITSTATUS(ws));
    OK(P(badge_call)(1, &badge, NULL));
    P(resource_ticket_t) wrong; memcpy(&wrong, &badge, sizeof wrong);
    n = 999; assert(P(count_call)(wrong, &n, NULL) == P(CLOSED) && n == 999);
    assert(P(resource_ticket_release)(&wrong) == P(CLOSED)); OK(P(resource_badge_release)(&badge));
    P(resource_ticket_t) alias = a; OK(P(resource_ticket_release)(&a)); OK(P(resource_ticket_retain)(b, &a));
    assert(P(resource_ticket_release)(&alias) == P(CLOSED));
    P(resource_ticket_t) foreign = a; foreign._private[1] ^= 1;
    assert(P(count_call)(foreign, &n, NULL) == P(CLOSED));
    OK(P(resource_ticket_release)(&other)); PEER(Q(resource_ticket_release)(&b)); baseline(base + 1);
    P(pending_handle) job = {0};
    OK(P(pending_start)(a, 0, &job)); phase(1); OK(P(resource_ticket_release)(&a));
    assert(P(pending_take)(&job, &out) == P(PENDING));
    OK(P(release_call)(&unit, NULL)); WAIT(pending,job); OK(P(pending_take)(&job, &out));
    PEER(Q(count_call)(out, &n, NULL)); assert(n == 42); baseline(base + 1);
    P(checked_handle) immediate = {0};
    assert(P(checked_start)(true, out, &immediate, &err) == P(TYPED_ERROR) && !immediate.id);
    PEER(Q(resource_ticket_same)(out, err, &same)); assert(same);
    OK(P(resource_ticket_release)(&err));
    OK(P(checked_start)(false, out, &immediate, &err));
    assert(P(checked_take)(&immediate, &out) == P(INVALID)); /* take is retryable */
    OK(P(checked_take)(&immediate, &a)); OK(P(resource_ticket_release)(&a));
    for (int mode = 0; mode < 3; ++mode) {
        uint32_t before; OK(P(closes_call)(&before, NULL));
        P(tickets_handle) stream = {0}; OK(P(tickets_start)(out, mode == 1, &stream, NULL));
        OK(P(tickets_pull)(stream)); WAIT(tickets,stream); OK(P(tickets_take)(&stream, &a, &err));
        OK(P(resource_ticket_same)(a, out, &same)); assert(same); OK(P(resource_ticket_release)(&a));
        if (mode == 2) { OK(P(tickets_close)(&stream)); }
        else {
            OK(P(tickets_pull)(stream)); WAIT(tickets,stream);
            assert(P(tickets_take)(&stream, &a, &err) == (mode ? P(TYPED_ERROR) : P(END)));
            if (mode) { OK(P(resource_ticket_same)(err, out, &same)); assert(same); OK(P(resource_ticket_release)(&err)); }
        }
        OK(P(closes_call)(&n, NULL)); assert(n == before + 1); baseline(base + 1);
    }
    for (int cooperates = 1; cooperates >= 0; --cooperates) {
        OK(P(reset_call)(&unit, NULL)); OK(P(pending_start)(out, cooperates, &job)); phase(1);
        if (!cooperates) OK(P(resource_ticket_release)(&out)); /* no remaining host lease */
        OK(P(pending_close)(&job)); assert(P(pending_take)(&job, &a) == P(CLOSED));
        if (!cooperates) { descriptors_at(files + 1); OK(P(release_call)(&unit, NULL)); }
        phase(cooperates ? 2 : 3); baseline(base + (uint32_t)cooperates);
        descriptors_at(files + (unsigned)cooperates);
    }
    OK(P(make_call)(1, (P(view)){(const uint8_t *)"retire-probe", 12}, &a, NULL));
    P(tickets_handle) retiring = {0}; OK(P(tickets_start)(a, false, &retiring, NULL));
    assert(access("retired-close-ran.txt", F_OK) == -1);
    void *lib = dlopen("liblean_bridge_native.so", RTLD_NOLOAD | RTLD_NOW); assert(lib);
    void (*retire)(void) = (void (*)(void))dlsym(lib, "lean_bridge_native_runtime_retire"); assert(retire); retire();
    assert(P(count_call)(a, &n, NULL) == P(UNAVAILABLE)); PEER(Q(resource_ticket_release)(&a));
    descriptors_at(files + 1); OK(P(tickets_close)(&retiring)); baseline(base); descriptors_at(files);
    assert(access("retired-close-ran.txt", F_OK) == -1);
    puts("C leases: identity across packages, typed failures, cancellation and cleanup passed");
}
