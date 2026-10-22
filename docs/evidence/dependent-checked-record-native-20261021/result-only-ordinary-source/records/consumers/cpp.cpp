#include <dependentrecords.hpp>
#include <cstdio>

namespace api = lean_bridge::dependentrecords;
using Nat = api::Nat;
static unsigned checks;
#define CHECK(test) do { if (!(test)) { std::fprintf(stderr, "failed at line %d: %s\n", __LINE__, #test); return 1; } ++checks; } while (0)

int main() {
  for (unsigned i = 0; i < 512; ++i)
    if (!(api::dependent_result(i) == api::Dependent{i + 1, i})) return 1;
  checks += 512;
  const Nat huge = Nat(1) << 130;
  CHECK((api::dependent_result(huge) == api::Dependent{huge + 1, huge}));
  std::printf("dependent-checked-record-ok:%u\n", checks);
  return 0;
}
