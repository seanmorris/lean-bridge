// This translation unit includes only the installed C++ API, not a bridge ABI.
// The integration checks must execute even in a Release-mode CMake build.
#undef NDEBUG
#include <lbc_pulse.hpp>
#include <cassert>
#include <chrono>
#include <cstdlib>
#include <iostream>
#include <limits>
#include <thread>
#include <type_traits>
#include <sys/wait.h>
#include <unistd.h>

namespace api = lean_bridge::lbc_pulse;
using namespace std::chrono_literals;
using Task = api::Future<std::int64_t>;
using Item = api::Result<std::uint32_t, std::string>;
static_assert(!std::is_copy_constructible_v<Task> && std::is_nothrow_move_constructible_v<Task>);
static_assert(!std::is_copy_constructible_v<api::Stream<Item>>);
static_assert(std::is_same_v<decltype(api::state()), std::uint32_t>);
static_assert(std::is_same_v<decltype(api::reset()), void>);
static_assert(std::is_same_v<decltype(api::io_task(false)), api::Future<void>>);

template<class E, class F> void expect(F f) {
    try { f(); } catch (const E&) { return; }
    std::abort();
}
void wait_state(std::uint32_t state) {
    for (int i = 0; i < 3000; ++i) {
        if (api::state() == state) return;
        std::this_thread::sleep_for(1ms);
    }
    std::abort();
}
// An unrelated, eagerly started host coroutine type. The bridge neither
// owns this frame nor requires it to inherit a particular promise type.
struct Eager {
    struct promise_type;
    using Handle = std::coroutine_handle<promise_type>;
    struct promise_type {
        std::exception_ptr error;
        Eager get_return_object() { return Eager{Handle::from_promise(*this)}; }
        std::suspend_never initial_suspend() noexcept { return {}; }
        std::suspend_always final_suspend() noexcept { return {}; }
        void return_void() noexcept {}
        void unhandled_exception() noexcept { error = std::current_exception(); }
    };
    Handle h;
    explicit Eager(Handle value) : h(value) {}
    Eager(Eager&& v) noexcept : h(std::exchange(v.h, {})) {}
    Eager(const Eager&) = delete;
    ~Eager() { reset(); }
    void reset() { if (h) { h.destroy(); h = {}; } }
    bool done() const { return h && h.done(); }
    void finish() {
        while (!done()) assert(api::run_one(5000));
        if (h.promise().error) std::rethrow_exception(h.promise().error);
    }
};
Eager observe(Task &task, bool &cancelled, std::int64_t &value) {
    try { value = co_await task; } catch (const api::Cancelled&) { cancelled = true; }
}
Eager cancel_sibling(Task &task, Eager &sibling, unsigned &resumes) {
    try { (void)co_await task; std::abort(); }
    catch (const api::Cancelled&) { ++resumes; sibling.reset(); }
}
api::Routine<std::uint32_t> nested_value() {
    co_await api::io_task(false);
    auto result = co_await api::checked(false, false, "value");
    co_return std::get<api::Ok<std::uint32_t>>(result).value;
}
api::Routine<void> consume(const std::string &label) {
    assert((co_await nested_value()) == 42);
    const auto before = api::pulls(), initial = api::closes();
    auto stream = api::series(false, false, label);
    assert(api::pulls() == before);
    auto first = stream.next();
    expect<api::Busy>([&] { (void)stream.next(); });
    auto item = co_await first;
    assert(item && std::get<api::Err<std::string>>(*item).value == label);
    expect<api::Closed>([&] { (void)first.get(); });
    assert(api::pulls() == before + 1);
    item = co_await stream.next();
    assert(item && std::get<api::Ok<std::uint32_t>>(*item).value == 73);
    assert(!(co_await stream.next())); assert(!(co_await stream.next()));
    assert(api::pulls() == before + 3 && api::closes() == initial + 1);
    stream.close(); assert(api::closes() == initial + 1);
    {
        auto early = api::series(false, false, label);
        while (auto v = co_await early.next()) { assert(v.has_value()); break; }
    }
    assert(api::closes() == initial + 2);
    {
        auto failing = api::series(true, false, label);
        auto returned = co_await failing.next(); assert(std::holds_alternative<api::Err<std::string>>(*returned));
        try { (void)co_await failing.next(); std::abort(); }
        catch (const api::StepError<std::uint16_t> &e) { assert(e.payload == 413 && e.declaration == "Pulse.series"); }
    }
    assert(api::closes() == initial + 3);
}
int main() {
    alarm(90);
    std::string label{"C\0\xc3\xa9", 4}; std::vector<std::uint8_t> bytes{0, 128, 255};
    assert(api::bytes(bytes).get() == bytes); assert(api::bytes({}).get().empty());
    try { (void)api::checked(true, false, label); std::abort(); }
    catch (const api::StartError<std::string> &e) { assert(e.payload == label && e.declaration == "Pulse.checked"); }
    expect<std::invalid_argument>([] { (void)api::checked(false, true, "\xc0\xaf"); });
    auto returned = api::checked(false, true, label);
    assert(returned.ready()); assert(std::get<api::Err<std::string>>(returned.get()).value == label);
    expect<api::Closed>([&] { (void)returned.get(); });
    try { (void)api::io_task(true); std::abort(); }
    catch (const api::IOError &e) { assert(e.message == "IO refusal" && e.declaration == "Pulse.ioTask"); }
    api::io_task(false).get(); consume(label).get();
    api::reset();
    auto original = api::late(false, std::numeric_limits<std::int64_t>::min()); wait_state(1);
    auto moved = std::move(original); expect<api::Closed>([&] { (void)original.get(); });
    std::int64_t value = 88; bool cancelled = false;
    auto listening = observe(moved, cancelled, value); assert(!listening.done());
    expect<api::Busy>([&] { (void)moved.get(); });
    expect<api::Busy>([&] { (void)std::move(moved).operator co_await(); });
    assert(!moved.ready());
    assert(!api::run_one(0));
    auto pid = fork(); assert(pid >= 0);
    if (!pid) { expect<api::WrongContext>([&] { (void)moved.ready(); }); expect<api::WrongContext>([] { (void)api::state(); }); _exit(0); }
    int ws; assert(waitpid(pid, &ws, 0) == pid && WIFEXITED(ws) && WEXITSTATUS(ws) == 0);
    api::release(); listening.finish();
    assert(!cancelled && value == std::numeric_limits<std::int64_t>::min());

    api::reset(); auto task = api::late(true, 93); wait_state(1);
    auto pending = observe(task, cancelled, value);
    std::thread worker([f = std::move(task)]() mutable {
        auto local = std::move(f);
        expect<api::WrongContext>([&] { (void)local.ready(); });
        expect<api::WrongContext>([&] { (void)std::move(local).operator co_await(); });
        // Destruction, not the failed await, hands cleanup to the main thread.
    });
    worker.join(); pending.finish(); assert(cancelled); wait_state(2);

    // Destroy a different registered external frame *during* a resume. The old
    // poll snapshot and its numerical descriptors must never resume it again.
    api::reset(); auto a = api::late(false, 1), b = api::late(false, 2); wait_state(1);
    bool victim_cancelled = false; std::int64_t victim_value = -1; unsigned resumes = 0;
    auto victim = observe(b, victim_cancelled, victim_value);
    auto killer = cancel_sibling(a, victim, resumes);
    a.cancel(); killer.finish();
    assert(resumes == 1 && !victim.h && victim_value == -1 && !victim_cancelled);
    expect<api::Cancelled>([&] { (void)b.get(); }); api::release(); wait_state(3);

    // A stream owns its cursor; a pending next() cannot keep it logically open.
    // The non-cooperative Lean pull is allowed to finish late after scope exit.
    api::reset(); auto closed = api::closes(); auto stream = api::series(false, true, label);
    auto step = stream.next(); wait_state(1);
    std::thread release_stream([s = std::move(stream)]() mutable { auto on_worker = std::move(s); }); release_stream.join();
    expect<api::Cancelled>([&] { (void)step.get(); });
    assert(api::closes() == closed + 1); api::release(); wait_state(3);

    api::reset(); auto final_task = api::late(true, 7); wait_state(1);
    cancelled = false; auto final_observer = observe(final_task, cancelled, value);
    api::shutdown(); final_observer.finish(); assert(cancelled);
    expect<api::Unavailable>([] { (void)api::io_task(false); });
    std::cout << "installed C++20 tasks, coroutines and pull streams: ok\n";
}
