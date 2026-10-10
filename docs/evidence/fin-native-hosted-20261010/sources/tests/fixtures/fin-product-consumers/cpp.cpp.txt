#include <finproducts.hpp>
#include <cstdio>
#include <optional>
#include <string>
#include <utility>
#include <variant>
#include <vector>
namespace api = lean_bridge::finproducts;
using Nat = api::Nat;
static unsigned checks;
#define CHECK(test) do { if (!(test)) { std::fprintf(stderr, "failed at line %d: %s\n", __LINE__, #test); return 1; } ++checks; } while (0)
/* A rejected call carries the invalid-argument status and names the parameter and the failed leaf's bound. */
template<class F> static bool rejected(F&& call, const std::string& expected) {
  try { call(); }
  catch (const api::Error& error) { return error.status == FINPRODUCTS_STATUS_INVALID_ARGUMENT && std::string(error.what()) == expected; }
  return false;
}
using Pair = std::pair<Nat, Nat>;

int main() {
  const Nat wide = (Nat(10) << 64) + 10;
  /* Fin 10 × Nat: only the first component is bounded. */
  for (unsigned d = 0; d < 10; ++d) { const Pair out = api::first(Pair{d, 1000}); CHECK(out.first == 9 - d && out.second == 1001); }
  CHECK(rejected([] { api::first(Pair{10, 0}); }, "arg0 is not below its Fin 10 bound"));
  CHECK(rejected([] { api::first(Pair{Nat(1) << 70, 0}); }, "arg0 is not below its Fin 10 bound"));
  CHECK(api::first(Pair{3, Nat(1) << 200}).second == (Nat(1) << 200) + 1);
  /* Nat × Fin 1, and a bound wider than 64 bits beside Fin 10. */
  CHECK(api::second(Pair{41, 0}) == 41);
  CHECK(rejected([] { api::second(Pair{41, 1}); }, "arg0 is not below its Fin 1 bound"));
  CHECK(api::wide(Pair{wide - 1, 9}) == wide + 8);
  CHECK(rejected([&] { api::wide(Pair{wide, 9}); }, "arg0 is not below its Fin 184467440737095516170 bound"));
  CHECK(rejected([&] { api::wide(Pair{wide - 1, 10}); }, "arg0 is not below its Fin 10 bound"));
  /* Option (Fin 0 × Nat): only none is valid. */
  CHECK(api::absent_only(std::nullopt) == 7);
  CHECK(rejected([] { api::absent_only(Pair{0, 0}); }, "arg0 is not below its Fin 0 bound"));
  /* Except String (Fin 10): the ok branch is bounded; an inactive branch is never read. */
  CHECK(api::ok_only(api::Ok<Nat>{9}) == 9);
  CHECK(rejected([] { api::ok_only(api::Ok<Nat>{10}); }, "arg0 is not below its Fin 10 bound"));
  CHECK(api::ok_only(api::Err<std::string>{"four"}) == 104);
  /* Except (Fin 5) Nat: the error branch is bounded; any ok Nat is valid. */
  CHECK(api::error_only(api::Ok<Nat>{Nat(1) << 100}) == Nat(1) << 100);
  CHECK(api::error_only(api::Err<Nat>{4}) == 104);
  CHECK(rejected([] { api::error_only(api::Err<Nat>{5}); }, "arg0 is not below its Fin 5 bound"));
  /* Except (Fin 3) (Fin 7): only the active branch is checked. */
  CHECK(api::both(api::Ok<Nat>{6}) == 6);
  CHECK(rejected([] { api::both(api::Ok<Nat>{7}); }, "arg0 is not below its Fin 7 bound"));
  CHECK(api::both(api::Err<Nat>{2}) == 102);
  CHECK(rejected([] { api::both(api::Err<Nat>{3}); }, "arg0 is not below its Fin 3 bound"));
  /* List (Option (Fin 3 × Except (Fin 2) Nat)): every present element, both levels. */
  using Branch = std::variant<api::Ok<Nat>, api::Err<Nat>>;
  using Row = std::optional<std::pair<Nat, Branch>>;
  std::vector<Row> rows = {std::nullopt, Row{{2, api::Ok<Nat>{50}}}, Row{{1, api::Err<Nat>{1}}}};
  CHECK(api::nested(rows) == 54);
  rows[2] = Row{{1, api::Err<Nat>{2}}};
  CHECK(rejected([&] { api::nested(rows); }, "arg0 is not below its Fin 2 bound"));
  rows[2] = Row{{1, api::Err<Nat>{1}}}; rows[1] = Row{{3, api::Ok<Nat>{50}}};
  CHECK(rejected([&] { api::nested(rows); }, "arg0 is not below its Fin 3 bound"));
  rows[1] = Row{{2, api::Ok<Nat>{50}}};
  CHECK(api::nested(rows) == 54); /* Recovery after rejections. */
  /* DigitPair := Digit × Digit through the alias. */
  const Pair swapped = api::aliased(Pair{1, 9});
  CHECK(swapped.first == 9 && swapped.second == 1);
  CHECK(rejected([] { api::aliased(Pair{1, 10}); }, "arg0 is not below its Fin 10 bound"));
  /* Results carrying bounds are produced by Lean and arrive below them. */
  const auto produced = api::produce(4);
  CHECK(std::holds_alternative<api::Err<Nat>>(produced) && std::get<api::Err<Nat>>(produced).value == 4);
  CHECK(std::holds_alternative<api::Ok<std::string>>(api::produce(23)));
  const Pair up = api::pair_up(23);
  CHECK(up.first == 3 && up.second == 23);
  for (unsigned i = 0; i < 1000; ++i) {
    if (api::first(Pair{i % 10, i}).first != 9 - i % 10) { std::fprintf(stderr, "round %u failed\n", i); return 1; }
    if (!rejected([&] { api::first(Pair{10 + i, i}); }, "arg0 is not below its Fin 10 bound")) { std::fprintf(stderr, "rejection round %u failed\n", i); return 1; }
  }
  checks += 2000;
  std::printf("fin-product-ok:%u\n", checks);
  return 0;
}
