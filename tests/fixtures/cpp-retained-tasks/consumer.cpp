#include <lbc_cpp_retained.hpp>
#include <lbc_cpp_peer.hpp>
#include "audit.hpp"
#include <iostream>
#ifdef NDEBUG
#error "The installed C++ acceptance checks must not be compiled out"
#endif
namespace a = lean_bridge::lbc_cpp_retained;
namespace b = lean_bridge::lbc_cpp_peer;
#include "scalars.hpp"
#include "example.hpp"

template<class E, class F> E failure(F f) {
    try { f(); } catch (const E &e) { return e; }
    throw std::logic_error("expected failure was not observed");
}
struct Marker : std::runtime_error {
    std::shared_ptr<int> data;
    explicit Marker(std::shared_ptr<int> p) : runtime_error("identical"), data(std::move(p)) {}
};
static a::Routine<std::string> nested() {
    auto id = std::this_thread::get_id(); auto count = std::make_unique<int>(0);
    auto t = a::during_start([count = std::move(count), id](std::string s) mutable {
        assert(std::this_thread::get_id() == id); ++*count;
        // Drive a second, independently packaged callback task while the outer watch is servicing us.
        assert(b::repeat_call("b", [](std::string x) { return x + "!"; }).get() == "b!!");
        return s + "!";
    }, [](std::string s) { return s + "?"; }, std::string("α\0", 3));
    co_return co_await t;
}
static void errors() {
    auto data = std::make_shared<int>(17); auto original = std::make_exception_ptr(Marker(data));
    auto fail = [original](auto) -> a::Nat { std::rethrow_exception(original); };
    auto fail_text = [original](std::string) -> std::string { std::rethrow_exception(original); };
    auto preserved = [&](auto f) {
        try { f(); assert(false); }
        catch (const Marker &m) { assert(m.data == data && std::current_exception() == original); }
    };
    preserved([&] { a::repeat_call("", fail_text).get(); });
    preserved([&] { a::during_start(fail_text, fail_text, "").get(); });
    struct NonUtf8 : std::exception { const char *what() const noexcept override { return "\xfe"; } };
    auto binary = std::make_exception_ptr(NonUtf8{});
    try { a::repeat_call("", [binary](std::string) -> std::string { std::rethrow_exception(binary); }).get(); assert(false); }
    catch (const NonUtf8&) { assert(std::current_exception() == binary); }
    auto replaced = failure<a::TaskIOError>([&] { a::replace_error(fail).get(); });
    assert(replaced.declaration == "Retained.replaceError" && replaced.message == "identical");
    auto caught = a::recover(fail, 0).get(); assert(std::get<a::Err<std::string>>(caught).value == "caught in Lean");
    auto typed = failure<a::StartError<std::string>>([] { a::typed_start([](auto v) { return v; }, true, {}).get(); });
    assert(typed.payload == "factory refused" && typed.declaration == "Retained.typedStart");
    auto pending = a::factory([](auto v) { return v; }, true);
    assert(failure<a::IOError>([&] { pending.get(); }).message == "early factory IO");
    assert(failure<a::IOError>([] { (void)a::local_factory(true); }).message == "eager factory IO");
    assert(a::local_factory(false).get() == 11);
    assert(failure<a::TaskIOError>([] { a::terminal(true).get(); }).message == "late IO");
    failure<std::invalid_argument>([] { a::repeat_call("", [](std::string) { return std::string(1, '\xff'); }).get(); });
    assert(a::plain(5) == 6);
}
static void lifetimes() {
    int hits = 0;
    std::optional<a::RetainedCallback<std::string(std::string)>> cb;
    cb.emplace([&](std::string s) { ++hits; cb->close(); return s; });
    failure<a::CallbackClosed>([&] { a::repeat_call("x", *cb).get(); }); assert(hits == 1);
    std::optional<a::Future<std::string>> self;
    self.emplace(a::repeat_call("x", [&](std::string s) { ++hits; self->cancel(); return s; }));
    failure<a::Cancelled>([&] { self->get(); }); assert(hits == 2);
    auto tag = std::make_shared<int>(1); auto weak = std::weak_ptr<int>(tag);
    auto remembered = a::remember([tag = std::move(tag)](auto n) { return n + *tag; });
    audit::until([&] { if (!weak.expired()) (void)a::run_one(40); return weak.expired(); });
    assert(failure<a::TaskIOError>([] { a::use_expired().get(); }).message.find("expired") != std::string::npos);
    remembered.cancel(); assert(remembered.get() == 17); a::forget(); // Cancellation cannot replace the buffered result.
    const auto main = std::this_thread::get_id(); bool released = false;
    auto payload = std::shared_ptr<int>(new int(0), [&](int *p) { assert(std::this_thread::get_id() == main); released = true; delete p; });
    a::reset(); auto before = audit::events(true);
    auto queued = a::queued([payload = std::move(payload), &hits](auto n) { ++hits; return n; });
    audit::until([] { return a::state() == 3; }); a::release(); audit::wait_queued(before);
    std::thread([job = std::move(queued)]() mutable { job.cancel(); }).join();
    assert(!released); (void)a::plain(0); assert(released && hits == 2); audit::until([] { return a::state() == 4; });
    a::reset(); auto late = a::cancel_late([&](auto v) { ++hits; return v; });
    audit::until([] { return a::state() == 1; }); late.cancel(); a::release();
    audit::until([] { return a::state() == 2; }); assert(hits == 2);
}
static void unclaimed() {
    std::optional<a::Future<std::string>> job; int hits = 0;
    job.emplace(a::repeat_call("x", [&](std::string s) {
        ++hits; failure<a::Busy>([&] { (void)job->get(); }); return s + "!";
    }));
    audit::until([&] { if (!job->ready()) (void)a::run_one(40); return job->ready(); });
    assert(hits == 2 && job->get() == "x!!");
    auto original = std::make_exception_ptr(Marker(std::make_shared<int>(11)));
    auto failed = a::repeat_call("", [original](std::string) -> std::string { std::rethrow_exception(original); });
    audit::until([&] { if (!failed.ready()) (void)a::run_one(40); return failed.ready(); });
    failed.cancel();
    try { (void)failed.get(); assert(false); } catch (const Marker&) { assert(std::current_exception() == original); }
    failure<a::Closed>([&] { (void)failed.get(); });
}
static void isolated(std::string_view mode) {
    if (mode == "peer-trap") {
        // The parked task never finishes unless cancelled. Its awaiting coroutine must wake when its peer poisons the runtime.
        auto parked = b::park(); auto trap = a::repeat_call("", [](std::string) -> std::string { throw 31; });
        failure<b::Unavailable>([&] { (void)parked.get(); });
        assert(failure<a::CallbackTrap>([&] { (void)trap.get(); }).declaration == "Retained.repeatCall");
    } else if (mode == "trap") {
        auto t = a::repeat_call("", [](std::string) -> std::string { throw 17; });
        assert(failure<a::CallbackTrap>([&] { t.get(); }).declaration == "Retained.repeatCall");
    } else if (mode == "retire") {
        a::reset(); auto before = audit::events(true); int hits = 0;
        auto t = a::queued([&](auto v) { ++hits; return v; });
        audit::until([] { return a::state() == 3; }); a::release(); audit::wait_queued(before);
        audit::retire(); failure<a::Unavailable>([&] { t.get(); }); assert(!hits);
    } else if (mode == "cancel-trap") {
        std::optional<a::Future<std::string>> own;
        own.emplace(a::repeat_call("", [&](std::string) -> std::string { own->cancel(); throw 42; }));
        failure<a::Cancelled>([&] { (void)own->get(); }); // Cancellation won, but the trap still retires the runtime for everyone else.
    } else {
        assert(mode == "shutdown");
        auto t = a::repeat_call("", [](std::string v) { a::shutdown(); return v; });
        failure<a::Cancelled>([&] { t.get(); });
    }
    failure<a::Unavailable>([] { (void)a::plain(0); }); failure<b::Unavailable>([] { (void)b::plain(0); });
    audit::until([] { return audit::live() == 0; });
}
int main(int argc, char **argv) {
    ::alarm(150); a::reset(); assert(b::plain(1) == 2);
    if (argc == 2) { isolated(argv[1]); return 0; }
    const auto leases = audit::live(); const auto descriptors = audit::events();
    assert(nested().get() == std::string("α\0!?!", 6)); assert(guide_example() == "hello!!");
    scalars(); errors(); lifetimes(); unclaimed();
    audit::until([&] { return audit::live() == leases && audit::events() == descriptors; });
    std::cout << "C++: retained callbacks, coroutine reentry, exact exceptions, cancellation and cleanup passed\n";
}
