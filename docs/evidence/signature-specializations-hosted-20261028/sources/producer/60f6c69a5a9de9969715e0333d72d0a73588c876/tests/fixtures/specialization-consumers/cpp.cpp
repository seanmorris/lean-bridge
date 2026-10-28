#include <specialized.hpp>
#include <cstdio>
#include <string>
#include <type_traits>
namespace api = lean_bridge::specialized;
static unsigned checks;
#define CHECK(test) do { if (!(test)) { std::fprintf(stderr, "failed at line %d: %s\n", __LINE__, #test); return 1; } ++checks; } while (0)

int main() {
  using Nat = api::Nat;
  // Each specialization is an ordinary concrete function; no template or type tag is exposed.
  static_assert(std::is_same_v<decltype(api::echo_word(0)), uint32_t>);
  static_assert(std::is_same_v<decltype(api::echo_text("")), std::string>);
  static_assert(std::is_same_v<decltype(api::choose_word(true, 0)), uint32_t>);
  const std::string greeting = "h\xc3\xa9llo \xf0\x9f\x99\x82";
  CHECK(api::echo_word(0) == 0 && api::echo_word(UINT32_MAX) == UINT32_MAX);
  CHECK(api::echo_text(greeting) == greeting && api::echo_text("").empty());
  const Nat large = Nat(1) << 200;
  CHECK(api::echo_nat(large) == large);
  const std::vector<uint32_t> words = {0, 42, UINT32_MAX};
  CHECK(api::echo_words(words) == words);
  CHECK(api::choose_word(true, 5) == 5 && api::choose_word(false, 5) == 37);
  CHECK(api::choose_text(true, greeting) == greeting && api::choose_text(false, greeting).empty());
  CHECK(api::choose_words(true, words) == words && api::choose_words(false, words).empty());
  CHECK(api::double_word(UINT32_C(2147483649)) == 2);
  CHECK(api::double_nat(Nat(1) << 100) == Nat(1) << 101);
  CHECK(api::first_text_word(greeting, 9) == greeting);
  CHECK(api::plain(1) == 4);
  for (uint32_t i = 0; i < 1000; ++i) {
    CHECK(api::choose_word(i % 2 == 0, i) == (i % 2 == 0 ? i : 37));
    CHECK(api::double_word(i) == 2 * i);
  }
  std::printf("specialization-ok:%u\n", checks);
  return 0;
}
