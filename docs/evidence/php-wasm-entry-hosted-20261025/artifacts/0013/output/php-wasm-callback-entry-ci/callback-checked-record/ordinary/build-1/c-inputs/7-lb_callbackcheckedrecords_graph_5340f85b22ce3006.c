#include <php.h>
#include <limits.h>
#include <Zend/zend_exceptions.h>
#include "callbackcheckedrecords-graph.h"
_Static_assert(sizeof(zend_long) == 4 && sizeof(size_t) == 4 && sizeof(void *) == 4, "Recursive PHP-Wasm requires a 32-bit host and graph ABI");
_Static_assert(sizeof(bool) == 1, "Bool markers require one byte");
#if PHP_VERSION_ID < 80200 || PHP_VERSION_ID >= 90000
#error This adapter requires PHP 8.2 through 8.x
#endif
#ifdef ZTS
#error This adapter requires a non-thread-safe PHP runtime
#endif

#include <inttypes.h>
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
  unsigned failure; /* 2: budget, 3: allocation, 4: invalid representation. */
} lb_scope;
static int lb_fail(lb_scope *s, const char *message, int type_error) {
  if (!s->error) { s->error = message; s->type_error = type_error; if (!s->failure) s->failure = 4; }
  return 0;
}
static int lb_charge(lb_scope *s, size_t count, size_t width) {
  if (!width || count > s->remaining / width) {
    if (!s->error) s->failure = 2;
    return lb_fail(s, "16 MiB Zend conversion limit exceeded", 0);
  }
  s->remaining -= count * width; return 1;
}
static int lb_readable(lb_scope *s, const void *data, size_t count, size_t width, size_t alignment) {
  if (!count) return 1;
  if (!data || !width || !alignment || count > SIZE_MAX / width) return lb_fail(s, "Invalid native output buffer", 0);
  if ((uintptr_t)data % alignment) return lb_fail(s, "Misaligned native output buffer", 0);
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
  if (!data) {
    LB_ZEND_FREE(block); if (!s->error) s->failure = 3;
    lb_fail(s, "Zend conversion allocation failed", 0); return NULL;
  }
  block->data = data; block->next = s->blocks; s->blocks = block; return data;
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


enum { LG_SCALAR, LG_FIELDS, LG_VARIANT, LG_OPTION, LG_RESULT, LG_SEQUENCE };
typedef struct { unsigned type; size_t offset; bool pointer; } lg_field;
typedef struct { size_t count; const lg_field *fields; } lg_branch;
typedef struct {
  unsigned kind;
  bool inhabited;
  size_t size, alignment;
  unsigned element;
  size_t tag_offset, data_offset, length_offset;
  size_t branch_count;
  const lg_branch *branches;
  int (*input)(zval *, void *, lb_scope *);
  int (*output)(const void *, zval *, lb_scope *);
} lg_node;
typedef struct {
  unsigned type;
  bool entered;
  unsigned char *native;
  zval *wire;
  HashTable *outer, *items;
  zval *children;
  const lg_field *fields;
  unsigned char *data;
  size_t index, count, wire_offset;
} lg_frame;
typedef struct { lb_scope scope; size_t visits; lg_frame frames[129]; } lg_walk;


static int lb_to5(zval *value, callbackcheckedrecords_scalar_nat_t *out, lb_scope *s) {
  ZVAL_DEREF(value);
  if (!lb_charge(s, 1, 16)) return 0;
  uint32_t *words; bool negative; if (!lb_big_in(value, s, &words, &out->length, &negative, false)) return 0;
  out->data = words;
  return 1;
}
static int lb_from5(const callbackcheckedrecords_scalar_nat_t *value, zval *out, lb_scope *s) {
  if (!lb_charge(s, 1, 16)) return 0;
  return lb_big_out(value->data, value->length, false, out, s);
  return 1;
}

static int lb_to6(zval *value, callbackcheckedrecords_scalar_string_t *out, lb_scope *s) {
  ZVAL_DEREF(value);
  if (!lb_charge(s, 1, 16)) return 0;
  if (Z_TYPE_P(value) != IS_STRING) return lb_fail(s, "Expected string bytes", 1);
  if (!lb_charge(s, Z_STRLEN_P(value), 1)) return 0;
  if (!lb_utf8((const unsigned char *)Z_STRVAL_P(value), Z_STRLEN_P(value))) return lb_fail(s, "String requires valid UTF-8", 0);
  out->data = (const char *)Z_STRVAL_P(value); out->length = Z_STRLEN_P(value);
  return 1;
}
static int lb_from6(const callbackcheckedrecords_scalar_string_t *value, zval *out, lb_scope *s) {
  if (!lb_charge(s, 1, 16)) return 0;
  if (!lb_charge(s, value->length, 1) || (value->length && !value->data)) return lb_fail(s, "Invalid string buffer", 0);
  if (!lb_readable(s, value->data, value->length, 1, 1)) return 0;
  if (!lb_utf8((const unsigned char *)value->data, value->length)) return lb_fail(s, "Native string is not valid UTF-8", 0);
  ZVAL_STRINGL(out, value->length ? (const char *)value->data : "", value->length);
  return 1;
}

static int lb_to7(zval *value, uint8_t *out, lb_scope *s) {
  ZVAL_DEREF(value);
  if (!lb_charge(s, 1, 16)) return 0;
  if (Z_TYPE_P(value) != IS_NULL) return lb_fail(s, "Unit requires null", 1);
  *out = 0;
  return 1;
}
static int lb_from7(const uint8_t *value, zval *out, lb_scope *s) {
  if (!lb_charge(s, 1, 16)) return 0;
  if (*value != 0) return lb_fail(s, "Invalid native Unit marker", 0);
  ZVAL_NULL(out);
  return 1;
}

static int lg_to_5(zval *value, void *out, lb_scope *s) { return lb_to5(value, (callbackcheckedrecords_scalar_nat_t *)out, s); }
static int lg_from_5(const void *value, zval *out, lb_scope *s) { return lb_from5((const callbackcheckedrecords_scalar_nat_t *)value, out, s); }

static int lg_to_6(zval *value, void *out, lb_scope *s) { return lb_to6(value, (callbackcheckedrecords_scalar_string_t *)out, s); }
static int lg_from_6(const void *value, zval *out, lb_scope *s) { return lb_from6((const callbackcheckedrecords_scalar_string_t *)value, out, s); }

static int lg_to_7(zval *value, void *out, lb_scope *s) { return lb_to7(value, (uint8_t *)out, s); }
static int lg_from_7(const void *value, zval *out, lb_scope *s) { return lb_from7((const uint8_t *)value, out, s); }

static const lg_field lg_fields_0_1[] = {
  { 3, offsetof(callbackcheckedrecords_graph_38a8689c2f20ead532ea_t, value), false },
};

static const lg_branch lg_branches_0[] = { { 0, NULL }, { 1, lg_fields_0_1 } };

static const lg_field lg_fields_2_0[] = {
  { 6, offsetof(callbackcheckedrecords_graph_29468227bdfd05da1480_t, error), false },
};

static const lg_field lg_fields_2_1[] = {
  { 0, offsetof(callbackcheckedrecords_graph_29468227bdfd05da1480_t, ok), false },
};

static const lg_branch lg_branches_2[] = { { 1, lg_fields_2_0 }, { 1, lg_fields_2_1 } };

static const lg_field lg_fields_3_0[] = {
  { 5, offsetof(callbackcheckedrecords_interval_t, lo), false },
  { 5, offsetof(callbackcheckedrecords_interval_t, hi), false },
};

static const lg_branch lg_branches_3[] = { { 2, lg_fields_3_0 } };

static const lg_field lg_fields_4_0[] = {
  { 5, offsetof(callbackcheckedrecords_weighted_t, weight), false },
  { 5, offsetof(callbackcheckedrecords_weighted_t, limit), false },
};

static const lg_branch lg_branches_4[] = { { 2, lg_fields_4_0 } };

static const lg_node lg_nodes[] = {
  { LG_OPTION, true, sizeof(callbackcheckedrecords_graph_38a8689c2f20ead532ea_t), _Alignof(callbackcheckedrecords_graph_38a8689c2f20ead532ea_t), 0, offsetof(callbackcheckedrecords_graph_38a8689c2f20ead532ea_t, has_value), 0, 0, 2, lg_branches_0, NULL, NULL },
  { LG_SEQUENCE, true, sizeof(callbackcheckedrecords_graph_7ee21eb6b8ea120b53f0_t), _Alignof(callbackcheckedrecords_graph_7ee21eb6b8ea120b53f0_t), 0, 0, offsetof(callbackcheckedrecords_graph_7ee21eb6b8ea120b53f0_t, data), offsetof(callbackcheckedrecords_graph_7ee21eb6b8ea120b53f0_t, length), 0, NULL, NULL, NULL },
  { LG_RESULT, true, sizeof(callbackcheckedrecords_graph_29468227bdfd05da1480_t), _Alignof(callbackcheckedrecords_graph_29468227bdfd05da1480_t), 0, offsetof(callbackcheckedrecords_graph_29468227bdfd05da1480_t, is_ok), 0, 0, 2, lg_branches_2, NULL, NULL },
  { LG_FIELDS, true, sizeof(callbackcheckedrecords_interval_t), _Alignof(callbackcheckedrecords_interval_t), 0, 0, 0, 0, 1, lg_branches_3, NULL, NULL },
  { LG_FIELDS, true, sizeof(callbackcheckedrecords_weighted_t), _Alignof(callbackcheckedrecords_weighted_t), 0, 0, 0, 0, 1, lg_branches_4, NULL, NULL },
  { LG_SCALAR, true, sizeof(callbackcheckedrecords_scalar_nat_t), _Alignof(callbackcheckedrecords_scalar_nat_t), 0, 0, 0, 0, 0, NULL, lg_to_5, lg_from_5 },
  { LG_SCALAR, true, sizeof(callbackcheckedrecords_scalar_string_t), _Alignof(callbackcheckedrecords_scalar_string_t), 0, 0, 0, 0, 0, NULL, lg_to_6, lg_from_6 },
  { LG_SCALAR, true, sizeof(uint8_t), _Alignof(uint8_t), 0, 0, 0, 0, 0, NULL, lg_to_7, lg_from_7 },
};


static int lg_list(zval *value, size_t count, bool exact, lb_scope *s) {
  ZVAL_DEREF(value);
  if (Z_TYPE_P(value) != IS_ARRAY || !zend_array_is_list(Z_ARRVAL_P(value))
      || (exact && zend_hash_num_elements(Z_ARRVAL_P(value)) != count))
    return lb_fail(s, "Expected consecutive-key wire list with exact arity", 1);
  return 1;
}
static int lg_children(lg_walk *walk, size_t count) {
  if (count > walk->visits) {
    if (!walk->scope.error) walk->scope.failure = 2;
    return lb_fail(&walk->scope, "Copied value exceeds 262144 visits", 0);
  }
  return lb_charge(&walk->scope, count, 32);
}
static int lg_step(lg_walk *walk, size_t depth) {
  if (depth > 128 || !walk->visits) {
    if (!walk->scope.error) walk->scope.failure = 2;
    return lb_fail(&walk->scope, depth > 128 ? "Copied value exceeds 128 levels" : "Copied value exceeds 262144 visits", 0);
  }
  walk->visits--; return 1;
}
static int lg_input_enter(lg_walk *walk, lg_frame *frame, const lg_node *node) {
  lb_scope *s = &walk->scope; zval *value = frame->wire; ZVAL_DEREF(value);
  if (node->kind == LG_OPTION && Z_TYPE_P(value) == IS_NULL) return 1;
  if (!lg_list(value, 0, false, s)) return 0;
  frame->outer = Z_ARRVAL_P(value); frame->items = frame->outer;
  if (node->kind == LG_SEQUENCE) {
    const lg_node *child = &lg_nodes[node->element]; frame->count = zend_hash_num_elements(frame->items);
    if (!lg_children(walk, frame->count)) return 0;
    frame->data = lb_allocate(s, frame->count, child->size); if (!frame->data) return 0;
    memcpy(frame->native + node->data_offset, &frame->data, sizeof(frame->data));
    memcpy(frame->native + node->length_offset, &frame->count, sizeof(frame->count));
    return 1;
  }
  size_t branch = 0;
  if (node->kind == LG_VARIANT || node->kind == LG_RESULT) {
    if (!lg_list(value, 2, true, s)) return 0;
    zval *tag = zend_hash_index_find(frame->outer, 0); ZVAL_DEREF(tag);
    if (node->kind == LG_VARIANT) {
      if (Z_TYPE_P(tag) != IS_LONG || Z_LVAL_P(tag) < 0 || (uint64_t)Z_LVAL_P(tag) >= node->branch_count)
        return lb_fail(s, "Invalid copied variant wire tag", 1);
      branch = (size_t)Z_LVAL_P(tag); uint32_t raw = (uint32_t)branch;
      memcpy(frame->native + node->tag_offset, &raw, sizeof(raw));
      zval *payload = zend_hash_index_find(frame->outer, 1); ZVAL_DEREF(payload);
      if (!lg_list(payload, node->branches[branch].count, true, s)) return 0;
      frame->items = Z_ARRVAL_P(payload);
    } else {
      if (Z_TYPE_P(tag) != IS_TRUE && Z_TYPE_P(tag) != IS_FALSE) return lb_fail(s, "Except wire tag requires bool", 1);
      unsigned char raw = Z_TYPE_P(tag) == IS_TRUE; branch = raw; frame->wire_offset = 1;
      memcpy(frame->native + node->tag_offset, &raw, sizeof(raw));
    }
  } else if (node->kind == LG_OPTION) {
    if (!lg_list(value, 1, true, s)) return 0;
    branch = 1; unsigned char raw = 1; memcpy(frame->native + node->tag_offset, &raw, sizeof(raw));
  } else if (!lg_list(value, node->branches[0].count, true, s)) return 0;
  frame->fields = node->branches[branch].fields; frame->count = node->branches[branch].count;
  return lg_children(walk, frame->count);
}
static int lg_to(lg_walk *walk, unsigned type, zval *value, void *out) {
  size_t depth = 0; walk->frames[0] = (lg_frame){ .type = type, .wire = value, .native = out };
  while (true) {
    lg_frame *frame = &walk->frames[depth]; const lg_node *node = &lg_nodes[frame->type];
    if (!frame->entered) {
      if (!lg_step(walk, depth)) return 0;
      if (!node->inhabited) return lb_fail(&walk->scope, "The declared copied type has no finite value", 0);
      frame->entered = true;
      if (node->kind == LG_SCALAR) { if (!node->input(frame->wire, frame->native, &walk->scope)) return 0; }
      else {
        if (!lb_charge(&walk->scope, 1, 16) || !lg_input_enter(walk, frame, node)) return 0;
        for (size_t index = 0; index < depth; index++) {
          const lg_frame *parent = &walk->frames[index];
          if ((frame->outer && (frame->outer == parent->outer || frame->outer == parent->items))
              || (frame->items && (frame->items == parent->outer || frame->items == parent->items)))
            return lb_fail(&walk->scope, "Cyclic copied wire value", 0);
        }
      }
    }
    if (frame->index == frame->count) { if (!depth) return 1; depth--; continue; }
    if (depth == 128) return lg_step(walk, 129);
    size_t index = frame->index++; const lg_field *field = node->kind == LG_SEQUENCE ? NULL : &frame->fields[index];
    unsigned child_type = field ? field->type : node->element; const lg_node *child = &lg_nodes[child_type];
    unsigned char *at = field ? frame->native + field->offset : frame->data + index * child->size;
    if (field && field->pointer) {
      void *pointer = lb_allocate(&walk->scope, 1, child->size); if (!pointer) return 0;
      memcpy(at, &pointer, sizeof(pointer)); at = pointer;
    }
    zval *input = zend_hash_index_find(frame->items, index + frame->wire_offset);
    if (!input) return lb_fail(&walk->scope, "Missing copied wire field", 1);
    walk->frames[++depth] = (lg_frame){ .type = child_type, .wire = input, .native = at };
  }
}
static zval *lg_slot(zval *owner) {
  zval empty; ZVAL_NULL(&empty);
  // Insert before constructing the child. Any Zend bailout leaves every
  // partially built child reachable from the call context's owned root zval.
  return zend_hash_next_index_insert(Z_ARRVAL_P(owner), &empty);
}
static int lg_output_enter(lg_walk *walk, lg_frame *frame, const lg_node *node) {
  lb_scope *s = &walk->scope; size_t branch = 0;
  if (node->kind == LG_SEQUENCE) {
    const lg_node *child = &lg_nodes[node->element];
    memcpy(&frame->count, frame->native + node->length_offset, sizeof(frame->count));
    memcpy(&frame->data, frame->native + node->data_offset, sizeof(frame->data));
    if (!lb_readable(s, frame->data, frame->count, child->size, child->alignment)
        || !lg_children(walk, frame->count) || !lb_charge(s, frame->count, child->size)) return 0;
  } else {
    if (node->kind == LG_VARIANT) {
      uint32_t raw; memcpy(&raw, frame->native + node->tag_offset, sizeof(raw)); branch = raw;
    } else if (node->kind == LG_OPTION || node->kind == LG_RESULT) {
      unsigned char raw; memcpy(&raw, frame->native + node->tag_offset, sizeof(raw)); branch = raw;
    }
    if (branch >= node->branch_count) return lb_fail(s, "Invalid native copied branch tag", 0);
    frame->fields = node->branches[branch].fields; frame->count = node->branches[branch].count;
    if (!lg_children(walk, frame->count)) return 0;
  }
  if (node->kind == LG_OPTION && !branch) { ZVAL_NULL(frame->wire); return 1; }
  if (node->kind == LG_VARIANT || node->kind == LG_RESULT) {
    array_init_size(frame->wire, 2);
    if (node->kind == LG_VARIANT) {
      add_next_index_long(frame->wire, (zend_long)branch); frame->children = lg_slot(frame->wire);
      array_init_size(frame->children, (uint32_t)frame->count);
    } else {
      add_next_index_bool(frame->wire, branch); frame->children = frame->wire;
    }
  } else { array_init_size(frame->wire, (uint32_t)frame->count); frame->children = frame->wire; }
  return 1;
}
static int lg_from(lg_walk *walk, unsigned type, const void *value, zval *out) {
  size_t depth = 0;
  // The cursor never writes through native, including when it points to a const
  // borrowed span. A shared frame type avoids a second unbounded traversal.
  walk->frames[0] = (lg_frame){ .type = type, .wire = out, .native = (unsigned char *)value };
  while (true) {
    lg_frame *frame = &walk->frames[depth]; const lg_node *node = &lg_nodes[frame->type];
    if (!frame->entered) {
      if (!lg_step(walk, depth) || !lb_readable(&walk->scope, frame->native, 1, node->size, node->alignment)) return 0;
      if (!node->inhabited) return lb_fail(&walk->scope, "Uninhabited native copied value", 0);
      for (size_t index = 0; index < depth; index++) if (walk->frames[index].type == frame->type && walk->frames[index].native == frame->native)
        return lb_fail(&walk->scope, "Cyclic native copied value", 0);
      frame->entered = true;
      if (node->kind == LG_SCALAR) { if (!node->output(frame->native, frame->wire, &walk->scope)) return 0; }
      else if (!lb_charge(&walk->scope, 1, 16) || !lg_output_enter(walk, frame, node)) return 0;
    }
    if (frame->index == frame->count) { if (!depth) return 1; depth--; continue; }
    if (depth == 128) return lg_step(walk, 129);
    size_t index = frame->index++; const lg_field *field = node->kind == LG_SEQUENCE ? NULL : &frame->fields[index];
    unsigned child_type = field ? field->type : node->element; const lg_node *child = &lg_nodes[child_type];
    unsigned char *at = field ? frame->native + field->offset : frame->data + index * child->size;
    if (field && field->pointer) {
      if (!lb_charge(&walk->scope, 1, child->size)) return 0;
      unsigned char *pointer; memcpy(&pointer, at, sizeof(pointer)); at = pointer;
    }
    zval *wire = lg_slot(frame->children);
    walk->frames[++depth] = (lg_frame){ .type = child_type, .wire = wire, .native = at };
  }
}


typedef struct lgc_call lgc_call;
typedef struct lgc_borrow {
  struct lgc_borrow *next, *call_next;
  uintptr_t identity;
  unsigned signature;
  zval *callback;
  lgc_call *call;
} lgc_borrow;
typedef struct lgc_reply {
  struct lgc_reply *next;
  zval arguments[16], value;
} lgc_reply;
struct lgc_call {
  lg_walk walk;
  lgc_borrow *borrows;
  lgc_reply *replies;
  zval wire;
  uint32_t status;
  int bailout;
};
static lgc_borrow *lgc_borrows;
static uintptr_t lgc_next_identity;
static unsigned lgc_depth;

static lgc_borrow *lgc_lookup(void *context, unsigned signature) {
  uintptr_t identity = (uintptr_t)context;
  if (!identity) return NULL;
  for (lgc_borrow *borrow = lgc_borrows; borrow; borrow = borrow->next)
    if (borrow->identity == identity && borrow->signature == signature) return borrow;
  return NULL;
}
static void *lgc_register(lgc_call *call, unsigned signature, zval *callback) {
  if (!zend_is_callable(callback, 0, NULL)) { lb_fail(&call->walk.scope, "Expected a synchronous callable", 1); return NULL; }
  if (lgc_next_identity == UINTPTR_MAX) { lb_fail(&call->walk.scope, "Zend callback context identities exhausted", 0); return NULL; }
  lgc_borrow *borrow = lb_allocate(&call->walk.scope, 1, sizeof(*borrow));
  if (!borrow) return NULL;
  *borrow = (lgc_borrow){ lgc_borrows, call->borrows, ++lgc_next_identity, signature, callback, call };
  lgc_borrows = borrow; call->borrows = borrow;
  return (void *)borrow->identity;
}
static void lgc_unregister(lgc_call *call) {
  for (lgc_borrow *borrow = call->borrows; borrow; borrow = borrow->call_next) {
    lgc_borrow **entry = &lgc_borrows;
    while (*entry && *entry != borrow) entry = &(*entry)->next;
    if (*entry) *entry = borrow->next;
  }
  call->borrows = NULL;
}
static void lgc_clear_zval(lgc_call *call, zval *value) {
  zend_try { zval_ptr_dtor(value); }
  zend_catch { call->bailout = 1; } zend_end_try();
  ZVAL_UNDEF(value);
}
static void lgc_clear(lgc_call *call) {
  lgc_unregister(call);
  // Reply strings and nested buffers must survive the native copy. The frame
  // owns them until the entire downcall, not merely the PHP callback, finishes.
  zend_object *failure = EG(exception);
  if (failure) { GC_ADDREF(failure); zend_clear_exception(); }
  for (lgc_reply *reply = call->replies; reply; reply = reply->next) {
    for (unsigned index = 0; index < 16; ++index) lgc_clear_zval(call, &reply->arguments[index]);
    lgc_clear_zval(call, &reply->value);
  }
  lgc_clear_zval(call, &call->wire);
  lb_scope_clear(&call->walk.scope);
  if (failure) {
    if (EG(exception)) zend_clear_exception();
    // PHP 8.4 exit() uses an internal unwind object, not Throwable. Restore
    // the original engine exception without applying userland throw checks.
    zend_throw_exception_internal(failure);
  }
}
typedef struct { uint64_t token; unsigned signature; } lgc_owned;
static int lgc_owned_type;


static void lgc_owned_close(lgc_owned *owner) {
  if (!owner || !owner->token) return;
  uint64_t token = owner->token; owner->token = 0;
  switch (owner->signature) {
    case 2: callbackcheckedrecords_callback_e014092ff0a1ee8527eeeb58a78e2de63bdf09fa_lease_dispose(token); break;
    case 4: callbackcheckedrecords_callback_d885a7d82ec894d17b81e7a67a36bc2930adca13_lease_dispose(token); break;
    case 6: callbackcheckedrecords_callback_2e292aebff8c53f6a465ec3d5745e74400590434_lease_dispose(token); break;
    case 7: callbackcheckedrecords_callback_8994592329ecba032f0abfaa9703e59a57f3c6a1_lease_dispose(token); break;
  }
}
static void lgc_owned_destroy(zend_resource *resource) {
  lgc_owned *owner = resource->ptr; lgc_owned_close(owner); LB_ZEND_FREE(owner);
}
static int lgc_from(lgc_call *call, unsigned type, const void *input, zval *output) {
  if (lg_from(&call->walk, type, input, output)) return 1;
  if (call->walk.scope.failure == 4) { callbackcheckedrecords_graph_retire(); call->status = 4; }
  return 0;
}


static uint32_t lgc_callback0(void *context, const callbackcheckedrecords_graph_38a8689c2f20ead532ea_t *arg0, callbackcheckedrecords_graph_29468227bdfd05da1480_t *output) {
  lgc_borrow *borrow = lgc_lookup(context, 0);
  if (!borrow) return 6;
  lgc_call *call = borrow->call;
  if (EG(exception) || call->bailout || call->status || call->walk.scope.error) return 6;
  if (!lb_readable(&call->walk.scope, output, 1, sizeof(*output), _Alignof(callbackcheckedrecords_graph_29468227bdfd05da1480_t))) return 6;
  lgc_reply *reply = lb_allocate(&call->walk.scope, 1, sizeof(*reply));
  if (!reply) return 6;
  reply->next = call->replies; call->replies = reply;
  int success = 0;
  zend_try {
    do {
      if (!lgc_from(call, 0, arg0, &reply->arguments[0])) break;
      if (call_user_function(EG(function_table), NULL, borrow->callback, &reply->value, 1, reply->arguments) != SUCCESS || EG(exception)) break;
      if (!lg_to(&call->walk, 2, &reply->value, output)) break;
      success = 1;
    } while (0);
  } zend_catch { call->bailout = 1; } zend_end_try();
  return success && !call->bailout && !EG(exception) ? 0 : 6;
}


static uint32_t lgc_callback1(void *context, const callbackcheckedrecords_scalar_nat_t *arg0, const callbackcheckedrecords_interval_t *arg1, callbackcheckedrecords_interval_t *output) {
  lgc_borrow *borrow = lgc_lookup(context, 1);
  if (!borrow) return 6;
  lgc_call *call = borrow->call;
  if (EG(exception) || call->bailout || call->status || call->walk.scope.error) return 6;
  if (!lb_readable(&call->walk.scope, output, 1, sizeof(*output), _Alignof(callbackcheckedrecords_interval_t))) return 6;
  lgc_reply *reply = lb_allocate(&call->walk.scope, 1, sizeof(*reply));
  if (!reply) return 6;
  reply->next = call->replies; call->replies = reply;
  int success = 0;
  zend_try {
    do {
      if (!lgc_from(call, 5, arg0, &reply->arguments[0])) break;
      if (!lgc_from(call, 3, arg1, &reply->arguments[1])) break;
      if (call_user_function(EG(function_table), NULL, borrow->callback, &reply->value, 2, reply->arguments) != SUCCESS || EG(exception)) break;
      if (!lg_to(&call->walk, 3, &reply->value, output)) break;
      success = 1;
    } while (0);
  } zend_catch { call->bailout = 1; } zend_end_try();
  return success && !call->bailout && !EG(exception) ? 0 : 6;
}


ZEND_BEGIN_ARG_INFO_EX(lgc_close_args2, 0, 0, 1)
  ZEND_ARG_INFO(0, token)
ZEND_END_ARG_INFO()
static ZEND_FUNCTION(lgc_close2) {
  zval *token; ZEND_PARSE_PARAMETERS_START(1, 1) Z_PARAM_RESOURCE(token) ZEND_PARSE_PARAMETERS_END();
  lgc_owned *owner = zend_fetch_resource_ex(token, "Lean graph closure", lgc_owned_type);
  if (!owner) RETURN_THROWS();
  if (owner->signature != 2) { zend_type_error("Lean closure signature differs"); RETURN_THROWS(); }
  lgc_owned_close(owner); RETURN_NULL();
}


static uint32_t lgc_callback3(void *context, const callbackcheckedrecords_interval_t *arg0, callbackcheckedrecords_interval_t *output) {
  lgc_borrow *borrow = lgc_lookup(context, 3);
  if (!borrow) return 6;
  lgc_call *call = borrow->call;
  if (EG(exception) || call->bailout || call->status || call->walk.scope.error) return 6;
  if (!lb_readable(&call->walk.scope, output, 1, sizeof(*output), _Alignof(callbackcheckedrecords_interval_t))) return 6;
  lgc_reply *reply = lb_allocate(&call->walk.scope, 1, sizeof(*reply));
  if (!reply) return 6;
  reply->next = call->replies; call->replies = reply;
  int success = 0;
  zend_try {
    do {
      if (!lgc_from(call, 3, arg0, &reply->arguments[0])) break;
      if (call_user_function(EG(function_table), NULL, borrow->callback, &reply->value, 1, reply->arguments) != SUCCESS || EG(exception)) break;
      if (!lg_to(&call->walk, 3, &reply->value, output)) break;
      success = 1;
    } while (0);
  } zend_catch { call->bailout = 1; } zend_end_try();
  return success && !call->bailout && !EG(exception) ? 0 : 6;
}


ZEND_BEGIN_ARG_INFO_EX(lgc_close_args4, 0, 0, 1)
  ZEND_ARG_INFO(0, token)
ZEND_END_ARG_INFO()
static ZEND_FUNCTION(lgc_close4) {
  zval *token; ZEND_PARSE_PARAMETERS_START(1, 1) Z_PARAM_RESOURCE(token) ZEND_PARSE_PARAMETERS_END();
  lgc_owned *owner = zend_fetch_resource_ex(token, "Lean graph closure", lgc_owned_type);
  if (!owner) RETURN_THROWS();
  if (owner->signature != 4) { zend_type_error("Lean closure signature differs"); RETURN_THROWS(); }
  lgc_owned_close(owner); RETURN_NULL();
}


static uint32_t lgc_callback5(void *context, const callbackcheckedrecords_weighted_t *arg0, callbackcheckedrecords_weighted_t *output) {
  lgc_borrow *borrow = lgc_lookup(context, 5);
  if (!borrow) return 6;
  lgc_call *call = borrow->call;
  if (EG(exception) || call->bailout || call->status || call->walk.scope.error) return 6;
  if (!lb_readable(&call->walk.scope, output, 1, sizeof(*output), _Alignof(callbackcheckedrecords_weighted_t))) return 6;
  lgc_reply *reply = lb_allocate(&call->walk.scope, 1, sizeof(*reply));
  if (!reply) return 6;
  reply->next = call->replies; call->replies = reply;
  int success = 0;
  zend_try {
    do {
      if (!lgc_from(call, 4, arg0, &reply->arguments[0])) break;
      if (call_user_function(EG(function_table), NULL, borrow->callback, &reply->value, 1, reply->arguments) != SUCCESS || EG(exception)) break;
      if (!lg_to(&call->walk, 4, &reply->value, output)) break;
      success = 1;
    } while (0);
  } zend_catch { call->bailout = 1; } zend_end_try();
  return success && !call->bailout && !EG(exception) ? 0 : 6;
}


ZEND_BEGIN_ARG_INFO_EX(lgc_close_args6, 0, 0, 1)
  ZEND_ARG_INFO(0, token)
ZEND_END_ARG_INFO()
static ZEND_FUNCTION(lgc_close6) {
  zval *token; ZEND_PARSE_PARAMETERS_START(1, 1) Z_PARAM_RESOURCE(token) ZEND_PARSE_PARAMETERS_END();
  lgc_owned *owner = zend_fetch_resource_ex(token, "Lean graph closure", lgc_owned_type);
  if (!owner) RETURN_THROWS();
  if (owner->signature != 6) { zend_type_error("Lean closure signature differs"); RETURN_THROWS(); }
  lgc_owned_close(owner); RETURN_NULL();
}


ZEND_BEGIN_ARG_INFO_EX(lgc_close_args7, 0, 0, 1)
  ZEND_ARG_INFO(0, token)
ZEND_END_ARG_INFO()
static ZEND_FUNCTION(lgc_close7) {
  zval *token; ZEND_PARSE_PARAMETERS_START(1, 1) Z_PARAM_RESOURCE(token) ZEND_PARSE_PARAMETERS_END();
  lgc_owned *owner = zend_fetch_resource_ex(token, "Lean graph closure", lgc_owned_type);
  if (!owner) RETURN_THROWS();
  if (owner->signature != 7) { zend_type_error("Lean closure signature differs"); RETURN_THROWS(); }
  lgc_owned_close(owner); RETURN_NULL();
}

typedef struct {
  lgc_call call;
  callbackcheckedrecords_callback_00652748bed3eb7036c9091f570efa39888f5490 input0;
  callbackcheckedrecords_interval_t recovery0;
  callbackcheckedrecords_scalar_nat_t output;
} lgc_context_call0;
static void lgc_cleanup_call0(lgc_context_call0 *ctx) {
  callbackcheckedrecords_scalar_nat_t_clear(&ctx->output);
  lgc_clear(&ctx->call);
}
static void lgc_execute_call0(lgc_context_call0 *ctx, zval *args) {
  (void)args; lgc_call *call = &ctx->call;
  
  if (Z_TYPE(args[0]) != IS_ARRAY || zend_hash_num_elements(Z_ARRVAL(args[0])) != 2) { lb_fail(&call->walk.scope, "Malformed checked callback", 1); return; }
  zval *callback0 = zend_hash_index_find(Z_ARRVAL(args[0]), 0);
  zval *recovery0 = zend_hash_index_find(Z_ARRVAL(args[0]), 1);
  if (!callback0 || !recovery0) { lb_fail(&call->walk.scope, "Malformed checked callback", 1); return; }
  ZVAL_DEREF(callback0); ZVAL_DEREF(recovery0);
  if (!lg_to(&call->walk, 3, recovery0, &ctx->recovery0)) return;
  ctx->input0.call = lgc_callback3;
  ctx->input0.context = lgc_register(call, 3, callback0);
  if (!ctx->input0.context) return;
  ctx->input0.recovery = &ctx->recovery0;
  call->status = callbackcheckedrecords_graph_initialize();
  if (!call->status) {
    uint32_t status = lean_bridge_697151f2fc3cf6b95ff12b69_graph(&ctx->input0, &ctx->output);
    if (!call->status) call->status = status;
  }
  if (call->status == 10) call->status = 1;
  else if (call->status == 4 || call->status > 6) { callbackcheckedrecords_graph_retire(); call->status = 4; }
  if (call->status || EG(exception) || call->bailout || call->walk.scope.error) return;
  if (!lgc_from(call, 5, &ctx->output, &call->wire)) return;
  if (!callbackcheckedrecords_graph_ready()) call->status = 5;
}
ZEND_BEGIN_ARG_INFO_EX(lgc_args_call0, 0, 0, 1)
  ZEND_ARG_INFO(0, arg0)
ZEND_END_ARG_INFO()
static ZEND_FUNCTION(lgc_call0) {
  if (ZEND_NUM_ARGS() != 1) { zend_argument_count_error("Expected exactly 1 arguments"); RETURN_THROWS(); }
  if (lgc_depth == 64) { zend_value_error("Lean calls exceed 64 reentry levels"); RETURN_THROWS(); }
  zval args[1];
  if (zend_get_parameters_array_ex(1, args) != SUCCESS) RETURN_THROWS();
  if (sizeof(lgc_context_call0) > 16 * 1024 * 1024) { zend_value_error("Zend call context exceeds the conversion limit"); RETURN_THROWS(); }
  lgc_context_call0 *ctx = LB_ZEND_CALLOC(1, sizeof(*ctx));
  if (!ctx) { zend_throw_error(NULL, "Zend call allocation failed"); RETURN_THROWS(); }
  ctx->call.walk.scope.remaining = 16 * 1024 * 1024 - sizeof(*ctx); ctx->call.walk.visits = 262144;
  ZVAL_UNDEF(&ctx->call.wire); ZVAL_NULL(return_value); ++lgc_depth;
  zend_try { lgc_execute_call0(ctx, args); }
  zend_catch { ctx->call.bailout = 1; } zend_end_try();
  uint32_t status = ctx->call.status;
  const char *message = ctx->call.walk.scope.error; int type_error = ctx->call.walk.scope.type_error;
  if (!status && !message && !ctx->call.bailout && !EG(exception)) {
    ZVAL_COPY_VALUE(return_value, &ctx->call.wire); ZVAL_UNDEF(&ctx->call.wire);
  }
  lgc_cleanup_call0(ctx);
  int bailout = ctx->call.bailout; LB_ZEND_FREE(ctx); --lgc_depth;
  if (bailout) zend_bailout();
  if (EG(exception)) { zval_ptr_dtor(return_value); ZVAL_NULL(return_value); RETURN_THROWS(); }
  if (status) { zend_throw_exception(zend_ce_exception, message ? message : "Compiled Lean graph call failed", status); RETURN_THROWS(); }
  if (message) {
    if (type_error) zend_type_error("%s", message); else zend_value_error("%s", message);
    RETURN_THROWS();
  }
}

typedef struct {
  lgc_call call;
  callbackcheckedrecords_callback_2663a58c7c0e71654db1d87936875f8677e197b2 input0;
  callbackcheckedrecords_graph_29468227bdfd05da1480_t recovery0;
  callbackcheckedrecords_scalar_nat_t output;
} lgc_context_call1;
static void lgc_cleanup_call1(lgc_context_call1 *ctx) {
  callbackcheckedrecords_scalar_nat_t_clear(&ctx->output);
  lgc_clear(&ctx->call);
}
static void lgc_execute_call1(lgc_context_call1 *ctx, zval *args) {
  (void)args; lgc_call *call = &ctx->call;
  
  if (Z_TYPE(args[0]) != IS_ARRAY || zend_hash_num_elements(Z_ARRVAL(args[0])) != 2) { lb_fail(&call->walk.scope, "Malformed checked callback", 1); return; }
  zval *callback0 = zend_hash_index_find(Z_ARRVAL(args[0]), 0);
  zval *recovery0 = zend_hash_index_find(Z_ARRVAL(args[0]), 1);
  if (!callback0 || !recovery0) { lb_fail(&call->walk.scope, "Malformed checked callback", 1); return; }
  ZVAL_DEREF(callback0); ZVAL_DEREF(recovery0);
  if (!lg_to(&call->walk, 2, recovery0, &ctx->recovery0)) return;
  ctx->input0.call = lgc_callback0;
  ctx->input0.context = lgc_register(call, 0, callback0);
  if (!ctx->input0.context) return;
  ctx->input0.recovery = &ctx->recovery0;
  call->status = callbackcheckedrecords_graph_initialize();
  if (!call->status) {
    uint32_t status = lean_bridge_413afe4aaf66162bb3ba3d3c_graph(&ctx->input0, &ctx->output);
    if (!call->status) call->status = status;
  }
  if (call->status == 10) call->status = 1;
  else if (call->status == 4 || call->status > 6) { callbackcheckedrecords_graph_retire(); call->status = 4; }
  if (call->status || EG(exception) || call->bailout || call->walk.scope.error) return;
  if (!lgc_from(call, 5, &ctx->output, &call->wire)) return;
  if (!callbackcheckedrecords_graph_ready()) call->status = 5;
}
ZEND_BEGIN_ARG_INFO_EX(lgc_args_call1, 0, 0, 1)
  ZEND_ARG_INFO(0, arg0)
ZEND_END_ARG_INFO()
static ZEND_FUNCTION(lgc_call1) {
  if (ZEND_NUM_ARGS() != 1) { zend_argument_count_error("Expected exactly 1 arguments"); RETURN_THROWS(); }
  if (lgc_depth == 64) { zend_value_error("Lean calls exceed 64 reentry levels"); RETURN_THROWS(); }
  zval args[1];
  if (zend_get_parameters_array_ex(1, args) != SUCCESS) RETURN_THROWS();
  if (sizeof(lgc_context_call1) > 16 * 1024 * 1024) { zend_value_error("Zend call context exceeds the conversion limit"); RETURN_THROWS(); }
  lgc_context_call1 *ctx = LB_ZEND_CALLOC(1, sizeof(*ctx));
  if (!ctx) { zend_throw_error(NULL, "Zend call allocation failed"); RETURN_THROWS(); }
  ctx->call.walk.scope.remaining = 16 * 1024 * 1024 - sizeof(*ctx); ctx->call.walk.visits = 262144;
  ZVAL_UNDEF(&ctx->call.wire); ZVAL_NULL(return_value); ++lgc_depth;
  zend_try { lgc_execute_call1(ctx, args); }
  zend_catch { ctx->call.bailout = 1; } zend_end_try();
  uint32_t status = ctx->call.status;
  const char *message = ctx->call.walk.scope.error; int type_error = ctx->call.walk.scope.type_error;
  if (!status && !message && !ctx->call.bailout && !EG(exception)) {
    ZVAL_COPY_VALUE(return_value, &ctx->call.wire); ZVAL_UNDEF(&ctx->call.wire);
  }
  lgc_cleanup_call1(ctx);
  int bailout = ctx->call.bailout; LB_ZEND_FREE(ctx); --lgc_depth;
  if (bailout) zend_bailout();
  if (EG(exception)) { zval_ptr_dtor(return_value); ZVAL_NULL(return_value); RETURN_THROWS(); }
  if (status) { zend_throw_exception(zend_ce_exception, message ? message : "Compiled Lean graph call failed", status); RETURN_THROWS(); }
  if (message) {
    if (type_error) zend_type_error("%s", message); else zend_value_error("%s", message);
    RETURN_THROWS();
  }
}

typedef struct {
  lgc_call call;
  callbackcheckedrecords_callback_526ba4a0f03797057c1f9a17ca435a5a42131510 input0;
  callbackcheckedrecords_interval_t recovery0;
  callbackcheckedrecords_scalar_nat_t output;
} lgc_context_call2;
static void lgc_cleanup_call2(lgc_context_call2 *ctx) {
  callbackcheckedrecords_scalar_nat_t_clear(&ctx->output);
  lgc_clear(&ctx->call);
}
static void lgc_execute_call2(lgc_context_call2 *ctx, zval *args) {
  (void)args; lgc_call *call = &ctx->call;
  
  if (Z_TYPE(args[0]) != IS_ARRAY || zend_hash_num_elements(Z_ARRVAL(args[0])) != 2) { lb_fail(&call->walk.scope, "Malformed checked callback", 1); return; }
  zval *callback0 = zend_hash_index_find(Z_ARRVAL(args[0]), 0);
  zval *recovery0 = zend_hash_index_find(Z_ARRVAL(args[0]), 1);
  if (!callback0 || !recovery0) { lb_fail(&call->walk.scope, "Malformed checked callback", 1); return; }
  ZVAL_DEREF(callback0); ZVAL_DEREF(recovery0);
  if (!lg_to(&call->walk, 3, recovery0, &ctx->recovery0)) return;
  ctx->input0.call = lgc_callback1;
  ctx->input0.context = lgc_register(call, 1, callback0);
  if (!ctx->input0.context) return;
  ctx->input0.recovery = &ctx->recovery0;
  call->status = callbackcheckedrecords_graph_initialize();
  if (!call->status) {
    uint32_t status = lean_bridge_184bfb6b98fb39095f0bfec8_graph(&ctx->input0, &ctx->output);
    if (!call->status) call->status = status;
  }
  if (call->status == 10) call->status = 1;
  else if (call->status == 4 || call->status > 6) { callbackcheckedrecords_graph_retire(); call->status = 4; }
  if (call->status || EG(exception) || call->bailout || call->walk.scope.error) return;
  if (!lgc_from(call, 5, &ctx->output, &call->wire)) return;
  if (!callbackcheckedrecords_graph_ready()) call->status = 5;
}
ZEND_BEGIN_ARG_INFO_EX(lgc_args_call2, 0, 0, 1)
  ZEND_ARG_INFO(0, arg0)
ZEND_END_ARG_INFO()
static ZEND_FUNCTION(lgc_call2) {
  if (ZEND_NUM_ARGS() != 1) { zend_argument_count_error("Expected exactly 1 arguments"); RETURN_THROWS(); }
  if (lgc_depth == 64) { zend_value_error("Lean calls exceed 64 reentry levels"); RETURN_THROWS(); }
  zval args[1];
  if (zend_get_parameters_array_ex(1, args) != SUCCESS) RETURN_THROWS();
  if (sizeof(lgc_context_call2) > 16 * 1024 * 1024) { zend_value_error("Zend call context exceeds the conversion limit"); RETURN_THROWS(); }
  lgc_context_call2 *ctx = LB_ZEND_CALLOC(1, sizeof(*ctx));
  if (!ctx) { zend_throw_error(NULL, "Zend call allocation failed"); RETURN_THROWS(); }
  ctx->call.walk.scope.remaining = 16 * 1024 * 1024 - sizeof(*ctx); ctx->call.walk.visits = 262144;
  ZVAL_UNDEF(&ctx->call.wire); ZVAL_NULL(return_value); ++lgc_depth;
  zend_try { lgc_execute_call2(ctx, args); }
  zend_catch { ctx->call.bailout = 1; } zend_end_try();
  uint32_t status = ctx->call.status;
  const char *message = ctx->call.walk.scope.error; int type_error = ctx->call.walk.scope.type_error;
  if (!status && !message && !ctx->call.bailout && !EG(exception)) {
    ZVAL_COPY_VALUE(return_value, &ctx->call.wire); ZVAL_UNDEF(&ctx->call.wire);
  }
  lgc_cleanup_call2(ctx);
  int bailout = ctx->call.bailout; LB_ZEND_FREE(ctx); --lgc_depth;
  if (bailout) zend_bailout();
  if (EG(exception)) { zval_ptr_dtor(return_value); ZVAL_NULL(return_value); RETURN_THROWS(); }
  if (status) { zend_throw_exception(zend_ce_exception, message ? message : "Compiled Lean graph call failed", status); RETURN_THROWS(); }
  if (message) {
    if (type_error) zend_type_error("%s", message); else zend_value_error("%s", message);
    RETURN_THROWS();
  }
}

typedef struct {
  lgc_call call;
  callbackcheckedrecords_callback_cd01d463066ae86d043223e65eab1640e16b22ab input0;
  callbackcheckedrecords_weighted_t recovery0;
  callbackcheckedrecords_scalar_nat_t output;
} lgc_context_call3;
static void lgc_cleanup_call3(lgc_context_call3 *ctx) {
  callbackcheckedrecords_scalar_nat_t_clear(&ctx->output);
  lgc_clear(&ctx->call);
}
static void lgc_execute_call3(lgc_context_call3 *ctx, zval *args) {
  (void)args; lgc_call *call = &ctx->call;
  
  if (Z_TYPE(args[0]) != IS_ARRAY || zend_hash_num_elements(Z_ARRVAL(args[0])) != 2) { lb_fail(&call->walk.scope, "Malformed checked callback", 1); return; }
  zval *callback0 = zend_hash_index_find(Z_ARRVAL(args[0]), 0);
  zval *recovery0 = zend_hash_index_find(Z_ARRVAL(args[0]), 1);
  if (!callback0 || !recovery0) { lb_fail(&call->walk.scope, "Malformed checked callback", 1); return; }
  ZVAL_DEREF(callback0); ZVAL_DEREF(recovery0);
  if (!lg_to(&call->walk, 4, recovery0, &ctx->recovery0)) return;
  ctx->input0.call = lgc_callback5;
  ctx->input0.context = lgc_register(call, 5, callback0);
  if (!ctx->input0.context) return;
  ctx->input0.recovery = &ctx->recovery0;
  call->status = callbackcheckedrecords_graph_initialize();
  if (!call->status) {
    uint32_t status = lean_bridge_f168e18f231fdb7eb1733b0e_graph(&ctx->input0, &ctx->output);
    if (!call->status) call->status = status;
  }
  if (call->status == 10) call->status = 1;
  else if (call->status == 4 || call->status > 6) { callbackcheckedrecords_graph_retire(); call->status = 4; }
  if (call->status || EG(exception) || call->bailout || call->walk.scope.error) return;
  if (!lgc_from(call, 5, &ctx->output, &call->wire)) return;
  if (!callbackcheckedrecords_graph_ready()) call->status = 5;
}
ZEND_BEGIN_ARG_INFO_EX(lgc_args_call3, 0, 0, 1)
  ZEND_ARG_INFO(0, arg0)
ZEND_END_ARG_INFO()
static ZEND_FUNCTION(lgc_call3) {
  if (ZEND_NUM_ARGS() != 1) { zend_argument_count_error("Expected exactly 1 arguments"); RETURN_THROWS(); }
  if (lgc_depth == 64) { zend_value_error("Lean calls exceed 64 reentry levels"); RETURN_THROWS(); }
  zval args[1];
  if (zend_get_parameters_array_ex(1, args) != SUCCESS) RETURN_THROWS();
  if (sizeof(lgc_context_call3) > 16 * 1024 * 1024) { zend_value_error("Zend call context exceeds the conversion limit"); RETURN_THROWS(); }
  lgc_context_call3 *ctx = LB_ZEND_CALLOC(1, sizeof(*ctx));
  if (!ctx) { zend_throw_error(NULL, "Zend call allocation failed"); RETURN_THROWS(); }
  ctx->call.walk.scope.remaining = 16 * 1024 * 1024 - sizeof(*ctx); ctx->call.walk.visits = 262144;
  ZVAL_UNDEF(&ctx->call.wire); ZVAL_NULL(return_value); ++lgc_depth;
  zend_try { lgc_execute_call3(ctx, args); }
  zend_catch { ctx->call.bailout = 1; } zend_end_try();
  uint32_t status = ctx->call.status;
  const char *message = ctx->call.walk.scope.error; int type_error = ctx->call.walk.scope.type_error;
  if (!status && !message && !ctx->call.bailout && !EG(exception)) {
    ZVAL_COPY_VALUE(return_value, &ctx->call.wire); ZVAL_UNDEF(&ctx->call.wire);
  }
  lgc_cleanup_call3(ctx);
  int bailout = ctx->call.bailout; LB_ZEND_FREE(ctx); --lgc_depth;
  if (bailout) zend_bailout();
  if (EG(exception)) { zval_ptr_dtor(return_value); ZVAL_NULL(return_value); RETURN_THROWS(); }
  if (status) { zend_throw_exception(zend_ce_exception, message ? message : "Compiled Lean graph call failed", status); RETURN_THROWS(); }
  if (message) {
    if (type_error) zend_type_error("%s", message); else zend_value_error("%s", message);
    RETURN_THROWS();
  }
}

typedef struct {
  lgc_call call;
  callbackcheckedrecords_scalar_nat_t input0;
  uint64_t output;
} lgc_context_call4;
static void lgc_cleanup_call4(lgc_context_call4 *ctx) {
  callbackcheckedrecords_callback_e014092ff0a1ee8527eeeb58a78e2de63bdf09fa_lease_dispose(ctx->output); ctx->output = 0;
  lgc_clear(&ctx->call);
}
static void lgc_execute_call4(lgc_context_call4 *ctx, zval *args) {
  (void)args; lgc_call *call = &ctx->call;
  
  if (!lg_to(&call->walk, 5, &args[0], &ctx->input0)) return;
  call->status = callbackcheckedrecords_graph_initialize();
  if (!call->status) {
    uint32_t status = lean_bridge_97d7a19c3e5ee22681017ca9_graph(&ctx->input0, &ctx->output);
    if (!call->status) call->status = status;
  }
  if (call->status == 10) call->status = 1;
  else if (call->status == 4 || call->status > 6) { callbackcheckedrecords_graph_retire(); call->status = 4; }
  if (call->status || EG(exception) || call->bailout || call->walk.scope.error) return;
  if (!ctx->output) { callbackcheckedrecords_graph_retire(); call->status = 4; return; }
  if (!lb_charge(&call->walk.scope, 1, sizeof(lgc_owned))) return;
  lgc_owned *returned = LB_ZEND_CALLOC(1, sizeof(*returned));
  if (!returned) { call->walk.scope.failure = 3; lb_fail(&call->walk.scope, "Lean closure resource allocation failed", 0); return; }
  zend_resource *resource = NULL;
  zend_try { resource = zend_register_resource(returned, lgc_owned_type); }
  zend_catch { LB_ZEND_FREE(returned); zend_bailout(); } zend_end_try();
  returned->signature = 2; returned->token = ctx->output; ctx->output = 0;
  ZVAL_RES(&call->wire, resource);
  if (!callbackcheckedrecords_graph_ready()) call->status = 5;
}
ZEND_BEGIN_ARG_INFO_EX(lgc_args_call4, 0, 0, 1)
  ZEND_ARG_INFO(0, arg0)
ZEND_END_ARG_INFO()
static ZEND_FUNCTION(lgc_call4) {
  if (ZEND_NUM_ARGS() != 1) { zend_argument_count_error("Expected exactly 1 arguments"); RETURN_THROWS(); }
  if (lgc_depth == 64) { zend_value_error("Lean calls exceed 64 reentry levels"); RETURN_THROWS(); }
  zval args[1];
  if (zend_get_parameters_array_ex(1, args) != SUCCESS) RETURN_THROWS();
  if (sizeof(lgc_context_call4) > 16 * 1024 * 1024) { zend_value_error("Zend call context exceeds the conversion limit"); RETURN_THROWS(); }
  lgc_context_call4 *ctx = LB_ZEND_CALLOC(1, sizeof(*ctx));
  if (!ctx) { zend_throw_error(NULL, "Zend call allocation failed"); RETURN_THROWS(); }
  ctx->call.walk.scope.remaining = 16 * 1024 * 1024 - sizeof(*ctx); ctx->call.walk.visits = 262144;
  ZVAL_UNDEF(&ctx->call.wire); ZVAL_NULL(return_value); ++lgc_depth;
  zend_try { lgc_execute_call4(ctx, args); }
  zend_catch { ctx->call.bailout = 1; } zend_end_try();
  uint32_t status = ctx->call.status;
  const char *message = ctx->call.walk.scope.error; int type_error = ctx->call.walk.scope.type_error;
  if (!status && !message && !ctx->call.bailout && !EG(exception)) {
    ZVAL_COPY_VALUE(return_value, &ctx->call.wire); ZVAL_UNDEF(&ctx->call.wire);
  }
  lgc_cleanup_call4(ctx);
  int bailout = ctx->call.bailout; LB_ZEND_FREE(ctx); --lgc_depth;
  if (bailout) zend_bailout();
  if (EG(exception)) { zval_ptr_dtor(return_value); ZVAL_NULL(return_value); RETURN_THROWS(); }
  if (status) { zend_throw_exception(zend_ce_exception, message ? message : "Compiled Lean graph call failed", status); RETURN_THROWS(); }
  if (message) {
    if (type_error) zend_type_error("%s", message); else zend_value_error("%s", message);
    RETURN_THROWS();
  }
}

typedef struct {
  lgc_call call;
  callbackcheckedrecords_scalar_nat_t input0;
  uint64_t output;
} lgc_context_call5;
static void lgc_cleanup_call5(lgc_context_call5 *ctx) {
  callbackcheckedrecords_callback_8994592329ecba032f0abfaa9703e59a57f3c6a1_lease_dispose(ctx->output); ctx->output = 0;
  lgc_clear(&ctx->call);
}
static void lgc_execute_call5(lgc_context_call5 *ctx, zval *args) {
  (void)args; lgc_call *call = &ctx->call;
  
  if (!lg_to(&call->walk, 5, &args[0], &ctx->input0)) return;
  call->status = callbackcheckedrecords_graph_initialize();
  if (!call->status) {
    uint32_t status = lean_bridge_74ed57fc03e7ed555389a3ab_graph(&ctx->input0, &ctx->output);
    if (!call->status) call->status = status;
  }
  if (call->status == 10) call->status = 1;
  else if (call->status == 4 || call->status > 6) { callbackcheckedrecords_graph_retire(); call->status = 4; }
  if (call->status || EG(exception) || call->bailout || call->walk.scope.error) return;
  if (!ctx->output) { callbackcheckedrecords_graph_retire(); call->status = 4; return; }
  if (!lb_charge(&call->walk.scope, 1, sizeof(lgc_owned))) return;
  lgc_owned *returned = LB_ZEND_CALLOC(1, sizeof(*returned));
  if (!returned) { call->walk.scope.failure = 3; lb_fail(&call->walk.scope, "Lean closure resource allocation failed", 0); return; }
  zend_resource *resource = NULL;
  zend_try { resource = zend_register_resource(returned, lgc_owned_type); }
  zend_catch { LB_ZEND_FREE(returned); zend_bailout(); } zend_end_try();
  returned->signature = 7; returned->token = ctx->output; ctx->output = 0;
  ZVAL_RES(&call->wire, resource);
  if (!callbackcheckedrecords_graph_ready()) call->status = 5;
}
ZEND_BEGIN_ARG_INFO_EX(lgc_args_call5, 0, 0, 1)
  ZEND_ARG_INFO(0, arg0)
ZEND_END_ARG_INFO()
static ZEND_FUNCTION(lgc_call5) {
  if (ZEND_NUM_ARGS() != 1) { zend_argument_count_error("Expected exactly 1 arguments"); RETURN_THROWS(); }
  if (lgc_depth == 64) { zend_value_error("Lean calls exceed 64 reentry levels"); RETURN_THROWS(); }
  zval args[1];
  if (zend_get_parameters_array_ex(1, args) != SUCCESS) RETURN_THROWS();
  if (sizeof(lgc_context_call5) > 16 * 1024 * 1024) { zend_value_error("Zend call context exceeds the conversion limit"); RETURN_THROWS(); }
  lgc_context_call5 *ctx = LB_ZEND_CALLOC(1, sizeof(*ctx));
  if (!ctx) { zend_throw_error(NULL, "Zend call allocation failed"); RETURN_THROWS(); }
  ctx->call.walk.scope.remaining = 16 * 1024 * 1024 - sizeof(*ctx); ctx->call.walk.visits = 262144;
  ZVAL_UNDEF(&ctx->call.wire); ZVAL_NULL(return_value); ++lgc_depth;
  zend_try { lgc_execute_call5(ctx, args); }
  zend_catch { ctx->call.bailout = 1; } zend_end_try();
  uint32_t status = ctx->call.status;
  const char *message = ctx->call.walk.scope.error; int type_error = ctx->call.walk.scope.type_error;
  if (!status && !message && !ctx->call.bailout && !EG(exception)) {
    ZVAL_COPY_VALUE(return_value, &ctx->call.wire); ZVAL_UNDEF(&ctx->call.wire);
  }
  lgc_cleanup_call5(ctx);
  int bailout = ctx->call.bailout; LB_ZEND_FREE(ctx); --lgc_depth;
  if (bailout) zend_bailout();
  if (EG(exception)) { zval_ptr_dtor(return_value); ZVAL_NULL(return_value); RETURN_THROWS(); }
  if (status) { zend_throw_exception(zend_ce_exception, message ? message : "Compiled Lean graph call failed", status); RETURN_THROWS(); }
  if (message) {
    if (type_error) zend_type_error("%s", message); else zend_value_error("%s", message);
    RETURN_THROWS();
  }
}

typedef struct {
  lgc_call call;
  callbackcheckedrecords_scalar_nat_t input0;
  uint64_t output;
} lgc_context_call6;
static void lgc_cleanup_call6(lgc_context_call6 *ctx) {
  callbackcheckedrecords_callback_2e292aebff8c53f6a465ec3d5745e74400590434_lease_dispose(ctx->output); ctx->output = 0;
  lgc_clear(&ctx->call);
}
static void lgc_execute_call6(lgc_context_call6 *ctx, zval *args) {
  (void)args; lgc_call *call = &ctx->call;
  
  if (!lg_to(&call->walk, 5, &args[0], &ctx->input0)) return;
  call->status = callbackcheckedrecords_graph_initialize();
  if (!call->status) {
    uint32_t status = lean_bridge_bbabc0c3fa2252f4f7a67708_graph(&ctx->input0, &ctx->output);
    if (!call->status) call->status = status;
  }
  if (call->status == 10) call->status = 1;
  else if (call->status == 4 || call->status > 6) { callbackcheckedrecords_graph_retire(); call->status = 4; }
  if (call->status || EG(exception) || call->bailout || call->walk.scope.error) return;
  if (!ctx->output) { callbackcheckedrecords_graph_retire(); call->status = 4; return; }
  if (!lb_charge(&call->walk.scope, 1, sizeof(lgc_owned))) return;
  lgc_owned *returned = LB_ZEND_CALLOC(1, sizeof(*returned));
  if (!returned) { call->walk.scope.failure = 3; lb_fail(&call->walk.scope, "Lean closure resource allocation failed", 0); return; }
  zend_resource *resource = NULL;
  zend_try { resource = zend_register_resource(returned, lgc_owned_type); }
  zend_catch { LB_ZEND_FREE(returned); zend_bailout(); } zend_end_try();
  returned->signature = 6; returned->token = ctx->output; ctx->output = 0;
  ZVAL_RES(&call->wire, resource);
  if (!callbackcheckedrecords_graph_ready()) call->status = 5;
}
ZEND_BEGIN_ARG_INFO_EX(lgc_args_call6, 0, 0, 1)
  ZEND_ARG_INFO(0, arg0)
ZEND_END_ARG_INFO()
static ZEND_FUNCTION(lgc_call6) {
  if (ZEND_NUM_ARGS() != 1) { zend_argument_count_error("Expected exactly 1 arguments"); RETURN_THROWS(); }
  if (lgc_depth == 64) { zend_value_error("Lean calls exceed 64 reentry levels"); RETURN_THROWS(); }
  zval args[1];
  if (zend_get_parameters_array_ex(1, args) != SUCCESS) RETURN_THROWS();
  if (sizeof(lgc_context_call6) > 16 * 1024 * 1024) { zend_value_error("Zend call context exceeds the conversion limit"); RETURN_THROWS(); }
  lgc_context_call6 *ctx = LB_ZEND_CALLOC(1, sizeof(*ctx));
  if (!ctx) { zend_throw_error(NULL, "Zend call allocation failed"); RETURN_THROWS(); }
  ctx->call.walk.scope.remaining = 16 * 1024 * 1024 - sizeof(*ctx); ctx->call.walk.visits = 262144;
  ZVAL_UNDEF(&ctx->call.wire); ZVAL_NULL(return_value); ++lgc_depth;
  zend_try { lgc_execute_call6(ctx, args); }
  zend_catch { ctx->call.bailout = 1; } zend_end_try();
  uint32_t status = ctx->call.status;
  const char *message = ctx->call.walk.scope.error; int type_error = ctx->call.walk.scope.type_error;
  if (!status && !message && !ctx->call.bailout && !EG(exception)) {
    ZVAL_COPY_VALUE(return_value, &ctx->call.wire); ZVAL_UNDEF(&ctx->call.wire);
  }
  lgc_cleanup_call6(ctx);
  int bailout = ctx->call.bailout; LB_ZEND_FREE(ctx); --lgc_depth;
  if (bailout) zend_bailout();
  if (EG(exception)) { zval_ptr_dtor(return_value); ZVAL_NULL(return_value); RETURN_THROWS(); }
  if (status) { zend_throw_exception(zend_ce_exception, message ? message : "Compiled Lean graph call failed", status); RETURN_THROWS(); }
  if (message) {
    if (type_error) zend_type_error("%s", message); else zend_value_error("%s", message);
    RETURN_THROWS();
  }
}

typedef struct {
  lgc_call call;
  callbackcheckedrecords_scalar_nat_t input0;
  uint64_t output;
} lgc_context_call7;
static void lgc_cleanup_call7(lgc_context_call7 *ctx) {
  callbackcheckedrecords_callback_d885a7d82ec894d17b81e7a67a36bc2930adca13_lease_dispose(ctx->output); ctx->output = 0;
  lgc_clear(&ctx->call);
}
static void lgc_execute_call7(lgc_context_call7 *ctx, zval *args) {
  (void)args; lgc_call *call = &ctx->call;
  
  if (!lg_to(&call->walk, 5, &args[0], &ctx->input0)) return;
  call->status = callbackcheckedrecords_graph_initialize();
  if (!call->status) {
    uint32_t status = lean_bridge_77496697d09177e0d1ebadfd_graph(&ctx->input0, &ctx->output);
    if (!call->status) call->status = status;
  }
  if (call->status == 10) call->status = 1;
  else if (call->status == 4 || call->status > 6) { callbackcheckedrecords_graph_retire(); call->status = 4; }
  if (call->status || EG(exception) || call->bailout || call->walk.scope.error) return;
  if (!ctx->output) { callbackcheckedrecords_graph_retire(); call->status = 4; return; }
  if (!lb_charge(&call->walk.scope, 1, sizeof(lgc_owned))) return;
  lgc_owned *returned = LB_ZEND_CALLOC(1, sizeof(*returned));
  if (!returned) { call->walk.scope.failure = 3; lb_fail(&call->walk.scope, "Lean closure resource allocation failed", 0); return; }
  zend_resource *resource = NULL;
  zend_try { resource = zend_register_resource(returned, lgc_owned_type); }
  zend_catch { LB_ZEND_FREE(returned); zend_bailout(); } zend_end_try();
  returned->signature = 4; returned->token = ctx->output; ctx->output = 0;
  ZVAL_RES(&call->wire, resource);
  if (!callbackcheckedrecords_graph_ready()) call->status = 5;
}
ZEND_BEGIN_ARG_INFO_EX(lgc_args_call7, 0, 0, 1)
  ZEND_ARG_INFO(0, arg0)
ZEND_END_ARG_INFO()
static ZEND_FUNCTION(lgc_call7) {
  if (ZEND_NUM_ARGS() != 1) { zend_argument_count_error("Expected exactly 1 arguments"); RETURN_THROWS(); }
  if (lgc_depth == 64) { zend_value_error("Lean calls exceed 64 reentry levels"); RETURN_THROWS(); }
  zval args[1];
  if (zend_get_parameters_array_ex(1, args) != SUCCESS) RETURN_THROWS();
  if (sizeof(lgc_context_call7) > 16 * 1024 * 1024) { zend_value_error("Zend call context exceeds the conversion limit"); RETURN_THROWS(); }
  lgc_context_call7 *ctx = LB_ZEND_CALLOC(1, sizeof(*ctx));
  if (!ctx) { zend_throw_error(NULL, "Zend call allocation failed"); RETURN_THROWS(); }
  ctx->call.walk.scope.remaining = 16 * 1024 * 1024 - sizeof(*ctx); ctx->call.walk.visits = 262144;
  ZVAL_UNDEF(&ctx->call.wire); ZVAL_NULL(return_value); ++lgc_depth;
  zend_try { lgc_execute_call7(ctx, args); }
  zend_catch { ctx->call.bailout = 1; } zend_end_try();
  uint32_t status = ctx->call.status;
  const char *message = ctx->call.walk.scope.error; int type_error = ctx->call.walk.scope.type_error;
  if (!status && !message && !ctx->call.bailout && !EG(exception)) {
    ZVAL_COPY_VALUE(return_value, &ctx->call.wire); ZVAL_UNDEF(&ctx->call.wire);
  }
  lgc_cleanup_call7(ctx);
  int bailout = ctx->call.bailout; LB_ZEND_FREE(ctx); --lgc_depth;
  if (bailout) zend_bailout();
  if (EG(exception)) { zval_ptr_dtor(return_value); ZVAL_NULL(return_value); RETURN_THROWS(); }
  if (status) { zend_throw_exception(zend_ce_exception, message ? message : "Compiled Lean graph call failed", status); RETURN_THROWS(); }
  if (message) {
    if (type_error) zend_type_error("%s", message); else zend_value_error("%s", message);
    RETURN_THROWS();
  }
}

typedef struct {
  lgc_call call;
  callbackcheckedrecords_interval_t input0;
  callbackcheckedrecords_scalar_nat_t output;
} lgc_context_invoke2;
static void lgc_cleanup_invoke2(lgc_context_invoke2 *ctx) {
  callbackcheckedrecords_scalar_nat_t_clear(&ctx->output);
  lgc_clear(&ctx->call);
}
static void lgc_execute_invoke2(lgc_context_invoke2 *ctx, zval *args) {
  (void)args; lgc_call *call = &ctx->call;
  lgc_owned *owner = zend_fetch_resource_ex(&args[0], "Lean graph closure", lgc_owned_type);
  if (!owner) return;
  if (owner->signature != 2 || !owner->token) { lb_fail(&call->walk.scope, "Closed or wrong-signature Lean closure", 1); return; }
  if (!lg_to(&call->walk, 3, &args[1], &ctx->input0)) return;
  call->status = callbackcheckedrecords_graph_initialize();
  if (!call->status) {
    uint32_t status = callbackcheckedrecords_callback_e014092ff0a1ee8527eeeb58a78e2de63bdf09fa_lease_call(owner->token, &ctx->input0, &ctx->output);
    if (!call->status) call->status = status;
  }
  if (call->status == 10) call->status = 1;
  else if (call->status == 4 || call->status > 6) { callbackcheckedrecords_graph_retire(); call->status = 4; }
  if (call->status || EG(exception) || call->bailout || call->walk.scope.error) return;
  if (!lgc_from(call, 5, &ctx->output, &call->wire)) return;
  if (!callbackcheckedrecords_graph_ready()) call->status = 5;
}
ZEND_BEGIN_ARG_INFO_EX(lgc_args_invoke2, 0, 0, 2)
  ZEND_ARG_INFO(0, arg0)
  ZEND_ARG_INFO(0, arg1)
ZEND_END_ARG_INFO()
static ZEND_FUNCTION(lgc_invoke2) {
  if (ZEND_NUM_ARGS() != 2) { zend_argument_count_error("Expected exactly 2 arguments"); RETURN_THROWS(); }
  if (lgc_depth == 64) { zend_value_error("Lean calls exceed 64 reentry levels"); RETURN_THROWS(); }
  zval args[2];
  if (zend_get_parameters_array_ex(2, args) != SUCCESS) RETURN_THROWS();
  if (sizeof(lgc_context_invoke2) > 16 * 1024 * 1024) { zend_value_error("Zend call context exceeds the conversion limit"); RETURN_THROWS(); }
  lgc_context_invoke2 *ctx = LB_ZEND_CALLOC(1, sizeof(*ctx));
  if (!ctx) { zend_throw_error(NULL, "Zend call allocation failed"); RETURN_THROWS(); }
  ctx->call.walk.scope.remaining = 16 * 1024 * 1024 - sizeof(*ctx); ctx->call.walk.visits = 262144;
  ZVAL_UNDEF(&ctx->call.wire); ZVAL_NULL(return_value); ++lgc_depth;
  zend_try { lgc_execute_invoke2(ctx, args); }
  zend_catch { ctx->call.bailout = 1; } zend_end_try();
  uint32_t status = ctx->call.status;
  const char *message = ctx->call.walk.scope.error; int type_error = ctx->call.walk.scope.type_error;
  if (!status && !message && !ctx->call.bailout && !EG(exception)) {
    ZVAL_COPY_VALUE(return_value, &ctx->call.wire); ZVAL_UNDEF(&ctx->call.wire);
  }
  lgc_cleanup_invoke2(ctx);
  int bailout = ctx->call.bailout; LB_ZEND_FREE(ctx); --lgc_depth;
  if (bailout) zend_bailout();
  if (EG(exception)) { zval_ptr_dtor(return_value); ZVAL_NULL(return_value); RETURN_THROWS(); }
  if (status) { zend_throw_exception(zend_ce_exception, message ? message : "Compiled Lean graph call failed", status); RETURN_THROWS(); }
  if (message) {
    if (type_error) zend_type_error("%s", message); else zend_value_error("%s", message);
    RETURN_THROWS();
  }
}

typedef struct {
  lgc_call call;
  callbackcheckedrecords_weighted_t input0;
  callbackcheckedrecords_scalar_nat_t output;
} lgc_context_invoke4;
static void lgc_cleanup_invoke4(lgc_context_invoke4 *ctx) {
  callbackcheckedrecords_scalar_nat_t_clear(&ctx->output);
  lgc_clear(&ctx->call);
}
static void lgc_execute_invoke4(lgc_context_invoke4 *ctx, zval *args) {
  (void)args; lgc_call *call = &ctx->call;
  lgc_owned *owner = zend_fetch_resource_ex(&args[0], "Lean graph closure", lgc_owned_type);
  if (!owner) return;
  if (owner->signature != 4 || !owner->token) { lb_fail(&call->walk.scope, "Closed or wrong-signature Lean closure", 1); return; }
  if (!lg_to(&call->walk, 4, &args[1], &ctx->input0)) return;
  call->status = callbackcheckedrecords_graph_initialize();
  if (!call->status) {
    uint32_t status = callbackcheckedrecords_callback_d885a7d82ec894d17b81e7a67a36bc2930adca13_lease_call(owner->token, &ctx->input0, &ctx->output);
    if (!call->status) call->status = status;
  }
  if (call->status == 10) call->status = 1;
  else if (call->status == 4 || call->status > 6) { callbackcheckedrecords_graph_retire(); call->status = 4; }
  if (call->status || EG(exception) || call->bailout || call->walk.scope.error) return;
  if (!lgc_from(call, 5, &ctx->output, &call->wire)) return;
  if (!callbackcheckedrecords_graph_ready()) call->status = 5;
}
ZEND_BEGIN_ARG_INFO_EX(lgc_args_invoke4, 0, 0, 2)
  ZEND_ARG_INFO(0, arg0)
  ZEND_ARG_INFO(0, arg1)
ZEND_END_ARG_INFO()
static ZEND_FUNCTION(lgc_invoke4) {
  if (ZEND_NUM_ARGS() != 2) { zend_argument_count_error("Expected exactly 2 arguments"); RETURN_THROWS(); }
  if (lgc_depth == 64) { zend_value_error("Lean calls exceed 64 reentry levels"); RETURN_THROWS(); }
  zval args[2];
  if (zend_get_parameters_array_ex(2, args) != SUCCESS) RETURN_THROWS();
  if (sizeof(lgc_context_invoke4) > 16 * 1024 * 1024) { zend_value_error("Zend call context exceeds the conversion limit"); RETURN_THROWS(); }
  lgc_context_invoke4 *ctx = LB_ZEND_CALLOC(1, sizeof(*ctx));
  if (!ctx) { zend_throw_error(NULL, "Zend call allocation failed"); RETURN_THROWS(); }
  ctx->call.walk.scope.remaining = 16 * 1024 * 1024 - sizeof(*ctx); ctx->call.walk.visits = 262144;
  ZVAL_UNDEF(&ctx->call.wire); ZVAL_NULL(return_value); ++lgc_depth;
  zend_try { lgc_execute_invoke4(ctx, args); }
  zend_catch { ctx->call.bailout = 1; } zend_end_try();
  uint32_t status = ctx->call.status;
  const char *message = ctx->call.walk.scope.error; int type_error = ctx->call.walk.scope.type_error;
  if (!status && !message && !ctx->call.bailout && !EG(exception)) {
    ZVAL_COPY_VALUE(return_value, &ctx->call.wire); ZVAL_UNDEF(&ctx->call.wire);
  }
  lgc_cleanup_invoke4(ctx);
  int bailout = ctx->call.bailout; LB_ZEND_FREE(ctx); --lgc_depth;
  if (bailout) zend_bailout();
  if (EG(exception)) { zval_ptr_dtor(return_value); ZVAL_NULL(return_value); RETURN_THROWS(); }
  if (status) { zend_throw_exception(zend_ce_exception, message ? message : "Compiled Lean graph call failed", status); RETURN_THROWS(); }
  if (message) {
    if (type_error) zend_type_error("%s", message); else zend_value_error("%s", message);
    RETURN_THROWS();
  }
}

typedef struct {
  lgc_call call;
  callbackcheckedrecords_scalar_nat_t input0;
  callbackcheckedrecords_interval_t input1;
  callbackcheckedrecords_interval_t output;
} lgc_context_invoke6;
static void lgc_cleanup_invoke6(lgc_context_invoke6 *ctx) {
  callbackcheckedrecords_interval_t_clear(&ctx->output);
  lgc_clear(&ctx->call);
}
static void lgc_execute_invoke6(lgc_context_invoke6 *ctx, zval *args) {
  (void)args; lgc_call *call = &ctx->call;
  lgc_owned *owner = zend_fetch_resource_ex(&args[0], "Lean graph closure", lgc_owned_type);
  if (!owner) return;
  if (owner->signature != 6 || !owner->token) { lb_fail(&call->walk.scope, "Closed or wrong-signature Lean closure", 1); return; }
  if (!lg_to(&call->walk, 5, &args[1], &ctx->input0)) return;
  if (!lg_to(&call->walk, 3, &args[2], &ctx->input1)) return;
  call->status = callbackcheckedrecords_graph_initialize();
  if (!call->status) {
    uint32_t status = callbackcheckedrecords_callback_2e292aebff8c53f6a465ec3d5745e74400590434_lease_call(owner->token, &ctx->input0, &ctx->input1, &ctx->output);
    if (!call->status) call->status = status;
  }
  if (call->status == 10) call->status = 1;
  else if (call->status == 4 || call->status > 6) { callbackcheckedrecords_graph_retire(); call->status = 4; }
  if (call->status || EG(exception) || call->bailout || call->walk.scope.error) return;
  if (!lgc_from(call, 3, &ctx->output, &call->wire)) return;
  if (!callbackcheckedrecords_graph_ready()) call->status = 5;
}
ZEND_BEGIN_ARG_INFO_EX(lgc_args_invoke6, 0, 0, 3)
  ZEND_ARG_INFO(0, arg0)
  ZEND_ARG_INFO(0, arg1)
  ZEND_ARG_INFO(0, arg2)
ZEND_END_ARG_INFO()
static ZEND_FUNCTION(lgc_invoke6) {
  if (ZEND_NUM_ARGS() != 3) { zend_argument_count_error("Expected exactly 3 arguments"); RETURN_THROWS(); }
  if (lgc_depth == 64) { zend_value_error("Lean calls exceed 64 reentry levels"); RETURN_THROWS(); }
  zval args[3];
  if (zend_get_parameters_array_ex(3, args) != SUCCESS) RETURN_THROWS();
  if (sizeof(lgc_context_invoke6) > 16 * 1024 * 1024) { zend_value_error("Zend call context exceeds the conversion limit"); RETURN_THROWS(); }
  lgc_context_invoke6 *ctx = LB_ZEND_CALLOC(1, sizeof(*ctx));
  if (!ctx) { zend_throw_error(NULL, "Zend call allocation failed"); RETURN_THROWS(); }
  ctx->call.walk.scope.remaining = 16 * 1024 * 1024 - sizeof(*ctx); ctx->call.walk.visits = 262144;
  ZVAL_UNDEF(&ctx->call.wire); ZVAL_NULL(return_value); ++lgc_depth;
  zend_try { lgc_execute_invoke6(ctx, args); }
  zend_catch { ctx->call.bailout = 1; } zend_end_try();
  uint32_t status = ctx->call.status;
  const char *message = ctx->call.walk.scope.error; int type_error = ctx->call.walk.scope.type_error;
  if (!status && !message && !ctx->call.bailout && !EG(exception)) {
    ZVAL_COPY_VALUE(return_value, &ctx->call.wire); ZVAL_UNDEF(&ctx->call.wire);
  }
  lgc_cleanup_invoke6(ctx);
  int bailout = ctx->call.bailout; LB_ZEND_FREE(ctx); --lgc_depth;
  if (bailout) zend_bailout();
  if (EG(exception)) { zval_ptr_dtor(return_value); ZVAL_NULL(return_value); RETURN_THROWS(); }
  if (status) { zend_throw_exception(zend_ce_exception, message ? message : "Compiled Lean graph call failed", status); RETURN_THROWS(); }
  if (message) {
    if (type_error) zend_type_error("%s", message); else zend_value_error("%s", message);
    RETURN_THROWS();
  }
}

typedef struct {
  lgc_call call;
  callbackcheckedrecords_graph_7ee21eb6b8ea120b53f0_t input0;
  callbackcheckedrecords_graph_38a8689c2f20ead532ea_t output;
} lgc_context_invoke7;
static void lgc_cleanup_invoke7(lgc_context_invoke7 *ctx) {
  callbackcheckedrecords_graph_38a8689c2f20ead532ea_t_clear(&ctx->output);
  lgc_clear(&ctx->call);
}
static void lgc_execute_invoke7(lgc_context_invoke7 *ctx, zval *args) {
  (void)args; lgc_call *call = &ctx->call;
  lgc_owned *owner = zend_fetch_resource_ex(&args[0], "Lean graph closure", lgc_owned_type);
  if (!owner) return;
  if (owner->signature != 7 || !owner->token) { lb_fail(&call->walk.scope, "Closed or wrong-signature Lean closure", 1); return; }
  if (!lg_to(&call->walk, 1, &args[1], &ctx->input0)) return;
  call->status = callbackcheckedrecords_graph_initialize();
  if (!call->status) {
    uint32_t status = callbackcheckedrecords_callback_8994592329ecba032f0abfaa9703e59a57f3c6a1_lease_call(owner->token, &ctx->input0, &ctx->output);
    if (!call->status) call->status = status;
  }
  if (call->status == 10) call->status = 1;
  else if (call->status == 4 || call->status > 6) { callbackcheckedrecords_graph_retire(); call->status = 4; }
  if (call->status || EG(exception) || call->bailout || call->walk.scope.error) return;
  if (!lgc_from(call, 0, &ctx->output, &call->wire)) return;
  if (!callbackcheckedrecords_graph_ready()) call->status = 5;
}
ZEND_BEGIN_ARG_INFO_EX(lgc_args_invoke7, 0, 0, 2)
  ZEND_ARG_INFO(0, arg0)
  ZEND_ARG_INFO(0, arg1)
ZEND_END_ARG_INFO()
static ZEND_FUNCTION(lgc_invoke7) {
  if (ZEND_NUM_ARGS() != 2) { zend_argument_count_error("Expected exactly 2 arguments"); RETURN_THROWS(); }
  if (lgc_depth == 64) { zend_value_error("Lean calls exceed 64 reentry levels"); RETURN_THROWS(); }
  zval args[2];
  if (zend_get_parameters_array_ex(2, args) != SUCCESS) RETURN_THROWS();
  if (sizeof(lgc_context_invoke7) > 16 * 1024 * 1024) { zend_value_error("Zend call context exceeds the conversion limit"); RETURN_THROWS(); }
  lgc_context_invoke7 *ctx = LB_ZEND_CALLOC(1, sizeof(*ctx));
  if (!ctx) { zend_throw_error(NULL, "Zend call allocation failed"); RETURN_THROWS(); }
  ctx->call.walk.scope.remaining = 16 * 1024 * 1024 - sizeof(*ctx); ctx->call.walk.visits = 262144;
  ZVAL_UNDEF(&ctx->call.wire); ZVAL_NULL(return_value); ++lgc_depth;
  zend_try { lgc_execute_invoke7(ctx, args); }
  zend_catch { ctx->call.bailout = 1; } zend_end_try();
  uint32_t status = ctx->call.status;
  const char *message = ctx->call.walk.scope.error; int type_error = ctx->call.walk.scope.type_error;
  if (!status && !message && !ctx->call.bailout && !EG(exception)) {
    ZVAL_COPY_VALUE(return_value, &ctx->call.wire); ZVAL_UNDEF(&ctx->call.wire);
  }
  lgc_cleanup_invoke7(ctx);
  int bailout = ctx->call.bailout; LB_ZEND_FREE(ctx); --lgc_depth;
  if (bailout) zend_bailout();
  if (EG(exception)) { zval_ptr_dtor(return_value); ZVAL_NULL(return_value); RETURN_THROWS(); }
  if (status) { zend_throw_exception(zend_ce_exception, message ? message : "Compiled Lean graph call failed", status); RETURN_THROWS(); }
  if (message) {
    if (type_error) zend_type_error("%s", message); else zend_value_error("%s", message);
    RETURN_THROWS();
  }
}
ZEND_BEGIN_ARG_INFO_EX(lgc_retire_args, 0, 0, 0)
ZEND_END_ARG_INFO()
static ZEND_FUNCTION(lgc_retire) {
  if (ZEND_NUM_ARGS()) { zend_argument_count_error("Expected no arguments"); RETURN_THROWS(); }
  callbackcheckedrecords_graph_retire(); RETURN_NULL();
}
static const zend_function_entry lgc_functions[] = {
  ZEND_NS_NAMED_FE("LeanCallbackcheckedrecords\\Internal\\GraphZend5340f85b22ce3006", call0, zif_lgc_call0, lgc_args_call0)
  ZEND_NS_NAMED_FE("LeanCallbackcheckedrecords\\Internal\\GraphZend5340f85b22ce3006", call1, zif_lgc_call1, lgc_args_call1)
  ZEND_NS_NAMED_FE("LeanCallbackcheckedrecords\\Internal\\GraphZend5340f85b22ce3006", call2, zif_lgc_call2, lgc_args_call2)
  ZEND_NS_NAMED_FE("LeanCallbackcheckedrecords\\Internal\\GraphZend5340f85b22ce3006", call3, zif_lgc_call3, lgc_args_call3)
  ZEND_NS_NAMED_FE("LeanCallbackcheckedrecords\\Internal\\GraphZend5340f85b22ce3006", call4, zif_lgc_call4, lgc_args_call4)
  ZEND_NS_NAMED_FE("LeanCallbackcheckedrecords\\Internal\\GraphZend5340f85b22ce3006", call5, zif_lgc_call5, lgc_args_call5)
  ZEND_NS_NAMED_FE("LeanCallbackcheckedrecords\\Internal\\GraphZend5340f85b22ce3006", call6, zif_lgc_call6, lgc_args_call6)
  ZEND_NS_NAMED_FE("LeanCallbackcheckedrecords\\Internal\\GraphZend5340f85b22ce3006", call7, zif_lgc_call7, lgc_args_call7)
  ZEND_NS_NAMED_FE("LeanCallbackcheckedrecords\\Internal\\GraphZend5340f85b22ce3006", invoke2, zif_lgc_invoke2, lgc_args_invoke2)
  ZEND_NS_NAMED_FE("LeanCallbackcheckedrecords\\Internal\\GraphZend5340f85b22ce3006", close2, zif_lgc_close2, lgc_close_args2)
  ZEND_NS_NAMED_FE("LeanCallbackcheckedrecords\\Internal\\GraphZend5340f85b22ce3006", invoke4, zif_lgc_invoke4, lgc_args_invoke4)
  ZEND_NS_NAMED_FE("LeanCallbackcheckedrecords\\Internal\\GraphZend5340f85b22ce3006", close4, zif_lgc_close4, lgc_close_args4)
  ZEND_NS_NAMED_FE("LeanCallbackcheckedrecords\\Internal\\GraphZend5340f85b22ce3006", invoke6, zif_lgc_invoke6, lgc_args_invoke6)
  ZEND_NS_NAMED_FE("LeanCallbackcheckedrecords\\Internal\\GraphZend5340f85b22ce3006", close6, zif_lgc_close6, lgc_close_args6)
  ZEND_NS_NAMED_FE("LeanCallbackcheckedrecords\\Internal\\GraphZend5340f85b22ce3006", invoke7, zif_lgc_invoke7, lgc_args_invoke7)
  ZEND_NS_NAMED_FE("LeanCallbackcheckedrecords\\Internal\\GraphZend5340f85b22ce3006", close7, zif_lgc_close7, lgc_close_args7)
  ZEND_NS_NAMED_FE("LeanCallbackcheckedrecords\\Internal\\GraphZend5340f85b22ce3006", retire, zif_lgc_retire, lgc_retire_args)
  PHP_FE_END
};
static PHP_MINIT_FUNCTION(lb_callbackcheckedrecords_graph_5340f85b22ce3006) {
  lgc_owned_type = zend_register_list_destructors_ex(lgc_owned_destroy, NULL, "Lean graph closure", module_number);
  return SUCCESS;
}
zend_module_entry lb_callbackcheckedrecords_graph_5340f85b22ce3006_module_entry = {
  STANDARD_MODULE_HEADER, "lb_callbackcheckedrecords_graph_5340f85b22ce3006", lgc_functions, PHP_MINIT(lb_callbackcheckedrecords_graph_5340f85b22ce3006), NULL, NULL, NULL, NULL, "1", STANDARD_MODULE_PROPERTIES
};
ZEND_GET_MODULE(lb_callbackcheckedrecords_graph_5340f85b22ce3006)
