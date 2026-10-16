#define NESTED_CHECKED_RECORD_RESULT_ONLY
#include <nestedcheckedrecords.hpp>
#include <cstdio>
#include <optional>
#include <string>
#include <utility>
#include <variant>
#include <vector>

namespace api = lean_bridge::nestedcheckedrecords;
using Nat = api::Nat;
using Packet = api::Packet;

#ifndef NESTED_PARAMETER_PREFIX
#define NESTED_PARAMETER_PREFIX "arg"
#endif

static unsigned checks;
static unsigned rejections;
static unsigned recoveries;
static unsigned snapshots;
static constexpr unsigned rounds = 256;

#define CHECK(test) do { \
  if (!(test)) { std::fprintf(stderr, "line %d: %s\n", __LINE__, #test); return 1; } \
  ++checks; \
} while (0)
#define KEPT(test) do { ++snapshots; CHECK(test); } while (0)

#ifndef NESTED_CHECKED_RECORD_RESULT_ONLY
template<class F> static bool rejected(F&& call, const std::string& expected) {
  try { call(); }
  catch (const api::Error& error) {
    if (error.status == NESTEDCHECKEDRECORDS_STATUS_INVALID_ARGUMENT
        && error.code == NESTEDCHECKEDRECORDS_ERROR_INVALID_ARGUMENT
        && std::string(error.what()) == expected) {
      ++rejections;
      return true;
    }
  }
  return false;
}

static std::string path(const std::string& suffix) {
  return std::string(NESTED_PARAMETER_PREFIX) + suffix;
}
#endif

int main() {
  const Nat huge = Nat(1) << 100;
  for (unsigned round = 0; round < rounds; ++round) {
    const Nat value = huge + round;
    const auto option = api::produce_option(value);
    CHECK(option.has_value());
    CHECK(option->digit == 0 && option->word == value + 1);
    const auto array = api::produce_array(value);
    CHECK(array.size() == 2);
    CHECK((array[0] == Packet{0, value + 1}));
    CHECK((array[1] == Packet{0, value + 2}));
  }

#ifndef NESTED_CHECKED_RECORD_RESULT_ONLY
  const Packet first{2, 3}, second{7, 0};
  CHECK(api::first(first) == 3);
  CHECK(api::second(second) == 8);
  CHECK(api::pair(first, second) == 11);
  CHECK(api::in_array({Packet{1, 2}, Packet{3, 5}}) == 7);
  CHECK(api::in_list({Packet{1, 0}, Packet{3, 100}}) == 6);
  CHECK(api::in_option(std::nullopt) == 0);
  CHECK(api::in_option(Packet{1, 2}) == 3);
  CHECK(api::in_product({Packet{1, 2}, Packet{3, 0}}) == 6);
  CHECK(api::in_except(api::Ok<Packet>{Packet{2, 9}}) == 3);
  CHECK(api::in_except(api::Err<Packet>{Packet{1, 2}}) == 3);
  CHECK(api::in_holder(api::Holder{Packet{3, 1}, 9}) == 13);
  CHECK(api::in_choice(api::ChoiceEmpty{}) == 0);
  CHECK(api::in_choice(api::ChoicePacket{Packet{2, 4}}) == 5);
  const std::vector<Packet> echoed = {first, Packet{1, huge}};
  CHECK(api::echo_array(echoed) == echoed);
  KEPT(echoed == std::vector<Packet>({first, Packet{1, huge}}));

  const auto refuses = [&](auto&& call, const std::string& message, auto& input, const auto& before) -> int {
    CHECK(rejected(std::forward<decltype(call)>(call), message));
    KEPT(input == before);
    return 0;
  };
  Packet invalid{0, 0};
  Packet before = invalid;
  if (refuses([&] { api::first(invalid); }, path("0.word was rejected by NestedCheckedRecords.mkWord"), invalid, before)) return 1;
  invalid = {4, 2}; before = invalid;
  if (refuses([&] { api::first(invalid); }, path("0 was rejected by NestedCheckedRecords.mkPacket"), invalid, before)) return 1;
  invalid = {10, 12}; before = invalid;
  if (refuses([&] { api::first(invalid); }, path("0.digit is not below its Fin 10 bound"), invalid, before)) return 1;

  Packet left{4, 2}; const Packet leftBefore = left;
  CHECK(rejected([&] { api::pair(left, second); }, path("0 was rejected by NestedCheckedRecords.mkPacket")));
  KEPT((left == leftBefore && second == Packet{7, 0}));
  Packet right{10, 0}; const Packet rightBefore = right;
  CHECK(rejected([&] { api::pair(first, right); }, path("1.digit is not below its Fin 10 bound")));
  KEPT((first == Packet{2, 3} && right == rightBefore));

  std::vector<Packet> array = {first, Packet{1, 0}};
  auto arrayBefore = array;
  if (refuses([&] { api::in_array(array); }, path("0[1].word was rejected by NestedCheckedRecords.mkWord"), array, arrayBefore)) return 1;
  array = {first, Packet{5, 2}}; arrayBefore = array;
  if (refuses([&] { api::in_array(array); }, path("0[1] was rejected by NestedCheckedRecords.mkPacket"), array, arrayBefore)) return 1;
  array = {first, Packet{10, 12}}; arrayBefore = array;
  if (refuses([&] { api::in_array(array); }, path("0[1].digit is not below its Fin 10 bound"), array, arrayBefore)) return 1;

  std::optional<Packet> option = Packet{5, 2}; const auto optionBefore = option;
  if (refuses([&] { api::in_option(option); }, path("0? was rejected by NestedCheckedRecords.mkPacket"), option, optionBefore)) return 1;
  std::pair<Packet, Packet> product{first, Packet{10, 0}}; const auto productBefore = product;
  if (refuses([&] { api::in_product(product); }, path("0.1.digit is not below its Fin 10 bound"), product, productBefore)) return 1;

  api::Result<Packet, Packet> branch = api::Ok<Packet>{Packet{10, 0}};
  const auto okBefore = branch;
  if (refuses([&] { api::in_except(branch); }, path("0.ok.digit is not below its Fin 10 bound"), branch, okBefore)) return 1;
  branch = api::Err<Packet>{Packet{3, 1}}; const auto errorBefore = branch;
  if (refuses([&] { api::in_except(branch); }, path("0.error was rejected by NestedCheckedRecords.mkPacket"), branch, errorBefore)) return 1;

  api::Holder holder{Packet{10, 0}, 9}; const auto holderBefore = holder;
  if (refuses([&] { api::in_holder(holder); }, path("0.packet.digit is not below its Fin 10 bound"), holder, holderBefore)) return 1;
  api::Choice choice = api::ChoicePacket{Packet{3, 1}}; const auto choiceBefore = choice;
  if (refuses([&] { api::in_choice(choice); }, path("0.packet.value was rejected by NestedCheckedRecords.mkPacket"), choice, choiceBefore)) return 1;

  for (unsigned round = 0; round < rounds; ++round) {
    Packet valid{round % 10, Nat(round) + 10}; const Packet validBefore = valid;
    CHECK(api::first(valid) == Nat(round) + 10); KEPT(valid == validBefore);
    Packet outer{2, 1}; const Packet outerBefore = outer;
    CHECK(rejected([&] { api::first(outer); }, path("0 was rejected by NestedCheckedRecords.mkPacket")));
    KEPT(outer == outerBefore);
    Packet normalized{round % 10, 0}; const Packet normalizedBefore = normalized;
    CHECK(api::second(normalized) == Nat(round % 10) + 1); KEPT(normalized == normalizedBefore);
    std::vector<Packet> late = {valid, Packet{1, 0}}; const auto lateBefore = late;
    CHECK(rejected([&] { api::in_array(late); }, path("0[1].word was rejected by NestedCheckedRecords.mkWord")));
    KEPT(late == lateBefore);
    late[1] = first; const auto recoveredBefore = late;
    CHECK(api::in_array(late) == Nat(round) + 13); KEPT(late == recoveredBefore); ++recoveries;
  }
  KEPT((second == Packet{7, 0}));
#endif

  std::printf("{\"checks\":%u,\"rejections\":%u,\"recoveries\":%u,\"snapshots\":%u,\"rounds\":%u}\n",
    checks, rejections, recoveries, snapshots, rounds);
}
