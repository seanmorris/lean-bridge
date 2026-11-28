#include <lbc_journal_cpp.hpp>
#include <cassert>
#include <concepts>
#include <dirent.h>
#include <dlfcn.h>
#include <sys/wait.h>
#include <thread>
#include <unistd.h>

namespace api = lean_bridge::lbc_journal_cpp;
using Payload = api::Result<std::string, std::uint32_t>;
static_assert(std::same_as<decltype(api::choose(false, true, "x")), Payload>);
static_assert(std::same_as<decltype(api::bump(3)), std::uint32_t>);

// Test-only observers. The public synchronous interface needs neither.
struct Snapshot { std::uint32_t abi, state, init, components, attached, live; std::uint64_t runtime, domain; };
static Snapshot snapshot() {
    auto get = reinterpret_cast<void(*)(Snapshot*)>(dlsym(RTLD_DEFAULT, "lean_bridge_native_snapshot_read"));
    Snapshot s{}; assert(get); get(&s); assert(s.abi == 1); return s;
}
static int descriptors() {
    auto *d = opendir("/proc/self/fd"); assert(d); int count = 0;
    while (readdir(d)) ++count;
    closedir(d); return count;
}
int main() {
    const auto cold = snapshot(); const int fds = descriptors();
    try { api::store("state", "\xff"); assert(false); } catch (const std::invalid_argument&) {}
    bool refused = false;
    std::thread worker([&] {
        try { (void)api::bump(9); } catch (const api::WrongContext&) { refused = true; }
    });
    worker.join();
    assert(refused && snapshot().components == cold.components && descriptors() == fds);
    assert(api::count() == 0 && api::bump(3) == 3 && api::bump(2) == 5 && api::echo(37) == 37);
    const auto warm = snapshot(); const int open = descriptors();
    assert(warm.components == cold.components + 1 && warm.live == cold.live && api::read("state") == "open");
    try { (void)api::read("missing"); assert(false); } catch (const api::IOError &e) {
        assert(e.declaration == "Journal.read" && e.message.find("missing") != std::string::npos);
    }
    const std::string text{"a\0b", 3};
    for (int i = 0; i < 4; ++i) for (bool tag : {false, true}) {
        const Payload expected = tag ? Payload{api::Ok<std::string>{text}} : Payload{api::Err<std::uint32_t>{37}};
        assert(api::choose(false, tag, text) == expected);
        try { (void)api::choose(true, tag, text); assert(false); }
        catch (const api::DeclaredError<Payload> &e) { assert(e.declaration == "Journal.choose" && e.payload == expected); }
    }
    api::store("state", "closed"); assert(api::read("state") == "closed" && snapshot().live == warm.live && descriptors() == open);
    const auto child = fork(); assert(child >= 0);
    if (!child) { try { (void)api::count(); } catch (const api::WrongContext&) { _exit(0); } _exit(1); }
    int status{}; assert(waitpid(child, &status, 0) == child && WIFEXITED(status) && WEXITSTATUS(status) == 0 && api::count() == 5);
}
