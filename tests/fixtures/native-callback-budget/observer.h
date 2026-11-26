/* Inspect the already-loaded runtime; do not initialize an independent one. */
#include <assert.h>
#include <dlfcn.h>
#include <stdint.h>
struct budget_snapshot {
    uint32_t abi, state, init, components, attached, live;
    uint64_t runtime, domain;
};
static void expect_zero_leases(void) {
    struct budget_snapshot s = {1,0,0,0,0,0,0,0};
    typedef void (*reader)(struct budget_snapshot *);
    reader read_snapshot = (reader)dlsym(RTLD_DEFAULT, "lean_bridge_native_snapshot_read");
    assert(read_snapshot); read_snapshot(&s);
    assert(s.abi == 1 && s.init == 1 && s.live == 0);
}
