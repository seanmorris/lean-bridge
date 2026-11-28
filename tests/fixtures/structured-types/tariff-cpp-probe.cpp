/* Test observer only. The second binary runs the unchanged public consumer. */
#include <cassert>
#include <cstdint>
#include <cstdio>
#include <dlfcn.h>

struct Snapshot { uint32_t abi, state, starts, init, attached, live; uint64_t runtime, domain; };
static uint32_t count() {
    auto read = reinterpret_cast<void (*)(Snapshot*)>(dlsym(RTLD_DEFAULT, "lean_bridge_native_snapshot_read"));
    assert(read);
    Snapshot value{};
    read(&value);
    assert(value.abi == 1);
    return value.live;
}
static unsigned checkpoints = 0;
void checkpoint(const char *name) {
    assert(count() == 1); // The owner thread's session only.
    ++checkpoints;
    std::puts(name);
}
void after_owner_exit() {
    assert(checkpoints == 6 && count() == 0);
    std::puts("identities:1,1,1,1,1,1,0");
}
