#include <fincontainers.hpp>
#include <cstdio>
#include <optional>
#include <string>
#include <vector>
namespace api = lean_bridge::fincontainers;
using Nat = api::Nat;
static unsigned checks;
#define CHECK(test) do { if (!(test)) { std::fprintf(stderr, "failed at line %d: %s\n", __LINE__, #test); return 1; } ++checks; } while (0)
/* A rejected call carries the invalid-argument status and names the parameter and the failed leaf's bound. */
template<class F> static bool rejected(F&& call, const std::string& expected) {
  try { call(); }
  catch (const api::Error& error) { return error.status == FINCONTAINERS_STATUS_INVALID_ARGUMENT && std::string(error.what()) == expected; }
  return false;
}
template<class F> static bool invalid(F&& call) {
  try { call(); } catch (const api::Error& error) { return error.status == FINCONTAINERS_STATUS_INVALID_ARGUMENT; }
  return false;
}

int main() {
  const Nat huge = Nat(1) << 70, word = Nat(1) << 32;
  const std::vector<Nat> digits = {0, 1, 2, 3, 4, 5, 6, 7, 8, 9}, none = {};
  /* Array (Fin 10): every element is checked; results stay below the bound. */
  std::vector<Nat> mirrored = api::mirror_all(digits);
  CHECK(mirrored.size() == 10);
  for (unsigned i = 0; i < 10; ++i) CHECK(mirrored[i] == 9 - i);
  CHECK(api::mirror_all(none).empty());
  for (unsigned position = 0; position < 3; ++position) {
    std::vector<Nat> bad = {1, 2, 3}; bad[position] = 10;
    CHECK(rejected([&] { api::mirror_all(bad); }, "arg0[" + std::to_string(position) + "] is not below its Fin 10 bound"));
    CHECK(bad[position] == 10);
  }
  CHECK(rejected([&] { api::mirror_all({word, 1, 2}); }, "arg0[0] is not below its Fin 10 bound"));
  CHECK(invalid([&] { api::mirror_all({Nat(-1), 1, 2}); })); /* Negative is the Nat error. */
  /* Array (Fin 0): only the empty array has values. */
  CHECK(api::count_none(none) == 0);
  CHECK(rejected([&] { api::count_none({0}); }, "arg0[0] is not below its Fin 0 bound"));
  /* List Huge: a 2^70 bound compared limb by limb. */
  CHECK(api::sum_huge({word, huge - 1}) == word + huge - 1);
  CHECK(api::sum_huge({}) == 0);
  CHECK(rejected([&] { api::sum_huge({word, huge}); }, "arg0[1] is not below its Fin 1180591620717411303424 bound"));
  /* Option (Fin 1): none is valid; a present value is checked. */
  CHECK(api::or_default(std::nullopt) == 7);
  CHECK(api::or_default(Nat(0)) == 0);
  CHECK(rejected([&] { api::or_default(Nat(1)); }, "arg0? is not below its Fin 1 bound"));
  /* Array (Option Digit): only present elements are checked. */
  std::vector<std::optional<Nat>> mixed = {Nat(1), std::nullopt, Nat(9)};
  CHECK(api::present(mixed) == std::vector<Nat>({1, 9}));
  mixed[2] = Nat(10);
  CHECK(rejected([&] { api::present(mixed); }, "arg0[2]? is not below its Fin 10 bound"));
  mixed[2] = std::nullopt;
  CHECK(api::present(mixed).size() == 1);
  /* List (Array Digit) -> Option (List Digit): nested rows. */
  std::vector<std::vector<Nat>> rows = {{1, 2}, {3}};
  CHECK(api::flatten(rows) == std::optional<std::vector<Nat>>(std::vector<Nat>{1, 2, 3}));
  CHECK(api::flatten({}) == std::nullopt);
  rows[1][0] = 10;
  CHECK(rejected([&] { api::flatten(rows); }, "arg0[1][0] is not below its Fin 10 bound"));
  /* A late refined argument after an unrefined one. */
  const std::vector<std::string> names = {"a", "b"};
  CHECK(api::label(names, {1, 3}) == "a:1,b:3");
  CHECK(rejected([&] { api::label(names, {1, 4}); }, "arg1[1] is not below its Fin 4 bound"));
  CHECK(names[1] == "b");
  /* A result-only container refinement projects each element after Lean returns. */
  CHECK(api::wrap_all({100, huge}) == std::vector<Nat>({2, 2}));
  CHECK(api::wrap_all(none).empty());
  /* Repeated invalid and valid calls recover without retiring the runtime. */
  for (unsigned i = 0; i < 1000; ++i) {
    if (!rejected([&] { api::mirror_all({Nat(10 + i % 5)}); }, "arg0[0] is not below its Fin 10 bound") || api::mirror_all({Nat(i % 10)})[0] != 9 - i % 10) {
      std::fprintf(stderr, "recovery failed at %u\n", i); return 1;
    }
  }
  checks += 2000;
  std::printf("fin-container-ok:%u\n", checks);
  return 0;
}
