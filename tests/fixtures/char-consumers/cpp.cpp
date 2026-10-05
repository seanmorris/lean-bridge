#include "glyphs.hpp"
#include <cassert>
#include <cstdio>
#include <type_traits>
namespace api = lean_bridge::glyphs;
static unsigned checks;
#define CHECK(test) do { assert(test); ++checks; } while (0)
int main() {
  static_assert(std::is_same_v<decltype(api::keep(U'a')), char32_t>);
  const std::vector<char32_t> values = {__POINTS__};
  for (char32_t point : values) {
    CHECK(api::keep(point) == point);
    CHECK(api::point(point) == point);
    CHECK(api::choose(true, point, U'x') == point);
    CHECK(api::choose(false, U'x', point) == point);
    CHECK(api::text(point).size() >= 1 && api::text(point).size() <= 4);
    CHECK(api::keep_array(values) == values);
    api::Label label = api::keep_label({point, values});
    CHECK(label.marker == point && label.line == values);
    const std::vector<std::vector<char32_t>> rows = {values, {}, {point}};
    CHECK(api::keep_rows(rows) == rows);
  }
  CHECK(api::sprout() == U'🌱');
  CHECK(api::text(U'🌱') == "\xf0\x9f\x8c\xb1");
  CHECK(api::text(U'\0') == std::string(1, '\0'));
  for (char32_t bad : {char32_t(0xd800), char32_t(0xdfff), char32_t(0x110000), char32_t(0xffffffff)}) {
    for (int shape = 0; shape < 5; ++shape) {
      bool rejected = false;
      try {
        if (shape == 0) (void)api::keep(bad);
        if (shape == 1) (void)api::keep_array({U'a', bad});
        if (shape == 2) (void)api::keep_rows({{U'a'}, {bad}});
        if (shape == 3) (void)api::keep_label({bad, values});
        if (shape == 4) (void)api::keep_label({U'a', {bad}});
      } catch (const api::Error&) { rejected = true; }
      CHECK(rejected); CHECK(api::keep(U'🌱') == U'🌱');
    }
  }
  for (int i = 0; i < 1000; ++i) CHECK(api::keep_rows({values, values})[1] == values);
  std::printf("char-ok:%u\n", checks);
}
