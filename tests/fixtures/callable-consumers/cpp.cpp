// Installed C++ acceptance uses the public generated API, not handwritten ABI glue.
#include "callables.hpp"
#include <atomic>
#include <bit>
#include <cassert>
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <dlfcn.h>
#include <limits>
#include <new>
#include <sys/wait.h>
namespace api = lean_bridge::callables;
static std::atomic<unsigned> checks = 0;
static thread_local int fail_after = -1;
void* operator new(std::size_t size) {
  if (fail_after == 0) { fail_after = -1; throw std::bad_alloc(); }
  if (fail_after > 0) --fail_after;
  if (void* p = std::malloc(size ? size : 1)) return p;
  throw std::bad_alloc();
}
void* operator new[](std::size_t size) { return ::operator new(size); }
void operator delete(void* p) noexcept { std::free(p); }
void operator delete[](void* p) noexcept { std::free(p); }
void operator delete(void* p, std::size_t) noexcept { std::free(p); }
void operator delete[](void* p, std::size_t) noexcept { std::free(p); }
static void check(bool value) { ++checks; assert(value); }
template<class T> static void same(const T& a, const T& b) { check(a == b); }
static void same(float a, float b) { check((std::isnan(a) && std::isnan(b)) || std::bit_cast<uint32_t>(a) == std::bit_cast<uint32_t>(b)); }
static void same(double a, double b) { check((std::isnan(a) && std::isnan(b)) || std::bit_cast<uint64_t>(a) == std::bit_cast<uint64_t>(b)); }
struct Snapshot { uint32_t abi, state, runs, components, attached, identities; uint64_t runtime, domain; };
static unsigned live() {
  auto read = reinterpret_cast<void (*)(Snapshot*)>(dlsym(RTLD_DEFAULT, "lean_bridge_native_snapshot_read"));
  assert(read); Snapshot snapshot{}; read(&snapshot); return snapshot.identities;
}
template<class F> static void rejected(F&& function) {
  bool caught = false; try { function(); } catch (const api::Error&) { caught = true; }
  check(caught);
}
template<class F> static void faults(F&& function) {
  const auto baseline = live(); bool succeeded = false; unsigned failures = 0;
  for (int checkpoint = 0; checkpoint < 256; ++checkpoint) {
    fail_after = checkpoint;
    try { function(); fail_after = -1; succeeded = true; }
    catch (const std::bad_alloc&) { fail_after = -1; ++failures; }
    check(live() == baseline);
    if (succeeded) break;
  }
  check(succeeded && failures > 0);
}
static uint32_t recurse(uint32_t value) { return api::call_uint32(value, recurse); }
#define EXERCISE(NAME, TYPE, ...) do { \
  const std::vector<TYPE> values{__VA_ARGS__}; \
  for (unsigned repeat = 0; repeat < 12; ++repeat) for (const TYPE& value : values) { \
    unsigned calls = 0; \
    auto identity = [&](TYPE input) -> TYPE { same(input, value); ++calls; return input; }; \
    same(api::call_##NAME(value, identity), value); check(calls == 1); \
    same(api::twice_##NAME(value, identity), value); check(calls == 3); \
    auto choose = api::make_##NAME(value); check(!choose.is_closed()); \
    same(choose.call(true, values.front()), value); same(choose(false, values.back()), values.back()); \
    auto moved = std::move(choose); check(choose.is_closed()); same(moved.call(true, values.front()), value); \
    moved.close(); moved.close(); check(moved.is_closed()); rejected([&] { (void)moved.call(true, value); }); \
  } \
} while (false)
int main() {
  check(api::word_bits() == 64);
  const auto baseline = live();
  static_assert(std::is_same_v<api::Nat, boost::multiprecision::cpp_int>);
  static_assert(std::is_same_v<api::Int, boost::multiprecision::cpp_int>);
  const api::Nat huge = (api::Nat(1) << 16384) + (api::Nat(1) << 4095) + 17;
  EXERCISE(bool, bool, false, true);
  EXERCISE(uint8, uint8_t, 0, UINT8_MAX);
  EXERCISE(uint16, uint16_t, 0, UINT16_MAX);
  EXERCISE(uint32, uint32_t, 0, UINT32_MAX);
  EXERCISE(uint64, uint64_t, 0, (uint64_t(1) << 53) + 1, UINT64_MAX);
  EXERCISE(usize, uint64_t, 0, UINT64_MAX);
  EXERCISE(int8, int8_t, INT8_MIN, -1, 0, INT8_MAX);
  EXERCISE(int16, int16_t, INT16_MIN, -1, 0, INT16_MAX);
  EXERCISE(int32, int32_t, INT32_MIN, -1, 0, INT32_MAX);
  EXERCISE(int64, int64_t, INT64_MIN, -1, 0, (int64_t(1) << 53) + 1, INT64_MAX);
  EXERCISE(isize, int64_t, INT64_MIN, -1, 0, INT64_MAX);
  EXERCISE(nat, api::Nat, 0, UINT64_MAX, huge);
  EXERCISE(int, api::Int, 0, INT64_MIN, huge, -huge);
  EXERCISE(char, char32_t, 0, 0xd7ff, 0xe000, 0x10ffff, U'🌿');
  EXERCISE(float32, float, 0.0f, -0.0f, 1.0f/3, std::numeric_limits<float>::denorm_min(), INFINITY, -INFINITY, NAN);
  EXERCISE(float, double, 0.0, -0.0, 1.0/3, std::numeric_limits<double>::denorm_min(), INFINITY, -INFINITY, NAN);
  EXERCISE(string, std::string, "", std::string("a\0λ🌿", 8), std::string("\0", 1), "\U0010ffff", "e\u0301");
  EXERCISE(bytes, std::vector<uint8_t>, {}, {0, 255, 128}, {1, 2, 3});
  for (unsigned i = 0; i < 12; ++i) {
    unsigned calls = 0;
    api::call_unit({}, [&](std::monostate) { ++calls; });
    api::twice_unit({}, [&](std::monostate) { ++calls; }); check(calls == 3);
    auto choose = api::make_unit({}); choose.call(true, {}); choose(false, {});
    choose.close(); rejected([&] { choose.call(false, {}); });
  }
  check(live() == baseline);
  same(api::call_nat(huge, [](api::Nat n) -> api::Nat { return n + 1; }), api::Nat(huge + 1));
  same(api::call_int(-huge, [](api::Int n) -> api::Int { return n - 1; }), api::Int(-huge - 1));
  rejected([] { api::call_nat(-1, [](api::Nat n) { return n; }); });
  rejected([] { api::call_nat(0, [](api::Nat) -> api::Nat { return -1; }); });
  rejected([] { api::make_nat(-1); });
  rejected([] { auto f = api::make_nat(0); f.call(false, -1); });
  for (char32_t invalid : {char32_t(0xd800), char32_t(0xdfff), char32_t(0x110000), char32_t(UINT32_MAX)}) {
    rejected([&] { api::call_char(invalid, [](char32_t c) { return c; }); });
    rejected([&] { api::call_char(U'x', [&](char32_t) { return invalid; }); });
    rejected([&] { auto f = api::make_char(U'x'); f.call(false, invalid); });
  }
  rejected([] { api::call_string("\xed\xa0\x80", [](std::string text) { return text; }); });
  rejected([] { api::call_string("", [](std::string) { return std::string("\xff"); }); });
  auto movable = [owned = std::make_unique<uint32_t>(42)](uint32_t) { return *owned; };
  check(api::call_uint32(0, std::move(movable)) == 42);
  same(api::combine(std::string("hello\0", 6), UINT64_MAX,
    [](std::string text, uint64_t number) { return text + std::to_string(number); },
    [](std::string text) { return text + "🌿"; }), std::string("hello\0", 6) + "18446744073709551615🌿");
  unsigned calls = 0; int token = 7;
  try { api::twice_uint32(0, [&](uint32_t) -> uint32_t { ++calls; throw &token; }); check(false); }
  catch (int* caught) { check(caught == &token && calls == 1); }
  bool second = false;
  try { api::combine("", 1, [](std::string, uint64_t) -> std::string { throw 73; }, [&](std::string text) { second = true; return text; }); check(false); }
  catch (int caught) { check(caught == 73 && !second); }
  check(api::twice_uint32(40, [](uint32_t value) {
    try { api::call_uint32(0, [](uint32_t) -> uint32_t { throw 73; }); } catch (int v) { check(v == 73); }
    return api::call_uint32(value, [](uint32_t n) { return n + 1; });
  }) == 42);
  rejected([] { api::call_uint32(0, recurse); });
  for (unsigned i = 0; i < 8; ++i) {
    auto escaped = api::retain_callback([](uint32_t n) { return n + 1; });
    rejected([&] { escaped.call(41); }); rejected([&] { escaped.call(41); });
    check(api::call_uint32(41, [](uint32_t n) { return n + 1; }) == 42);
  }
  rejected([] { api::call_bytes({}, [](std::vector<uint8_t>) { return std::vector<uint8_t>(16*1024*1024+1); }); });
  rejected([] { api::twice_string(std::string(3500000, 'x'), [](std::string text) { return text; }); });
  {
    auto choose = api::make_string("thread-bound");
    std::thread worker([&] { rejected([&] { choose.call(true, ""); }); rejected([&] { choose.close(); }); }); worker.join();
    same(choose.call(true, ""), std::string("thread-bound"));
    pid_t child = fork(); check(child >= 0);
    if (child == 0) { rejected([&] { choose.call(true, ""); }); rejected([&] { choose.close(); });
      auto moved = std::move(choose); { auto dropped = std::move(moved); } _exit(0); }
    int status = 0; check(waitpid(child, &status, 0) == child && status == 0);
  }
  for (unsigned i = 0; i < 4; ++i) {
    std::thread worker([] { auto f = api::make_uint32(42); check(f.call(true, 0) == 42); }); worker.join();
  }
  {
    std::unique_ptr<api::LeanClosure<uint32_t(bool, uint32_t)>> transferred;
    std::thread creator([&] { transferred = std::make_unique<api::LeanClosure<uint32_t(bool, uint32_t)>>(api::make_uint32(1)); }); creator.join();
    std::thread successor([&] { rejected([&] { transferred->call(true, 0); }); rejected([&] { transferred->close(); }); }); successor.join();
    transferred.reset(); check(live() == baseline);
  }
  const std::string text(1024, 'x'); const std::vector<uint8_t> bytes(1024, 255);
  faults([&] { same(api::twice_string(text, [](std::string s) { return s; }), text); });
  faults([&] { same(api::twice_bytes(bytes, [](std::vector<uint8_t> v) { return v; }), bytes); });
  faults([&] { same(api::twice_nat(huge, [](api::Nat n) { return n; }), huge); });
  faults([&] { auto f = api::make_string(text); same(f.call(true, ""), text); });
  faults([&] { auto f = api::make_nat(huge); same(f.call(true, 0), huge); });
  {
    std::vector<api::LeanClosure<uint32_t(bool, uint32_t)>> leases;
    for (unsigned i = 0; i < 4096; ++i) leases.push_back(api::make_uint32(i));
    check(live() == baseline + 4096); rejected([] { api::make_uint32(0); });
    for (unsigned i = 0; i < leases.size(); ++i) check(leases[i].call(true, 0) == i);
    for (auto& f : leases) { f.close(); } check(live() == baseline);
  }
  for (unsigned i = 0; i < 8192; ++i) { auto f = api::make_uint32(i); check(f.call(true, 0) == i); }
  check(live() == baseline);
  std::printf("callable-cpp-ok:%u\n", checks.load());
}
