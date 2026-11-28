#include <lbc_dials.hpp>
#include <cassert>
#include <cstdlib>
#include <ranges>
#include <thread>
#include <type_traits>

namespace app = lean_bridge::lbc_dials;
using Range = decltype(app::sequence(2));
static_assert(std::ranges::input_range<Range>);
static_assert(!std::ranges::forward_range<Range>);
static_assert(std::is_move_constructible_v<Range> && !std::is_copy_constructible_v<Range>);

// Observe the compiled application's counters without running the C++ cleanup queue.
static std::uint32_t raw_counts() {
    std::uint32_t n; assert(lbc_dials_counts_call(&n) == lbc_dials_OK); return n;
}
static void drop_on_worker(Range range) {
    std::thread worker([cursor = std::move(range)]() mutable {
        auto local = std::move(cursor);
        try { (void)local.next(); assert(false); } catch (const app::WrongContext&) {}
        try { local.close(); assert(false); } catch (const app::WrongContext&) {}
    });
    worker.join();
}
int main() {
    assert(!std::atexit([] { assert(raw_counts() == 71307); }));
    assert(app::counts() == 0);
    for (auto n : app::sequence(3)) {
        assert(n == 0 && raw_counts() == 10100);
        break;
    }
    assert(raw_counts() == 10101);
    auto iter = app::sequence(2);
    assert(iter.next() == 0 && iter.next() == 1 && !iter.next());
    assert(!iter.next()); iter.close();
    assert(raw_counts() == 20402);
    try { (void)app::checked(0); assert(false); } catch (const app::DeclaredError<std::string>& e) {
        assert(e.declaration == "Dials.checked" && e.payload == "factory");
    }
    auto typed = app::checked(1);
    assert(typed.next() == 0);
    try { (void)typed.next(); assert(false); } catch (const app::DeclaredError<std::string>& e) {
        assert(e.declaration == "Dials.checkedNext" && e.payload == "step");
    }
    assert(!typed.next() && raw_counts() == 30603);
    auto units = app::units(1);
    assert(units.next().has_value());
    try { (void)units.next(); assert(false); } catch (const app::IOError& e) {
        assert(e.declaration == "Dials.nextUnit" && e.message == "unit step");
    }
    assert(!units.next() && raw_counts() == 40804);
    unsigned seen = 0;
    for (auto unused : app::units(4)) { (void)unused; ++seen; }
    assert(seen == 2 && raw_counts() == 51105);
    auto deferred = app::sequence(4);
    assert(deferred.next() == 0);
    drop_on_worker(std::move(deferred));
    assert(raw_counts() == 61205 && app::counts() == 61206);
    auto at_exit = app::sequence(4);
    assert(at_exit.next() == 0);
    drop_on_worker(std::move(at_exit));
    assert(raw_counts() == 71306);
}
