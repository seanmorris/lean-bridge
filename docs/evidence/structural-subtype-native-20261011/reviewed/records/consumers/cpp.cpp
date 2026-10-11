#include <structuralsubtypes.hpp>
#include <cstdio>
#include <optional>
#include <string>
#include <utility>
#include <variant>
#include <vector>

namespace api = lean_bridge::structuralsubtypes;
using Nat = api::Nat;
using Group = std::vector<std::optional<Nat>>;
using Pair = std::pair<Nat, Nat>;
static unsigned checks;
#define CHECK(test) do { if (!(test)) { std::fprintf(stderr, "line %d: %s\n", __LINE__, #test); return 1; } ++checks; } while (0)
template<class F> static bool rejected(F&& call, const std::string& expected) {
  try { call(); }
  catch (const api::Error& error) { return error.status == STRUCTURALSUBTYPES_STATUS_INVALID_ARGUMENT && std::string(error.what()) == expected; }
  return false;
}

int main() {
  const Nat wide = (Nat(10) << 64) + 10, huge = Nat(1) << 100;
  CHECK(api::scalar(huge) == huge);
  CHECK(rejected([] { api::scalar(0); }, "value0 was rejected by StructuralSubtypes.checkedPositive"));
  const std::vector<Nat> values = {1, huge, 3};
  CHECK(api::arrays({}).empty());
  CHECK(api::lists({}).empty());
  CHECK(api::arrays(values) == values);
  CHECK(api::lists(values) == values);
  CHECK(api::specialized(values) == values);
  for (unsigned i = 0; i < 3; ++i) {
    auto bad = values; bad[i] = 0; const auto before = bad;
    const auto message = "value0[" + std::to_string(i) + "] was rejected by StructuralSubtypes.checkedPositive";
    CHECK(rejected([&] { api::arrays(bad); }, message)); CHECK(bad == before);
    CHECK(rejected([&] { api::lists(bad); }, message)); CHECK(bad == before);
    CHECK(rejected([&] { api::specialized(bad); }, message)); CHECK(bad == before);
  }
  CHECK(!api::options(std::nullopt));
  CHECK(api::options(huge) == huge);
  CHECK(rejected([] { api::options(Nat(0)); }, "value0? was rejected by StructuralSubtypes.checkedPositive"));
  const std::string text("a\0tail", 6);
  const auto product = std::make_pair(huge, text);
  CHECK(api::product(product) == product);
  CHECK(rejected([&] { api::product({huge, ""}); }, "value0.1 was rejected by StructuralSubtypes.checkedWord"));
  CHECK(rejected([&] { api::product({0, text}); }, "value0.0 was rejected by StructuralSubtypes.checkedPositive"));
  const auto ok = api::branch(api::Ok<Nat>{huge});
  CHECK(std::holds_alternative<api::Ok<Nat>>(ok) && std::get<api::Ok<Nat>>(ok).value == huge);
  const auto error = api::branch(api::Err<std::string>{text});
  CHECK(std::holds_alternative<api::Err<std::string>>(error) && std::get<api::Err<std::string>>(error).value == text);
  CHECK(rejected([] { api::branch(api::Ok<Nat>{0}); }, "value0.ok was rejected by StructuralSubtypes.checkedPositive"));
  CHECK(rejected([] { api::branch(api::Err<std::string>{""}); }, "value0.error was rejected by StructuralSubtypes.checkedWord"));
  using BytePair = std::optional<std::pair<uint8_t, Nat>>;
  const std::vector<BytePair> bytes = {std::nullopt, BytePair{{255, huge}}};
  CHECK(api::byte_branches(bytes) == bytes);
  CHECK(rejected([] { api::byte_branches({BytePair{{0, 1}}}); }, "value0[0]?.0 was rejected by StructuralSubtypes.checkedByte"));
  CHECK(rejected([] { api::byte_branches({BytePair{{1, 0}}}); }, "value0[0]?.1 was rejected by StructuralSubtypes.checkedPositive"));
  using Row = std::vector<std::optional<Pair>>;
  std::vector<Row> nested = {{std::nullopt, Pair{huge, wide - 1}}, {}, {Pair{2, 3}}};
  CHECK(api::nested(nested) == 3);
  nested[2][0] = Pair{0, wide}; const auto before = nested;
  CHECK(rejected([&] { api::nested(nested); }, "value0[2][0]?.1 is not below its Fin 184467440737095516170 bound"));
  CHECK(nested == before);
  nested[2][0] = Pair{0, wide - 1};
  CHECK(rejected([&] { api::nested(nested); }, "value0[2][0]?.0 was rejected by StructuralSubtypes.checkedPositive"));
  nested[2][0] = Pair{1, wide - 1}; CHECK(api::nested(nested) == 3);
  const Group first = {1, std::nullopt, huge}, second = {huge, 3, std::nullopt};
  const auto pair = api::alias_pair({first, second});
  const Group normalized = {huge + 1, 4, std::nullopt};
  CHECK(pair.first == first && pair.second == normalized);
  const Group joined = {1, std::nullopt, huge, huge + 1, 4, std::nullopt};
  CHECK(api::alias_arguments(first, second) == joined);
  CHECK(api::plain_fin({std::nullopt, Nat(0), Nat(9)}) == 3);
  CHECK(rejected([] { api::plain_fin({Nat(10)}); }, "value0[0]? is not below its Fin 10 bound"));
  for (unsigned i = 0; i < 1000; ++i) {
    Group late = {huge, 3, 4}; late[i % 3] = 0; const auto snapshot = late;
    const std::string message = "value1[" + std::to_string(i % 3) + "]? was rejected by StructuralSubtypes.normalizePositive";
    CHECK(rejected([&] { api::alias_arguments(first, late); }, message));
    CHECK(late == snapshot && first == Group({1, std::nullopt, huge}));
    CHECK(api::alias_arguments(first, second) == joined);
    CHECK(second == Group({huge, 3, std::nullopt}));
  }
  std::printf("structural-subtype-ok:%u\n", checks);
}
