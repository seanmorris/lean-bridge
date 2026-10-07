#include <genericrecords.hpp>
#include <cstdio>
#include <optional>
#include <string>
#include <vector>
namespace api = lean_bridge::genericrecords;
using Nat = api::Nat;
static unsigned checks;
#define CHECK(test) do { if (!(test)) { std::fprintf(stderr, "failed at line %d: %s\n", __LINE__, #test); return 1; } ++checks; } while (0)

int main() {
  /* Each alias is its own host type with the structure's fields instantiated. */
  const api::NatBox box{4, 1};
  const api::NatBox bumped = api::bump(box);
  CHECK(bumped.value == 5 && bumped.count == 2 && box.value == 4);
  const api::NatBoxAgain again = api::again(api::NatBoxAgain{4, 1});
  CHECK(again.value == 8 && again.count == 1);
  static_assert(!std::is_same_v<api::NatBox, api::NatBoxAgain>, "two aliases of one application are distinct host types");
  const api::TextBox shouted = api::shout(api::TextBox{"h\xc3\xa9llo \xf0\x9f\x99\x82", 3});
  CHECK(shouted.value == "h\xc3\xa9llo \xf0\x9f\x99\x82!" && shouted.count == 3);
  const api::WordPair swapped = api::swap_named(api::WordPair{"a", 1});
  CHECK(swapped.first == "a!" && swapped.second == 2);
  /* A parameter instantiated with Option Nat and a List of a named instantiation. */
  CHECK(api::or_zero(api::MaybeBox{std::optional<Nat>{5}, 2}) == 7);
  CHECK(api::or_zero(api::MaybeBox{std::nullopt, 2}) == 2);
  const api::Boxes boxes = {api::NatBox{1, 0}, api::NatBox{2, 0}, api::NatBox{Nat(1) << 70, 0}};
  CHECK(api::total(boxes) == (Nat(1) << 70) + 3 && api::total(api::Boxes{}) == 0);
  const std::optional<api::Boxes> first = api::first_boxes(2);
  CHECK(first.has_value() && first->size() == 2 && (*first)[1].value == 1 && (*first)[1].count == 2);
  CHECK(!api::first_boxes(0).has_value());
  /* A pair of two named instantiations. */
  CHECK(api::unpair(api::BoxPair{api::NatBox{3, 0}, api::TextBox{"abcd", 0}}) == 7);
  /* A universe-polymorphic structure instantiated at Type. */
  const api::TaggedNat retagged = api::retag(api::TaggedNat{"t", 1});
  CHECK(retagged.tag == "t#" && retagged.payload == 2);
  /* A phantom argument: the instantiation names Marker, which no field carries. */
  CHECK(api::relabel(api::MarkerTag{"m"}).label == "m?");
  for (unsigned i = 0; i < 1000; ++i) {
    const api::NatBox round = api::bump(api::NatBox{i, i});
    if (round.value != i + 1 || round.count != i + 1) { std::fprintf(stderr, "round %u failed\n", i); return 1; }
  }
  checks += 1000;
  std::printf("generic-records-ok:%u\n", checks);
  return 0;
}
