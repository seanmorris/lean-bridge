#include <checkedrecordvalueindices.hpp>
#include <iostream>

using namespace lean_bridge::checkedrecordvalueindices;

static unsigned checks;
static unsigned calls;
#define CHECK(test) do { if (!(test)) { std::cerr << "failed at line " << __LINE__ << ": " #test "\n"; return 1; } ++checks; } while (0)

int main() {
  const Nat huge = (Nat(1) << 128) + 1;
  ++calls; CHECK(produce_true_bool() == On{0});
  ++calls; CHECK(produce_false_bool() == Off{1});
  ++calls; CHECK(produce_ab() == Ab{2});
  Nat value = 23; ++calls; CHECK(produce_empty_string(value) == EmptyToken{23} && value == 23);
  value = 24; ++calls; CHECK(produce_unicode_string(value) == UnicodeToken{24} && value == 24);
  ++calls; CHECK(produce_empty_sized() == EmptySized{{}});
  value = 25; ++calls; CHECK(produce_zero_nat(value) == ZeroToken{25} && value == 25);
  ++calls; CHECK(produce_wide_nat(huge) == WideToken{huge} && value == 25);
  CHECK(calls == 8);
  std::cout << "{\"calls\":" << calls << ",\"checks\":" << checks
    << ",\"recoveries\":0,\"rejections\":0}\n";
  return 0;
}
