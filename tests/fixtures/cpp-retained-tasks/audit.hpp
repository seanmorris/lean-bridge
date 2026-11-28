// Test-only observation: neither the installed C++ API nor its consumers require runtime symbols.
#pragma once
#include <cassert>
#include <chrono>
#include <cstdint>
#include <cstdlib>
#include <dlfcn.h>
#include <filesystem>
#include <fstream>
#include <poll.h>
#include <set>
#include <thread>
namespace audit {
struct Snapshot { std::uint32_t abi, state, init, components, attached, live; std::uint64_t runtime, domain; };
template<class F> F symbol(const char *name) {
    auto fn = reinterpret_cast<F>(::dlsym(RTLD_DEFAULT, name)); assert(fn); return fn;
}
inline unsigned live() {
    Snapshot s{}; symbol<void(*)(Snapshot*)>("lean_bridge_native_snapshot_read")(&s); assert(s.abi == 1); return s.live;
}
inline void retire() { symbol<void(*)()>("lean_bridge_native_runtime_retire")(); }
template<class F> void until(F ready) {
    const auto deadline = std::chrono::steady_clock::now() + std::chrono::seconds(25);
    while (!ready()) { assert(std::chrono::steady_clock::now() < deadline); std::this_thread::sleep_for(std::chrono::milliseconds(1)); }
}
inline std::set<int> events(bool semaphore = false) {
    std::set<int> result;
    for (auto const &e : std::filesystem::directory_iterator("/proc/self/fd")) {
        std::error_code error; if (std::filesystem::read_symlink(e.path(), error) != "anon_inode:[eventfd]") continue;
        auto name = e.path().filename().string();
        if (semaphore) {
            std::ifstream info("/proc/self/fdinfo/" + name); std::string line; bool found = false;
            while (std::getline(info, line)) if (line.starts_with("eventfd-semaphore:") && line.find('1') != std::string::npos) found = true;
            if (!found) continue;
        }
        result.insert(std::stoi(name));
    }
    return result;
}
inline void wait_queued(const std::set<int> &before) {
    auto after = events(true); for (auto fd : before) after.erase(fd);
    assert(after.size() == 1); ::pollfd descriptor{*after.begin(), POLLIN, 0};
    int n; do { n = ::poll(&descriptor, 1, 25000); } while (n < 0 && errno == EINTR);
    assert(n == 1 && descriptor.revents == POLLIN); // Borrowed descriptor; never consume the request.
}
}
