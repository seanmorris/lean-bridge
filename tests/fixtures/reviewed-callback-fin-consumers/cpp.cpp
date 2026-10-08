#include <reviewedcallbacks.hpp>
#include <cstdio>
#include <string>
#include <variant>
#include <vector>
namespace api = lean_bridge::reviewedcallbacks;
using Nat = api::Nat;
static unsigned checks;
#define CHECK(test) do { if (!(test)) { std::fprintf(stderr, "failed at line %d: %s\n", __LINE__, #test); return 1; } ++checks; } while (0)
/* A rejected call carries the invalid-argument status and names the argument and the failed leaf's bound. */
template<class F> static bool rejected(F&& call, const std::string& expected) {
  try { call(); }
  catch (const api::Error& error) { return error.status == REVIEWEDCALLBACKS_STATUS_INVALID_ARGUMENT && std::string(error.what()) == expected; }
  return false;
}

int main() {
  /* scaler: a leased closure's Fin 10 argument is checked before Lean runs, then the closure recovers. */
  auto scaler = api::scaler(Nat(3));
  for (unsigned d = 0; d < 10; ++d) CHECK(scaler(Nat(d)) == Nat(d * 3));
  for (unsigned round = 0; round < 100; ++round) {
    CHECK(rejected([&] { scaler(Nat(10 + round)); }, "arg0 is not below its Fin 10 bound"));
    CHECK(scaler(Nat(round % 10)) == Nat((round % 10) * 3));
  }
  CHECK(rejected([&] { scaler(Nat(1) << 70); }, "arg0 is not below its Fin 10 bound"));
  scaler.close();

  /* counter: Lean produces the Fin 10 result. */
  auto counter = api::counter(Nat(7));
  for (unsigned step = 0; step < 25; ++step) CHECK(counter(Nat(step)) == Nat((7 + step) % 10));
  counter.close();

  /* visit: Lean passes Fin 5 arguments to the host. */
  unsigned visited = 0; Nat largest = 0;
  CHECK(api::visit([&](Nat digit) { ++visited; if (digit > largest) largest = digit; return digit; }) == 10 && visited == 5 && largest == 4);

  /* digits: every element of an Array (Fin 3) argument is checked; the caller's vector is unchanged. */
  auto digits = api::digits(std::monostate{});
  std::vector<Nat> items{0, 1, 2};
  CHECK(digits(items) == 5);
  for (std::size_t bad = 0; bad < 3; ++bad) {
    std::vector<Nat> broken = items; broken[bad] = 3;
    const std::vector<Nat> before = broken;
    CHECK(rejected([&] { digits(broken); }, "arg0 is not below its Fin 3 bound") && broken == before);
  }
  CHECK(digits(std::vector<Nat>{}) == 0);
  digits.close();

  /* tiles and tileMaker: the nominal Tile's Fin 5 field is checked in a closure argument and proved in a closure result. */
  auto tiles = api::tiles(std::monostate{});
  std::vector<api::Tile> row{{0, 10}, {1, 10}, {2, 10}};
  CHECK(tiles(row) == 330);
  for (std::size_t bad = 0; bad < 3; ++bad) {
    std::vector<api::Tile> broken = row; broken[bad].digit = 5;
    CHECK(rejected([&] { tiles(broken); }, "arg0 is not below its Fin 5 bound"));
  }
  CHECK(tiles(row) == 330);
  tiles.close();
  auto maker = api::tile_maker(Nat(3));
  for (unsigned n = 0; n < 12; ++n) CHECK((maker(Nat(n)) == api::Tile{Nat((3 + n) % 5), Nat(n)}));
  maker.close();

  /* apply: an unrefined host callback is unchanged. */
  CHECK(api::apply([](Nat value) { return Nat(value + 1); }, Nat(41)) == 42);
  std::printf("reviewed-callback-fin-ok:%u\n", checks);
  return 0;
}
