#include "variants.hpp"
#include <cassert>
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <fstream>
#include <limits>
#include <new>
#include <set>

namespace v = lean_bridge::variants;
static size_t checks, calls, rejected, allocation_failures, live;
static long remaining = -1;
#define CHECK(x) do { ++checks; assert((x)); } while (0)
void* operator new(size_t size) {
  if (remaining == 0) throw std::bad_alloc();
  if (remaining > 0) --remaining;
  void* result = std::malloc(size ? size : 1);
  if (!result) throw std::bad_alloc();
  ++live; return result;
}
void* operator new[](size_t size) { return ::operator new(size); }
void operator delete(void* value) noexcept { if (value) { --live; std::free(value); } }
void operator delete[](void* value) noexcept { ::operator delete(value); }
void operator delete(void* value, size_t) noexcept { ::operator delete(value); }
void operator delete[](void* value, size_t) noexcept { ::operator delete(value); }
template<class F> static auto call(F fn) { ++calls; return fn(); }
template<class F> static void invalid(F fn) {
  try { ++calls; fn(); CHECK(false); }
  catch (const v::Error& error) { CHECK(error.status == VARIANTS_STATUS_INVALID_ARGUMENT); ++rejected; }
}
static v::ScalarsAll scalars() {
  v::ScalarsAll value{};
  value.bool_ = true; value.u8 = UINT8_MAX; value.u16 = UINT16_MAX; value.u32 = UINT32_MAX; value.u64 = UINT64_MAX;
  value.i8 = INT8_MIN; value.i16 = INT16_MIN; value.i32 = INT32_MIN; value.i64 = INT64_MIN;
  value.natural = (v::Nat(1) << 5120) + 19; value.integer = -((v::Int(1) << 5120) + 31);
  value.f32 = 1.5f; value.f64 = -2.25; value.text = std::string("A\0🌱", 6);
  value.bytes = {0,255,1}; value.char_ = U'🌱'; value.word = UINT32_MAX; value.signed_word = INT32_MIN;
  return value;
}
static void primitives() {
  const auto expected = scalars();
  CHECK(call([&] { return v::inspect(expected); }));
  for (unsigned i = 0; i < 128; ++i) {
    auto result = std::get<v::ScalarsAll>(call([&] { return v::echo_scalars(expected); }));
    CHECK(result.unit == std::monostate{}); CHECK(result.bool_ == expected.bool_);
    CHECK(result.u8 == expected.u8); CHECK(result.u16 == expected.u16); CHECK(result.u32 == expected.u32); CHECK(result.u64 == expected.u64);
    CHECK(result.i8 == expected.i8); CHECK(result.i16 == expected.i16); CHECK(result.i32 == expected.i32); CHECK(result.i64 == expected.i64);
    CHECK(result.natural == expected.natural); CHECK(result.integer == expected.integer);
    CHECK(result.f32 == expected.f32); CHECK(result.f64 == expected.f64); CHECK(result.text == expected.text);
    CHECK(result.bytes == expected.bytes); CHECK(result.char_ == expected.char_); CHECK(result.word == expected.word); CHECK(result.signed_word == expected.signed_word);
    result.text[0] = 'Z'; result.bytes[0] = 19; CHECK(expected.text[0] == 'A'); CHECK(expected.bytes[0] == 0);
  }
  for (unsigned field = 0; field < 18; ++field) {
    auto wrong = expected;
    switch (field) {
      case 0: wrong.bool_ = false; break; case 1: wrong.u8 = 0; break; case 2: wrong.u16 = 0; break;
      case 3: wrong.u32 = 0; break; case 4: wrong.u64 = 0; break; case 5: wrong.i8 = 0; break;
      case 6: wrong.i16 = 0; break; case 7: wrong.i32 = 0; break; case 8: wrong.i64 = 0; break;
      case 9: wrong.natural = 0; break; case 10: wrong.integer = 0; break; case 11: wrong.f32 = 0; break;
      case 12: wrong.f64 = 0; break; case 13: wrong.text = "wrong"; break; case 14: wrong.bytes = {}; break;
      case 15: wrong.char_ = U'A'; break; case 16: wrong.word = 0; break; case 17: wrong.signed_word = 0; break;
    }
    CHECK(!call([&] { return v::inspect(wrong); }));
  }
  CHECK(!call([] { return v::inspect(v::ScalarsAbsent{}); }));
  auto extreme = expected;
  extreme.word = UINT64_MAX; extreme.signed_word = INT64_MIN;
  extreme.f32 = -0.0f; extreme.f64 = -0.0;
  auto output = std::get<v::ScalarsAll>(call([&] { return v::echo_scalars(extreme); }));
  CHECK(output.word == UINT64_MAX && output.signed_word == INT64_MIN);
  CHECK(std::signbit(output.f32) && std::signbit(output.f64));
  extreme.f32 = std::numeric_limits<float>::infinity(); extreme.f64 = -std::numeric_limits<double>::infinity();
  output = std::get<v::ScalarsAll>(call([&] { return v::echo_scalars(extreme); }));
  CHECK(std::isinf(output.f32) && !std::signbit(output.f32)); CHECK(std::isinf(output.f64) && std::signbit(output.f64));
  extreme.f32 = std::numeric_limits<float>::quiet_NaN(); extreme.f64 = std::numeric_limits<double>::quiet_NaN();
  output = std::get<v::ScalarsAll>(call([&] { return v::echo_scalars(extreme); }));
  CHECK(std::isnan(output.f32) && std::isnan(output.f64));
  for (char32_t c : {char32_t(0), char32_t(0xd7ff), char32_t(0xe000), char32_t(0x10ffff)}) {
    extreme.char_ = c;
    CHECK(std::get<v::ScalarsAll>(call([&] { return v::echo_scalars(extreme); })).char_ == c);
  }
  for (char32_t c : {char32_t(0xd800), char32_t(0xdfff), char32_t(0x110000)}) {
    extreme.char_ = c; invalid([&] { v::echo_scalars(extreme); });
  }
  extreme = expected; extreme.natural = -1; invalid([&] { v::echo_scalars(extreme); });
  for (const auto& text : {std::string("\xff",1), std::string("\xc0\x80",2), std::string("\xed\xa0\x80",3)}) {
    extreme = expected; extreme.text = text; invalid([&] { v::echo_scalars(extreme); });
  }
  CHECK(call([&] { return v::inspect(expected); }));
}
static v::Nested sample() {
  return v::NestedPacket{v::Packet{v::SignalData{19,std::string("A\0🌱",6)}, {v::SignalIdle{},v::SignalMarker{},v::SignalData{UINT32_MAX,"last"}}, v::SignalStopped{}, {v::ModeFirst{},v::ModeThird{}}}};
}
static void shapes() {
  const std::vector<v::Signal> signals{v::SignalIdle{},v::SignalStopped{},v::SignalData{UINT32_MAX,std::string("A\0🌱",6)},v::SignalMarker{}};
  const std::vector<v::Mode> modes{v::ModeFirst{},v::ModeSecond{},v::ModeThird{}};
  const auto nested = sample();
  for (unsigned round = 0; round < 128; ++round) {
    for (const auto& value : signals) CHECK(call([&] { return v::echo(value); }) == value);
    for (const auto& value : modes) CHECK(call([&] { return v::echo_mode(value); }) == value);
    CHECK(call([&] { return v::echo_nested(nested); }) == nested);
    CHECK(std::holds_alternative<v::NestedEmpty>(call([] { return v::echo_nested(v::NestedEmpty{}); })));
    v::Nested outcome = v::NestedOutcome{v::Ok<std::pair<v::Signal,v::Mode>>{{signals[round%4],modes[round%3]}}};
    CHECK(call([&] { return v::echo_nested(outcome); }) == outcome);
    outcome = v::NestedOutcome{v::Err<std::string>{std::string("error\0🌱",10)}};
    CHECK(call([&] { return v::echo_nested(outcome); }) == outcome);
    v::Nested empty = v::NestedPacket{v::Packet{v::SignalIdle{}, {}, std::nullopt, {}}};
    CHECK(call([&] { return v::echo_nested(empty); }) == empty);
    const std::vector<std::vector<v::Signal>> rows{signals,{},signals};
    auto reversed = call([&] { return v::signals(rows); });
    CHECK(reversed.size() == 3 && reversed[1].empty());
    for (size_t i = 0; i < 4; ++i) { CHECK(reversed[0][i] == signals[3-i]); CHECK(reversed[2][i] == signals[3-i]); }
    CHECK(rows[0] == signals);
    CHECK(std::get<v::OneOnly>(call([] { return v::echo_one(v::OneOnly{UINT32_MAX}); })).value == 0);
    for (const v::Anonymous& value : {v::Anonymous{v::AnonymousNumber{37}},v::Anonymous{v::AnonymousPair{19,"pair"}},v::Anonymous{v::AnonymousCollision{42,"collision"}}})
      CHECK(call([&] { return v::echo_anonymous(value); }) == value);
  }
  CHECK(std::holds_alternative<v::SignalStopped>(call([] { return v::next(v::SignalIdle{}); })));
  CHECK(std::holds_alternative<v::SignalMarker>(call([] { return v::next(v::SignalStopped{}); })));
  CHECK(call([] { return v::next(v::SignalMarker{}); }) == v::Signal(v::SignalData{42,"ready"}));
  CHECK(call([] { return v::next(v::SignalData{UINT32_MAX,"x"}); }) == v::Signal(v::SignalData{0,"x!"}));
  CHECK(call([] { return v::code(v::SignalIdle{}); }) == 7); CHECK(call([] { return v::code(v::SignalStopped{}); }) == 13);
  CHECK(call([] { return v::code(v::SignalMarker{}); }) == 29); CHECK(call([] { return v::code(v::SignalData{19,std::string("A\0🌱",6)}); }) == 25);
  CHECK(std::holds_alternative<v::SignalIdle>(call([] { return v::make(0); })));
  CHECK(call([] { return v::make(7); }) == v::Signal(v::SignalData{7,"made"}));
  auto sibling = call([&] { return v::echo_nested(nested); });
  std::get<v::SignalData>(std::get<v::NestedPacket>(sibling).value.current).label[0] = 'Z';
  CHECK(std::get<v::SignalData>(std::get<v::NestedPacket>(nested).value.current).label[0] == 'A');
  CHECK(call([&] { return v::echo_nested(nested); }) == nested);
}
static void ownership() {
  v::Buffers saved;
  { std::vector<uint8_t> input{0,255,42}; saved = call([&] { return v::duplicate(input); }); input[0] = 13; }
  auto& pair = std::get<v::BuffersPair>(saved); CHECK(pair.first == std::vector<uint8_t>({0,255,42})); CHECK(pair.second == pair.first);
  pair.first[0] = 7; CHECK(pair.second[0] == 0);
  auto empty = std::get<v::BuffersPair>(call([] { return v::duplicate({}); })); CHECK(empty.first.empty() && empty.second.empty());
  const auto input = sample();
  CHECK(call([&] { return v::echo_nested(input); }) == input);
  const size_t baseline = live;
  bool succeeded = false;
  for (long limit = 0; limit < 1024; ++limit) {
    remaining = limit;
    try { auto result = call([&] { return v::echo_nested(input); }); remaining = -1; CHECK(result == input); succeeded = true; }
    catch (const std::bad_alloc&) { remaining = -1; ++allocation_failures; }
    CHECK(live == baseline);
    if (succeeded) break;
  }
  CHECK(succeeded && allocation_failures > 10);
  invalid([] { v::produce(v::Nat(17u * 1024u * 1024u)); });
  const auto after = std::get<v::BuffersPair>(call([] { return v::produce(30000); }));
  CHECK(after.first.size() == 30000 && after.second == std::vector<uint8_t>{1});
  for (auto byte : after.first) CHECK(byte == 17);
  const std::vector<uint8_t> too_large(17u * 1024u * 1024u, 0);
  invalid([&] { v::duplicate(too_large); });
  CHECK(call([&] { return v::echo_nested(input); }) == input);
}
int main() {
  primitives(); shapes(); ownership();
  std::ifstream maps("/proc/self/maps"); std::string line; std::set<std::string> libraries;
  while (std::getline(maps,line)) {
    const auto start = line.find('/'); if (start == std::string::npos) continue;
    const auto path = line.substr(start);
    if (path.find("libvariants.so") != std::string::npos || path.find("libcomponent_") != std::string::npos || path.find("liblean_") != std::string::npos || path.find("libleanshared.so") != std::string::npos) libraries.insert(path);
  }
  CHECK(libraries.size() == 4);
  std::printf("variant-ok:%zu:%zu:%zu:%zu\n",checks,calls,rejected,allocation_failures);
  for (const auto& path : libraries) std::printf("library:%s\n",path.c_str());
}
