#include "glyphs.h"
#include <assert.h>
#include <stdio.h>
#include <string.h>

static unsigned checks;
#define CHECK(test) do { assert(test); ++checks; } while (0)
int main(void) {
  glyphs_error error = {0};
  uint32_t out = 0;
  for (uint32_t point = 0; point <= 0x110000; ++point) {
    int valid = point < 0x110000 && !(point >= 0xd800 && point <= 0xdfff);
    glyphs_status status = glyphs_keep(point, &out, &error);
    CHECK(valid ? status == 0 && out == point : status == 1);
  }
  const uint32_t points[] = {__POINTS__};
  const size_t n = sizeof(points) / sizeof(points[0]);
  glyphs_array_char_span values = {points, n, NULL, NULL};
  for (size_t i = 0; i < n; ++i) {
    CHECK(glyphs_point(points[i], &out, &error) == 0 && out == points[i]);
    CHECK(glyphs_choose(true, points[i], 65, &out, &error) == 0 && out == points[i]);
    CHECK(glyphs_choose(false, 65, points[i], &out, &error) == 0 && out == points[i]);
    glyphs_string text = {0};
    CHECK(glyphs_text(points[i], &text, &error) == 0 && text.length >= 1 && text.length <= 4);
    if (points[i] == 0) CHECK(text.length == 1 && text.data[0] == 0);
    if (points[i] == 0x1f331) CHECK(text.length == 4 && !memcmp(text.data, "\xf0\x9f\x8c\xb1", 4));
    glyphs_string_clear(&text);
    glyphs_label input = {points[i], values}, label = {0};
    CHECK(glyphs_keep_label(&input, &label, &error) == 0 && label.marker == points[i]);
    CHECK(label.line.length == n && !memcmp(label.line.data, points, sizeof(points)));
    glyphs_label_clear(&label);
  }
  CHECK(glyphs_sprout(&out, &error) == 0 && out == 0x1f331);
  uint32_t bad[] = {0xd800, 0xdfff, 0x110000, 0xffffffff};
  for (size_t i = 0; i < sizeof(bad) / sizeof(bad[0]); ++i) {
    glyphs_array_char_span invalid = {bad + i, 1, NULL, NULL}, result = {0};
    glyphs_label input = {bad[i], values}, label = {0};
    CHECK(glyphs_keep_label(&input, &label, &error) == 1);
    input.marker = 65; input.line = invalid;
    CHECK(glyphs_keep_label(&input, &label, &error) == 1);
    CHECK(glyphs_keep_array(&invalid, &result, &error) == 1);
    glyphs_array_array_char_span rows = {&invalid, 1, NULL, NULL}, kept = {0};
    CHECK(glyphs_keep_rows(&rows, &kept, &error) == 1);
    CHECK(glyphs_keep(65, &out, &error) == 0 && out == 65);
  }
  for (int i = 0; i < 1000; ++i) {
    glyphs_array_char_span empty = {0}, rows[] = {values, empty, values};
    glyphs_array_array_char_span input = {rows, 3, NULL, NULL}, out = {0};
    CHECK(glyphs_keep_rows(&input, &out, &error) == 0);
    CHECK(out.length == 3 && out.data[1].length == 0 && out.data[2].length == n);
    CHECK(!memcmp(out.data[0].data, points, sizeof(points)));
    glyphs_array_array_char_span_clear(&out);
  }
  printf("char-ok:%u\n", checks);
}
