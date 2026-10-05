#include "words.hpp"
#include <cassert>
#include <cstdio>
#include <type_traits>
namespace api = lean_bridge::words;
static unsigned checks;
#define CHECK(test) do { assert(test); ++checks; } while (0)
int main() {
  static_assert(std::is_same_v<decltype(api::keep_unsigned(0)), uint64_t>);
  static_assert(std::is_same_v<decltype(api::keep_signed(0)), int64_t>);
  CHECK(api::word_bits() == 64);
  const std::vector<uint64_t> us = {0, 1, UINT32_MAX, UINT64_C(9007199254740993), UINT64_MAX};
  const std::vector<int64_t> ss = {INT64_MIN, INT64_C(-9007199254740993), -1, 0, INT64_MAX};
  for (size_t i = 0; i < us.size(); ++i) {
    CHECK(api::keep_unsigned(us[i]) == us[i]);
    CHECK(api::keep_signed(ss[i]) == ss[i]);
    CHECK(api::unsigned_text(us[i]) == std::to_string(us[i]));
    CHECK(api::signed_text(ss[i]) == std::to_string(ss[i]));
    CHECK(api::advance_unsigned(us[i]) == us[i] + 1);
    CHECK(api::advance_signed(ss[i]) == (ss[i] == INT64_MAX ? INT64_MIN : ss[i] + 1));
  }
  for (int i = 0; i < 1000; ++i) {
    const auto out = api::keep_sample({UINT64_MAX, INT64_MIN, us, ss});
    CHECK(out.natural == UINT64_MAX && out.integer == INT64_MIN);
    CHECK(out.unsigned_values == us && out.signed_values == ss);
    CHECK(api::keep_unsigned_values(us) == us);
    CHECK(api::keep_signed_values(ss) == ss);
    CHECK(api::keep_unsigned_rows({us, {}}) == (std::vector<std::vector<uint64_t>>{us, {}}));
    CHECK(api::keep_signed_rows({ss, {}}) == (std::vector<std::vector<int64_t>>{ss, {}}));
  }
  std::printf("word-ok:%u\n", checks);
}
