#undef NDEBUG
#include <lbc_wide.hpp>
#include <cassert>
#include <iostream>
#include <unistd.h>
namespace api = lean_bridge::lbc_wide;
using I = api::Int; using N = api::Nat;
static_assert(std::is_same_v<I, boost::multiprecision::cpp_int>);
static_assert(std::is_same_v<decltype(api::sum(N{}, I{})), api::Future<I>>);

api::Routine<void> stream(const N &n, const I &z) {
    try { (void)api::series(true, false, n, z); std::abort(); }
    catch (const api::StartError<N> &e) { assert(e.payload == n && e.declaration == "Wide.series"); }
    for (bool terminal : {false, true}) {
        auto s = api::series(false, terminal, n, z);
        auto item = co_await s.next(); assert(item && std::get<api::Err<N>>(*item).value == n);
        if (terminal) {
            try { (void)co_await s.next(); std::abort(); }
            catch (const api::StepError<I> &e) { assert(e.payload == z && e.declaration == "Wide.series"); }
        } else {
            item = co_await s.next(); assert(item && std::get<api::Ok<I>>(*item).value == z);
            assert(!(co_await s.next())); assert(!(co_await s.next()));
        }
    }
}
int main() {
    alarm(90);
    const N n = (N(1) << 4095) + (N(1) << 2051) + (N(1) << 511) + 3;
    const I z = -2 * n - 17;
    assert(api::sum(n, z).get() == n + z); assert(api::sum(N(0), I(0)).get() == 0);
    assert(api::huge(64).get() == (N(1) << 64)); assert(api::calls() == 2);
    try { (void)api::sum(z, n); std::abort(); } catch (const std::invalid_argument&) {}
    try { (void)api::sum(N(1) << 134217720, z); std::abort(); } catch (const std::length_error&) {}
    assert(api::calls() == 2);
    try { (void)api::huge(134217728).get(); std::abort(); } catch (const std::length_error&) {}
    I changed = z; auto task = api::late(changed); changed = 0; assert(!task.ready());
    api::open_gate(); assert(task.get() == z);
    try { (void)api::checked(true, false, n, z); std::abort(); }
    catch (const api::StartError<I> &e) { assert(e.payload == z && e.declaration == "Wide.checked"); }
    auto out = api::checked(false, true, n, z).get();
    assert(std::get<api::Err<I>>(out).value == z);
    using Inner = api::Result<I, N>;
    out = api::checked(false, false, n, z).get(); assert(std::get<api::Err<N>>(std::get<api::Ok<Inner>>(out).value).value == n);
    out = api::checked(false, false, n, n).get(); assert(std::get<api::Ok<I>>(std::get<api::Ok<Inner>>(out).value).value == n);
    stream(n, z).get(); assert(api::closes() == 2);
    std::cout << "exact installed cpp tasks: ok\n";
}
