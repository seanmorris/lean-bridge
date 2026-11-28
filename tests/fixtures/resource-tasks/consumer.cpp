#include <lbc_depot.hpp>
#include <lbc_depot_peer.hpp>
#include "audit.h"
#include <iostream>
#include <thread>
#include <type_traits>
namespace a = lean_bridge::lbc_depot;
namespace b = lean_bridge::lbc_depot_peer;
static_assert(std::is_same_v<a::Ticket, b::Ticket>);
static_assert(!std::is_same_v<a::Ticket, a::Badge> && !std::is_copy_constructible_v<a::Ticket>);
static void phase(std::uint32_t wanted) {
    for (int i = 0; i < 5000; ++i) { if (a::state() == wanted) return; tick(); }
    assert(false);
}
template<class E, class F> void throws(F f) {
    try { f(); } catch (const E&) { return; } assert(false);
}
static a::Routine<b::Ticket> complete(a::Future<a::Ticket> job) {
    co_return co_await job;
}
int main() {
    alarm(90); a::reset(); auto base = live(); auto files = descriptors();
    {
        auto x = a::make(10, "same"), y = b::make(10, "same");
        descriptors_at(files + 2);
        assert(x != y && x.clone() == x && b::alias(x) == x);
        b::add(x, 1); assert(a::count(x) == 11);
        auto fork = x.clone();
        std::thread worker([held = std::move(fork)]() mutable {
            throws<a::WrongContext>([&] { (void)b::count(held); });
            held.close();
        });
        worker.join(); assert(live() == base + 3); (void)a::state(); baseline(base + 2);
        throws<b::Closed>([&] { (void)b::count(fork); });
        auto f = a::pending(x, false); phase(1);
        x.close(); y.close(); a::release(); auto result = complete(std::move(f)).get();
        assert(b::count(result) == 12); baseline(base + 1);
        try { (void)b::checked(true, result); assert(false); }
        catch (const b::StartError<b::Ticket> &e) {
            assert(e.payload == result && e.declaration == "Depot.checked"); b::add(e.payload, 2);
        }
        assert(b::checked(false, result).get() == result && a::count(result) == 14);
        for (int mode : {0, 1, 2}) {
            auto before = b::closes();
            auto stream = b::tickets(result, mode == 1);
            auto item = stream.next().get(); assert(item && *item == result);
            if (mode == 2) stream.close();
            else if (mode == 0) assert(!stream.next().get());
            else {
                try { (void)stream.next().get(); assert(false); }
                catch (const b::StepError<b::Ticket> &e) {
                    assert(e.payload == *item && e.declaration == "Depot.tickets");
                }
            }
            assert(b::closes() == before + 1);
        }
        baseline(base + 1);
        for (bool cooperate : {true, false}) {
            a::reset(); auto job = a::pending(result, cooperate); phase(1);
            if (!cooperate) result.close();
            job.cancel(); throws<a::Cancelled>([&] { (void)job.get(); });
            if (!cooperate) { descriptors_at(files + 1); a::release(); }
            phase(cooperate ? 2 : 3); baseline(base + cooperate);
            descriptors_at(files + cooperate);
        }
    }
    auto left = a::make(1, "end"); auto right = b::alias(left);
    a::shutdown(); baseline(base); descriptors_at(files);
    left.close(); right.close(); /* no second release after dispatcher shutdown */
    std::cout << "C++ leases: shared nominal types, typed errors, co_await and owner-thread cleanup passed\n";
}
