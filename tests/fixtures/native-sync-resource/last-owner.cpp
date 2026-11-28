#include <lbc_lease_sync.hpp>
#include <lbc_lease_task.hpp>
#include <cassert>
#include <dlfcn.h>
#include <iostream>
#include <type_traits>

namespace desk = lean_bridge::lbc_lease_sync;
namespace peer = lean_bridge::lbc_lease_task;
static_assert(std::is_same_v<desk::Badge, peer::Badge>);

// Test instrumentation only. The package user needs neither the broker nor its ABI.
static unsigned live() {
    struct Snapshot { std::uint32_t abi, state, init, components, attached, live; std::uint64_t runtime, domain; } s{};
    auto read = reinterpret_cast<void(*)(Snapshot*)>(dlsym(RTLD_DEFAULT, "lean_bridge_native_snapshot_read"));
    assert(read); read(&s); assert(s.abi == 1); return s.live;
}
int main() {
    const auto base = live(); assert(base == 0);
    auto original = desk::fresh(41);
    try { (void)desk::checked(true, original); assert(false); }
    catch (const desk::DeclaredError<desk::Badge>& failure) {
        assert(failure.declaration == "Owned.checked" && failure.payload == original);
        original.close(); assert(live() == base + 1);
        try { (void)desk::read(original); assert(false); } catch (const desk::Closed&) {}
        auto delivered = peer::later(failure.payload).get();
        assert(delivered == failure.payload && desk::read(failure.payload) == 42);
        delivered.close(); assert(desk::read(failure.payload) == 42 && live() == base + 1);
    } // Only the exception was holding the badge here.
    assert(live() == base);
    { auto fresh = desk::fresh(7); assert(desk::read(fresh) == 7); }
    assert(live() == base);
    std::cout << "typed synchronous failure owned the badge through the peer task; zero identities after payload release\n";
}
