#include <finrecords.hpp>
#include <cstdio>
#include <optional>
#include <string>
#include <variant>
#include <vector>
namespace api = lean_bridge::finrecords;
using Nat = api::Nat;
static unsigned checks;
#define CHECK(test) do { if (!(test)) { std::fprintf(stderr, "failed at line %d: %s\n", __LINE__, #test); return 1; } ++checks; } while (0)
/* A rejected call carries the invalid-argument status and names the parameter and the failed leaf's bound. */
template<class F> static bool rejected(F&& call, const std::string& expected) {
  try { call(); }
  catch (const api::Error& error) { return error.status == FINRECORDS_STATUS_INVALID_ARGUMENT && std::string(error.what()) == expected; }
  return false;
}

int main() {
  const Nat huge = Nat(1) << 100;
  /* Tile: the digit is Fin 5; any count is valid. Each rejected input is compared with an
     independently built copy before the caller changes it back. */
  for (unsigned d = 0; d < 5; ++d) CHECK(api::tile_sum(api::Tile{d, 10}) == d + 10);
  api::Tile t{3, huge};
  CHECK(api::tile_sum(t) == huge + 3);
  t.digit = 5;
  {
    const api::Tile before{5, huge};
    CHECK(rejected([&] { api::tile_sum(t); }, "arg0 is not below its Fin 5 bound") && t == before);
  }
  t.digit = Nat(1) << 70;
  {
    const api::Tile before{Nat(1) << 70, huge};
    CHECK(rejected([&] { api::tile_sum(t); }, "arg0 is not below its Fin 5 bound") && t == before);
  }
  /* Nest: the inner record's own bound and the outer bound are both checked. */
  api::Nest nest{api::Tile{4, 6}, 2};
  CHECK(api::nest_sum(nest) == 210);
  nest.inner.digit = 5;
  {
    const api::Nest before{api::Tile{5, 6}, 2};
    CHECK(rejected([&] { api::nest_sum(nest); }, "arg0 is not below its Fin 5 bound") && nest == before);
  }
  nest.inner.digit = 4; nest.tag = 3;
  {
    const api::Nest before{api::Tile{4, 6}, 3};
    CHECK(rejected([&] { api::nest_sum(nest); }, "arg0 is not below its Fin 3 bound") && nest == before);
  }
  nest.tag = 2;
  CHECK(api::nest_sum(nest) == 210); /* Recovery. */
  /* Late: heap fields precede the bound; a rejection leaves them as the caller built them. */
  api::Late late{"ab", {1, 2}, 4};
  CHECK(api::late_sum(late) == 4005);
  late.digit = 5;
  {
    const api::Late before{"ab", {1, 2}, 5};
    CHECK(rejected([&] { api::late_sum(late); }, "arg0 is not below its Fin 5 bound") && late == before);
  }
  late.digit = 4;
  CHECK(api::late_sum(late) == 4005);
  /* Slot: Option (Fin 0) is valid only when absent. */
  api::Slot slot{std::nullopt, 8};
  CHECK(api::slot_count(slot) == 8);
  slot.maybe = Nat(0);
  {
    const api::Slot before{Nat(0), 8};
    CHECK(rejected([&] { api::slot_count(slot); }, "arg0 is not below its Fin 0 bound") && slot == before);
  }
  /* Shape: only the active case is checked. */
  api::Shape shape = api::ShapeCircle{9};
  CHECK(api::shape_size(shape) == 9);
  shape = api::ShapeCircle{10};
  {
    const api::Shape before = api::ShapeCircle{10};
    CHECK(rejected([&] { api::shape_size(shape); }, "arg0 is not below its Fin 10 bound") && shape == before);
  }
  shape = api::ShapeLabel{"abc"};
  CHECK(api::shape_size(shape) == 1003);
  shape = api::ShapeEmpty{};
  CHECK(api::shape_size(shape) == 7);
  /* Gate: the never case holds Fin 0, so it is always rejected; the closed case is always valid. */
  api::Gate gate = api::GateClosed{};
  CHECK(api::gate_open(gate) == 1);
  gate = api::GateNever{0};
  {
    const api::Gate before = api::GateNever{0};
    CHECK(rejected([&] { api::gate_open(gate); }, "arg0 is not below its Fin 0 bound") && gate == before);
  }
  /* Array Tile: every element; the empty array is valid. */
  std::vector<api::Tile> row = {{0, 1}, {4, 2}, {1, 0}};
  CHECK(api::tiles({}) == 0);
  CHECK(api::tiles(row) == 8);
  for (size_t k = 0; k < row.size(); ++k) {
    const Nat kept = row[k].digit;
    row[k].digit = 5;
    std::vector<api::Tile> before = {{0, 1}, {4, 2}, {1, 0}}; before[k].digit = 5;
    CHECK(rejected([&] { api::tiles(row); }, "arg0 is not below its Fin 5 bound") && row == before);
    row[k].digit = kept;
  }
  CHECK(api::tiles(row) == 8);
  /* Option Shape: absent, a valid present circle, then an invalid one. */
  CHECK(api::maybe_shape(std::nullopt) == 99);
  std::optional<api::Shape> maybe = api::Shape{api::ShapeCircle{3}};
  CHECK(api::maybe_shape(maybe) == 3);
  maybe = api::Shape{api::ShapeCircle{10}};
  {
    const std::optional<api::Shape> before = api::Shape{api::ShapeCircle{10}};
    CHECK(rejected([&] { api::maybe_shape(maybe); }, "arg0 is not below its Fin 10 bound") && maybe == before);
  }
  /* Results carrying bounds are produced by Lean and arrive below them. */
  t = api::Tile{4, 9};
  CHECK((api::bump(t) == api::Tile{0, 10}));
  t.digit = 5;
  {
    const api::Tile before{5, 9};
    CHECK(rejected([&] { api::bump(t); }, "arg0 is not below its Fin 5 bound") && t == before);
  }
  const api::Shape small = api::make_shape(4);
  CHECK(std::holds_alternative<api::ShapeCircle>(small) && std::get<api::ShapeCircle>(small).radius == 4);
  const api::Shape large = api::make_shape(23);
  CHECK(std::holds_alternative<api::ShapeLabel>(large) && std::get<api::ShapeLabel>(large).text == "23");
  for (unsigned i = 0; i < 1000; ++i) {
    t = api::Tile{i % 5, i};
    if (api::tile_sum(t) != i % 5 + i) { std::fprintf(stderr, "round %u failed\n", i); return 1; }
    t.digit = 5 + i;
    if (!rejected([&] { api::tile_sum(t); }, "arg0 is not below its Fin 5 bound") || t != api::Tile{5 + i, i}) { std::fprintf(stderr, "rejection round %u failed\n", i); return 1; }
  }
  checks += 2000;
  std::printf("fin-record-ok:%u\n", checks);
  return 0;
}
