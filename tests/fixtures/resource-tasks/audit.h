/* Independent observer, not application glue. No Lean SDK or producer headers. */
#include <assert.h>
#include <dlfcn.h>
#include <dirent.h>
#include <stdint.h>
#include <string.h>
#include <time.h>
#include <unistd.h>
typedef struct { uint32_t abi, state, init, components, attached, live; uint64_t runtime, domain; } snapshot_v1;
static uint32_t live(void) {
    typedef void (*reader)(snapshot_v1 *);
    static reader read_snapshot;
    if (!read_snapshot) {
        void *lib = dlopen("liblean_bridge_native.so", RTLD_NOLOAD | RTLD_NOW); assert(lib);
        read_snapshot = (reader)dlsym(lib, "lean_bridge_native_snapshot_read"); assert(read_snapshot);
        dlclose(lib);
    }
    snapshot_v1 s; read_snapshot(&s); assert(s.abi == 1); return s.live;
}
static void tick(void) { const struct timespec pause = {0, 1000000}; nanosleep(&pause, NULL); }
static void baseline(uint32_t n) {
    for (int i = 0; i < 5000 && live() != n; ++i) tick();
    assert(live() == n);
}
/* Each actual Lean Ticket owns one /dev/null file handle. Unlike the runtime
   ledger, this observes Lean's final reference disappearing after cancellation. */
static unsigned descriptors(void) {
    unsigned n = 0; DIR *dir = opendir("/proc/self/fd"); assert(dir);
    for (struct dirent *e; (e = readdir(dir)) != NULL;) {
        char name[32]; ssize_t len = readlinkat(dirfd(dir), e->d_name, name, sizeof name);
        if (len == 9 && !memcmp(name, "/dev/null", 9)) ++n;
    }
    closedir(dir); return n;
}
static void descriptors_at(unsigned n) {
    for (int i = 0; i < 5000 && descriptors() != n; ++i) tick();
    assert(descriptors() == n);
}
