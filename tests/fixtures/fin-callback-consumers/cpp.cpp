#include <fincallbacks.hpp>
#include <cstdio>
#include <optional>
#include <string>
#include <thread>
#include <utility>
#include <variant>
#include <vector>
namespace api = lean_bridge::fincallbacks;
using Nat = api::Nat;
static unsigned checks;
#define CHECK(test) do { if (!(test)) { std::fprintf(stderr, "failed at line %d: %s\n", __LINE__, #test); return 1; } ++checks; } while (0)
/* A rejected call carries the invalid-argument status and names the argument and the failed leaf's bound. */
template<class F> static bool rejected(F&& call, const std::string& expected) {
  try { call(); }
  catch (const api::Error& error) { return error.status == FINCALLBACKS_STATUS_INVALID_ARGUMENT && std::string(error.what()) == expected; }
  return false;
}
template<class F> static bool refused(F&& call) {
  try { call(); }
  catch (const api::Error&) { return true; }
  return false;
}

int main() {
  /* Fin 10 argument of a leased closure: every value below 10 runs, 10 and a 2^70 value are refused. */
  auto scaler = api::scaler(Nat(7));
  for (unsigned d = 0; d < 10; ++d) CHECK(scaler(Nat(d)) == Nat(d * 7));
  const Nat ten(10), huge = Nat(1) << 70;
  CHECK(rejected([&] { scaler(ten); }, "arg0 is not below its Fin 10 bound") && ten == 10);
  CHECK(rejected([&] { scaler(huge); }, "arg0 is not below its Fin 10 bound"));
  /* The same closure recovers after each rejection. */
  for (unsigned round = 0; round < 100; ++round) {
    CHECK(rejected([&] { scaler(Nat(10 + round)); }, "arg0 is not below its Fin 10 bound"));
    CHECK(scaler.call(Nat(round % 10)) == Nat((round % 10) * 7));
  }
  /* A closure is invoked on its creating thread only, and still works there afterwards. */
  bool other = false;
  std::thread worker([&] { other = refused([&] { scaler(Nat(4)); }); }); worker.join();
  CHECK(other && scaler(Nat(9)) == 63);
  /* An explicit close releases the lease once; later calls reject. */
  scaler.close();
  CHECK(refused([&] { scaler(Nat(1)); }));

  /* Fin 0 has no values: every argument is refused and the closure stays closable. */
  auto impossible = api::impossible(std::monostate{});
  for (unsigned d = 0; d < 3; ++d) CHECK(rejected([&] { impossible(Nat(d)); }, "arg0 is not below its Fin 0 bound"));
  impossible.close();

  /* A bound wider than 64 bits. */
  auto wide = api::wide(std::monostate{});
  const Nat bound("184467440737095516170");
  CHECK(wide(bound - 1) == bound);
  CHECK(rejected([&] { wide(bound); }, "arg0 is not below its Fin 184467440737095516170 bound"));

  /* Array (Fin 3): the first, middle and last invalid element are refused; the caller's vector is unchanged. */
  auto digits = api::digits(std::monostate{});
  std::vector<Nat> items{0, 1, 2};
  CHECK(digits(items) == 5);
  for (std::size_t bad = 0; bad < 3; ++bad) {
    items[bad] = 3;
    CHECK(rejected([&] { digits(items); }, "arg0 is not below its Fin 3 bound") && items[bad] == 3);
    items[bad] = bad;
  }
  CHECK(digits(std::vector<Nat>{}) == 0);

  /* Option (Fin 5 × Nat): an absent value runs, a present component at its bound is refused. */
  auto pick = api::pick(std::monostate{});
  CHECK(pick(std::nullopt) == 100);
  CHECK(pick(std::pair<Nat, Nat>{4, 7}) == 11);
  CHECK(rejected([&] { pick(std::pair<Nat, Nat>{5, 0}); }, "arg0 is not below its Fin 5 bound"));

  /* Except String (Fin 7): only the active ok branch is bounded. */
  auto branch = api::branch(std::monostate{});
  CHECK(branch(api::Ok<Nat>{6}) == 6);
  CHECK(rejected([&] { branch(api::Ok<Nat>{7}); }, "arg0 is not below its Fin 7 bound"));
  CHECK(branch(api::Err<std::string>{"abc"}) == 53);

  /* A leased closure's Fin 10 result comes from Lean: the host only receives values below 10. */
  auto counter = api::counter(Nat(8));
  for (unsigned step = 0; step < 25; ++step) CHECK(counter(Nat(step)) == Nat((8 + step) % 10));

  /* A host callback's Fin 5 arguments come from Lean: every value 0 through 4, nothing at the bound. */
  unsigned seen = 0; Nat largest = 0;
  CHECK(api::visit([&](Nat digit) -> Nat { ++seen; if (digit > largest) largest = digit; return digit * 10; }) == 100);
  CHECK(seen == 5 && largest == 4);

  /* List of records: every element's Fin 5 field, first, middle and last, is checked; the caller's vector is unchanged. */
  auto tiles = api::tiles(std::monostate{});
  std::vector<api::Tile> row{{0, 10}, {1, 10}, {2, 10}};
  CHECK(tiles(row) == 330);
  for (std::size_t bad = 0; bad < 3; ++bad) {
    row[bad].digit = 5;
    CHECK(rejected([&] { tiles(row); }, "arg0 is not below its Fin 5 bound") && row[bad].digit == 5);
    row[bad].digit = bad;
  }
  CHECK(tiles(row) == 330);

  /* Nested: an absent list runs; a present list checks every record inside it. */
  auto maybe = api::maybe_tiles(std::monostate{});
  CHECK(maybe(std::nullopt) == 7 && maybe(row) == 3);
  row[1].digit = 9;
  CHECK(rejected([&] { maybe(row); }, "arg0 is not below its Fin 5 bound"));
  row[1].digit = 1;

  /* A variant: only the active case's Fin 10 field is checked. */
  auto shaped = api::shaped(std::monostate{});
  CHECK(shaped(api::ShapeCircle{9}) == 9);
  CHECK(rejected([&] { shaped(api::ShapeCircle{10}); }, "arg0 is not below its Fin 10 bound"));
  CHECK(shaped(api::ShapeLabel{"hey"}) == 23);

  /* A leased closure's record result comes from Lean: every digit is below 5. */
  auto maker = api::tile_maker(Nat(3));
  for (unsigned n = 0; n < 12; ++n) CHECK(maker(Nat(n)) == (api::Tile{Nat((3 + n) % 5), Nat(n)}));

  /* Host callbacks receive Lean's records and variants: digits 0 through 4, a radius below 10, and a label. */
  unsigned tile_calls = 0; Nat tile_max = 0;
  CHECK(api::visit_tiles([&](api::Tile tile) -> Nat { ++tile_calls; if (tile.digit > tile_max) tile_max = tile.digit; return tile.digit + tile.count; }) == 25);
  CHECK(tile_calls == 6 && tile_max == 4);
  unsigned shape_calls = 0; Nat radius = 0;
  CHECK(api::visit_shapes([&](api::Shape shape) -> Nat {
    ++shape_calls;
    if (const auto *circle = std::get_if<api::ShapeCircle>(&shape)) { radius = circle->radius; return circle->radius; }
    return Nat(std::get<api::ShapeLabel>(shape).text.size() + 20);
  }) == 31);
  CHECK(shape_calls == 2 && radius == 9);

  std::printf("fin-callback-ok:%u\n", checks);
  return 0;
}
