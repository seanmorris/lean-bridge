#include <finproductarrays.hpp>
#include <cstdio>
#include <string>
#include <utility>
#include <variant>
#include <vector>
namespace api = lean_bridge::finproductarrays;
using Nat = api::Nat;
static unsigned checks;
#define CHECK(test) do { if (!(test)) { std::fprintf(stderr, "failed at line %d: %s\n", __LINE__, #test); return 1; } ++checks; } while (0)
/* A rejected call carries the invalid-argument status and names the parameter and the failed leaf's bound. */
template<class F> static bool rejected(F&& call, const std::string& expected) {
  try { call(); }
  catch (const api::Error& error) { return error.status == FINPRODUCTARRAYS_STATUS_INVALID_ARGUMENT && std::string(error.what()) == expected; }
  return false;
}
using Row = std::pair<Nat, api::Result<Nat, Nat>>;

int main() {
  const Nat huge = Nat(1) << 100;
  /* (0, ok 2^100), (2, error 5), (3, ok 6): both endpoints, and ok values no bound applies to. */
  const std::vector<Row> valid = {{0, api::Ok<Nat>{huge}}, {2, api::Err<Nat>{5}}, {3, api::Ok<Nat>{6}}};
  const Nat expected = huge + 1016;
  /* An empty array is valid, in and out. */
  CHECK(api::rows({}) == 0);
  CHECK(api::reversed({}).empty());
  std::vector<Row> rows = valid;
  CHECK(api::rows(rows) == expected);
  /* A component at its bound is rejected in the first, middle and last element. Each rejected
     input is compared with its snapshot before the caller restores it. */
  for (std::size_t k = 0; k < 3; ++k) {
    rows[k].first = 4;
    const std::vector<Row> before = rows;
    CHECK(rejected([&] { api::rows(rows); }, "arg0[" + std::to_string(k) + "].0 is not below its Fin 4 bound") && rows == before);
    rows[k].first = valid[k].first;
  }
  /* The active error branch is bounded: error 6 is rejected, while ok 6 in the last row passed above. */
  rows[1].second = api::Err<Nat>{6};
  const std::vector<Row> before = rows;
  CHECK(rejected([&] { api::rows(rows); }, "arg0[1].1.error is not below its Fin 6 bound") && rows == before);
  rows[1].second = api::Err<Nat>{5};
  /* A valid call recovers. */
  CHECK(rows == valid);
  CHECK(api::rows(rows) == expected);
  /* Lean returns the rows reversed, each below its bounds. */
  CHECK(api::reversed(rows) == std::vector<Row>(valid.rbegin(), valid.rend()) && rows == valid);
  for (unsigned i = 0; i < 1000; ++i) {
    if (api::rows(rows) != expected) { std::fprintf(stderr, "round %u failed\n", i); return 1; }
    rows[2].first = 4 + i;
    if (!rejected([&] { api::rows(rows); }, "arg0[2].0 is not below its Fin 4 bound") || rows[2].first != 4 + i) { std::fprintf(stderr, "rejection round %u failed\n", i); return 1; }
    rows[2].first = 3;
  }
  checks += 2000;
  std::printf("fin-product-array-ok:%u\n", checks);
  return 0;
}
