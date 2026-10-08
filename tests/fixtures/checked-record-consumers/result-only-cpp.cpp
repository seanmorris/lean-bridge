#include <checkedrecords.hpp>
#include <cstdio>
namespace api = lean_bridge::checkedrecords;
using Nat = api::Nat;
static unsigned checks;
#define CHECK(test) do { if (!(test)) { std::fprintf(stderr, "failed at line %d: %s\n", __LINE__, #test); return 1; } ++checks; } while (0)

int main() {
  /* The package's only checked record is produced by Lean: its proof never crosses and no constructor runs. */
  for (unsigned i = 0; i < 1000; ++i)
    if (!(api::repeated(i) == api::Triple{{i, i, i}})) { std::fprintf(stderr, "round %u failed\n", i); return 1; }
  checks += 1000;
  CHECK((api::repeated(Nat(1) << 80) == api::Triple{{Nat(1) << 80, Nat(1) << 80, Nat(1) << 80}}));
  std::printf("checked-record-ok:%u\n", checks);
  return 0;
}
