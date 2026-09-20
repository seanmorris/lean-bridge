#include "lists.hpp"
#include <cassert>
#include <cmath>
#include <cstdio>
#include <limits>
namespace api = lean_bridge::lists;
static unsigned checks;
#define CHECK(x) do { ++checks; assert(x); } while (0)
template<class T> bool same(const T& a, const T& b) {
  if constexpr (std::is_floating_point_v<T>) return (std::isnan(a) && std::isnan(b)) || (a == b && (a != 0 || std::signbit(a) == std::signbit(b)));
  else return a == b;
}
template<class F> void invalid(F call) {
  try { call(); CHECK(false); } catch(const api::Error& error) { CHECK(error.status == LISTS_STATUS_INVALID_ARGUMENT); }
}
int main() {
  /* scalar cases */
  CHECK(api::join({std::string("a\0", 2), "", "z"}) == std::string("a\0🌱🌱z", 11));
  CHECK(api::mix({{1, 2, 3}, {}}) == std::vector<std::vector<uint32_t>>({{}, {3, 2, 1}}));
  using Branch = std::pair<api::Nat, std::monostate>;
  api::Packet packet{};
  packet.sequences = {{1, 2, 3}, {}}; packet.branches = {std::nullopt, api::Ok<Branch>{{api::Nat(1) << 100, {}}}, api::Err<std::string>{std::string("x\0", 2)}};
  packet.buffers = {{0, 255}, {}}; packet.arrays = {{{true, U'🌱'}, {false, char32_t(0x10ffff)}}, {}};
  for (unsigned round = 0; round < 20; ++round) {
    auto copied = api::transform(packet);
    CHECK(copied.sequences == std::vector<std::vector<uint32_t>>({{}, {3, 2, 1}}));
    CHECK(copied.branches.size() == 3 && !copied.branches[2]);
    CHECK(std::get<api::Err<std::string>>(*copied.branches[0]).value == std::string("x\0!", 3));
    CHECK(std::get<api::Ok<Branch>>(*copied.branches[1]).value.first == (api::Nat(1) << 100) + 1);
    CHECK(copied.buffers == std::vector<std::vector<uint8_t>>({{}, {0, 255}}));
    CHECK(copied.arrays.size() == 2 && copied.arrays[0].empty() && copied.arrays[1][0].second == 0x10ffff);
    copied.buffers[1][0] = 9; CHECK(packet.buffers[0][0] == 0);
  }
  using Units = std::vector<std::monostate>; using Nested = std::vector<api::Result<Units, std::string>>;
  CHECK(!api::nest(std::nullopt)); CHECK(api::nest(Nested{})->empty());
  auto nested = api::nest(Nested{api::Ok<Units>{Units(2)}, api::Err<std::string>{"bad"}}); CHECK(nested->size() == 2);
  CHECK(std::get<api::Err<std::string>>((*nested)[0]).value == "bad!"); CHECK(std::get<api::Ok<Units>>((*nested)[1]).value.size() == 2);
  using Pair = std::pair<std::vector<api::Nat>, std::vector<uint32_t>>;
  auto ok = api::swap(api::Err<std::vector<std::string>>{{"a", "b"}}); CHECK(std::get<api::Ok<std::vector<std::string>>>(ok).value == std::vector<std::string>({"b", "a"}));
  auto err = api::swap(api::Ok<Pair>{{{api::Nat(1) << 96, 42}, {1, 2}}}); CHECK(std::get<api::Err<Pair>>(err).value.first == std::vector<api::Nat>({42, api::Nat(1) << 96}));
  CHECK(std::get<api::Err<Pair>>(err).value.second == std::vector<uint32_t>({2, 1}));
  auto duplicated = api::duplicate({0, 255}); CHECK(duplicated.size() == 2); duplicated[0][0] = 9; CHECK(duplicated[1][0] == 0);
  for (unsigned round = 0; round < 3; ++round) {
    invalid([] { api::duplicate(std::vector<uint8_t>(6u * 1024u * 1024u)); });
    invalid([] { api::reverse_char({char32_t(0xd800)}); });
    invalid([] { api::reverse_nat({api::Nat(-1)}); });
    invalid([] { api::reverse_string({std::string("\xc0\xaf", 2)}); });
    CHECK(api::reverse_uint32({1, 2}) == std::vector<uint32_t>({2, 1}));
  }
  auto generated = api::generate(30000); CHECK(generated.size() == 30000); for (auto value : generated) CHECK(value == 7);
  invalid([] { api::generate(2097153); }); CHECK(api::generate(1) == std::vector<uint32_t>({7}));
  for (double value : {std::numeric_limits<double>::quiet_NaN(), double(INFINITY), -double(INFINITY), -0.0, 0.0}) {
    auto floats = api::reverse_float64({value, 7}); CHECK(floats.size() == 2 && floats[0] == 7 && same(floats[1], value));
    auto singles = api::reverse_float32({float(value), 7}); CHECK(singles.size() == 2 && singles[0] == 7 && same(singles[1], float(value)));
  }
  /* deep cases */
  printf("list-ok:%u\n", checks);
}
