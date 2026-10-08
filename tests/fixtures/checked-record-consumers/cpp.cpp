#include <checkedrecords.hpp>
#include <cstdio>
#include <string>
#include <vector>
namespace api = lean_bridge::checkedrecords;
using Nat = api::Nat;
static unsigned checks;
#define CHECK(test) do { if (!(test)) { std::fprintf(stderr, "failed at line %d: %s\n", __LINE__, #test); return 1; } ++checks; } while (0)
/* A refused call carries the invalid-argument status and names the parameter and its site's constructor. */
template<class F> static bool rejected(F&& call, const std::string& expected) {
  try { call(); }
  catch (const api::Error& error) { return error.status == CHECKEDRECORDS_STATUS_INVALID_ARGUMENT && std::string(error.what()) == expected; }
  return false;
}

int main() {
  /* Interval: only mkInterval builds one; the caller's value is never changed. */
  CHECK(api::width(api::Interval{3, 10}) == 7);
  const api::Interval reversed{10, 3};
  CHECK(rejected([&] { api::width(reversed); }, "arg0 was rejected by CheckedRecords.mkInterval") && (reversed == api::Interval{10, 3}));
  CHECK(api::span(api::Interval{1, 5}, api::Interval{2, 9}) == 8);
  CHECK(rejected([] { api::span(api::Interval{1, 5}, api::Interval{9, 2}); }, "arg1 was rejected by CheckedRecords.mkInterval"));
  CHECK(rejected([] { api::span(api::Interval{5, 1}, api::Interval{2, 9}); }, "arg0 was rejected by CheckedRecords.mkInterval"));
  /* Triple := Sized 3, with a different constructor at each site. */
  const api::Triple three{{3, 1, 2}};
  CHECK(api::total(three) == 6);
  CHECK(rejected([] { api::total(api::Triple{{1, 2}}); }, "arg0 was rejected by CheckedRecords.mkTriple"));
  CHECK(rejected([] { api::total(api::Triple{{1, 2, 3, 4}}); }, "arg0 was rejected by CheckedRecords.mkTriple"));
  CHECK(api::first_of(three) == 3);
  CHECK(api::smallest(three) == 1 && (three == api::Triple{{3, 1, 2}})); /* Normalization only inside Lean. */
  CHECK(rejected([] { api::smallest(api::Triple{{1, 2}}); }, "arg0 was rejected by CheckedRecords.sortedTriple"));
  /* A mixed signature, a Lean-produced result, and that result passed back as an input. */
  const api::Triple scaled = api::scale(2, three);
  CHECK((scaled == api::Triple{{6, 2, 4}}));
  CHECK(rejected([] { api::scale(2, api::Triple{{1}}); }, "arg1 was rejected by CheckedRecords.mkTriple"));
  CHECK(api::smallest(scaled) == 2);
  CHECK((api::repeated(4) == api::Triple{{4, 4, 4}}));
  CHECK(api::total(api::Triple{{Nat(1) << 70, 1, 2}}) == (Nat(1) << 70) + 3);
  /* Percent := Bounded 0 101. */
  CHECK(api::complement(api::Percent{40}) == 60);
  CHECK(rejected([] { api::complement(api::Percent{101}); }, "arg0 was rejected by CheckedRecords.mkPercent"));
  for (unsigned i = 0; i < 1000; ++i) {
    if (api::width(api::Interval{i, i + 1}) != 1) { std::fprintf(stderr, "round %u failed\n", i); return 1; }
    if (!rejected([i] { api::width(api::Interval{i + 1, i}); }, "arg0 was rejected by CheckedRecords.mkInterval")) { std::fprintf(stderr, "rejection round %u failed\n", i); return 1; }
  }
  checks += 2000;
  std::printf("checked-record-ok:%u\n", checks);
  return 0;
}
