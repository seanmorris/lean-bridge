#include <lbc_lease_sync.hpp>
#include <lbc_lease_task.hpp>
#include <cassert>
#include <concepts>
#include <dirent.h>
#include <dlfcn.h>
#include <thread>

namespace direct = lean_bridge::lbc_lease_sync;
namespace worker = lean_bridge::lbc_lease_task;
static_assert(std::same_as<direct::Badge, worker::Badge>);

// Test-only independent lease accounting.
static unsigned live() {
    struct Snapshot { std::uint32_t abi, state, inits, components, attached, live; std::uint64_t runtime, domain; } s{};
    auto read = reinterpret_cast<void(*)(Snapshot*)>(dlsym(RTLD_DEFAULT, "lean_bridge_native_snapshot_read"));
    assert(read); read(&s); assert(s.abi == 1); return s.live;
}
int main() {
    const auto baseline = live();
    const auto count_fds = [] {
        auto *d = opendir("/proc/self/fd"); assert(d); unsigned count = 0;
        while (readdir(d)) ++count;
        closedir(d); return count;
    };
    const auto cold = count_fds();
    try { (void)direct::letter(char32_t{0xd800}); assert(false); } catch (const std::invalid_argument&) {}
    assert(count_fds() == cold);
    {
        auto a = direct::fresh(40); auto alias = direct::checked(false, a);
        assert(a == alias);
        auto pending = worker::later(alias); alias.close();
        auto from_task = pending.get();
        assert(a == from_task && direct::read(from_task) == 41);
        direct::Badge keep;
        try { (void)direct::checked(true, from_task); assert(false); }
        catch (const direct::DeclaredError<direct::Badge> &e) {
            assert(e.declaration == "Owned.checked" && e.payload == a);
            direct::increment(e.payload, 3); keep = e.payload.clone();
        }
        a.close(); assert(direct::read(keep) == 44);
        try { (void)direct::read(a); assert(false); } catch (const direct::Closed&) {}
        std::thread drop([x = std::move(from_task)]() mutable { x.close(); }); drop.join();
        assert(direct::read(keep) == 44); // owner-thread entry drains the deferred release
    }
    assert(live() == baseline);
}
