#include <php.h>
#include <limits.h>
#include <Zend/zend_exceptions.h>
#include "nominalprimitivesubtypes.h"

_Static_assert(sizeof(zend_long) * CHAR_BIT == 32, "PHP integer width differs from the generated adapter");
_Static_assert(sizeof(bool) == sizeof(unsigned char), "Bool wire markers require one byte");
#if PHP_VERSION_ID < 80200 || PHP_VERSION_ID >= 90000
#error This adapter requires PHP 8.2 through 8.x
#endif
#ifdef ZTS
#error This adapter requires a non-thread-safe PHP runtime
#endif

#include <inttypes.h>
#include <limits.h>
#include <stdlib.h>
#include <string.h>

#ifndef LB_ZEND_CALLOC
#define LB_ZEND_CALLOC calloc
#endif
#ifndef LB_ZEND_FREE
#define LB_ZEND_FREE free
#endif

typedef struct lb_block { struct lb_block *next; void *data; } lb_block;
typedef struct {
  size_t remaining;
  lb_block *blocks;
  const char *error;
  int type_error;
} lb_scope;

static int lb_fail(lb_scope *s, const char *message, int type_error) {
  if (!s->error) { s->error = message; s->type_error = type_error; }
  return 0;
}
static int lb_charge(lb_scope *s, size_t count, size_t width) {
  if (!width || count > s->remaining / width)
    return lb_fail(s, "16 MiB Zend conversion limit exceeded", 0);
  s->remaining -= count * width;
  return 1;
}
static int lb_readable(lb_scope *s, const void *data, size_t count, size_t width, size_t alignment) {
  if (!count) return 1;
  if (!data || !width || !alignment || count > SIZE_MAX / width)
    return lb_fail(s, "Invalid native output buffer", 0);
  if ((uintptr_t)data % alignment)
    return lb_fail(s, "Misaligned native output buffer", 0);
#ifdef __wasm__
  if ((uint64_t)(uintptr_t)data + (uint64_t)count * width > (uint64_t)__builtin_wasm_memory_size(0) * 65536)
    return lb_fail(s, "Native output buffer exceeds Wasm memory", 0);
#endif
  return 1;
}
static void *lb_allocate(lb_scope *s, size_t count, size_t width) {
  if (!lb_charge(s, count ? count : 1, width) || !lb_charge(s, 1, sizeof(lb_block))) return NULL;
  lb_block *block = LB_ZEND_CALLOC(1, sizeof(*block));
  void *data = block ? LB_ZEND_CALLOC(count ? count : 1, width) : NULL;
  if (!data) { LB_ZEND_FREE(block); lb_fail(s, "Zend conversion allocation failed", 0); return NULL; }
  block->data = data; block->next = s->blocks; s->blocks = block;
  return data;
}
static void lb_scope_clear(lb_scope *s) {
  while (s->blocks) {
    lb_block *block = s->blocks; s->blocks = block->next;
    LB_ZEND_FREE(block->data); LB_ZEND_FREE(block);
  }
}
static int lb_utf8(const unsigned char *p, size_t n) {
  size_t i = 0;
  while (i < n) {
    unsigned a = p[i++], c = 0, minimum = 0, rest = 0;
    if (a < 128) continue;
    if (a >= 0xc2 && a <= 0xdf) { c = a & 31; minimum = 0x80; rest = 1; }
    else if (a >= 0xe0 && a <= 0xef) { c = a & 15; minimum = 0x800; rest = 2; }
    else if (a >= 0xf0 && a <= 0xf4) { c = a & 7; minimum = 0x10000; rest = 3; }
    else return 0;
    if (rest > n - i) return 0;
    while (rest--) { unsigned b = p[i++]; if ((b & 0xc0) != 0x80) return 0; c = (c << 6) | (b & 63); }
    if (c < minimum || c > 0x10ffff || (c >= 0xd800 && c <= 0xdfff)) return 0;
  }
  return 1;
}
static inline int lb_char_in(const unsigned char *text, size_t length, uint32_t *out) {
  if (!length || length > 4 || !lb_utf8(text, length)) return 0;
  size_t expected = text[0] < 128 ? 1 : text[0] < 0xe0 ? 2 : text[0] < 0xf0 ? 3 : 4;
  if (length != expected) return 0;
  uint32_t point = text[0] & (length == 1 ? 127 : length == 2 ? 31 : length == 3 ? 15 : 7);
  for (size_t i = 1; i < length; i++) point = (point << 6) | (text[i] & 63);
  *out = point; return 1;
}
static inline size_t lb_char_out(uint32_t point, char *text) {
  if (point < 128) { text[0] = (char)point; return 1; }
  size_t length = point < 0x800 ? 2 : point < 0x10000 ? 3 : 4;
  for (size_t i = length - 1; i > 0; i--) { text[i] = (char)(0x80 | (point & 63)); point >>= 6; }
  text[0] = (char)((length == 2 ? 0xc0 : length == 3 ? 0xe0 : 0xf0) | point); return length;
}
static int lb_decimal(zval *value, lb_scope *s, const char **digits, size_t *length, bool *negative) {
  if (Z_TYPE_P(value) != IS_STRING) return lb_fail(s, "Expected canonical decimal text", 1);
  const char *text = Z_STRVAL_P(value); size_t n = Z_STRLEN_P(value);
  if (!lb_charge(s, n, 1)) return 0;
  bool sign = n && text[0] == '-';
  if (sign) { text++; n--; }
  if (!n || n > 16384 || (text[0] == '0' && (n != 1 || sign)))
    return lb_fail(s, "Expected canonical decimal text of at most 16384 digits", 0);
  for (size_t i = 0; i < n; i++) if (text[i] < '0' || text[i] > '9')
    return lb_fail(s, "Expected canonical decimal text", 0);
  *digits = text; *length = n; *negative = sign; return 1;
}
static int lb_u64_in(zval *value, lb_scope *s, uint64_t *out, bool signed_value, unsigned bits) {
  const char *digits; size_t n; bool negative;
  if (!lb_decimal(value, s, &digits, &n, &negative)) return 0;
  if (negative && !signed_value) return lb_fail(s, "Expected an unsigned integer", 0);
  uint64_t limit = signed_value ? (negative ? UINT64_C(9223372036854775808) : INT64_MAX)
    : bits == 32 ? UINT32_MAX : UINT64_MAX;
  uint64_t magnitude = 0;
  for (size_t i = 0; i < n; i++) {
    unsigned digit = (unsigned)(digits[i] - '0');
    if (magnitude > (limit - digit) / 10) return lb_fail(s, "Integer is outside the declared Lean range", 0);
    magnitude = magnitude * 10 + digit;
  }
  *out = negative ? UINT64_C(0) - magnitude : magnitude; return 1;
}
static int lb_big_in(zval *value, lb_scope *s, uint32_t **out, size_t *length, bool *negative, bool signed_value) {
  const char *digits; size_t n; bool sign;
  if (!lb_decimal(value, s, &digits, &n, &sign)) return 0;
  if (sign && !signed_value) return lb_fail(s, "Expected an unsigned integer", 0);
  size_t capacity = n / 9 + 1, count = 0;
  uint32_t *words = lb_allocate(s, capacity, sizeof(uint32_t));
  if (!words) return 0;
  for (size_t offset = 0; offset < n;) {
    size_t width = (n - offset) % 9; if (!width) width = 9;
    uint64_t carry = 0, base = 1;
    for (size_t i = 0; i < width; i++) { carry = carry * 10 + (unsigned)(digits[offset++] - '0'); base *= 10; }
    for (size_t i = 0; i < count; i++) { uint64_t v = (uint64_t)words[i] * base + carry; words[i] = (uint32_t)v; carry = v >> 32; }
    if (carry) words[count++] = (uint32_t)carry;
  }
  *out = words; *length = count; *negative = sign; return 1;
}
static int lb_big_out(const uint32_t *words, size_t length, bool negative, zval *out, lb_scope *s) {
  if (length > 1701 || (!length && negative))
    return lb_fail(s, "Invalid or excessive big integer output", 0);
  if (!lb_readable(s, words, length, sizeof(*words), _Alignof(uint32_t))) return 0;
  if (length && !words[length - 1]) return lb_fail(s, "Noncanonical big integer output", 0);
  if (!lb_charge(s, length, sizeof(uint32_t))) return 0;
  uint32_t *chunks = lb_allocate(s, length * 2 + 1, sizeof(uint32_t));
  if (!chunks) return 0;
  size_t count = 0;
  for (size_t index = length; index > 0; index--) {
    uint64_t carry = words[index - 1];
    for (size_t i = 0; i < count; i++) {
      uint64_t v = (uint64_t)chunks[i] * UINT64_C(4294967296) + carry;
      chunks[i] = (uint32_t)(v % 1000000000); carry = v / 1000000000;
    }
    while (carry) { chunks[count++] = (uint32_t)(carry % 1000000000); carry /= 1000000000; }
  }
  size_t capacity = count * 9 + 2;
  char *text = lb_allocate(s, capacity, 1); if (!text) return 0;
  size_t used = negative ? 1 : 0; if (negative) text[0] = '-';
  used += (size_t)snprintf(text + used, capacity - used, "%" PRIu32, count ? chunks[--count] : 0);
  while (count) used += (size_t)snprintf(text + used, capacity - used, "%09" PRIu32, chunks[--count]);
  if (used - (negative ? 1 : 0) > 16384) return lb_fail(s, "BigInteger decimal conversion limit exceeded", 0);
  if (!lb_charge(s, used, 1)) return 0;
  ZVAL_STRINGL(out, text, used); return 1;
}

static int lb_to0(zval *value, uint8_t *out, lb_scope *s) {
  ZVAL_DEREF(value);
  if (!lb_charge(s, 1, 16)) return 0;
  if (Z_TYPE_P(value) != IS_NULL) return lb_fail(s, "Unit requires null", 1);
  *out = 0;
  return 1;
}
static int lb_from0(const uint8_t *value, zval *out, lb_scope *s) {
  if (!lb_charge(s, 1, 16)) return 0;
  if (*value != 0) return lb_fail(s, "Invalid native Unit marker", 0);
  ZVAL_NULL(out);
  return 1;
}

static int lb_to1(zval *value, bool *out, lb_scope *s) {
  ZVAL_DEREF(value);
  if (!lb_charge(s, 1, 16)) return 0;
  if (Z_TYPE_P(value) != IS_TRUE && Z_TYPE_P(value) != IS_FALSE) return lb_fail(s, "Bool requires bool", 1);
  *out = Z_TYPE_P(value) == IS_TRUE;
  return 1;
}
static int lb_from1(const bool *value, zval *out, lb_scope *s) {
  if (!lb_charge(s, 1, 16)) return 0;
  unsigned char raw; memcpy(&raw, value, sizeof(raw));
  if (raw > 1) return lb_fail(s, "Invalid native Bool marker", 0);
  ZVAL_BOOL(out, raw);
  return 1;
}

static int lb_to2(zval *value, uint8_t *out, lb_scope *s) {
  ZVAL_DEREF(value);
  if (!lb_charge(s, 1, 16)) return 0;
  if (Z_TYPE_P(value) != IS_LONG) return lb_fail(s, "Expected an int without numeric coercion", 1);
  if (Z_LVAL_P(value) < 0 || (uint64_t)Z_LVAL_P(value) > UINT8_MAX) return lb_fail(s, "Integer is outside the declared Lean range", 0);
  *out = (uint8_t)Z_LVAL_P(value);
  return 1;
}
static int lb_from2(const uint8_t *value, zval *out, lb_scope *s) {
  if (!lb_charge(s, 1, 16)) return 0;
  ZVAL_LONG(out, (zend_long)*value);
  return 1;
}

static int lb_to3(zval *value, uint16_t *out, lb_scope *s) {
  ZVAL_DEREF(value);
  if (!lb_charge(s, 1, 16)) return 0;
  if (Z_TYPE_P(value) != IS_LONG) return lb_fail(s, "Expected an int without numeric coercion", 1);
  if (Z_LVAL_P(value) < 0 || (uint64_t)Z_LVAL_P(value) > UINT16_MAX) return lb_fail(s, "Integer is outside the declared Lean range", 0);
  *out = (uint16_t)Z_LVAL_P(value);
  return 1;
}
static int lb_from3(const uint16_t *value, zval *out, lb_scope *s) {
  if (!lb_charge(s, 1, 16)) return 0;
  ZVAL_LONG(out, (zend_long)*value);
  return 1;
}

static int lb_to4(zval *value, uint32_t *out, lb_scope *s) {
  ZVAL_DEREF(value);
  if (!lb_charge(s, 1, 16)) return 0;
  uint64_t bits; if (!lb_u64_in(value, s, &bits, false, 32)) return 0;
  *out = (uint32_t)bits;
  return 1;
}
static int lb_from4(const uint32_t *value, zval *out, lb_scope *s) {
  if (!lb_charge(s, 1, 16)) return 0;
  char text[32]; int length = snprintf(text, sizeof(text), "%" PRIu64, (uint64_t)*value);
  ZVAL_STRINGL(out, text, (size_t)length);
  return 1;
}

static int lb_to5(zval *value, uint64_t *out, lb_scope *s) {
  ZVAL_DEREF(value);
  if (!lb_charge(s, 1, 16)) return 0;
  uint64_t bits; if (!lb_u64_in(value, s, &bits, false, 64)) return 0;
  *out = (uint64_t)bits;
  return 1;
}
static int lb_from5(const uint64_t *value, zval *out, lb_scope *s) {
  if (!lb_charge(s, 1, 16)) return 0;
  char text[32]; int length = snprintf(text, sizeof(text), "%" PRIu64, (uint64_t)*value);
  ZVAL_STRINGL(out, text, (size_t)length);
  return 1;
}

static int lb_to6(zval *value, int8_t *out, lb_scope *s) {
  ZVAL_DEREF(value);
  if (!lb_charge(s, 1, 16)) return 0;
  if (Z_TYPE_P(value) != IS_LONG) return lb_fail(s, "Expected an int without numeric coercion", 1);
  if (Z_LVAL_P(value) < INT8_MIN || Z_LVAL_P(value) > INT8_MAX) return lb_fail(s, "Integer is outside the declared Lean range", 0);
  *out = (int8_t)Z_LVAL_P(value);
  return 1;
}
static int lb_from6(const int8_t *value, zval *out, lb_scope *s) {
  if (!lb_charge(s, 1, 16)) return 0;
  ZVAL_LONG(out, (zend_long)*value);
  return 1;
}

static int lb_to7(zval *value, int16_t *out, lb_scope *s) {
  ZVAL_DEREF(value);
  if (!lb_charge(s, 1, 16)) return 0;
  if (Z_TYPE_P(value) != IS_LONG) return lb_fail(s, "Expected an int without numeric coercion", 1);
  if (Z_LVAL_P(value) < INT16_MIN || Z_LVAL_P(value) > INT16_MAX) return lb_fail(s, "Integer is outside the declared Lean range", 0);
  *out = (int16_t)Z_LVAL_P(value);
  return 1;
}
static int lb_from7(const int16_t *value, zval *out, lb_scope *s) {
  if (!lb_charge(s, 1, 16)) return 0;
  ZVAL_LONG(out, (zend_long)*value);
  return 1;
}

static int lb_to8(zval *value, int32_t *out, lb_scope *s) {
  ZVAL_DEREF(value);
  if (!lb_charge(s, 1, 16)) return 0;
  if (Z_TYPE_P(value) != IS_LONG) return lb_fail(s, "Expected an int without numeric coercion", 1);
  if ((int64_t)Z_LVAL_P(value) < INT32_MIN || (int64_t)Z_LVAL_P(value) > INT32_MAX) return lb_fail(s, "Integer is outside the declared Lean range", 0);
  *out = (int32_t)Z_LVAL_P(value);
  return 1;
}
static int lb_from8(const int32_t *value, zval *out, lb_scope *s) {
  if (!lb_charge(s, 1, 16)) return 0;
  ZVAL_LONG(out, (zend_long)*value);
  return 1;
}

static int lb_to9(zval *value, int64_t *out, lb_scope *s) {
  ZVAL_DEREF(value);
  if (!lb_charge(s, 1, 16)) return 0;
  uint64_t bits; if (!lb_u64_in(value, s, &bits, true, 64)) return 0;
  memcpy(out, &bits, sizeof(bits));
  return 1;
}
static int lb_from9(const int64_t *value, zval *out, lb_scope *s) {
  if (!lb_charge(s, 1, 16)) return 0;
  char text[32]; int length = snprintf(text, sizeof(text), "%" PRId64, (int64_t)*value);
  ZVAL_STRINGL(out, text, (size_t)length);
  return 1;
}

static int lb_to10(zval *value, nominalprimitivesubtypes_nat *out, lb_scope *s) {
  ZVAL_DEREF(value);
  if (!lb_charge(s, 1, 16)) return 0;
  uint32_t *words; bool negative; if (!lb_big_in(value, s, &words, &out->length, &negative, false)) return 0;
  out->data = words;
  return 1;
}
static int lb_from10(const nominalprimitivesubtypes_nat *value, zval *out, lb_scope *s) {
  if (!lb_charge(s, 1, 16)) return 0;
  return lb_big_out(value->data, value->length, false, out, s);
  return 1;
}

static int lb_to11(zval *value, nominalprimitivesubtypes_int *out, lb_scope *s) {
  ZVAL_DEREF(value);
  if (!lb_charge(s, 1, 16)) return 0;
  uint32_t *words; bool negative; if (!lb_big_in(value, s, &words, &out->length, &negative, true)) return 0;
  out->data = words;
  out->negative = negative;
  return 1;
}
static int lb_from11(const nominalprimitivesubtypes_int *value, zval *out, lb_scope *s) {
  if (!lb_charge(s, 1, 16)) return 0;
  unsigned char negative; memcpy(&negative, &value->negative, sizeof(negative));
  if (negative > 1) return lb_fail(s, "Invalid native integer sign", 0);
  return lb_big_out(value->data, value->length, negative, out, s);
  return 1;
}

static int lb_to12(zval *value, float *out, lb_scope *s) {
  ZVAL_DEREF(value);
  if (!lb_charge(s, 1, 16)) return 0;
  if (Z_TYPE_P(value) != IS_DOUBLE) return lb_fail(s, "Expected a float without numeric coercion", 1);
  *out = (float)Z_DVAL_P(value);
  return 1;
}
static int lb_from12(const float *value, zval *out, lb_scope *s) {
  if (!lb_charge(s, 1, 16)) return 0;
  ZVAL_DOUBLE(out, (double)*value);
  return 1;
}

static int lb_to13(zval *value, double *out, lb_scope *s) {
  ZVAL_DEREF(value);
  if (!lb_charge(s, 1, 16)) return 0;
  if (Z_TYPE_P(value) != IS_DOUBLE) return lb_fail(s, "Expected a float without numeric coercion", 1);
  *out = (double)Z_DVAL_P(value);
  return 1;
}
static int lb_from13(const double *value, zval *out, lb_scope *s) {
  if (!lb_charge(s, 1, 16)) return 0;
  ZVAL_DOUBLE(out, (double)*value);
  return 1;
}

static int lb_to14(zval *value, nominalprimitivesubtypes_string *out, lb_scope *s) {
  ZVAL_DEREF(value);
  if (!lb_charge(s, 1, 16)) return 0;
  if (Z_TYPE_P(value) != IS_STRING) return lb_fail(s, "Expected string bytes", 1);
  if (!lb_charge(s, Z_STRLEN_P(value), 1)) return 0;
  if (!lb_utf8((const unsigned char *)Z_STRVAL_P(value), Z_STRLEN_P(value))) return lb_fail(s, "String requires valid UTF-8", 0);
  out->data = (const char *)Z_STRVAL_P(value); out->length = Z_STRLEN_P(value);
  return 1;
}
static int lb_from14(const nominalprimitivesubtypes_string *value, zval *out, lb_scope *s) {
  if (!lb_charge(s, 1, 16)) return 0;
  if (!lb_charge(s, value->length, 1) || (value->length && !value->data)) return lb_fail(s, "Invalid string buffer", 0);
  if (!lb_readable(s, value->data, value->length, 1, 1)) return 0;
  if (!lb_utf8((const unsigned char *)value->data, value->length)) return lb_fail(s, "Native string is not valid UTF-8", 0);
  ZVAL_STRINGL(out, value->length ? (const char *)value->data : "", value->length);
  return 1;
}

static int lb_to15(zval *value, nominalprimitivesubtypes_bytes *out, lb_scope *s) {
  ZVAL_DEREF(value);
  if (!lb_charge(s, 1, 16)) return 0;
  if (Z_TYPE_P(value) != IS_STRING) return lb_fail(s, "Expected string bytes", 1);
  if (!lb_charge(s, Z_STRLEN_P(value), 1)) return 0;
  out->data = (const uint8_t *)Z_STRVAL_P(value); out->length = Z_STRLEN_P(value);
  return 1;
}
static int lb_from15(const nominalprimitivesubtypes_bytes *value, zval *out, lb_scope *s) {
  if (!lb_charge(s, 1, 16)) return 0;
  if (!lb_charge(s, value->length, 1) || (value->length && !value->data)) return lb_fail(s, "Invalid string buffer", 0);
  if (!lb_readable(s, value->data, value->length, 1, 1)) return 0;
  ZVAL_STRINGL(out, value->length ? (const char *)value->data : "", value->length);
  return 1;
}

static int lb_to16(zval *value, uint32_t *out, lb_scope *s) {
  ZVAL_DEREF(value);
  if (!lb_charge(s, 1, 16)) return 0;
  if (Z_TYPE_P(value) != IS_STRING) return lb_fail(s, "Char requires a string", 1);
  if (!lb_char_in((const unsigned char *)Z_STRVAL_P(value), Z_STRLEN_P(value), out)) return lb_fail(s, "Char requires one Unicode scalar", 0);
  return 1;
}
static int lb_from16(const uint32_t *value, zval *out, lb_scope *s) {
  if (!lb_charge(s, 1, 16)) return 0;
  if (*value > 0x10ffff || (*value >= 0xd800 && *value <= 0xdfff)) return lb_fail(s, "Invalid native Unicode scalar", 0);
  char text[4]; size_t length = lb_char_out(*value, text);
  ZVAL_STRINGL(out, text, length);
  return 1;
}

static int lb_to17(zval *value, uint64_t *out, lb_scope *s) {
  ZVAL_DEREF(value);
  if (!lb_charge(s, 1, 16)) return 0;
  uint64_t bits; if (!lb_u64_in(value, s, &bits, false, 32)) return 0;
  *out = (uint64_t)bits;
  return 1;
}
static int lb_from17(const uint64_t *value, zval *out, lb_scope *s) {
  if (!lb_charge(s, 1, 16)) return 0;
  char text[32]; int length = snprintf(text, sizeof(text), "%" PRIu64, (uint64_t)*value);
  ZVAL_STRINGL(out, text, (size_t)length);
  return 1;
}

static int lb_to18(zval *value, int64_t *out, lb_scope *s) {
  ZVAL_DEREF(value);
  if (!lb_charge(s, 1, 16)) return 0;
  if (Z_TYPE_P(value) != IS_LONG) return lb_fail(s, "Expected an int without numeric coercion", 1);
  if ((int64_t)Z_LVAL_P(value) < INT32_MIN || (int64_t)Z_LVAL_P(value) > INT32_MAX) return lb_fail(s, "Integer is outside the declared Lean range", 0);
  *out = (int64_t)Z_LVAL_P(value);
  return 1;
}
static int lb_from18(const int64_t *value, zval *out, lb_scope *s) {
  if (!lb_charge(s, 1, 16)) return 0;
  ZVAL_LONG(out, (zend_long)*value);
  return 1;
}

static int lb_to19(zval *value, nominalprimitivesubtypes_raw_packet *out, lb_scope *s) {
  ZVAL_DEREF(value);
  if (!lb_charge(s, 1, 16)) return 0;
  if (Z_TYPE_P(value) != IS_ARRAY || !zend_array_is_list(Z_ARRVAL_P(value))) return lb_fail(s, "Expected a consecutive-key wire list", 1);
  if (zend_hash_num_elements(Z_ARRVAL_P(value)) != 20) return lb_fail(s, "Record wire field count differs", 0);
  if (!lb_to0(zend_hash_index_find(Z_ARRVAL_P(value), 0), &out->unit_value, s)) return 0;
  if (!lb_to1(zend_hash_index_find(Z_ARRVAL_P(value), 1), &out->bool_value, s)) return 0;
  if (!lb_to2(zend_hash_index_find(Z_ARRVAL_P(value), 2), &out->uint8_value, s)) return 0;
  if (!lb_to3(zend_hash_index_find(Z_ARRVAL_P(value), 3), &out->uint16_value, s)) return 0;
  if (!lb_to4(zend_hash_index_find(Z_ARRVAL_P(value), 4), &out->uint32_value, s)) return 0;
  if (!lb_to5(zend_hash_index_find(Z_ARRVAL_P(value), 5), &out->uint64_value, s)) return 0;
  if (!lb_to6(zend_hash_index_find(Z_ARRVAL_P(value), 6), &out->int8_value, s)) return 0;
  if (!lb_to7(zend_hash_index_find(Z_ARRVAL_P(value), 7), &out->int16_value, s)) return 0;
  if (!lb_to8(zend_hash_index_find(Z_ARRVAL_P(value), 8), &out->int32_value, s)) return 0;
  if (!lb_to9(zend_hash_index_find(Z_ARRVAL_P(value), 9), &out->int64_value, s)) return 0;
  if (!lb_to10(zend_hash_index_find(Z_ARRVAL_P(value), 10), &out->nat_value, s)) return 0;
  if (!lb_to11(zend_hash_index_find(Z_ARRVAL_P(value), 11), &out->int_value, s)) return 0;
  if (!lb_to12(zend_hash_index_find(Z_ARRVAL_P(value), 12), &out->float32_value, s)) return 0;
  if (!lb_to13(zend_hash_index_find(Z_ARRVAL_P(value), 13), &out->float64_value, s)) return 0;
  if (!lb_to14(zend_hash_index_find(Z_ARRVAL_P(value), 14), &out->text_value, s)) return 0;
  if (!lb_to15(zend_hash_index_find(Z_ARRVAL_P(value), 15), &out->bytes_value, s)) return 0;
  if (!lb_to16(zend_hash_index_find(Z_ARRVAL_P(value), 16), &out->char_value, s)) return 0;
  if (!lb_to17(zend_hash_index_find(Z_ARRVAL_P(value), 17), &out->usize_value, s)) return 0;
  if (!lb_to18(zend_hash_index_find(Z_ARRVAL_P(value), 18), &out->isize_value, s)) return 0;
  if (!lb_to10(zend_hash_index_find(Z_ARRVAL_P(value), 19), &out->digit, s)) return 0;
  return 1;
}
static int lb_from19(const nominalprimitivesubtypes_raw_packet *value, zval *out, lb_scope *s) {
  if (!lb_charge(s, 1, 16)) return 0;
  if (!lb_charge(s, 20, 32)) return 0;
  array_init_size(out, 20);
  zval item0; ZVAL_NULL(&item0);
  if (!lb_from0(&value->unit_value, &item0, s)) { zval_ptr_dtor(&item0); return 0; }
  add_next_index_zval(out, &item0);
  zval item1; ZVAL_NULL(&item1);
  if (!lb_from1(&value->bool_value, &item1, s)) { zval_ptr_dtor(&item1); return 0; }
  add_next_index_zval(out, &item1);
  zval item2; ZVAL_NULL(&item2);
  if (!lb_from2(&value->uint8_value, &item2, s)) { zval_ptr_dtor(&item2); return 0; }
  add_next_index_zval(out, &item2);
  zval item3; ZVAL_NULL(&item3);
  if (!lb_from3(&value->uint16_value, &item3, s)) { zval_ptr_dtor(&item3); return 0; }
  add_next_index_zval(out, &item3);
  zval item4; ZVAL_NULL(&item4);
  if (!lb_from4(&value->uint32_value, &item4, s)) { zval_ptr_dtor(&item4); return 0; }
  add_next_index_zval(out, &item4);
  zval item5; ZVAL_NULL(&item5);
  if (!lb_from5(&value->uint64_value, &item5, s)) { zval_ptr_dtor(&item5); return 0; }
  add_next_index_zval(out, &item5);
  zval item6; ZVAL_NULL(&item6);
  if (!lb_from6(&value->int8_value, &item6, s)) { zval_ptr_dtor(&item6); return 0; }
  add_next_index_zval(out, &item6);
  zval item7; ZVAL_NULL(&item7);
  if (!lb_from7(&value->int16_value, &item7, s)) { zval_ptr_dtor(&item7); return 0; }
  add_next_index_zval(out, &item7);
  zval item8; ZVAL_NULL(&item8);
  if (!lb_from8(&value->int32_value, &item8, s)) { zval_ptr_dtor(&item8); return 0; }
  add_next_index_zval(out, &item8);
  zval item9; ZVAL_NULL(&item9);
  if (!lb_from9(&value->int64_value, &item9, s)) { zval_ptr_dtor(&item9); return 0; }
  add_next_index_zval(out, &item9);
  zval item10; ZVAL_NULL(&item10);
  if (!lb_from10(&value->nat_value, &item10, s)) { zval_ptr_dtor(&item10); return 0; }
  add_next_index_zval(out, &item10);
  zval item11; ZVAL_NULL(&item11);
  if (!lb_from11(&value->int_value, &item11, s)) { zval_ptr_dtor(&item11); return 0; }
  add_next_index_zval(out, &item11);
  zval item12; ZVAL_NULL(&item12);
  if (!lb_from12(&value->float32_value, &item12, s)) { zval_ptr_dtor(&item12); return 0; }
  add_next_index_zval(out, &item12);
  zval item13; ZVAL_NULL(&item13);
  if (!lb_from13(&value->float64_value, &item13, s)) { zval_ptr_dtor(&item13); return 0; }
  add_next_index_zval(out, &item13);
  zval item14; ZVAL_NULL(&item14);
  if (!lb_from14(&value->text_value, &item14, s)) { zval_ptr_dtor(&item14); return 0; }
  add_next_index_zval(out, &item14);
  zval item15; ZVAL_NULL(&item15);
  if (!lb_from15(&value->bytes_value, &item15, s)) { zval_ptr_dtor(&item15); return 0; }
  add_next_index_zval(out, &item15);
  zval item16; ZVAL_NULL(&item16);
  if (!lb_from16(&value->char_value, &item16, s)) { zval_ptr_dtor(&item16); return 0; }
  add_next_index_zval(out, &item16);
  zval item17; ZVAL_NULL(&item17);
  if (!lb_from17(&value->usize_value, &item17, s)) { zval_ptr_dtor(&item17); return 0; }
  add_next_index_zval(out, &item17);
  zval item18; ZVAL_NULL(&item18);
  if (!lb_from18(&value->isize_value, &item18, s)) { zval_ptr_dtor(&item18); return 0; }
  add_next_index_zval(out, &item18);
  zval item19; ZVAL_NULL(&item19);
  if (!lb_from10(&value->digit, &item19, s)) { zval_ptr_dtor(&item19); return 0; }
  add_next_index_zval(out, &item19);
  return 1;
}

static int lb_to20(zval *value, nominalprimitivesubtypes_packet *out, lb_scope *s) {
  ZVAL_DEREF(value);
  if (!lb_charge(s, 1, 16)) return 0;
  if (Z_TYPE_P(value) != IS_ARRAY || !zend_array_is_list(Z_ARRVAL_P(value))) return lb_fail(s, "Expected a consecutive-key wire list", 1);
  if (zend_hash_num_elements(Z_ARRVAL_P(value)) != 20) return lb_fail(s, "Record wire field count differs", 0);
  if (!lb_to0(zend_hash_index_find(Z_ARRVAL_P(value), 0), &out->unit_value, s)) return 0;
  if (!lb_to1(zend_hash_index_find(Z_ARRVAL_P(value), 1), &out->bool_value, s)) return 0;
  if (!lb_to2(zend_hash_index_find(Z_ARRVAL_P(value), 2), &out->uint8_value, s)) return 0;
  if (!lb_to3(zend_hash_index_find(Z_ARRVAL_P(value), 3), &out->uint16_value, s)) return 0;
  if (!lb_to4(zend_hash_index_find(Z_ARRVAL_P(value), 4), &out->uint32_value, s)) return 0;
  if (!lb_to5(zend_hash_index_find(Z_ARRVAL_P(value), 5), &out->uint64_value, s)) return 0;
  if (!lb_to6(zend_hash_index_find(Z_ARRVAL_P(value), 6), &out->int8_value, s)) return 0;
  if (!lb_to7(zend_hash_index_find(Z_ARRVAL_P(value), 7), &out->int16_value, s)) return 0;
  if (!lb_to8(zend_hash_index_find(Z_ARRVAL_P(value), 8), &out->int32_value, s)) return 0;
  if (!lb_to9(zend_hash_index_find(Z_ARRVAL_P(value), 9), &out->int64_value, s)) return 0;
  if (!lb_to10(zend_hash_index_find(Z_ARRVAL_P(value), 10), &out->nat_value, s)) return 0;
  if (!lb_to11(zend_hash_index_find(Z_ARRVAL_P(value), 11), &out->int_value, s)) return 0;
  if (!lb_to12(zend_hash_index_find(Z_ARRVAL_P(value), 12), &out->float32_value, s)) return 0;
  if (!lb_to13(zend_hash_index_find(Z_ARRVAL_P(value), 13), &out->float64_value, s)) return 0;
  if (!lb_to14(zend_hash_index_find(Z_ARRVAL_P(value), 14), &out->text_value, s)) return 0;
  if (!lb_to15(zend_hash_index_find(Z_ARRVAL_P(value), 15), &out->bytes_value, s)) return 0;
  if (!lb_to16(zend_hash_index_find(Z_ARRVAL_P(value), 16), &out->char_value, s)) return 0;
  if (!lb_to17(zend_hash_index_find(Z_ARRVAL_P(value), 17), &out->usize_value, s)) return 0;
  if (!lb_to18(zend_hash_index_find(Z_ARRVAL_P(value), 18), &out->isize_value, s)) return 0;
  if (!lb_to10(zend_hash_index_find(Z_ARRVAL_P(value), 19), &out->digit, s)) return 0;
  return 1;
}
static int lb_from20(const nominalprimitivesubtypes_packet *value, zval *out, lb_scope *s) {
  if (!lb_charge(s, 1, 16)) return 0;
  if (!lb_charge(s, 20, 32)) return 0;
  array_init_size(out, 20);
  zval item0; ZVAL_NULL(&item0);
  if (!lb_from0(&value->unit_value, &item0, s)) { zval_ptr_dtor(&item0); return 0; }
  add_next_index_zval(out, &item0);
  zval item1; ZVAL_NULL(&item1);
  if (!lb_from1(&value->bool_value, &item1, s)) { zval_ptr_dtor(&item1); return 0; }
  add_next_index_zval(out, &item1);
  zval item2; ZVAL_NULL(&item2);
  if (!lb_from2(&value->uint8_value, &item2, s)) { zval_ptr_dtor(&item2); return 0; }
  add_next_index_zval(out, &item2);
  zval item3; ZVAL_NULL(&item3);
  if (!lb_from3(&value->uint16_value, &item3, s)) { zval_ptr_dtor(&item3); return 0; }
  add_next_index_zval(out, &item3);
  zval item4; ZVAL_NULL(&item4);
  if (!lb_from4(&value->uint32_value, &item4, s)) { zval_ptr_dtor(&item4); return 0; }
  add_next_index_zval(out, &item4);
  zval item5; ZVAL_NULL(&item5);
  if (!lb_from5(&value->uint64_value, &item5, s)) { zval_ptr_dtor(&item5); return 0; }
  add_next_index_zval(out, &item5);
  zval item6; ZVAL_NULL(&item6);
  if (!lb_from6(&value->int8_value, &item6, s)) { zval_ptr_dtor(&item6); return 0; }
  add_next_index_zval(out, &item6);
  zval item7; ZVAL_NULL(&item7);
  if (!lb_from7(&value->int16_value, &item7, s)) { zval_ptr_dtor(&item7); return 0; }
  add_next_index_zval(out, &item7);
  zval item8; ZVAL_NULL(&item8);
  if (!lb_from8(&value->int32_value, &item8, s)) { zval_ptr_dtor(&item8); return 0; }
  add_next_index_zval(out, &item8);
  zval item9; ZVAL_NULL(&item9);
  if (!lb_from9(&value->int64_value, &item9, s)) { zval_ptr_dtor(&item9); return 0; }
  add_next_index_zval(out, &item9);
  zval item10; ZVAL_NULL(&item10);
  if (!lb_from10(&value->nat_value, &item10, s)) { zval_ptr_dtor(&item10); return 0; }
  add_next_index_zval(out, &item10);
  zval item11; ZVAL_NULL(&item11);
  if (!lb_from11(&value->int_value, &item11, s)) { zval_ptr_dtor(&item11); return 0; }
  add_next_index_zval(out, &item11);
  zval item12; ZVAL_NULL(&item12);
  if (!lb_from12(&value->float32_value, &item12, s)) { zval_ptr_dtor(&item12); return 0; }
  add_next_index_zval(out, &item12);
  zval item13; ZVAL_NULL(&item13);
  if (!lb_from13(&value->float64_value, &item13, s)) { zval_ptr_dtor(&item13); return 0; }
  add_next_index_zval(out, &item13);
  zval item14; ZVAL_NULL(&item14);
  if (!lb_from14(&value->text_value, &item14, s)) { zval_ptr_dtor(&item14); return 0; }
  add_next_index_zval(out, &item14);
  zval item15; ZVAL_NULL(&item15);
  if (!lb_from15(&value->bytes_value, &item15, s)) { zval_ptr_dtor(&item15); return 0; }
  add_next_index_zval(out, &item15);
  zval item16; ZVAL_NULL(&item16);
  if (!lb_from16(&value->char_value, &item16, s)) { zval_ptr_dtor(&item16); return 0; }
  add_next_index_zval(out, &item16);
  zval item17; ZVAL_NULL(&item17);
  if (!lb_from17(&value->usize_value, &item17, s)) { zval_ptr_dtor(&item17); return 0; }
  add_next_index_zval(out, &item17);
  zval item18; ZVAL_NULL(&item18);
  if (!lb_from18(&value->isize_value, &item18, s)) { zval_ptr_dtor(&item18); return 0; }
  add_next_index_zval(out, &item18);
  zval item19; ZVAL_NULL(&item19);
  if (!lb_from10(&value->digit, &item19, s)) { zval_ptr_dtor(&item19); return 0; }
  add_next_index_zval(out, &item19);
  return 1;
}

static int lb_to21(zval *value, nominalprimitivesubtypes_option_lean_nominal_primitive_subtypes_packet_value *out, lb_scope *s) {
  ZVAL_DEREF(value);
  if (!lb_charge(s, 1, 16)) return 0;
  if (Z_TYPE_P(value) == IS_NULL) { out->has_value = 0; return 1; }
  if (Z_TYPE_P(value) != IS_ARRAY || !zend_array_is_list(Z_ARRVAL_P(value)) || zend_hash_num_elements(Z_ARRVAL_P(value)) != 1) return lb_fail(s, "Option wire requires null or one payload", 1);
  if (!lb_charge(s, 1, 32)) return 0;
  out->has_value = 1;
  if (!lb_to20(zend_hash_index_find(Z_ARRVAL_P(value), 0), &out->value, s)) return 0;
  return 1;
}
static int lb_from21(const nominalprimitivesubtypes_option_lean_nominal_primitive_subtypes_packet_value *value, zval *out, lb_scope *s) {
  if (!lb_charge(s, 1, 16)) return 0;
  if (value->has_value > 1) return lb_fail(s, "Invalid native Option flag", 0);
  if (!value->has_value) { ZVAL_NULL(out); return 1; }
  if (!lb_charge(s, 1, 32)) return 0;
  array_init_size(out, 1);
  zval item; ZVAL_NULL(&item);
  if (!lb_from20(&value->value, &item, s)) { zval_ptr_dtor(&item); return 0; }
  add_next_index_zval(out, &item);
  return 1;
}

static int lb_to22(zval *value, nominalprimitivesubtypes_result_lean_nominal_primitive_subtypes_packet_lean_nominal_primitive_subtypes_packet_value *out, lb_scope *s) {
  ZVAL_DEREF(value);
  if (!lb_charge(s, 1, 16)) return 0;
  if (Z_TYPE_P(value) != IS_ARRAY || !zend_array_is_list(Z_ARRVAL_P(value)) || zend_hash_num_elements(Z_ARRVAL_P(value)) != 2) return lb_fail(s, "Except wire requires a tag and payload", 1);
  if (!lb_charge(s, 2, 32)) return 0;
  zval *tag = zend_hash_index_find(Z_ARRVAL_P(value), 0); ZVAL_DEREF(tag);
  if (Z_TYPE_P(tag) != IS_TRUE && Z_TYPE_P(tag) != IS_FALSE) return lb_fail(s, "Except wire tag requires bool", 1);
  out->is_ok = Z_TYPE_P(tag) == IS_TRUE;
  zval *payload = zend_hash_index_find(Z_ARRVAL_P(value), 1);
  return out->is_ok ? lb_to20(payload, &out->ok, s) : lb_to20(payload, &out->error, s);
  return 1;
}
static int lb_from22(const nominalprimitivesubtypes_result_lean_nominal_primitive_subtypes_packet_lean_nominal_primitive_subtypes_packet_value *value, zval *out, lb_scope *s) {
  if (!lb_charge(s, 1, 16)) return 0;
  if (value->is_ok > 1) return lb_fail(s, "Invalid native Except flag", 0);
  if (!lb_charge(s, 2, 32)) return 0;
  array_init_size(out, 2);
  add_next_index_bool(out, value->is_ok);
  zval item; ZVAL_NULL(&item);
  int valid = value->is_ok ? lb_from20(&value->ok, &item, s) : lb_from20(&value->error, &item, s);
  if (!valid) { zval_ptr_dtor(&item); return 0; }
  add_next_index_zval(out, &item);
  return 1;
}

static int lb_to23(zval *value, nominalprimitivesubtypes_option_result_lean_nominal_primitive_subtypes_packet_lean_nominal_primitive_subtypes_packet_value *out, lb_scope *s) {
  ZVAL_DEREF(value);
  if (!lb_charge(s, 1, 16)) return 0;
  if (Z_TYPE_P(value) == IS_NULL) { out->has_value = 0; return 1; }
  if (Z_TYPE_P(value) != IS_ARRAY || !zend_array_is_list(Z_ARRVAL_P(value)) || zend_hash_num_elements(Z_ARRVAL_P(value)) != 1) return lb_fail(s, "Option wire requires null or one payload", 1);
  if (!lb_charge(s, 1, 32)) return 0;
  out->has_value = 1;
  if (!lb_to22(zend_hash_index_find(Z_ARRVAL_P(value), 0), &out->value, s)) return 0;
  return 1;
}
static int lb_from23(const nominalprimitivesubtypes_option_result_lean_nominal_primitive_subtypes_packet_lean_nominal_primitive_subtypes_packet_value *value, zval *out, lb_scope *s) {
  if (!lb_charge(s, 1, 16)) return 0;
  if (value->has_value > 1) return lb_fail(s, "Invalid native Option flag", 0);
  if (!value->has_value) { ZVAL_NULL(out); return 1; }
  if (!lb_charge(s, 1, 32)) return 0;
  array_init_size(out, 1);
  zval item; ZVAL_NULL(&item);
  if (!lb_from22(&value->value, &item, s)) { zval_ptr_dtor(&item); return 0; }
  add_next_index_zval(out, &item);
  return 1;
}

static int lb_to24(zval *value, nominalprimitivesubtypes_array_option_result_lean_nominal_primitive_subtypes_packet_lean_nominal_primitive_subtypes_packet_span *out, lb_scope *s) {
  ZVAL_DEREF(value);
  if (!lb_charge(s, 1, 16)) return 0;
  if (Z_TYPE_P(value) != IS_ARRAY || !zend_array_is_list(Z_ARRVAL_P(value))) return lb_fail(s, "Expected a consecutive-key wire list", 1);
  size_t count = zend_hash_num_elements(Z_ARRVAL_P(value));
  if (!lb_charge(s, count, 32)) return 0;
  nominalprimitivesubtypes_option_result_lean_nominal_primitive_subtypes_packet_lean_nominal_primitive_subtypes_packet_value *data = lb_allocate(s, count, sizeof(*data)); if (!data) return 0;
  out->data = data; out->length = count;
  for (size_t i = 0; i < count; i++) if (!lb_to23(zend_hash_index_find(Z_ARRVAL_P(value), i), &data[i], s)) return 0;
  return 1;
}
static int lb_from24(const nominalprimitivesubtypes_array_option_result_lean_nominal_primitive_subtypes_packet_lean_nominal_primitive_subtypes_packet_span *value, zval *out, lb_scope *s) {
  if (!lb_charge(s, 1, 16)) return 0;
  if (!lb_charge(s, value->length, 32) || (value->length && !value->data)) return lb_fail(s, "Invalid array output", 0);
  if (value->length && (uintptr_t)value->data % _Alignof(nominalprimitivesubtypes_option_result_lean_nominal_primitive_subtypes_packet_lean_nominal_primitive_subtypes_packet_value)) return lb_fail(s, "Misaligned sequence output", 0);
  #ifdef __wasm__
  if (value->length && ((uint64_t)(uintptr_t)value->data + (uint64_t)value->length * sizeof(*value->data) > (uint64_t)__builtin_wasm_memory_size(0) * 65536)) return lb_fail(s, "Sequence output exceeds Wasm memory", 0);
  #endif
  array_init_size(out, (uint32_t)value->length);
  for (size_t i = 0; i < value->length; i++) {
    zval item; ZVAL_NULL(&item);
    if (!lb_from23(&value->data[i], &item, s)) { zval_ptr_dtor(&item); return 0; }
    add_next_index_zval(out, &item);
  }
  return 1;
}

static int lb_to25(zval *value, nominalprimitivesubtypes_event *out, lb_scope *s) {
  ZVAL_DEREF(value);
  if (!lb_charge(s, 1, 16)) return 0;
  if (Z_TYPE_P(value) != IS_ARRAY || !zend_array_is_list(Z_ARRVAL_P(value)) || zend_hash_num_elements(Z_ARRVAL_P(value)) < 1) return lb_fail(s, "Variant wire requires a constructor tag and fields", 1);
  zval *tag = zend_hash_index_find(Z_ARRVAL_P(value), 0); ZVAL_DEREF(tag);
  if (Z_TYPE_P(tag) != IS_LONG) return lb_fail(s, "Variant wire tag requires int", 1);
  if (Z_LVAL_P(tag) < 0 || (uint64_t)Z_LVAL_P(tag) >= 3) return lb_fail(s, "Invalid variant wire constructor", 0);
  out->kind = (uint32_t)Z_LVAL_P(tag);
  switch (out->kind) {
  case 0: {
    if (zend_hash_num_elements(Z_ARRVAL_P(value)) != 1) return lb_fail(s, "Variant wire field count differs", 0);
    if (!lb_charge(s, 1, 32)) return 0;
    break;
  }
  case 1: {
    if (zend_hash_num_elements(Z_ARRVAL_P(value)) != 2) return lb_fail(s, "Variant wire field count differs", 0);
    if (!lb_charge(s, 2, 32)) return 0;
    if (!lb_to20(zend_hash_index_find(Z_ARRVAL_P(value), 1), &out->cases.box.value, s)) return 0;
    break;
  }
  case 2: {
    if (zend_hash_num_elements(Z_ARRVAL_P(value)) != 2) return lb_fail(s, "Variant wire field count differs", 0);
    if (!lb_charge(s, 2, 32)) return 0;
    if (!lb_to24(zend_hash_index_find(Z_ARRVAL_P(value), 1), &out->cases.choices.values, s)) return 0;
    break;
  }
  }
  return 1;
}
static int lb_from25(const nominalprimitivesubtypes_event *value, zval *out, lb_scope *s) {
  if (!lb_charge(s, 1, 16)) return 0;
  if (value->kind >= 3) return lb_fail(s, "Invalid native variant constructor", 0);
  switch (value->kind) {
  case 0: {
    if (!lb_charge(s, 1, 32)) return 0;
    array_init_size(out, 1);
    add_next_index_long(out, 0);
    break;
  }
  case 1: {
    if (!lb_charge(s, 2, 32)) return 0;
    array_init_size(out, 2);
    add_next_index_long(out, 1);
    zval item0; ZVAL_NULL(&item0);
    if (!lb_from20(&value->cases.box.value, &item0, s)) { zval_ptr_dtor(&item0); return 0; }
    add_next_index_zval(out, &item0);
    break;
  }
  case 2: {
    if (!lb_charge(s, 2, 32)) return 0;
    array_init_size(out, 2);
    add_next_index_long(out, 2);
    zval item0; ZVAL_NULL(&item0);
    if (!lb_from24(&value->cases.choices.values, &item0, s)) { zval_ptr_dtor(&item0); return 0; }
    add_next_index_zval(out, &item0);
    break;
  }
  }
  return 1;
}

static int lb_to26(zval *value, nominalprimitivesubtypes_array_option_lean_nominal_primitive_subtypes_packet_span *out, lb_scope *s) {
  ZVAL_DEREF(value);
  if (!lb_charge(s, 1, 16)) return 0;
  if (Z_TYPE_P(value) != IS_ARRAY || !zend_array_is_list(Z_ARRVAL_P(value))) return lb_fail(s, "Expected a consecutive-key wire list", 1);
  size_t count = zend_hash_num_elements(Z_ARRVAL_P(value));
  if (!lb_charge(s, count, 32)) return 0;
  nominalprimitivesubtypes_option_lean_nominal_primitive_subtypes_packet_value *data = lb_allocate(s, count, sizeof(*data)); if (!data) return 0;
  out->data = data; out->length = count;
  for (size_t i = 0; i < count; i++) if (!lb_to21(zend_hash_index_find(Z_ARRVAL_P(value), i), &data[i], s)) return 0;
  return 1;
}
static int lb_from26(const nominalprimitivesubtypes_array_option_lean_nominal_primitive_subtypes_packet_span *value, zval *out, lb_scope *s) {
  if (!lb_charge(s, 1, 16)) return 0;
  if (!lb_charge(s, value->length, 32) || (value->length && !value->data)) return lb_fail(s, "Invalid array output", 0);
  if (value->length && (uintptr_t)value->data % _Alignof(nominalprimitivesubtypes_option_lean_nominal_primitive_subtypes_packet_value)) return lb_fail(s, "Misaligned sequence output", 0);
  #ifdef __wasm__
  if (value->length && ((uint64_t)(uintptr_t)value->data + (uint64_t)value->length * sizeof(*value->data) > (uint64_t)__builtin_wasm_memory_size(0) * 65536)) return lb_fail(s, "Sequence output exceeds Wasm memory", 0);
  #endif
  array_init_size(out, (uint32_t)value->length);
  for (size_t i = 0; i < value->length; i++) {
    zval item; ZVAL_NULL(&item);
    if (!lb_from21(&value->data[i], &item, s)) { zval_ptr_dtor(&item); return 0; }
    add_next_index_zval(out, &item);
  }
  return 1;
}

static int lb_to27(zval *value, nominalprimitivesubtypes_pair *out, lb_scope *s) {
  ZVAL_DEREF(value);
  if (!lb_charge(s, 1, 16)) return 0;
  if (Z_TYPE_P(value) != IS_ARRAY || !zend_array_is_list(Z_ARRVAL_P(value))) return lb_fail(s, "Expected a consecutive-key wire list", 1);
  if (zend_hash_num_elements(Z_ARRVAL_P(value)) != 2) return lb_fail(s, "Record wire field count differs", 0);
  if (!lb_to26(zend_hash_index_find(Z_ARRVAL_P(value), 0), &out->left, s)) return 0;
  if (!lb_to26(zend_hash_index_find(Z_ARRVAL_P(value), 1), &out->right, s)) return 0;
  return 1;
}
static int lb_from27(const nominalprimitivesubtypes_pair *value, zval *out, lb_scope *s) {
  if (!lb_charge(s, 1, 16)) return 0;
  if (!lb_charge(s, 2, 32)) return 0;
  array_init_size(out, 2);
  zval item0; ZVAL_NULL(&item0);
  if (!lb_from26(&value->left, &item0, s)) { zval_ptr_dtor(&item0); return 0; }
  add_next_index_zval(out, &item0);
  zval item1; ZVAL_NULL(&item1);
  if (!lb_from26(&value->right, &item1, s)) { zval_ptr_dtor(&item1); return 0; }
  add_next_index_zval(out, &item1);
  return 1;
}
typedef struct {
  lb_scope scope;
  nominalprimitivesubtypes_raw_packet input0;
  nominalprimitivesubtypes_option_lean_nominal_primitive_subtypes_packet_value output;
  nominalprimitivesubtypes_error error;
  int status;
} lb_context0;
static void lb_cleanup0(lb_context0 *ctx) {
  nominalprimitivesubtypes_option_lean_nominal_primitive_subtypes_packet_value_clear(&ctx->output);
  lb_scope_clear(&ctx->scope); LB_ZEND_FREE(ctx);
}
static void lb_execute0(lb_context0 *ctx, zval *args, zval *out) {
  (void)args;
  if (!lb_to19(&args[0], &ctx->input0, &ctx->scope)) return;
  ctx->status = nominalprimitivesubtypes_produce(&ctx->input0, &ctx->output, &ctx->error);
  if (ctx->status) return;
  (void)lb_from21(&ctx->output, out, &ctx->scope);
}
ZEND_BEGIN_ARG_INFO_EX(lb_args0, 0, 0, 1)
  ZEND_ARG_INFO(0, arg0)
ZEND_END_ARG_INFO()
static ZEND_FUNCTION(lb_call0) {
  if (ZEND_NUM_ARGS() != 1) { zend_argument_count_error("Expected exactly 1 arguments"); RETURN_THROWS(); }
  zval args[1];
  if (zend_get_parameters_array_ex(1, args) != SUCCESS) RETURN_THROWS();
  if (sizeof(lb_context0) > 16 * 1024 * 1024) { zend_value_error("Zend call context exceeds the conversion limit"); RETURN_THROWS(); }
  lb_context0 *ctx = LB_ZEND_CALLOC(1, sizeof(*ctx));
  if (!ctx) { zend_throw_error(NULL, "Zend call allocation failed"); RETURN_THROWS(); }
  ctx->scope.remaining = 16 * 1024 * 1024 - sizeof(*ctx);
  ZVAL_NULL(return_value);
  zend_try { lb_execute0(ctx, args, return_value); }
  zend_catch { lb_cleanup0(ctx); zend_bailout(); }
  zend_end_try();
  const char *message = ctx->scope.error; int type_error = ctx->scope.type_error;
  int status = ctx->status;
  /* Error text may belong to the native result. Copy it before releasing owners. */
  char native_message[16385];
  if (status) {
    size_t length = ctx->error.message ? ctx->error.message_length : 0;
    if (length > sizeof(native_message) - 1) length = sizeof(native_message) - 1;
    if (!lb_readable(&ctx->scope, ctx->error.message, length, 1, 1)) message = ctx->scope.error;
    else {
      if (length) memcpy(native_message, ctx->error.message, length);
      native_message[length] = 0;
      message = length ? native_message : "Compiled Lean call failed";
    }
  }
  lb_cleanup0(ctx);
  if (message) {
    zval_ptr_dtor(return_value); ZVAL_NULL(return_value);
    if (type_error) zend_type_error("%s", message);
    else if (status) zend_throw_exception(zend_ce_exception, message, status);
    else zend_value_error("%s", message);
    RETURN_THROWS();
  }
}

typedef struct {
  lb_scope scope;
  nominalprimitivesubtypes_raw_packet input0;
  nominalprimitivesubtypes_event output;
  nominalprimitivesubtypes_error error;
  int status;
} lb_context1;
static void lb_cleanup1(lb_context1 *ctx) {
  nominalprimitivesubtypes_event_clear(&ctx->output);
  lb_scope_clear(&ctx->scope); LB_ZEND_FREE(ctx);
}
static void lb_execute1(lb_context1 *ctx, zval *args, zval *out) {
  (void)args;
  if (!lb_to19(&args[0], &ctx->input0, &ctx->scope)) return;
  ctx->status = nominalprimitivesubtypes_produce_choices(&ctx->input0, &ctx->output, &ctx->error);
  if (ctx->status) return;
  (void)lb_from25(&ctx->output, out, &ctx->scope);
}
ZEND_BEGIN_ARG_INFO_EX(lb_args1, 0, 0, 1)
  ZEND_ARG_INFO(0, arg0)
ZEND_END_ARG_INFO()
static ZEND_FUNCTION(lb_call1) {
  if (ZEND_NUM_ARGS() != 1) { zend_argument_count_error("Expected exactly 1 arguments"); RETURN_THROWS(); }
  zval args[1];
  if (zend_get_parameters_array_ex(1, args) != SUCCESS) RETURN_THROWS();
  if (sizeof(lb_context1) > 16 * 1024 * 1024) { zend_value_error("Zend call context exceeds the conversion limit"); RETURN_THROWS(); }
  lb_context1 *ctx = LB_ZEND_CALLOC(1, sizeof(*ctx));
  if (!ctx) { zend_throw_error(NULL, "Zend call allocation failed"); RETURN_THROWS(); }
  ctx->scope.remaining = 16 * 1024 * 1024 - sizeof(*ctx);
  ZVAL_NULL(return_value);
  zend_try { lb_execute1(ctx, args, return_value); }
  zend_catch { lb_cleanup1(ctx); zend_bailout(); }
  zend_end_try();
  const char *message = ctx->scope.error; int type_error = ctx->scope.type_error;
  int status = ctx->status;
  /* Error text may belong to the native result. Copy it before releasing owners. */
  char native_message[16385];
  if (status) {
    size_t length = ctx->error.message ? ctx->error.message_length : 0;
    if (length > sizeof(native_message) - 1) length = sizeof(native_message) - 1;
    if (!lb_readable(&ctx->scope, ctx->error.message, length, 1, 1)) message = ctx->scope.error;
    else {
      if (length) memcpy(native_message, ctx->error.message, length);
      native_message[length] = 0;
      message = length ? native_message : "Compiled Lean call failed";
    }
  }
  lb_cleanup1(ctx);
  if (message) {
    zval_ptr_dtor(return_value); ZVAL_NULL(return_value);
    if (type_error) zend_type_error("%s", message);
    else if (status) zend_throw_exception(zend_ce_exception, message, status);
    else zend_value_error("%s", message);
    RETURN_THROWS();
  }
}

typedef struct {
  lb_scope scope;
  nominalprimitivesubtypes_raw_packet input0;
  nominalprimitivesubtypes_event output;
  nominalprimitivesubtypes_error error;
  int status;
} lb_context2;
static void lb_cleanup2(lb_context2 *ctx) {
  nominalprimitivesubtypes_event_clear(&ctx->output);
  lb_scope_clear(&ctx->scope); LB_ZEND_FREE(ctx);
}
static void lb_execute2(lb_context2 *ctx, zval *args, zval *out) {
  (void)args;
  if (!lb_to19(&args[0], &ctx->input0, &ctx->scope)) return;
  ctx->status = nominalprimitivesubtypes_produce_event(&ctx->input0, &ctx->output, &ctx->error);
  if (ctx->status) return;
  (void)lb_from25(&ctx->output, out, &ctx->scope);
}
ZEND_BEGIN_ARG_INFO_EX(lb_args2, 0, 0, 1)
  ZEND_ARG_INFO(0, arg0)
ZEND_END_ARG_INFO()
static ZEND_FUNCTION(lb_call2) {
  if (ZEND_NUM_ARGS() != 1) { zend_argument_count_error("Expected exactly 1 arguments"); RETURN_THROWS(); }
  zval args[1];
  if (zend_get_parameters_array_ex(1, args) != SUCCESS) RETURN_THROWS();
  if (sizeof(lb_context2) > 16 * 1024 * 1024) { zend_value_error("Zend call context exceeds the conversion limit"); RETURN_THROWS(); }
  lb_context2 *ctx = LB_ZEND_CALLOC(1, sizeof(*ctx));
  if (!ctx) { zend_throw_error(NULL, "Zend call allocation failed"); RETURN_THROWS(); }
  ctx->scope.remaining = 16 * 1024 * 1024 - sizeof(*ctx);
  ZVAL_NULL(return_value);
  zend_try { lb_execute2(ctx, args, return_value); }
  zend_catch { lb_cleanup2(ctx); zend_bailout(); }
  zend_end_try();
  const char *message = ctx->scope.error; int type_error = ctx->scope.type_error;
  int status = ctx->status;
  /* Error text may belong to the native result. Copy it before releasing owners. */
  char native_message[16385];
  if (status) {
    size_t length = ctx->error.message ? ctx->error.message_length : 0;
    if (length > sizeof(native_message) - 1) length = sizeof(native_message) - 1;
    if (!lb_readable(&ctx->scope, ctx->error.message, length, 1, 1)) message = ctx->scope.error;
    else {
      if (length) memcpy(native_message, ctx->error.message, length);
      native_message[length] = 0;
      message = length ? native_message : "Compiled Lean call failed";
    }
  }
  lb_cleanup2(ctx);
  if (message) {
    zval_ptr_dtor(return_value); ZVAL_NULL(return_value);
    if (type_error) zend_type_error("%s", message);
    else if (status) zend_throw_exception(zend_ce_exception, message, status);
    else zend_value_error("%s", message);
    RETURN_THROWS();
  }
}

typedef struct {
  lb_scope scope;
  nominalprimitivesubtypes_raw_packet input0;
  nominalprimitivesubtypes_array_option_lean_nominal_primitive_subtypes_packet_span output;
  nominalprimitivesubtypes_error error;
  int status;
} lb_context3;
static void lb_cleanup3(lb_context3 *ctx) {
  nominalprimitivesubtypes_array_option_lean_nominal_primitive_subtypes_packet_span_clear(&ctx->output);
  lb_scope_clear(&ctx->scope); LB_ZEND_FREE(ctx);
}
static void lb_execute3(lb_context3 *ctx, zval *args, zval *out) {
  (void)args;
  if (!lb_to19(&args[0], &ctx->input0, &ctx->scope)) return;
  ctx->status = nominalprimitivesubtypes_produce_group(&ctx->input0, &ctx->output, &ctx->error);
  if (ctx->status) return;
  (void)lb_from26(&ctx->output, out, &ctx->scope);
}
ZEND_BEGIN_ARG_INFO_EX(lb_args3, 0, 0, 1)
  ZEND_ARG_INFO(0, arg0)
ZEND_END_ARG_INFO()
static ZEND_FUNCTION(lb_call3) {
  if (ZEND_NUM_ARGS() != 1) { zend_argument_count_error("Expected exactly 1 arguments"); RETURN_THROWS(); }
  zval args[1];
  if (zend_get_parameters_array_ex(1, args) != SUCCESS) RETURN_THROWS();
  if (sizeof(lb_context3) > 16 * 1024 * 1024) { zend_value_error("Zend call context exceeds the conversion limit"); RETURN_THROWS(); }
  lb_context3 *ctx = LB_ZEND_CALLOC(1, sizeof(*ctx));
  if (!ctx) { zend_throw_error(NULL, "Zend call allocation failed"); RETURN_THROWS(); }
  ctx->scope.remaining = 16 * 1024 * 1024 - sizeof(*ctx);
  ZVAL_NULL(return_value);
  zend_try { lb_execute3(ctx, args, return_value); }
  zend_catch { lb_cleanup3(ctx); zend_bailout(); }
  zend_end_try();
  const char *message = ctx->scope.error; int type_error = ctx->scope.type_error;
  int status = ctx->status;
  /* Error text may belong to the native result. Copy it before releasing owners. */
  char native_message[16385];
  if (status) {
    size_t length = ctx->error.message ? ctx->error.message_length : 0;
    if (length > sizeof(native_message) - 1) length = sizeof(native_message) - 1;
    if (!lb_readable(&ctx->scope, ctx->error.message, length, 1, 1)) message = ctx->scope.error;
    else {
      if (length) memcpy(native_message, ctx->error.message, length);
      native_message[length] = 0;
      message = length ? native_message : "Compiled Lean call failed";
    }
  }
  lb_cleanup3(ctx);
  if (message) {
    zval_ptr_dtor(return_value); ZVAL_NULL(return_value);
    if (type_error) zend_type_error("%s", message);
    else if (status) zend_throw_exception(zend_ce_exception, message, status);
    else zend_value_error("%s", message);
    RETURN_THROWS();
  }
}

typedef struct {
  lb_scope scope;
  nominalprimitivesubtypes_raw_packet input0;
  nominalprimitivesubtypes_pair output;
  nominalprimitivesubtypes_error error;
  int status;
} lb_context4;
static void lb_cleanup4(lb_context4 *ctx) {
  nominalprimitivesubtypes_pair_clear(&ctx->output);
  lb_scope_clear(&ctx->scope); LB_ZEND_FREE(ctx);
}
static void lb_execute4(lb_context4 *ctx, zval *args, zval *out) {
  (void)args;
  if (!lb_to19(&args[0], &ctx->input0, &ctx->scope)) return;
  ctx->status = nominalprimitivesubtypes_produce_pair(&ctx->input0, &ctx->output, &ctx->error);
  if (ctx->status) return;
  (void)lb_from27(&ctx->output, out, &ctx->scope);
}
ZEND_BEGIN_ARG_INFO_EX(lb_args4, 0, 0, 1)
  ZEND_ARG_INFO(0, arg0)
ZEND_END_ARG_INFO()
static ZEND_FUNCTION(lb_call4) {
  if (ZEND_NUM_ARGS() != 1) { zend_argument_count_error("Expected exactly 1 arguments"); RETURN_THROWS(); }
  zval args[1];
  if (zend_get_parameters_array_ex(1, args) != SUCCESS) RETURN_THROWS();
  if (sizeof(lb_context4) > 16 * 1024 * 1024) { zend_value_error("Zend call context exceeds the conversion limit"); RETURN_THROWS(); }
  lb_context4 *ctx = LB_ZEND_CALLOC(1, sizeof(*ctx));
  if (!ctx) { zend_throw_error(NULL, "Zend call allocation failed"); RETURN_THROWS(); }
  ctx->scope.remaining = 16 * 1024 * 1024 - sizeof(*ctx);
  ZVAL_NULL(return_value);
  zend_try { lb_execute4(ctx, args, return_value); }
  zend_catch { lb_cleanup4(ctx); zend_bailout(); }
  zend_end_try();
  const char *message = ctx->scope.error; int type_error = ctx->scope.type_error;
  int status = ctx->status;
  /* Error text may belong to the native result. Copy it before releasing owners. */
  char native_message[16385];
  if (status) {
    size_t length = ctx->error.message ? ctx->error.message_length : 0;
    if (length > sizeof(native_message) - 1) length = sizeof(native_message) - 1;
    if (!lb_readable(&ctx->scope, ctx->error.message, length, 1, 1)) message = ctx->scope.error;
    else {
      if (length) memcpy(native_message, ctx->error.message, length);
      native_message[length] = 0;
      message = length ? native_message : "Compiled Lean call failed";
    }
  }
  lb_cleanup4(ctx);
  if (message) {
    zval_ptr_dtor(return_value); ZVAL_NULL(return_value);
    if (type_error) zend_type_error("%s", message);
    else if (status) zend_throw_exception(zend_ce_exception, message, status);
    else zend_value_error("%s", message);
    RETURN_THROWS();
  }
}

typedef struct {
  lb_scope scope;
  
  uint32_t output;
  nominalprimitivesubtypes_error error;
  int status;
} lb_context5;
static void lb_cleanup5(lb_context5 *ctx) {
  /* No copied output owner. */
  lb_scope_clear(&ctx->scope); LB_ZEND_FREE(ctx);
}
static void lb_execute5(lb_context5 *ctx, zval *args, zval *out) {
  (void)args;

  ctx->status = nominalprimitivesubtypes_word_bits(&ctx->output, &ctx->error);
  if (ctx->status) return;
  (void)lb_from4(&ctx->output, out, &ctx->scope);
}
ZEND_BEGIN_ARG_INFO_EX(lb_args5, 0, 0, 0)

ZEND_END_ARG_INFO()
static ZEND_FUNCTION(lb_call5) {
  if (ZEND_NUM_ARGS() != 0) { zend_argument_count_error("Expected exactly 0 arguments"); RETURN_THROWS(); }
  zval args[1];
  
  if (sizeof(lb_context5) > 16 * 1024 * 1024) { zend_value_error("Zend call context exceeds the conversion limit"); RETURN_THROWS(); }
  lb_context5 *ctx = LB_ZEND_CALLOC(1, sizeof(*ctx));
  if (!ctx) { zend_throw_error(NULL, "Zend call allocation failed"); RETURN_THROWS(); }
  ctx->scope.remaining = 16 * 1024 * 1024 - sizeof(*ctx);
  ZVAL_NULL(return_value);
  zend_try { lb_execute5(ctx, args, return_value); }
  zend_catch { lb_cleanup5(ctx); zend_bailout(); }
  zend_end_try();
  const char *message = ctx->scope.error; int type_error = ctx->scope.type_error;
  int status = ctx->status;
  /* Error text may belong to the native result. Copy it before releasing owners. */
  char native_message[16385];
  if (status) {
    size_t length = ctx->error.message ? ctx->error.message_length : 0;
    if (length > sizeof(native_message) - 1) length = sizeof(native_message) - 1;
    if (!lb_readable(&ctx->scope, ctx->error.message, length, 1, 1)) message = ctx->scope.error;
    else {
      if (length) memcpy(native_message, ctx->error.message, length);
      native_message[length] = 0;
      message = length ? native_message : "Compiled Lean call failed";
    }
  }
  lb_cleanup5(ctx);
  if (message) {
    zval_ptr_dtor(return_value); ZVAL_NULL(return_value);
    if (type_error) zend_type_error("%s", message);
    else if (status) zend_throw_exception(zend_ce_exception, message, status);
    else zend_value_error("%s", message);
    RETURN_THROWS();
  }
}



static const zend_function_entry lb_functions[] = {
  ZEND_NS_NAMED_FE("LeanNominalprimitivesubtypes\\Internal\\Zend38288f2996297301", call0, zif_lb_call0, lb_args0)
  ZEND_NS_NAMED_FE("LeanNominalprimitivesubtypes\\Internal\\Zend38288f2996297301", call1, zif_lb_call1, lb_args1)
  ZEND_NS_NAMED_FE("LeanNominalprimitivesubtypes\\Internal\\Zend38288f2996297301", call2, zif_lb_call2, lb_args2)
  ZEND_NS_NAMED_FE("LeanNominalprimitivesubtypes\\Internal\\Zend38288f2996297301", call3, zif_lb_call3, lb_args3)
  ZEND_NS_NAMED_FE("LeanNominalprimitivesubtypes\\Internal\\Zend38288f2996297301", call4, zif_lb_call4, lb_args4)
  ZEND_NS_NAMED_FE("LeanNominalprimitivesubtypes\\Internal\\Zend38288f2996297301", call5, zif_lb_call5, lb_args5)

  PHP_FE_END
};
zend_module_entry lb_nominalprimitivesubtypes_38288f2996297301_module_entry = {
  STANDARD_MODULE_HEADER, "lb_nominalprimitivesubtypes_38288f2996297301", lb_functions,
  NULL, NULL, NULL, NULL, NULL, "1", STANDARD_MODULE_PROPERTIES
};
ZEND_GET_MODULE(lb_nominalprimitivesubtypes_38288f2996297301)
