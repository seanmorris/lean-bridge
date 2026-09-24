// Installed structured C++ acceptance, using only the generated public API.
#include "structured.hpp"
#include <atomic>
#include <cassert>
#include <cstdio>
#include <cstdlib>
#include <dlfcn.h>
#include <new>
#include <sys/wait.h>
namespace api = lean_bridge::structured;
static std::atomic<unsigned> checks = 0;
static thread_local int fail_after = -1;
struct FaultStats { unsigned cases = 0, failures = 0; };
static FaultStats fault_stats[8];
static unsigned shape_index = 0;
void* operator new(std::size_t size) {
  if (fail_after == 0) { fail_after = -1; throw std::bad_alloc(); }
  if (fail_after > 0) --fail_after;
  if (void* value = std::malloc(size ? size : 1)) return value;
  throw std::bad_alloc();
}
void* operator new[](std::size_t size) { return ::operator new(size); }
void operator delete(void* value) noexcept { std::free(value); }
void operator delete[](void* value) noexcept { std::free(value); }
void operator delete(void* value, std::size_t) noexcept { std::free(value); }
void operator delete[](void* value, std::size_t) noexcept { std::free(value); }
static void check(bool value) { ++checks; assert(value); }
template<class T> static void same(const T& left, const T& right) { check(left == right); }
struct Snapshot { uint32_t abi, state, runs, components, attached, identities; uint64_t runtime, domain; };
static unsigned live() {
  auto read = reinterpret_cast<void (*)(Snapshot*)>(dlsym(RTLD_DEFAULT, "lean_bridge_native_snapshot_read"));
  assert(read); Snapshot snapshot{}; read(&snapshot); return snapshot.identities;
}
template<class F> static void rejected(F&& function) {
  bool caught = false;
  try { function(); } catch (const api::Error&) { caught = true; }
  check(caught);
}
template<class F> static void faults(F&& function) {
  const auto baseline = live(); bool succeeded = false; unsigned failures = 0;
  for (int checkpoint = 0; checkpoint < 1024; ++checkpoint) {
    fail_after = checkpoint;
    try { function(); fail_after = -1; succeeded = true; }
    catch (const std::bad_alloc&) { fail_after = -1; ++failures; }
    check(live() == baseline);
    if (succeeded) break;
  }
  check(succeeded);
  ++fault_stats[shape_index].cases; fault_stats[shape_index].failures += failures;
}
using Array = std::vector<std::optional<std::string>>;
using List = std::vector<api::Result<std::pair<uint32_t, std::string>, std::string>>;
using Option = std::optional<std::optional<std::monostate>>;
using Result = api::Result<std::optional<uint32_t>, std::vector<std::string>>;
using Tuple = std::pair<std::string, std::pair<std::vector<uint8_t>, api::Nat>>;
static const std::string text("a\0λ🌿", 8);
static Array array_value(unsigned seed) {
  if (seed % 4 == 0) return {};
  if (seed % 4 == 1) return {std::nullopt};
  if (seed % 4 == 2) return {std::string{}, text};
  return {text, std::nullopt, std::string{}, std::string("\0", 1)};
}
static Option option_value(unsigned seed) {
  if (seed % 3 == 0) return std::nullopt;
  if (seed % 3 == 1) return Option{std::in_place, std::nullopt};
  return Option{std::in_place, std::in_place};
}
static List list_value(unsigned seed) {
  if (seed % 4 == 0) return {};
  if (seed % 4 == 1) return {api::Err<std::string>{text}};
  return {api::Ok<std::pair<uint32_t, std::string>>{{UINT32_MAX, text}},
    api::Err<std::string>{""}, api::Ok<std::pair<uint32_t, std::string>>{{seed, ""}}};
}
static Result result_value(unsigned seed) {
  if (seed % 4 == 0) return api::Ok<std::optional<uint32_t>>{std::nullopt};
  if (seed % 4 == 1) return api::Ok<std::optional<uint32_t>>{UINT32_MAX};
  if (seed % 4 == 2) return api::Err<std::vector<std::string>>{{}};
  return api::Err<std::vector<std::string>>{{"", text, std::string("\0", 1)}};
}
static Tuple tuple_value(unsigned seed) {
  return {seed % 2 ? text : std::string{}, {seed % 2 ? std::vector<uint8_t>{0, 255, 128, 1} : std::vector<uint8_t>{},
    seed % 3 ? (api::Nat(1) << 4097) + seed : api::Nat(0)}};
}
static api::Payload record_value(unsigned seed) {
  api::Payload value{text, array_value(seed), (api::Nat(1) << 257) + seed, std::nullopt};
  if (seed % 3 == 1) value.nested = api::Ok<std::pair<uint64_t, std::monostate>>{{UINT64_MAX, {}}};
  if (seed % 3 == 2) value.nested = api::Err<std::string>{text};
  return value;
}
static api::Packet variant_value(unsigned seed) {
  if (seed % 3 == 0) return api::PacketEmpty{};
  if (seed % 3 == 1) return api::PacketPayload{text, array_value(seed)};
  const api::Nat huge = (api::Nat(1) << 8193) + seed;
  return api::PacketCounts{huge, -huge};
}
template<class T, class Call, class Twice, class Make> static void exercise(
    const T& original, const T& replacement, Call call, Twice twice, Make make) {
  const auto baseline = live();
  unsigned calls = 0;
  auto identity = [&](T input) -> T { same(input, original); ++calls; return input; };
  same(call(original, identity), original); check(calls == 1);
  same(twice(original, identity), original); check(calls == 3);
  same(call(original, [&](T input) -> T { same(input, original); return replacement; }), replacement);
  unsigned step = 0;
  same(twice(original, [&](T input) -> T {
    same(input, step++ ? replacement : original); return replacement;
  }), replacement); check(step == 2);
  {
    T captured = original;
    auto closure = make(captured); captured = replacement;
    same(closure.call(true, replacement), original); same(closure(false, replacement), replacement);
    auto moved = std::move(closure); check(closure.is_closed());
    same(moved.call(true, replacement), original);
    moved.close(); moved.close(); check(moved.is_closed());
    rejected([&] { (void)moved.call(true, replacement); });
  }
  int token = 37; unsigned attempts = 0;
  try { twice(original, [&](T) -> T { ++attempts; throw &token; }); check(false); }
  catch (int* caught) { check(caught == &token && attempts == 1); }
  same(call(original, [&](T input) -> T {
    try { call(input, [](T) -> T { throw 73; }); check(false); }
    catch (int caught) { check(caught == 73); }
    return call(input, [](T nested) { return nested; });
  }), original);
  faults([&] { same(call(original, [](T input) { return input; }), original); });
  faults([&] { same(twice(original, [](T input) { return input; }), original); });
  faults([&] { auto closure = make(original); same(closure.call(true, replacement), original); });
  {
    auto closure = make(original);
    faults([&] { same(closure.call(false, replacement), replacement); });
  }
  check(live() == baseline);
}
#define EXERCISE(NAME, VALUE) exercise(VALUE(seed), VALUE(seed + 1), \
  [](const auto& input, auto&& callback) { return api::call_##NAME(input, callback); }, \
  [](const auto& input, auto&& callback) { return api::twice_##NAME(input, callback); }, \
  [](const auto& input) { return api::make_##NAME(input); })
static api::Payload recurse(api::Payload value) { return api::call_record(value, recurse); }
int main(int argc, char**) {
  (void)api::call_option(std::nullopt, [](Option value) { return value; });
  if (argc > 1) return 0;
  const auto baseline = live();
  for (unsigned seed = 0; seed < 12; ++seed) {
    shape_index = 0; EXERCISE(array, array_value);
    shape_index = 1; EXERCISE(list, list_value);
    shape_index = 2; EXERCISE(option, option_value);
    shape_index = 3; EXERCISE(result, result_value);
    shape_index = 4; EXERCISE(tuple, tuple_value);
    shape_index = 5; EXERCISE(record, record_value);
    shape_index = 6; EXERCISE(variant, variant_value);
    shape_index = 7; EXERCISE(alias, record_value);
  }
  const auto value = record_value(7);
  rejected([&] { api::call_record(value, recurse); });
  for (unsigned round = 0; round < 8; ++round) {
    auto expired = api::retain_record([](api::Payload input) { return input; });
    rejected([&] { expired.call(value); }); rejected([&] { expired.call(value); });
    same(api::call_record(value, [](api::Payload input) { return input; }), value);
  }
  try { api::after_failure(value, [](api::Payload) -> api::Payload { throw 113; }); check(false); }
  catch (int caught) { check(caught == 113); }
  auto negative = value; negative.count = -1;
  rejected([&] { api::call_record(negative, [](api::Payload input) { return input; }); });
  rejected([&] { api::call_record(value, [&](api::Payload) { return negative; }); });
  rejected([&] { api::make_record(negative); });
  {
    auto closure = api::make_record(value);
    rejected([&] { closure.call(false, negative); });
    std::thread worker([&] {
      rejected([&] { closure.call(true, value); }); rejected([&] { closure.close(); });
    }); worker.join();
    same(closure.call(true, value), value);
    const pid_t child = fork(); check(child >= 0);
    if (child == 0) {
      rejected([&] { closure.call(true, value); }); rejected([&] { closure.close(); });
      auto moved = std::move(closure); { auto dropped = std::move(moved); } _exit(0);
    }
    int status = 0; check(waitpid(child, &status, 0) == child && status == 0);
  }
  auto invalid = value; invalid.rows = {std::string("\xff", 1)};
  rejected([&] { api::call_record(invalid, [](api::Payload input) { return input; }); });
  rejected([&] { api::call_record(value, [&](api::Payload) { return invalid; }); });
  rejected([&] { api::make_record(invalid); });
  rejected([&] { api::call_record(value, [](api::Payload input) {
    input.rows = {std::string(16 * 1024 * 1024 + 1, 'x')}; return input;
  }); });
  auto big = value; big.text = std::string(3500000, 'x');
  rejected([&] { api::twice_record(big, [](api::Payload input) { return input; }); });
  same(api::call_record(value, [](api::Payload input) { return input; }), value);
  check(live() == baseline);
  unsigned failures = 0;
  for (const auto& stats : fault_stats) {
    check(stats.cases == 48 && stats.failures > 0); failures += stats.failures;
  }
  std::printf("{\"checks\":%u,\"allocationFailures\":%u,\"faults\":[", checks.load(), failures);
  const char* names[] = {"array", "list", "option", "result", "tuple", "record", "variant", "alias"};
  for (unsigned i = 0; i < 8; ++i)
    std::printf("%s{\"shape\":\"%s\",\"cases\":%u,\"failures\":%u}", i ? "," : "", names[i], fault_stats[i].cases, fault_stats[i].failures);
  std::puts("]}");
}
