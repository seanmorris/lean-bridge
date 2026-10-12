#define NOMINAL_RESULT_ONLY
#include <nominalsubtypes.hpp>
#include <cstdio>
#include <optional>
#include <string>
#include <utility>
#include <variant>
#include <vector>

namespace api = lean_bridge::nominalsubtypes;
using Nat = api::Nat;
using Group = std::vector<std::optional<api::Envelope>>;
using Choices = std::vector<std::optional<api::Result<Nat, Nat>>>;
static unsigned checks;
#define CHECK(test) do { if (!(test)) { std::fprintf(stderr, "line %d: %s\n", __LINE__, #test); return 1; } ++checks; } while (0)
static api::Envelope box(Nat payload, Nat digit = 2) { return {std::move(payload), std::move(digit)}; }
static Group values(const Nat& value) { return {std::nullopt, box(value + 1)}; }

#ifndef NOMINAL_RESULT_ONLY
template<class F> static bool rejected(F&& call, const std::string& expected) {
  try { call(); }
  catch (const api::Error& error) {
    return error.status == NOMINALSUBTYPES_STATUS_INVALID_ARGUMENT
      && error.code == NOMINALSUBTYPES_ERROR_INVALID_ARGUMENT && std::string(error.what()) == expected;
  }
  return false;
}
#endif

int main() {
  const Nat huge = Nat(1) << 100;
  for (const Nat& value : std::vector<Nat>{0, 40, huge}) {
    const Nat before = value;
    CHECK(api::scalar(value) == value + 1);
    CHECK(api::produce_envelope(value) == box(value + 1));
    CHECK(api::array_values(value) == std::vector<Nat>({value + 1, value + 2}));
    CHECK(api::list_values(value) == std::vector<Nat>({value + 1, value + 2}));
    CHECK(api::optional(value) == (value == 0 ? std::optional<Nat>{} : std::optional<Nat>{value + 1}));
    CHECK(api::product(value) == std::make_pair(Nat(value + 1), Nat(value + 2)));
    const auto branch = api::branch(value);
    CHECK(value == 0 ? std::holds_alternative<api::Err<Nat>>(branch) && std::get<api::Err<Nat>>(branch).value == 1
      : std::holds_alternative<api::Ok<Nat>>(branch) && std::get<api::Ok<Nat>>(branch).value == value + 1);
    CHECK(api::group_values(value) == values(value));
    const api::AliasPair pair{values(value), values(value + 1)};
    CHECK(api::pair_values(value) == pair);
    CHECK(api::event_value(value) == api::Event(api::EventBox{box(value + 1)}));
    CHECK(api::event_empty(value) == api::Event(api::EventEmpty{}));
    const Choices choices{std::nullopt, api::Ok<Nat>{value + 1}, api::Err<Nat>{value + 2}};
    CHECK(api::event_choices(value) == api::Event(api::EventChoices{choices}));
    CHECK(api::no_items(value).empty());
    CHECK(value == before);
  }
#ifdef NOMINAL_RESULT_ONLY
  for (unsigned round = 0; round < 1000; ++round) {
    const Nat value = huge + round;
    const auto actual = api::pair_values(value);
    CHECK(actual.left == values(value));
    CHECK(actual.right == values(value + 1));
  }
#else
  const auto input = box(40), before = input;
  CHECK(api::first(input) == 41); CHECK(api::second(input) == 42);
  CHECK(api::combine(input, input) == 4142);
  CHECK(api::nested(api::Pair{input, input}) == 4142);
  CHECK(input == before);
  CHECK(api::first(box(99)) == 100); CHECK(api::second(box(89)) == 91);
  CHECK(api::first(box(90)) == 91);
  CHECK(rejected([] { api::first(box(100)); }, "value0.payload was rejected by NominalSubtypes.plusOne"));
  CHECK(rejected([] { api::second(box(90)); }, "value0.payload was rejected by NominalSubtypes.plusTwo"));
  CHECK(rejected([&] { api::combine(box(100), input); }, "value0.payload was rejected by NominalSubtypes.plusOne"));
  CHECK(rejected([&] { api::combine(input, box(90)); }, "value1.payload was rejected by NominalSubtypes.plusTwo"));
  CHECK(rejected([&] { api::nested(api::Pair{box(100), input}); }, "value0.left.payload was rejected by NominalSubtypes.plusOne"));
  CHECK(rejected([&] { api::nested(api::Pair{input, box(90)}); }, "value0.right.payload was rejected by NominalSubtypes.plusTwo"));
  CHECK(api::echo(input) == box(41)); CHECK(input == before);
  for (unsigned which = 0; which < 2; ++which) {
    const auto call = which == 0 ? api::event_first : api::event_second;
    const unsigned first = which == 0 ? 1 : 2, second = which == 0 ? 2 : 1;
    CHECK(call(api::EventEmpty{}) == 0);
    CHECK(call(api::EventBox{input}) == 40 + first);
    CHECK(call(api::EventChoices{{}}) == 0);
    CHECK(call(api::EventChoices{{std::nullopt}}) == 0);
    CHECK(call(api::EventChoices{{std::nullopt, api::Ok<Nat>{40}}}) == 40 + first);
    CHECK(call(api::EventChoices{{api::Err<Nat>{40}, std::nullopt}}) == 40 + second);
    for (unsigned branch = 0; branch < 2; ++branch) for (unsigned position = 0; position < 3; ++position) {
      Choices items{api::Ok<Nat>{40}, std::nullopt, api::Err<Nat>{40}};
      items[position] = branch == 0 ? api::Result<Nat, Nat>(api::Ok<Nat>{100}) : api::Result<Nat, Nat>(api::Err<Nat>{100});
      const auto snapshot = items;
      const std::string constructor = (branch == 0 ? first : second) == 1 ? "plusOne" : "plusTwo";
      const auto message = "value0.choices.values[" + std::to_string(position) + "]?." + (branch == 0 ? "ok" : "error") + " was rejected by NominalSubtypes." + constructor;
      CHECK(rejected([&] { call(api::EventChoices{items}); }, message)); CHECK(items == snapshot);
    }
  }
  const Group left{std::nullopt, input, box(1, 0)}, right{box(2, 1), std::nullopt};
  const Group normalized_left{std::nullopt, box(41), box(2, 0)}, normalized_right{box(4, 1), std::nullopt};
  const api::AliasPair original{left, right}, normalized{normalized_left, normalized_right};
  CHECK(api::aliases(left, right) == 47);
  CHECK(api::inspect_alias_pair(original) == 47);
  CHECK(api::echo_groups(left) == normalized_left);
  const auto projected = api::echo_pair(original); CHECK(projected == normalized);
  const api::AliasPair twice{{std::nullopt, box(42), box(3, 0)}, {box(6, 1), std::nullopt}};
  CHECK(api::echo_pair(projected) == twice);
  const api::Event choices = api::EventChoices{{std::nullopt, api::Ok<Nat>{40}, api::Err<Nat>{40}}};
  const api::Event choices_out = api::EventChoices{{std::nullopt, api::Ok<Nat>{41}, api::Err<Nat>{42}}};
  CHECK(api::echo_event(choices) == choices_out);
  CHECK(api::echo_event(api::EventEmpty{}) == api::Event(api::EventEmpty{}));
  CHECK(api::echo_event(api::EventBox{input}) == api::Event(api::EventBox{box(41)}));
  CHECK(api::echo_groups({}).empty());
  const api::AliasPair absent{{}, {std::nullopt}}; CHECK(api::echo_pair(absent) == absent);
  for (unsigned position = 0; position < 3; ++position) {
    Group bad{input, std::nullopt, input}; bad[position] = box(100); const auto snapshot = bad;
    const auto suffix = "[" + std::to_string(position) + "]?.payload was rejected by NominalSubtypes.";
    CHECK(rejected([&] { api::echo_groups(bad); }, "value0" + suffix + "plusOne"));
    CHECK(rejected([&] { api::inspect_alias_pair(api::AliasPair{bad, right}); }, "value0.left" + suffix + "plusOne"));
    CHECK(rejected([&] { api::inspect_alias_pair(api::AliasPair{left, bad}); }, "value0.right" + suffix + "plusTwo"));
    CHECK(bad == snapshot);
  }
  CHECK(rejected([] { api::combine(box(100), box(40, 3)); }, "value1.digit is not below its Fin 3 bound"));
  CHECK(rejected([] { api::nested(api::Pair{box(100), box(40, 3)}); }, "value0.right.digit is not below its Fin 3 bound"));
  CHECK(rejected([] { api::aliases({box(100)}, {std::nullopt, box(40, 3)}); }, "value1[1]?.digit is not below its Fin 3 bound"));
  CHECK(rejected([] { api::echo_event(api::EventBox{box(100, 3)}); }, "value0.box.value.digit is not below its Fin 3 bound"));
  CHECK(api::plain_fin(2) == 2);
  CHECK(rejected([] { api::plain_fin(3); }, "value0 is not below its Fin 3 bound"));
  for (unsigned round = 0; round < 1000; ++round) {
    Group bad{std::nullopt, box(1), std::nullopt}; bad[round % 3] = box(90);
    const auto snapshot = bad;
    const auto message = "value0.right[" + std::to_string(round % 3) + "]?.payload was rejected by NominalSubtypes.plusTwo";
    CHECK(rejected([&] { api::echo_pair(api::AliasPair{left, bad}); }, message));
    CHECK(bad == snapshot);
    CHECK(api::echo_pair(original) == normalized);
    CHECK(original.left == left && original.right == right && input == before);
  }
#endif
  std::printf("nominal-subtype-ok:%u\n", checks);
  return 0;
}
