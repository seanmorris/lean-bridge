#include <inheritedrecords.hpp>
#include <cstdio>
#include <string>
namespace api = lean_bridge::inheritedrecords;
using Nat = api::Nat;
static unsigned checks;
#define CHECK(test) do { if (!(test)) { std::fprintf(stderr, "failed at line %d: %s\n", __LINE__, #test); return 1; } ++checks; } while (0)
/* A rejected call carries the invalid-argument status and names the parameter and the parent field's bound. */
template<class F> static bool rejected(F&& call, const std::string& expected) {
  try { call(); }
  catch (const api::Error& error) { return error.status == INHERITEDRECORDS_STATUS_INVALID_ARGUMENT && std::string(error.what()) == expected; }
  return false;
}

int main() {
  const std::string bound = "arg0 is not below its Fin 10 bound";
  /* Labeled extends Point: the parent is the to_point member, read and rebuilt by Lean. */
  const api::Labeled moved = api::move(api::Labeled{api::Point{4, 7}, "héllo"});
  CHECK((moved == api::Labeled{api::Point{5, 7}, "héllo!"}));
  /* Tagged extends Digit and Point: Digit's Fin 10 field is checked through to_digit. */
  api::Tagged tagged{api::Digit{9}, api::Point{2, 3}, "ab"};
  CHECK(api::total(tagged) == 16);
  CHECK((api::bump(tagged) == api::Tagged{api::Digit{0}, api::Point{2, 3}, "ab"}));
  tagged.to_digit.digit = 10;
  {
    const api::Tagged before = tagged;
    CHECK(rejected([&] { api::total(tagged); }, bound) && tagged == before);
    CHECK(rejected([&] { api::bump(tagged); }, bound) && tagged == before);
  }
  tagged.to_digit.digit = Nat(1) << 70;
  CHECK(rejected([&] { api::total(tagged); }, bound));
  tagged.to_digit.digit = 4;
  CHECK(api::total(tagged) == 11); /* Recovery. */
  /* Stamped extends Labeled: two levels of subobjects. */
  const api::Stamped restamped = api::restamp(api::Stamped{api::Labeled{api::Point{1, 21}, "s"}, 41});
  CHECK((restamped == api::Stamped{api::Labeled{api::Point{1, 42}, "s"}, 42}));
  /* Merged extends Labeled and Tagged: Lean keeps to_labeled and flattens the rest of Tagged. */
  api::Merged merged{api::Labeled{api::Point{5, 0}, "m"}, api::Digit{3}, "t", 100};
  CHECK(api::merged_total(merged) == 108);
  merged.to_digit.digit = 10;
  CHECK(rejected([&] { api::merged_total(merged); }, bound));
  for (unsigned i = 0; i < 1000; ++i) {
    tagged.to_digit.digit = i % 10;
    if (api::total(tagged) != i % 10 + 7) { std::fprintf(stderr, "round %u failed\n", i); return 1; }
    tagged.to_digit.digit = 10 + i;
    if (!rejected([&] { api::total(tagged); }, bound)) { std::fprintf(stderr, "rejection round %u failed\n", i); return 1; }
  }
  checks += 2000;
  std::printf("inherited-record-ok:%u\n", checks);
  return 0;
}
