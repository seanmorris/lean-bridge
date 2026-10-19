#include <checkedrecordvalueindices.hpp>
#include <iostream>
#include <string>
#include <utility>
#include <vector>

using namespace lean_bridge::checkedrecordvalueindices;

static unsigned checks;
static unsigned calls;
static unsigned rejections;
static unsigned recoveries;
#define CHECK(test) do { if (!(test)) { std::cerr << "failed at line " << __LINE__ << ": " #test "\n"; return 1; } ++checks; } while (0)

template<class Call>
static bool refused(Call&& call, const std::string& expected) {
  ++calls;
  try { std::forward<Call>(call)(); }
  catch (const Error& error) {
    return error.status == CHECKEDRECORDVALUEINDICES_STATUS_INVALID_ARGUMENT
      && error.code == CHECKEDRECORDVALUEINDICES_ERROR_INVALID_ARGUMENT
      && error.what() == expected;
  }
  return false;
}

static bool recover(ZeroToken& value) {
  value.count = 99; ++calls;
  if (zero_nat_index(value) != 99 || value.count != 99) return false;
  ++recoveries; return true;
}

int main() {
  const Nat huge = (Nat(1) << 128) + 1;
  On on{0}; Off off{1}; Ab ab{2}; EmptyToken empty{9};
  UnicodeToken unicode{10}; EmptySized sized{{}}; ZeroToken zero{11}; WideToken wide{huge};
  ++calls; CHECK(true_bool_index(on) == 0 && on == On{0});
  ++calls; CHECK(false_bool_index(off) == 1 && off == Off{1});
  ++calls; CHECK(ab_string_index(ab) == 2 && ab == Ab{2});
  ++calls; CHECK(empty_string_index(empty) == 9 && empty == EmptyToken{9});
  ++calls; CHECK(unicode_string_index(unicode) == 10 && unicode == UnicodeToken{10});
  ++calls; CHECK(empty_sized_index(sized) == 0 && sized == EmptySized{{}});
  ++calls; CHECK(zero_nat_index(zero) == 11 && zero == ZeroToken{11});
  ++calls; CHECK(wide_nat_index(wide) == huge && wide == WideToken{huge});

  ab.size = 1;
  CHECK(refused([&] { (void)ab_string_index(ab); },
    "value0 was rejected by CheckedRecordValueIndices.mkAb") && ab == Ab{1});
  ++rejections; CHECK(recover(zero));
  sized.data = {1};
  CHECK(refused([&] { (void)empty_sized_index(sized); },
    "value0 was rejected by CheckedRecordValueIndices.mkEmptySized")
    && sized == EmptySized{{1}});
  ++rejections; CHECK(recover(zero));
  on.count = 1;
  CHECK(refused([&] { (void)true_bool_index(on); },
    "value0 was rejected by CheckedRecordValueIndices.mkOn") && on == On{1});
  ++rejections; CHECK(recover(zero));
  off.count = 0;
  CHECK(refused([&] { (void)false_bool_index(off); },
    "value0 was rejected by CheckedRecordValueIndices.mkOff") && off == Off{0});
  ++rejections; CHECK(recover(zero));
  on.count = -1;
  CHECK(refused([&] { (void)true_bool_index(on); }, "Nat must be nonnegative")
    && on == On{-1});
  ++rejections; CHECK(recover(zero));
  zero.count = -1;
  CHECK(refused([&] { (void)zero_nat_index(zero); }, "Nat must be nonnegative")
    && zero == ZeroToken{-1});
  ++rejections; CHECK(recover(zero));

  ++calls; CHECK(produce_true_bool() == On{0});
  ++calls; CHECK(produce_false_bool() == Off{1});
  ++calls; CHECK(produce_ab() == Ab{2});
  Nat value = 23; ++calls; CHECK(produce_empty_string(value) == EmptyToken{23} && value == 23);
  value = 24; ++calls; CHECK(produce_unicode_string(value) == UnicodeToken{24} && value == 24);
  ++calls; CHECK(produce_empty_sized() == EmptySized{{}});
  value = 25; ++calls; CHECK(produce_zero_nat(value) == ZeroToken{25} && value == 25);
  ++calls; CHECK(produce_wide_nat(huge) == WideToken{huge} && wide == WideToken{huge});
  CHECK(calls == 28 && rejections == 6 && recoveries == 6);
  std::cout << "{\"calls\":" << calls << ",\"checks\":" << checks
    << ",\"recoveries\":" << recoveries << ",\"rejections\":" << rejections << "}\n";
  return 0;
}
