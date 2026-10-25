#include <php.h>
#include <limits.h>
#include <Zend/zend_exceptions.h>
#include "checkedrecordvalueindices.h"

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

static int lb_to0(zval *value, checkedrecordvalueindices_nat *out, lb_scope *s) {
  ZVAL_DEREF(value);
  if (!lb_charge(s, 1, 16)) return 0;
  uint32_t *words; bool negative; if (!lb_big_in(value, s, &words, &out->length, &negative, false)) return 0;
  out->data = words;
  return 1;
}
static int lb_from0(const checkedrecordvalueindices_nat *value, zval *out, lb_scope *s) {
  if (!lb_charge(s, 1, 16)) return 0;
  return lb_big_out(value->data, value->length, false, out, s);
  return 1;
}

static int lb_to1(zval *value, checkedrecordvalueindices_ab *out, lb_scope *s) {
  ZVAL_DEREF(value);
  if (!lb_charge(s, 1, 16)) return 0;
  if (Z_TYPE_P(value) != IS_ARRAY || !zend_array_is_list(Z_ARRVAL_P(value))) return lb_fail(s, "Expected a consecutive-key wire list", 1);
  if (zend_hash_num_elements(Z_ARRVAL_P(value)) != 1) return lb_fail(s, "Record wire field count differs", 0);
  if (!lb_to0(zend_hash_index_find(Z_ARRVAL_P(value), 0), &out->size, s)) return 0;
  return 1;
}
static int lb_from1(const checkedrecordvalueindices_ab *value, zval *out, lb_scope *s) {
  if (!lb_charge(s, 1, 16)) return 0;
  if (!lb_charge(s, 1, 32)) return 0;
  array_init_size(out, 1);
  zval item0; ZVAL_NULL(&item0);
  if (!lb_from0(&value->size, &item0, s)) { zval_ptr_dtor(&item0); return 0; }
  add_next_index_zval(out, &item0);
  return 1;
}

static int lb_to2(zval *value, checkedrecordvalueindices_array_nat_span *out, lb_scope *s) {
  ZVAL_DEREF(value);
  if (!lb_charge(s, 1, 16)) return 0;
  if (Z_TYPE_P(value) != IS_ARRAY || !zend_array_is_list(Z_ARRVAL_P(value))) return lb_fail(s, "Expected a consecutive-key wire list", 1);
  size_t count = zend_hash_num_elements(Z_ARRVAL_P(value));
  if (!lb_charge(s, count, 32)) return 0;
  checkedrecordvalueindices_nat *data = lb_allocate(s, count, sizeof(*data)); if (!data) return 0;
  out->data = data; out->length = count;
  for (size_t i = 0; i < count; i++) if (!lb_to0(zend_hash_index_find(Z_ARRVAL_P(value), i), &data[i], s)) return 0;
  return 1;
}
static int lb_from2(const checkedrecordvalueindices_array_nat_span *value, zval *out, lb_scope *s) {
  if (!lb_charge(s, 1, 16)) return 0;
  if (!lb_charge(s, value->length, 32) || (value->length && !value->data)) return lb_fail(s, "Invalid array output", 0);
  if (value->length && (uintptr_t)value->data % _Alignof(checkedrecordvalueindices_nat)) return lb_fail(s, "Misaligned sequence output", 0);
  #ifdef __wasm__
  if (value->length && ((uint64_t)(uintptr_t)value->data + (uint64_t)value->length * sizeof(*value->data) > (uint64_t)__builtin_wasm_memory_size(0) * 65536)) return lb_fail(s, "Sequence output exceeds Wasm memory", 0);
  #endif
  array_init_size(out, (uint32_t)value->length);
  for (size_t i = 0; i < value->length; i++) {
    zval item; ZVAL_NULL(&item);
    if (!lb_from0(&value->data[i], &item, s)) { zval_ptr_dtor(&item); return 0; }
    add_next_index_zval(out, &item);
  }
  return 1;
}

static int lb_to3(zval *value, checkedrecordvalueindices_empty_sized *out, lb_scope *s) {
  ZVAL_DEREF(value);
  if (!lb_charge(s, 1, 16)) return 0;
  if (Z_TYPE_P(value) != IS_ARRAY || !zend_array_is_list(Z_ARRVAL_P(value))) return lb_fail(s, "Expected a consecutive-key wire list", 1);
  if (zend_hash_num_elements(Z_ARRVAL_P(value)) != 1) return lb_fail(s, "Record wire field count differs", 0);
  if (!lb_to2(zend_hash_index_find(Z_ARRVAL_P(value), 0), &out->data, s)) return 0;
  return 1;
}
static int lb_from3(const checkedrecordvalueindices_empty_sized *value, zval *out, lb_scope *s) {
  if (!lb_charge(s, 1, 16)) return 0;
  if (!lb_charge(s, 1, 32)) return 0;
  array_init_size(out, 1);
  zval item0; ZVAL_NULL(&item0);
  if (!lb_from2(&value->data, &item0, s)) { zval_ptr_dtor(&item0); return 0; }
  add_next_index_zval(out, &item0);
  return 1;
}

static int lb_to4(zval *value, checkedrecordvalueindices_empty_token *out, lb_scope *s) {
  ZVAL_DEREF(value);
  if (!lb_charge(s, 1, 16)) return 0;
  if (Z_TYPE_P(value) != IS_ARRAY || !zend_array_is_list(Z_ARRVAL_P(value))) return lb_fail(s, "Expected a consecutive-key wire list", 1);
  if (zend_hash_num_elements(Z_ARRVAL_P(value)) != 1) return lb_fail(s, "Record wire field count differs", 0);
  if (!lb_to0(zend_hash_index_find(Z_ARRVAL_P(value), 0), &out->count, s)) return 0;
  return 1;
}
static int lb_from4(const checkedrecordvalueindices_empty_token *value, zval *out, lb_scope *s) {
  if (!lb_charge(s, 1, 16)) return 0;
  if (!lb_charge(s, 1, 32)) return 0;
  array_init_size(out, 1);
  zval item0; ZVAL_NULL(&item0);
  if (!lb_from0(&value->count, &item0, s)) { zval_ptr_dtor(&item0); return 0; }
  add_next_index_zval(out, &item0);
  return 1;
}

static int lb_to5(zval *value, checkedrecordvalueindices_off *out, lb_scope *s) {
  ZVAL_DEREF(value);
  if (!lb_charge(s, 1, 16)) return 0;
  if (Z_TYPE_P(value) != IS_ARRAY || !zend_array_is_list(Z_ARRVAL_P(value))) return lb_fail(s, "Expected a consecutive-key wire list", 1);
  if (zend_hash_num_elements(Z_ARRVAL_P(value)) != 1) return lb_fail(s, "Record wire field count differs", 0);
  if (!lb_to0(zend_hash_index_find(Z_ARRVAL_P(value), 0), &out->count, s)) return 0;
  return 1;
}
static int lb_from5(const checkedrecordvalueindices_off *value, zval *out, lb_scope *s) {
  if (!lb_charge(s, 1, 16)) return 0;
  if (!lb_charge(s, 1, 32)) return 0;
  array_init_size(out, 1);
  zval item0; ZVAL_NULL(&item0);
  if (!lb_from0(&value->count, &item0, s)) { zval_ptr_dtor(&item0); return 0; }
  add_next_index_zval(out, &item0);
  return 1;
}

static int lb_to6(zval *value, checkedrecordvalueindices_on *out, lb_scope *s) {
  ZVAL_DEREF(value);
  if (!lb_charge(s, 1, 16)) return 0;
  if (Z_TYPE_P(value) != IS_ARRAY || !zend_array_is_list(Z_ARRVAL_P(value))) return lb_fail(s, "Expected a consecutive-key wire list", 1);
  if (zend_hash_num_elements(Z_ARRVAL_P(value)) != 1) return lb_fail(s, "Record wire field count differs", 0);
  if (!lb_to0(zend_hash_index_find(Z_ARRVAL_P(value), 0), &out->count, s)) return 0;
  return 1;
}
static int lb_from6(const checkedrecordvalueindices_on *value, zval *out, lb_scope *s) {
  if (!lb_charge(s, 1, 16)) return 0;
  if (!lb_charge(s, 1, 32)) return 0;
  array_init_size(out, 1);
  zval item0; ZVAL_NULL(&item0);
  if (!lb_from0(&value->count, &item0, s)) { zval_ptr_dtor(&item0); return 0; }
  add_next_index_zval(out, &item0);
  return 1;
}

static int lb_to7(zval *value, checkedrecordvalueindices_unicode_token *out, lb_scope *s) {
  ZVAL_DEREF(value);
  if (!lb_charge(s, 1, 16)) return 0;
  if (Z_TYPE_P(value) != IS_ARRAY || !zend_array_is_list(Z_ARRVAL_P(value))) return lb_fail(s, "Expected a consecutive-key wire list", 1);
  if (zend_hash_num_elements(Z_ARRVAL_P(value)) != 1) return lb_fail(s, "Record wire field count differs", 0);
  if (!lb_to0(zend_hash_index_find(Z_ARRVAL_P(value), 0), &out->count, s)) return 0;
  return 1;
}
static int lb_from7(const checkedrecordvalueindices_unicode_token *value, zval *out, lb_scope *s) {
  if (!lb_charge(s, 1, 16)) return 0;
  if (!lb_charge(s, 1, 32)) return 0;
  array_init_size(out, 1);
  zval item0; ZVAL_NULL(&item0);
  if (!lb_from0(&value->count, &item0, s)) { zval_ptr_dtor(&item0); return 0; }
  add_next_index_zval(out, &item0);
  return 1;
}

static int lb_to8(zval *value, checkedrecordvalueindices_wide_token *out, lb_scope *s) {
  ZVAL_DEREF(value);
  if (!lb_charge(s, 1, 16)) return 0;
  if (Z_TYPE_P(value) != IS_ARRAY || !zend_array_is_list(Z_ARRVAL_P(value))) return lb_fail(s, "Expected a consecutive-key wire list", 1);
  if (zend_hash_num_elements(Z_ARRVAL_P(value)) != 1) return lb_fail(s, "Record wire field count differs", 0);
  if (!lb_to0(zend_hash_index_find(Z_ARRVAL_P(value), 0), &out->count, s)) return 0;
  return 1;
}
static int lb_from8(const checkedrecordvalueindices_wide_token *value, zval *out, lb_scope *s) {
  if (!lb_charge(s, 1, 16)) return 0;
  if (!lb_charge(s, 1, 32)) return 0;
  array_init_size(out, 1);
  zval item0; ZVAL_NULL(&item0);
  if (!lb_from0(&value->count, &item0, s)) { zval_ptr_dtor(&item0); return 0; }
  add_next_index_zval(out, &item0);
  return 1;
}

static int lb_to9(zval *value, checkedrecordvalueindices_zero_token *out, lb_scope *s) {
  ZVAL_DEREF(value);
  if (!lb_charge(s, 1, 16)) return 0;
  if (Z_TYPE_P(value) != IS_ARRAY || !zend_array_is_list(Z_ARRVAL_P(value))) return lb_fail(s, "Expected a consecutive-key wire list", 1);
  if (zend_hash_num_elements(Z_ARRVAL_P(value)) != 1) return lb_fail(s, "Record wire field count differs", 0);
  if (!lb_to0(zend_hash_index_find(Z_ARRVAL_P(value), 0), &out->count, s)) return 0;
  return 1;
}
static int lb_from9(const checkedrecordvalueindices_zero_token *value, zval *out, lb_scope *s) {
  if (!lb_charge(s, 1, 16)) return 0;
  if (!lb_charge(s, 1, 32)) return 0;
  array_init_size(out, 1);
  zval item0; ZVAL_NULL(&item0);
  if (!lb_from0(&value->count, &item0, s)) { zval_ptr_dtor(&item0); return 0; }
  add_next_index_zval(out, &item0);
  return 1;
}
typedef struct {
  lb_scope scope;
  checkedrecordvalueindices_ab input0;
  checkedrecordvalueindices_nat output;
  checkedrecordvalueindices_error error;
  int status;
} lb_context0;
static void lb_cleanup0(lb_context0 *ctx) {
  checkedrecordvalueindices_nat_clear(&ctx->output);
  lb_scope_clear(&ctx->scope); LB_ZEND_FREE(ctx);
}
static void lb_execute0(lb_context0 *ctx, zval *args, zval *out) {
  (void)args;
  if (!lb_to1(&args[0], &ctx->input0, &ctx->scope)) return;
  ctx->status = checkedrecordvalueindices_ab_string_index(&ctx->input0, &ctx->output, &ctx->error);
  if (ctx->status) return;
  (void)lb_from0(&ctx->output, out, &ctx->scope);
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
  checkedrecordvalueindices_empty_sized input0;
  checkedrecordvalueindices_nat output;
  checkedrecordvalueindices_error error;
  int status;
} lb_context1;
static void lb_cleanup1(lb_context1 *ctx) {
  checkedrecordvalueindices_nat_clear(&ctx->output);
  lb_scope_clear(&ctx->scope); LB_ZEND_FREE(ctx);
}
static void lb_execute1(lb_context1 *ctx, zval *args, zval *out) {
  (void)args;
  if (!lb_to3(&args[0], &ctx->input0, &ctx->scope)) return;
  ctx->status = checkedrecordvalueindices_empty_sized_index(&ctx->input0, &ctx->output, &ctx->error);
  if (ctx->status) return;
  (void)lb_from0(&ctx->output, out, &ctx->scope);
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
  checkedrecordvalueindices_empty_token input0;
  checkedrecordvalueindices_nat output;
  checkedrecordvalueindices_error error;
  int status;
} lb_context2;
static void lb_cleanup2(lb_context2 *ctx) {
  checkedrecordvalueindices_nat_clear(&ctx->output);
  lb_scope_clear(&ctx->scope); LB_ZEND_FREE(ctx);
}
static void lb_execute2(lb_context2 *ctx, zval *args, zval *out) {
  (void)args;
  if (!lb_to4(&args[0], &ctx->input0, &ctx->scope)) return;
  ctx->status = checkedrecordvalueindices_empty_string_index(&ctx->input0, &ctx->output, &ctx->error);
  if (ctx->status) return;
  (void)lb_from0(&ctx->output, out, &ctx->scope);
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
  checkedrecordvalueindices_off input0;
  checkedrecordvalueindices_nat output;
  checkedrecordvalueindices_error error;
  int status;
} lb_context3;
static void lb_cleanup3(lb_context3 *ctx) {
  checkedrecordvalueindices_nat_clear(&ctx->output);
  lb_scope_clear(&ctx->scope); LB_ZEND_FREE(ctx);
}
static void lb_execute3(lb_context3 *ctx, zval *args, zval *out) {
  (void)args;
  if (!lb_to5(&args[0], &ctx->input0, &ctx->scope)) return;
  ctx->status = checkedrecordvalueindices_false_bool_index(&ctx->input0, &ctx->output, &ctx->error);
  if (ctx->status) return;
  (void)lb_from0(&ctx->output, out, &ctx->scope);
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
  
  checkedrecordvalueindices_ab output;
  checkedrecordvalueindices_error error;
  int status;
} lb_context4;
static void lb_cleanup4(lb_context4 *ctx) {
  checkedrecordvalueindices_ab_clear(&ctx->output);
  lb_scope_clear(&ctx->scope); LB_ZEND_FREE(ctx);
}
static void lb_execute4(lb_context4 *ctx, zval *args, zval *out) {
  (void)args;

  ctx->status = checkedrecordvalueindices_produce_ab(&ctx->output, &ctx->error);
  if (ctx->status) return;
  (void)lb_from1(&ctx->output, out, &ctx->scope);
}
ZEND_BEGIN_ARG_INFO_EX(lb_args4, 0, 0, 0)

ZEND_END_ARG_INFO()
static ZEND_FUNCTION(lb_call4) {
  if (ZEND_NUM_ARGS() != 0) { zend_argument_count_error("Expected exactly 0 arguments"); RETURN_THROWS(); }
  zval args[1];
  
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
  
  checkedrecordvalueindices_empty_sized output;
  checkedrecordvalueindices_error error;
  int status;
} lb_context5;
static void lb_cleanup5(lb_context5 *ctx) {
  checkedrecordvalueindices_empty_sized_clear(&ctx->output);
  lb_scope_clear(&ctx->scope); LB_ZEND_FREE(ctx);
}
static void lb_execute5(lb_context5 *ctx, zval *args, zval *out) {
  (void)args;

  ctx->status = checkedrecordvalueindices_produce_empty_sized(&ctx->output, &ctx->error);
  if (ctx->status) return;
  (void)lb_from3(&ctx->output, out, &ctx->scope);
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

typedef struct {
  lb_scope scope;
  checkedrecordvalueindices_nat input0;
  checkedrecordvalueindices_empty_token output;
  checkedrecordvalueindices_error error;
  int status;
} lb_context6;
static void lb_cleanup6(lb_context6 *ctx) {
  checkedrecordvalueindices_empty_token_clear(&ctx->output);
  lb_scope_clear(&ctx->scope); LB_ZEND_FREE(ctx);
}
static void lb_execute6(lb_context6 *ctx, zval *args, zval *out) {
  (void)args;
  if (!lb_to0(&args[0], &ctx->input0, &ctx->scope)) return;
  ctx->status = checkedrecordvalueindices_produce_empty_string(&ctx->input0, &ctx->output, &ctx->error);
  if (ctx->status) return;
  (void)lb_from4(&ctx->output, out, &ctx->scope);
}
ZEND_BEGIN_ARG_INFO_EX(lb_args6, 0, 0, 1)
  ZEND_ARG_INFO(0, arg0)
ZEND_END_ARG_INFO()
static ZEND_FUNCTION(lb_call6) {
  if (ZEND_NUM_ARGS() != 1) { zend_argument_count_error("Expected exactly 1 arguments"); RETURN_THROWS(); }
  zval args[1];
  if (zend_get_parameters_array_ex(1, args) != SUCCESS) RETURN_THROWS();
  if (sizeof(lb_context6) > 16 * 1024 * 1024) { zend_value_error("Zend call context exceeds the conversion limit"); RETURN_THROWS(); }
  lb_context6 *ctx = LB_ZEND_CALLOC(1, sizeof(*ctx));
  if (!ctx) { zend_throw_error(NULL, "Zend call allocation failed"); RETURN_THROWS(); }
  ctx->scope.remaining = 16 * 1024 * 1024 - sizeof(*ctx);
  ZVAL_NULL(return_value);
  zend_try { lb_execute6(ctx, args, return_value); }
  zend_catch { lb_cleanup6(ctx); zend_bailout(); }
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
  lb_cleanup6(ctx);
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
  
  checkedrecordvalueindices_off output;
  checkedrecordvalueindices_error error;
  int status;
} lb_context7;
static void lb_cleanup7(lb_context7 *ctx) {
  checkedrecordvalueindices_off_clear(&ctx->output);
  lb_scope_clear(&ctx->scope); LB_ZEND_FREE(ctx);
}
static void lb_execute7(lb_context7 *ctx, zval *args, zval *out) {
  (void)args;

  ctx->status = checkedrecordvalueindices_produce_false_bool(&ctx->output, &ctx->error);
  if (ctx->status) return;
  (void)lb_from5(&ctx->output, out, &ctx->scope);
}
ZEND_BEGIN_ARG_INFO_EX(lb_args7, 0, 0, 0)

ZEND_END_ARG_INFO()
static ZEND_FUNCTION(lb_call7) {
  if (ZEND_NUM_ARGS() != 0) { zend_argument_count_error("Expected exactly 0 arguments"); RETURN_THROWS(); }
  zval args[1];
  
  if (sizeof(lb_context7) > 16 * 1024 * 1024) { zend_value_error("Zend call context exceeds the conversion limit"); RETURN_THROWS(); }
  lb_context7 *ctx = LB_ZEND_CALLOC(1, sizeof(*ctx));
  if (!ctx) { zend_throw_error(NULL, "Zend call allocation failed"); RETURN_THROWS(); }
  ctx->scope.remaining = 16 * 1024 * 1024 - sizeof(*ctx);
  ZVAL_NULL(return_value);
  zend_try { lb_execute7(ctx, args, return_value); }
  zend_catch { lb_cleanup7(ctx); zend_bailout(); }
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
  lb_cleanup7(ctx);
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
  
  checkedrecordvalueindices_on output;
  checkedrecordvalueindices_error error;
  int status;
} lb_context8;
static void lb_cleanup8(lb_context8 *ctx) {
  checkedrecordvalueindices_on_clear(&ctx->output);
  lb_scope_clear(&ctx->scope); LB_ZEND_FREE(ctx);
}
static void lb_execute8(lb_context8 *ctx, zval *args, zval *out) {
  (void)args;

  ctx->status = checkedrecordvalueindices_produce_true_bool(&ctx->output, &ctx->error);
  if (ctx->status) return;
  (void)lb_from6(&ctx->output, out, &ctx->scope);
}
ZEND_BEGIN_ARG_INFO_EX(lb_args8, 0, 0, 0)

ZEND_END_ARG_INFO()
static ZEND_FUNCTION(lb_call8) {
  if (ZEND_NUM_ARGS() != 0) { zend_argument_count_error("Expected exactly 0 arguments"); RETURN_THROWS(); }
  zval args[1];
  
  if (sizeof(lb_context8) > 16 * 1024 * 1024) { zend_value_error("Zend call context exceeds the conversion limit"); RETURN_THROWS(); }
  lb_context8 *ctx = LB_ZEND_CALLOC(1, sizeof(*ctx));
  if (!ctx) { zend_throw_error(NULL, "Zend call allocation failed"); RETURN_THROWS(); }
  ctx->scope.remaining = 16 * 1024 * 1024 - sizeof(*ctx);
  ZVAL_NULL(return_value);
  zend_try { lb_execute8(ctx, args, return_value); }
  zend_catch { lb_cleanup8(ctx); zend_bailout(); }
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
  lb_cleanup8(ctx);
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
  checkedrecordvalueindices_nat input0;
  checkedrecordvalueindices_unicode_token output;
  checkedrecordvalueindices_error error;
  int status;
} lb_context9;
static void lb_cleanup9(lb_context9 *ctx) {
  checkedrecordvalueindices_unicode_token_clear(&ctx->output);
  lb_scope_clear(&ctx->scope); LB_ZEND_FREE(ctx);
}
static void lb_execute9(lb_context9 *ctx, zval *args, zval *out) {
  (void)args;
  if (!lb_to0(&args[0], &ctx->input0, &ctx->scope)) return;
  ctx->status = checkedrecordvalueindices_produce_unicode_string(&ctx->input0, &ctx->output, &ctx->error);
  if (ctx->status) return;
  (void)lb_from7(&ctx->output, out, &ctx->scope);
}
ZEND_BEGIN_ARG_INFO_EX(lb_args9, 0, 0, 1)
  ZEND_ARG_INFO(0, arg0)
ZEND_END_ARG_INFO()
static ZEND_FUNCTION(lb_call9) {
  if (ZEND_NUM_ARGS() != 1) { zend_argument_count_error("Expected exactly 1 arguments"); RETURN_THROWS(); }
  zval args[1];
  if (zend_get_parameters_array_ex(1, args) != SUCCESS) RETURN_THROWS();
  if (sizeof(lb_context9) > 16 * 1024 * 1024) { zend_value_error("Zend call context exceeds the conversion limit"); RETURN_THROWS(); }
  lb_context9 *ctx = LB_ZEND_CALLOC(1, sizeof(*ctx));
  if (!ctx) { zend_throw_error(NULL, "Zend call allocation failed"); RETURN_THROWS(); }
  ctx->scope.remaining = 16 * 1024 * 1024 - sizeof(*ctx);
  ZVAL_NULL(return_value);
  zend_try { lb_execute9(ctx, args, return_value); }
  zend_catch { lb_cleanup9(ctx); zend_bailout(); }
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
  lb_cleanup9(ctx);
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
  checkedrecordvalueindices_nat input0;
  checkedrecordvalueindices_wide_token output;
  checkedrecordvalueindices_error error;
  int status;
} lb_context10;
static void lb_cleanup10(lb_context10 *ctx) {
  checkedrecordvalueindices_wide_token_clear(&ctx->output);
  lb_scope_clear(&ctx->scope); LB_ZEND_FREE(ctx);
}
static void lb_execute10(lb_context10 *ctx, zval *args, zval *out) {
  (void)args;
  if (!lb_to0(&args[0], &ctx->input0, &ctx->scope)) return;
  ctx->status = checkedrecordvalueindices_produce_wide_nat(&ctx->input0, &ctx->output, &ctx->error);
  if (ctx->status) return;
  (void)lb_from8(&ctx->output, out, &ctx->scope);
}
ZEND_BEGIN_ARG_INFO_EX(lb_args10, 0, 0, 1)
  ZEND_ARG_INFO(0, arg0)
ZEND_END_ARG_INFO()
static ZEND_FUNCTION(lb_call10) {
  if (ZEND_NUM_ARGS() != 1) { zend_argument_count_error("Expected exactly 1 arguments"); RETURN_THROWS(); }
  zval args[1];
  if (zend_get_parameters_array_ex(1, args) != SUCCESS) RETURN_THROWS();
  if (sizeof(lb_context10) > 16 * 1024 * 1024) { zend_value_error("Zend call context exceeds the conversion limit"); RETURN_THROWS(); }
  lb_context10 *ctx = LB_ZEND_CALLOC(1, sizeof(*ctx));
  if (!ctx) { zend_throw_error(NULL, "Zend call allocation failed"); RETURN_THROWS(); }
  ctx->scope.remaining = 16 * 1024 * 1024 - sizeof(*ctx);
  ZVAL_NULL(return_value);
  zend_try { lb_execute10(ctx, args, return_value); }
  zend_catch { lb_cleanup10(ctx); zend_bailout(); }
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
  lb_cleanup10(ctx);
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
  checkedrecordvalueindices_nat input0;
  checkedrecordvalueindices_zero_token output;
  checkedrecordvalueindices_error error;
  int status;
} lb_context11;
static void lb_cleanup11(lb_context11 *ctx) {
  checkedrecordvalueindices_zero_token_clear(&ctx->output);
  lb_scope_clear(&ctx->scope); LB_ZEND_FREE(ctx);
}
static void lb_execute11(lb_context11 *ctx, zval *args, zval *out) {
  (void)args;
  if (!lb_to0(&args[0], &ctx->input0, &ctx->scope)) return;
  ctx->status = checkedrecordvalueindices_produce_zero_nat(&ctx->input0, &ctx->output, &ctx->error);
  if (ctx->status) return;
  (void)lb_from9(&ctx->output, out, &ctx->scope);
}
ZEND_BEGIN_ARG_INFO_EX(lb_args11, 0, 0, 1)
  ZEND_ARG_INFO(0, arg0)
ZEND_END_ARG_INFO()
static ZEND_FUNCTION(lb_call11) {
  if (ZEND_NUM_ARGS() != 1) { zend_argument_count_error("Expected exactly 1 arguments"); RETURN_THROWS(); }
  zval args[1];
  if (zend_get_parameters_array_ex(1, args) != SUCCESS) RETURN_THROWS();
  if (sizeof(lb_context11) > 16 * 1024 * 1024) { zend_value_error("Zend call context exceeds the conversion limit"); RETURN_THROWS(); }
  lb_context11 *ctx = LB_ZEND_CALLOC(1, sizeof(*ctx));
  if (!ctx) { zend_throw_error(NULL, "Zend call allocation failed"); RETURN_THROWS(); }
  ctx->scope.remaining = 16 * 1024 * 1024 - sizeof(*ctx);
  ZVAL_NULL(return_value);
  zend_try { lb_execute11(ctx, args, return_value); }
  zend_catch { lb_cleanup11(ctx); zend_bailout(); }
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
  lb_cleanup11(ctx);
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
  checkedrecordvalueindices_on input0;
  checkedrecordvalueindices_nat output;
  checkedrecordvalueindices_error error;
  int status;
} lb_context12;
static void lb_cleanup12(lb_context12 *ctx) {
  checkedrecordvalueindices_nat_clear(&ctx->output);
  lb_scope_clear(&ctx->scope); LB_ZEND_FREE(ctx);
}
static void lb_execute12(lb_context12 *ctx, zval *args, zval *out) {
  (void)args;
  if (!lb_to6(&args[0], &ctx->input0, &ctx->scope)) return;
  ctx->status = checkedrecordvalueindices_true_bool_index(&ctx->input0, &ctx->output, &ctx->error);
  if (ctx->status) return;
  (void)lb_from0(&ctx->output, out, &ctx->scope);
}
ZEND_BEGIN_ARG_INFO_EX(lb_args12, 0, 0, 1)
  ZEND_ARG_INFO(0, arg0)
ZEND_END_ARG_INFO()
static ZEND_FUNCTION(lb_call12) {
  if (ZEND_NUM_ARGS() != 1) { zend_argument_count_error("Expected exactly 1 arguments"); RETURN_THROWS(); }
  zval args[1];
  if (zend_get_parameters_array_ex(1, args) != SUCCESS) RETURN_THROWS();
  if (sizeof(lb_context12) > 16 * 1024 * 1024) { zend_value_error("Zend call context exceeds the conversion limit"); RETURN_THROWS(); }
  lb_context12 *ctx = LB_ZEND_CALLOC(1, sizeof(*ctx));
  if (!ctx) { zend_throw_error(NULL, "Zend call allocation failed"); RETURN_THROWS(); }
  ctx->scope.remaining = 16 * 1024 * 1024 - sizeof(*ctx);
  ZVAL_NULL(return_value);
  zend_try { lb_execute12(ctx, args, return_value); }
  zend_catch { lb_cleanup12(ctx); zend_bailout(); }
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
  lb_cleanup12(ctx);
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
  checkedrecordvalueindices_unicode_token input0;
  checkedrecordvalueindices_nat output;
  checkedrecordvalueindices_error error;
  int status;
} lb_context13;
static void lb_cleanup13(lb_context13 *ctx) {
  checkedrecordvalueindices_nat_clear(&ctx->output);
  lb_scope_clear(&ctx->scope); LB_ZEND_FREE(ctx);
}
static void lb_execute13(lb_context13 *ctx, zval *args, zval *out) {
  (void)args;
  if (!lb_to7(&args[0], &ctx->input0, &ctx->scope)) return;
  ctx->status = checkedrecordvalueindices_unicode_string_index(&ctx->input0, &ctx->output, &ctx->error);
  if (ctx->status) return;
  (void)lb_from0(&ctx->output, out, &ctx->scope);
}
ZEND_BEGIN_ARG_INFO_EX(lb_args13, 0, 0, 1)
  ZEND_ARG_INFO(0, arg0)
ZEND_END_ARG_INFO()
static ZEND_FUNCTION(lb_call13) {
  if (ZEND_NUM_ARGS() != 1) { zend_argument_count_error("Expected exactly 1 arguments"); RETURN_THROWS(); }
  zval args[1];
  if (zend_get_parameters_array_ex(1, args) != SUCCESS) RETURN_THROWS();
  if (sizeof(lb_context13) > 16 * 1024 * 1024) { zend_value_error("Zend call context exceeds the conversion limit"); RETURN_THROWS(); }
  lb_context13 *ctx = LB_ZEND_CALLOC(1, sizeof(*ctx));
  if (!ctx) { zend_throw_error(NULL, "Zend call allocation failed"); RETURN_THROWS(); }
  ctx->scope.remaining = 16 * 1024 * 1024 - sizeof(*ctx);
  ZVAL_NULL(return_value);
  zend_try { lb_execute13(ctx, args, return_value); }
  zend_catch { lb_cleanup13(ctx); zend_bailout(); }
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
  lb_cleanup13(ctx);
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
  checkedrecordvalueindices_wide_token input0;
  checkedrecordvalueindices_nat output;
  checkedrecordvalueindices_error error;
  int status;
} lb_context14;
static void lb_cleanup14(lb_context14 *ctx) {
  checkedrecordvalueindices_nat_clear(&ctx->output);
  lb_scope_clear(&ctx->scope); LB_ZEND_FREE(ctx);
}
static void lb_execute14(lb_context14 *ctx, zval *args, zval *out) {
  (void)args;
  if (!lb_to8(&args[0], &ctx->input0, &ctx->scope)) return;
  ctx->status = checkedrecordvalueindices_wide_nat_index(&ctx->input0, &ctx->output, &ctx->error);
  if (ctx->status) return;
  (void)lb_from0(&ctx->output, out, &ctx->scope);
}
ZEND_BEGIN_ARG_INFO_EX(lb_args14, 0, 0, 1)
  ZEND_ARG_INFO(0, arg0)
ZEND_END_ARG_INFO()
static ZEND_FUNCTION(lb_call14) {
  if (ZEND_NUM_ARGS() != 1) { zend_argument_count_error("Expected exactly 1 arguments"); RETURN_THROWS(); }
  zval args[1];
  if (zend_get_parameters_array_ex(1, args) != SUCCESS) RETURN_THROWS();
  if (sizeof(lb_context14) > 16 * 1024 * 1024) { zend_value_error("Zend call context exceeds the conversion limit"); RETURN_THROWS(); }
  lb_context14 *ctx = LB_ZEND_CALLOC(1, sizeof(*ctx));
  if (!ctx) { zend_throw_error(NULL, "Zend call allocation failed"); RETURN_THROWS(); }
  ctx->scope.remaining = 16 * 1024 * 1024 - sizeof(*ctx);
  ZVAL_NULL(return_value);
  zend_try { lb_execute14(ctx, args, return_value); }
  zend_catch { lb_cleanup14(ctx); zend_bailout(); }
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
  lb_cleanup14(ctx);
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
  checkedrecordvalueindices_zero_token input0;
  checkedrecordvalueindices_nat output;
  checkedrecordvalueindices_error error;
  int status;
} lb_context15;
static void lb_cleanup15(lb_context15 *ctx) {
  checkedrecordvalueindices_nat_clear(&ctx->output);
  lb_scope_clear(&ctx->scope); LB_ZEND_FREE(ctx);
}
static void lb_execute15(lb_context15 *ctx, zval *args, zval *out) {
  (void)args;
  if (!lb_to9(&args[0], &ctx->input0, &ctx->scope)) return;
  ctx->status = checkedrecordvalueindices_zero_nat_index(&ctx->input0, &ctx->output, &ctx->error);
  if (ctx->status) return;
  (void)lb_from0(&ctx->output, out, &ctx->scope);
}
ZEND_BEGIN_ARG_INFO_EX(lb_args15, 0, 0, 1)
  ZEND_ARG_INFO(0, arg0)
ZEND_END_ARG_INFO()
static ZEND_FUNCTION(lb_call15) {
  if (ZEND_NUM_ARGS() != 1) { zend_argument_count_error("Expected exactly 1 arguments"); RETURN_THROWS(); }
  zval args[1];
  if (zend_get_parameters_array_ex(1, args) != SUCCESS) RETURN_THROWS();
  if (sizeof(lb_context15) > 16 * 1024 * 1024) { zend_value_error("Zend call context exceeds the conversion limit"); RETURN_THROWS(); }
  lb_context15 *ctx = LB_ZEND_CALLOC(1, sizeof(*ctx));
  if (!ctx) { zend_throw_error(NULL, "Zend call allocation failed"); RETURN_THROWS(); }
  ctx->scope.remaining = 16 * 1024 * 1024 - sizeof(*ctx);
  ZVAL_NULL(return_value);
  zend_try { lb_execute15(ctx, args, return_value); }
  zend_catch { lb_cleanup15(ctx); zend_bailout(); }
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
  lb_cleanup15(ctx);
  if (message) {
    zval_ptr_dtor(return_value); ZVAL_NULL(return_value);
    if (type_error) zend_type_error("%s", message);
    else if (status) zend_throw_exception(zend_ce_exception, message, status);
    else zend_value_error("%s", message);
    RETURN_THROWS();
  }
}



static const zend_function_entry lb_functions[] = {
  ZEND_NS_NAMED_FE("LeanCheckedrecordvalueindices\\Internal\\Zend9a59ae38fa66670e", call0, zif_lb_call0, lb_args0)
  ZEND_NS_NAMED_FE("LeanCheckedrecordvalueindices\\Internal\\Zend9a59ae38fa66670e", call1, zif_lb_call1, lb_args1)
  ZEND_NS_NAMED_FE("LeanCheckedrecordvalueindices\\Internal\\Zend9a59ae38fa66670e", call2, zif_lb_call2, lb_args2)
  ZEND_NS_NAMED_FE("LeanCheckedrecordvalueindices\\Internal\\Zend9a59ae38fa66670e", call3, zif_lb_call3, lb_args3)
  ZEND_NS_NAMED_FE("LeanCheckedrecordvalueindices\\Internal\\Zend9a59ae38fa66670e", call4, zif_lb_call4, lb_args4)
  ZEND_NS_NAMED_FE("LeanCheckedrecordvalueindices\\Internal\\Zend9a59ae38fa66670e", call5, zif_lb_call5, lb_args5)
  ZEND_NS_NAMED_FE("LeanCheckedrecordvalueindices\\Internal\\Zend9a59ae38fa66670e", call6, zif_lb_call6, lb_args6)
  ZEND_NS_NAMED_FE("LeanCheckedrecordvalueindices\\Internal\\Zend9a59ae38fa66670e", call7, zif_lb_call7, lb_args7)
  ZEND_NS_NAMED_FE("LeanCheckedrecordvalueindices\\Internal\\Zend9a59ae38fa66670e", call8, zif_lb_call8, lb_args8)
  ZEND_NS_NAMED_FE("LeanCheckedrecordvalueindices\\Internal\\Zend9a59ae38fa66670e", call9, zif_lb_call9, lb_args9)
  ZEND_NS_NAMED_FE("LeanCheckedrecordvalueindices\\Internal\\Zend9a59ae38fa66670e", call10, zif_lb_call10, lb_args10)
  ZEND_NS_NAMED_FE("LeanCheckedrecordvalueindices\\Internal\\Zend9a59ae38fa66670e", call11, zif_lb_call11, lb_args11)
  ZEND_NS_NAMED_FE("LeanCheckedrecordvalueindices\\Internal\\Zend9a59ae38fa66670e", call12, zif_lb_call12, lb_args12)
  ZEND_NS_NAMED_FE("LeanCheckedrecordvalueindices\\Internal\\Zend9a59ae38fa66670e", call13, zif_lb_call13, lb_args13)
  ZEND_NS_NAMED_FE("LeanCheckedrecordvalueindices\\Internal\\Zend9a59ae38fa66670e", call14, zif_lb_call14, lb_args14)
  ZEND_NS_NAMED_FE("LeanCheckedrecordvalueindices\\Internal\\Zend9a59ae38fa66670e", call15, zif_lb_call15, lb_args15)

  PHP_FE_END
};
zend_module_entry lb_checkedrecordvalueindices_9a59ae38fa66670e_module_entry = {
  STANDARD_MODULE_HEADER, "lb_checkedrecordvalueindices_9a59ae38fa66670e", lb_functions,
  NULL, NULL, NULL, NULL, NULL, "1", STANDARD_MODULE_PROPERTIES
};
ZEND_GET_MODULE(lb_checkedrecordvalueindices_9a59ae38fa66670e)
