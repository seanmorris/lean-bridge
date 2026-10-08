#include <genericinheritance.hpp>
#include <cstdio>
#include <string>
namespace api = lean_bridge::genericinheritance;
using Nat = api::Nat;
static unsigned checks;
#define CHECK(test) do { if (!(test)) { std::fprintf(stderr, "failed at line %d: %s\n", __LINE__, #test); return 1; } ++checks; } while (0)

int main() {
  /* NatChild extends Base Nat: the parent is the to_base member, typed by its source alias NatBase. */
  const api::NatChild child{api::NatBase{4}, 7};
  CHECK((api::grow(child) == api::NatChild{api::NatBase{5}, 14}));
  CHECK((child == api::NatChild{api::NatBase{4}, 7}));
  /* Nat stays arbitrary precision through the parent member. */
  CHECK((api::grow(api::NatChild{api::NatBase{Nat(1) << 70}, (Nat(1) << 65) + 1}) == api::NatChild{api::NatBase{(Nat(1) << 70) + 1}, (Nat(1) << 66) + 2}));
  /* UNatChild extends a universe-polymorphic UBase instantiated at Type: the member is to_ubase. */
  CHECK(api::lift(api::UNatChild{api::UNatBase{30}, 12}) == 42);
  CHECK(api::lift(api::UNatChild{api::UNatBase{Nat(1) << 80}, 12}) == (Nat(1) << 80) + 12);
  /* MarkerTagged extends Tag Marker: Marker is a phantom argument, so to_tag carries only the label. */
  const api::MarkerTagged tagged{api::MarkerTag{"héllo 🙂"}, 3};
  CHECK((api::relabel(tagged) == api::MarkerTagged{api::MarkerTag{"héllo 🙂!"}, 3}));
  CHECK((api::relabel(api::MarkerTagged{api::MarkerTag{""}, 0}) == api::MarkerTagged{api::MarkerTag{"!"}, 0}));
  for (unsigned i = 0; i < 1000; ++i) {
    if (!(api::grow(api::NatChild{api::NatBase{i}, i}) == api::NatChild{api::NatBase{i + 1}, Nat(2) * i})) { std::fprintf(stderr, "grow round %u failed\n", i); return 1; }
    if (api::lift(api::UNatChild{api::UNatBase{i}, 1000 - i}) != 1000) { std::fprintf(stderr, "lift round %u failed\n", i); return 1; }
  }
  checks += 2000;
  std::printf("generic-inheritance-ok:%u\n", checks);
  return 0;
}
