#include <dependentrecords.hpp>
#include <cstdio>
#include <string>

namespace api = lean_bridge::dependentrecords;
using Nat = api::Nat;
static unsigned checks;
#define CHECK(test) do { if (!(test)) { std::fprintf(stderr, "failed at line %d: %s\n", __LINE__, #test); return 1; } ++checks; } while (0)

template<class F> static bool rejected(F&& call) {
  try { call(); }
  catch (const api::Error& error) {
    return error.status == DEPENDENTRECORDS_STATUS_INVALID_ARGUMENT
      && std::string(error.what()) == "value0 was rejected by DependentRecords.mkDependent";
  }
  return false;
}

int main() {
  const api::Dependent valid{3, 2};
  CHECK(api::dependent_total(valid) == 5);
  const api::Dependent equal{2, 2};
  CHECK(rejected([&] { api::dependent_total(equal); }));
  CHECK((equal == api::Dependent{2, 2}));
  CHECK(rejected([] { api::dependent_total(api::Dependent{0, 0}); }));
  CHECK(api::dependent_total(api::Dependent{2, 1}) == 3);
  CHECK(api::dependent_roundtrip(valid) == valid);
  CHECK((valid == api::Dependent{3, 2}));
  const Nat huge = Nat(1) << 130;
  CHECK(api::dependent_total(api::Dependent{huge, huge - 1})
    == 2 * huge - 1);
  CHECK((api::dependent_roundtrip(api::Dependent{huge, huge - 1})
    == api::Dependent{huge, huge - 1}));
  for (unsigned i = 0; i < 256; ++i) {
    if (api::dependent_total(api::Dependent{i + 1, i}) != 2 * i + 1)
      return 1;
    if (!rejected([i] { api::dependent_total(api::Dependent{i + 1, i + 1}); }))
      return 1;
  }
  checks += 512;
  std::printf("dependent-checked-record-ok:%u\n", checks);
  return 0;
}
