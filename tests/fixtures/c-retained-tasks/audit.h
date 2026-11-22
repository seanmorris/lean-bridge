/* Test-only inspection. The C consumer API doesn't require broker symbols. */
#include <dirent.h>
#include <dlfcn.h>
#include <time.h>
static void pause_ms(void) {
    struct timespec t = {0, 1000000}; while (nanosleep(&t, &t) < 0 && errno == EINTR) {}
}
static unsigned live(void) {
    struct snap { uint32_t abi, state, init, components, attached, live; uint64_t runtime, domain; } s = {0};
    void (*read_snapshot)(struct snap *) = dlsym(RTLD_DEFAULT, "lean_bridge_native_snapshot_read");
    assert(read_snapshot); read_snapshot(&s); assert(s.abi == 1); return s.live;
}
static unsigned descriptors(void) {
    DIR *d = opendir("/proc/self/fd"); assert(d); unsigned n = 0;
    while (readdir(d)) n++;
    closedir(d); return n;
}
static void quiescent(unsigned fds) {
    for (int i = 0; i < 3000 && (live() || descriptors() != fds); i++) pause_ms();
    assert(!live() && descriptors() == fds);
}
static void readable(int fd) {
    assert(fd >= 0); struct pollfd p = {.fd=fd, .events=POLLIN};
    int n; do { n = poll(&p, 1, 15000); } while (n < 0 && errno == EINTR);
    assert(n == 1 && p.revents == POLLIN);
}
/* Re-poll the same public task after every wake; never read/close the descriptor. */
#define READY(fn, handle, ns) do { \
    int descriptor = -1, first = -1; ns(status) state; \
    while ((state = fn((handle), &descriptor)) == ns(PENDING)) { \
        assert(first == -1 || first == descriptor); first = descriptor; readable(descriptor); \
    } assert(state == ns(OK) && descriptor == -1); \
} while (0)
