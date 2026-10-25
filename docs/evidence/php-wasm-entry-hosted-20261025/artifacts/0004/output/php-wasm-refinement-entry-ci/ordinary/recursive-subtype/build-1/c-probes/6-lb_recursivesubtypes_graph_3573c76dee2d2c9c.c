#include <stdio.h>
static void lb_probe_end(const char **label) { fprintf(stderr, "LB_SUBTYPE_ENTRY_V1 end public %s\n", *label); }
#include <php.h>
#include <limits.h>
#include <Zend/zend_exceptions.h>
#include "recursivesubtypes-graph.h"
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


static int lb_to3(zval *value, recursivesubtypes_scalar_nat_t *out, lb_scope *s) {
  ZVAL_DEREF(value);
  if (!lb_charge(s, 1, 16)) return 0;
  uint32_t *words; bool negative; if (!lb_big_in(value, s, &words, &out->length, &negative, false)) return 0;
  out->data = words;
  return 1;
}
static int lb_from3(const recursivesubtypes_scalar_nat_t *value, zval *out, lb_scope *s) {
  if (!lb_charge(s, 1, 16)) return 0;
  return lb_big_out(value->data, value->length, false, out, s);
  return 1;
}

static int lg_to_3(zval *value, void *out, lb_scope *s) { return lb_to3(value, (recursivesubtypes_scalar_nat_t *)out, s); }
static int lg_from_3(const void *value, zval *out, lb_scope *s) { return lb_from3((const recursivesubtypes_scalar_nat_t *)value, out, s); }

static const lg_field lg_fields_0_1[] = {
  { 2, offsetof(recursivesubtypes_graph_170e86bf9eebb9860794_t, value), false },
};

static const lg_branch lg_branches_0[] = { { 0, NULL }, { 1, lg_fields_0_1 } };

static const lg_field lg_fields_2_1[] = {
  { 3, offsetof(recursivesubtypes_chain_t, cases.node.value), false },
  { 3, offsetof(recursivesubtypes_chain_t, cases.node.digit), false },
  { 2, offsetof(recursivesubtypes_chain_t, cases.node.tail), true },
};

static const lg_branch lg_branches_2[] = { { 0, NULL }, { 3, lg_fields_2_1 } };

static const lg_node lg_nodes[] = {
  { LG_OPTION, true, sizeof(recursivesubtypes_graph_170e86bf9eebb9860794_t), _Alignof(recursivesubtypes_graph_170e86bf9eebb9860794_t), 0, offsetof(recursivesubtypes_graph_170e86bf9eebb9860794_t, has_value), 0, 0, 2, lg_branches_0, NULL, NULL },
  { LG_SEQUENCE, true, sizeof(recursivesubtypes_graph_69c0b33a73ddceecbd00_t), _Alignof(recursivesubtypes_graph_69c0b33a73ddceecbd00_t), 0, 0, offsetof(recursivesubtypes_graph_69c0b33a73ddceecbd00_t, data), offsetof(recursivesubtypes_graph_69c0b33a73ddceecbd00_t, length), 0, NULL, NULL, NULL },
  { LG_VARIANT, true, sizeof(recursivesubtypes_chain_t), _Alignof(recursivesubtypes_chain_t), 0, offsetof(recursivesubtypes_chain_t, kind), 0, 0, 2, lg_branches_2, NULL, NULL },
  { LG_SCALAR, true, sizeof(recursivesubtypes_scalar_nat_t), _Alignof(recursivesubtypes_scalar_nat_t), 0, 0, 0, 0, 0, NULL, lg_to_3, lg_from_3 },
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
    if (!lg_children(walk, frame->count) || !lb_charge(s, frame->count, child->size)
        || !lb_readable(s, frame->data, frame->count, child->size, child->alignment)) return 0;
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

typedef struct {
  lg_walk walk;
  recursivesubtypes_chain_t input0;
  recursivesubtypes_chain_t output;
  zval wire;
  uint32_t status;
} lg_context0;
static void lg_cleanup0(lg_context0 *ctx) {
  recursivesubtypes_chain_t_clear(&ctx->output);
  lb_scope_clear(&ctx->walk.scope);
  zval_ptr_dtor(&ctx->wire); LB_ZEND_FREE(ctx);
}
static void lg_execute0(lg_context0 *ctx, zval *args) {
  (void)args;
  if (!lg_to(&ctx->walk, 2, &args[0], &ctx->input0)) return;
  ctx->status = recursivesubtypes_graph_initialize();
  if (!ctx->status) ctx->status = recursivesubtypes_echo_graph(&ctx->input0, &ctx->output);
  if (ctx->status) {
    if (ctx->status == 4 || ctx->status > 5) { recursivesubtypes_graph_retire(); ctx->status = 4; }
    return;
  }
  ctx->walk.visits = 262144;
  if (!lg_from(&ctx->walk, 2, &ctx->output, &ctx->wire)) {
    if (ctx->walk.scope.failure == 4) { recursivesubtypes_graph_retire(); ctx->status = 4; }
    return;
  }
  if (!recursivesubtypes_graph_ready()) ctx->status = 5;
}
ZEND_BEGIN_ARG_INFO_EX(lg_args0, 0, 0, 1)
  ZEND_ARG_INFO(0, arg0)
ZEND_END_ARG_INFO()
static ZEND_FUNCTION(lg_call0) {
  const char *lb_probe_public_scope __attribute__((cleanup(lb_probe_end))) = "echo";
  fputs("LB_SUBTYPE_ENTRY_V1 begin public echo\n", stderr);

  if (ZEND_NUM_ARGS() != 1) { zend_argument_count_error("Expected exactly 1 arguments"); RETURN_THROWS(); }
  zval args[1];
  if (zend_get_parameters_array_ex(1, args) != SUCCESS) RETURN_THROWS();
  if (sizeof(lg_context0) > 16 * 1024 * 1024) { zend_value_error("Zend call context exceeds the conversion limit"); RETURN_THROWS(); }
  lg_context0 *ctx = LB_ZEND_CALLOC(1, sizeof(*ctx));
  if (!ctx) { zend_throw_error(NULL, "Zend call allocation failed"); RETURN_THROWS(); }
  ctx->walk.scope.remaining = 16 * 1024 * 1024 - sizeof(*ctx); ctx->walk.visits = 262144;
  ZVAL_NULL(&ctx->wire); ZVAL_NULL(return_value);
  recursivesubtypes_chain_t_init(&ctx->output);
  zend_try { lg_execute0(ctx, args); }
  zend_catch { lg_cleanup0(ctx); zend_bailout(); }
  zend_end_try();
  const char *message = ctx->walk.scope.error; int type_error = ctx->walk.scope.type_error;
  uint32_t status = ctx->status;
  if (!message && status == 1) message = recursivesubtypes_graph_error();
  if (!message && !status) { ZVAL_COPY_VALUE(return_value, &ctx->wire); ZVAL_UNDEF(&ctx->wire); }
  lg_cleanup0(ctx);
  if (status) { zend_throw_exception(zend_ce_exception, message ? message : "Compiled Lean graph call failed", status); RETURN_THROWS(); }
  if (message) {
    if (type_error) zend_type_error("%s", message); else zend_value_error("%s", message);
    RETURN_THROWS();
  }
}

typedef struct {
  lg_walk walk;
  recursivesubtypes_graph_69c0b33a73ddceecbd00_t input0;
  recursivesubtypes_graph_69c0b33a73ddceecbd00_t output;
  zval wire;
  uint32_t status;
} lg_context1;
static void lg_cleanup1(lg_context1 *ctx) {
  recursivesubtypes_graph_69c0b33a73ddceecbd00_t_clear(&ctx->output);
  lb_scope_clear(&ctx->walk.scope);
  zval_ptr_dtor(&ctx->wire); LB_ZEND_FREE(ctx);
}
static void lg_execute1(lg_context1 *ctx, zval *args) {
  (void)args;
  if (!lg_to(&ctx->walk, 1, &args[0], &ctx->input0)) return;
  ctx->status = recursivesubtypes_graph_initialize();
  if (!ctx->status) ctx->status = recursivesubtypes_echo_groups_graph(&ctx->input0, &ctx->output);
  if (ctx->status) {
    if (ctx->status == 4 || ctx->status > 5) { recursivesubtypes_graph_retire(); ctx->status = 4; }
    return;
  }
  ctx->walk.visits = 262144;
  if (!lg_from(&ctx->walk, 1, &ctx->output, &ctx->wire)) {
    if (ctx->walk.scope.failure == 4) { recursivesubtypes_graph_retire(); ctx->status = 4; }
    return;
  }
  if (!recursivesubtypes_graph_ready()) ctx->status = 5;
}
ZEND_BEGIN_ARG_INFO_EX(lg_args1, 0, 0, 1)
  ZEND_ARG_INFO(0, arg0)
ZEND_END_ARG_INFO()
static ZEND_FUNCTION(lg_call1) {
  const char *lb_probe_public_scope __attribute__((cleanup(lb_probe_end))) = "echoGroups";
  fputs("LB_SUBTYPE_ENTRY_V1 begin public echoGroups\n", stderr);

  if (ZEND_NUM_ARGS() != 1) { zend_argument_count_error("Expected exactly 1 arguments"); RETURN_THROWS(); }
  zval args[1];
  if (zend_get_parameters_array_ex(1, args) != SUCCESS) RETURN_THROWS();
  if (sizeof(lg_context1) > 16 * 1024 * 1024) { zend_value_error("Zend call context exceeds the conversion limit"); RETURN_THROWS(); }
  lg_context1 *ctx = LB_ZEND_CALLOC(1, sizeof(*ctx));
  if (!ctx) { zend_throw_error(NULL, "Zend call allocation failed"); RETURN_THROWS(); }
  ctx->walk.scope.remaining = 16 * 1024 * 1024 - sizeof(*ctx); ctx->walk.visits = 262144;
  ZVAL_NULL(&ctx->wire); ZVAL_NULL(return_value);
  recursivesubtypes_graph_69c0b33a73ddceecbd00_t_init(&ctx->output);
  zend_try { lg_execute1(ctx, args); }
  zend_catch { lg_cleanup1(ctx); zend_bailout(); }
  zend_end_try();
  const char *message = ctx->walk.scope.error; int type_error = ctx->walk.scope.type_error;
  uint32_t status = ctx->status;
  if (!message && status == 1) message = recursivesubtypes_graph_error();
  if (!message && !status) { ZVAL_COPY_VALUE(return_value, &ctx->wire); ZVAL_UNDEF(&ctx->wire); }
  lg_cleanup1(ctx);
  if (status) { zend_throw_exception(zend_ce_exception, message ? message : "Compiled Lean graph call failed", status); RETURN_THROWS(); }
  if (message) {
    if (type_error) zend_type_error("%s", message); else zend_value_error("%s", message);
    RETURN_THROWS();
  }
}

typedef struct {
  lg_walk walk;
  recursivesubtypes_chain_t input0;
  recursivesubtypes_scalar_nat_t output;
  zval wire;
  uint32_t status;
} lg_context2;
static void lg_cleanup2(lg_context2 *ctx) {
  recursivesubtypes_scalar_nat_t_clear(&ctx->output);
  lb_scope_clear(&ctx->walk.scope);
  zval_ptr_dtor(&ctx->wire); LB_ZEND_FREE(ctx);
}
static void lg_execute2(lg_context2 *ctx, zval *args) {
  (void)args;
  if (!lg_to(&ctx->walk, 2, &args[0], &ctx->input0)) return;
  ctx->status = recursivesubtypes_graph_initialize();
  if (!ctx->status) ctx->status = recursivesubtypes_first_graph(&ctx->input0, &ctx->output);
  if (ctx->status) {
    if (ctx->status == 4 || ctx->status > 5) { recursivesubtypes_graph_retire(); ctx->status = 4; }
    return;
  }
  ctx->walk.visits = 262144;
  if (!lg_from(&ctx->walk, 3, &ctx->output, &ctx->wire)) {
    if (ctx->walk.scope.failure == 4) { recursivesubtypes_graph_retire(); ctx->status = 4; }
    return;
  }
  if (!recursivesubtypes_graph_ready()) ctx->status = 5;
}
ZEND_BEGIN_ARG_INFO_EX(lg_args2, 0, 0, 1)
  ZEND_ARG_INFO(0, arg0)
ZEND_END_ARG_INFO()
static ZEND_FUNCTION(lg_call2) {
  const char *lb_probe_public_scope __attribute__((cleanup(lb_probe_end))) = "first";
  fputs("LB_SUBTYPE_ENTRY_V1 begin public first\n", stderr);

  if (ZEND_NUM_ARGS() != 1) { zend_argument_count_error("Expected exactly 1 arguments"); RETURN_THROWS(); }
  zval args[1];
  if (zend_get_parameters_array_ex(1, args) != SUCCESS) RETURN_THROWS();
  if (sizeof(lg_context2) > 16 * 1024 * 1024) { zend_value_error("Zend call context exceeds the conversion limit"); RETURN_THROWS(); }
  lg_context2 *ctx = LB_ZEND_CALLOC(1, sizeof(*ctx));
  if (!ctx) { zend_throw_error(NULL, "Zend call allocation failed"); RETURN_THROWS(); }
  ctx->walk.scope.remaining = 16 * 1024 * 1024 - sizeof(*ctx); ctx->walk.visits = 262144;
  ZVAL_NULL(&ctx->wire); ZVAL_NULL(return_value);
  recursivesubtypes_scalar_nat_t_init(&ctx->output);
  zend_try { lg_execute2(ctx, args); }
  zend_catch { lg_cleanup2(ctx); zend_bailout(); }
  zend_end_try();
  const char *message = ctx->walk.scope.error; int type_error = ctx->walk.scope.type_error;
  uint32_t status = ctx->status;
  if (!message && status == 1) message = recursivesubtypes_graph_error();
  if (!message && !status) { ZVAL_COPY_VALUE(return_value, &ctx->wire); ZVAL_UNDEF(&ctx->wire); }
  lg_cleanup2(ctx);
  if (status) { zend_throw_exception(zend_ce_exception, message ? message : "Compiled Lean graph call failed", status); RETURN_THROWS(); }
  if (message) {
    if (type_error) zend_type_error("%s", message); else zend_value_error("%s", message);
    RETURN_THROWS();
  }
}

typedef struct {
  lg_walk walk;
  recursivesubtypes_graph_69c0b33a73ddceecbd00_t input0;
  recursivesubtypes_scalar_nat_t output;
  zval wire;
  uint32_t status;
} lg_context3;
static void lg_cleanup3(lg_context3 *ctx) {
  recursivesubtypes_scalar_nat_t_clear(&ctx->output);
  lb_scope_clear(&ctx->walk.scope);
  zval_ptr_dtor(&ctx->wire); LB_ZEND_FREE(ctx);
}
static void lg_execute3(lg_context3 *ctx, zval *args) {
  (void)args;
  if (!lg_to(&ctx->walk, 1, &args[0], &ctx->input0)) return;
  ctx->status = recursivesubtypes_graph_initialize();
  if (!ctx->status) ctx->status = recursivesubtypes_groups_graph(&ctx->input0, &ctx->output);
  if (ctx->status) {
    if (ctx->status == 4 || ctx->status > 5) { recursivesubtypes_graph_retire(); ctx->status = 4; }
    return;
  }
  ctx->walk.visits = 262144;
  if (!lg_from(&ctx->walk, 3, &ctx->output, &ctx->wire)) {
    if (ctx->walk.scope.failure == 4) { recursivesubtypes_graph_retire(); ctx->status = 4; }
    return;
  }
  if (!recursivesubtypes_graph_ready()) ctx->status = 5;
}
ZEND_BEGIN_ARG_INFO_EX(lg_args3, 0, 0, 1)
  ZEND_ARG_INFO(0, arg0)
ZEND_END_ARG_INFO()
static ZEND_FUNCTION(lg_call3) {
  const char *lb_probe_public_scope __attribute__((cleanup(lb_probe_end))) = "groups";
  fputs("LB_SUBTYPE_ENTRY_V1 begin public groups\n", stderr);

  if (ZEND_NUM_ARGS() != 1) { zend_argument_count_error("Expected exactly 1 arguments"); RETURN_THROWS(); }
  zval args[1];
  if (zend_get_parameters_array_ex(1, args) != SUCCESS) RETURN_THROWS();
  if (sizeof(lg_context3) > 16 * 1024 * 1024) { zend_value_error("Zend call context exceeds the conversion limit"); RETURN_THROWS(); }
  lg_context3 *ctx = LB_ZEND_CALLOC(1, sizeof(*ctx));
  if (!ctx) { zend_throw_error(NULL, "Zend call allocation failed"); RETURN_THROWS(); }
  ctx->walk.scope.remaining = 16 * 1024 * 1024 - sizeof(*ctx); ctx->walk.visits = 262144;
  ZVAL_NULL(&ctx->wire); ZVAL_NULL(return_value);
  recursivesubtypes_scalar_nat_t_init(&ctx->output);
  zend_try { lg_execute3(ctx, args); }
  zend_catch { lg_cleanup3(ctx); zend_bailout(); }
  zend_end_try();
  const char *message = ctx->walk.scope.error; int type_error = ctx->walk.scope.type_error;
  uint32_t status = ctx->status;
  if (!message && status == 1) message = recursivesubtypes_graph_error();
  if (!message && !status) { ZVAL_COPY_VALUE(return_value, &ctx->wire); ZVAL_UNDEF(&ctx->wire); }
  lg_cleanup3(ctx);
  if (status) { zend_throw_exception(zend_ce_exception, message ? message : "Compiled Lean graph call failed", status); RETURN_THROWS(); }
  if (message) {
    if (type_error) zend_type_error("%s", message); else zend_value_error("%s", message);
    RETURN_THROWS();
  }
}

typedef struct {
  lg_walk walk;
  recursivesubtypes_scalar_nat_t input0;
  recursivesubtypes_chain_t output;
  zval wire;
  uint32_t status;
} lg_context4;
static void lg_cleanup4(lg_context4 *ctx) {
  recursivesubtypes_chain_t_clear(&ctx->output);
  lb_scope_clear(&ctx->walk.scope);
  zval_ptr_dtor(&ctx->wire); LB_ZEND_FREE(ctx);
}
static void lg_execute4(lg_context4 *ctx, zval *args) {
  (void)args;
  if (!lg_to(&ctx->walk, 3, &args[0], &ctx->input0)) return;
  ctx->status = recursivesubtypes_graph_initialize();
  if (!ctx->status) ctx->status = recursivesubtypes_produce_graph(&ctx->input0, &ctx->output);
  if (ctx->status) {
    if (ctx->status == 4 || ctx->status > 5) { recursivesubtypes_graph_retire(); ctx->status = 4; }
    return;
  }
  ctx->walk.visits = 262144;
  if (!lg_from(&ctx->walk, 2, &ctx->output, &ctx->wire)) {
    if (ctx->walk.scope.failure == 4) { recursivesubtypes_graph_retire(); ctx->status = 4; }
    return;
  }
  if (!recursivesubtypes_graph_ready()) ctx->status = 5;
}
ZEND_BEGIN_ARG_INFO_EX(lg_args4, 0, 0, 1)
  ZEND_ARG_INFO(0, arg0)
ZEND_END_ARG_INFO()
static ZEND_FUNCTION(lg_call4) {
  const char *lb_probe_public_scope __attribute__((cleanup(lb_probe_end))) = "produce";
  fputs("LB_SUBTYPE_ENTRY_V1 begin public produce\n", stderr);

  if (ZEND_NUM_ARGS() != 1) { zend_argument_count_error("Expected exactly 1 arguments"); RETURN_THROWS(); }
  zval args[1];
  if (zend_get_parameters_array_ex(1, args) != SUCCESS) RETURN_THROWS();
  if (sizeof(lg_context4) > 16 * 1024 * 1024) { zend_value_error("Zend call context exceeds the conversion limit"); RETURN_THROWS(); }
  lg_context4 *ctx = LB_ZEND_CALLOC(1, sizeof(*ctx));
  if (!ctx) { zend_throw_error(NULL, "Zend call allocation failed"); RETURN_THROWS(); }
  ctx->walk.scope.remaining = 16 * 1024 * 1024 - sizeof(*ctx); ctx->walk.visits = 262144;
  ZVAL_NULL(&ctx->wire); ZVAL_NULL(return_value);
  recursivesubtypes_chain_t_init(&ctx->output);
  zend_try { lg_execute4(ctx, args); }
  zend_catch { lg_cleanup4(ctx); zend_bailout(); }
  zend_end_try();
  const char *message = ctx->walk.scope.error; int type_error = ctx->walk.scope.type_error;
  uint32_t status = ctx->status;
  if (!message && status == 1) message = recursivesubtypes_graph_error();
  if (!message && !status) { ZVAL_COPY_VALUE(return_value, &ctx->wire); ZVAL_UNDEF(&ctx->wire); }
  lg_cleanup4(ctx);
  if (status) { zend_throw_exception(zend_ce_exception, message ? message : "Compiled Lean graph call failed", status); RETURN_THROWS(); }
  if (message) {
    if (type_error) zend_type_error("%s", message); else zend_value_error("%s", message);
    RETURN_THROWS();
  }
}

typedef struct {
  lg_walk walk;
  recursivesubtypes_chain_t input0;
  recursivesubtypes_scalar_nat_t output;
  zval wire;
  uint32_t status;
} lg_context5;
static void lg_cleanup5(lg_context5 *ctx) {
  recursivesubtypes_scalar_nat_t_clear(&ctx->output);
  lb_scope_clear(&ctx->walk.scope);
  zval_ptr_dtor(&ctx->wire); LB_ZEND_FREE(ctx);
}
static void lg_execute5(lg_context5 *ctx, zval *args) {
  (void)args;
  if (!lg_to(&ctx->walk, 2, &args[0], &ctx->input0)) return;
  ctx->status = recursivesubtypes_graph_initialize();
  if (!ctx->status) ctx->status = recursivesubtypes_second_graph(&ctx->input0, &ctx->output);
  if (ctx->status) {
    if (ctx->status == 4 || ctx->status > 5) { recursivesubtypes_graph_retire(); ctx->status = 4; }
    return;
  }
  ctx->walk.visits = 262144;
  if (!lg_from(&ctx->walk, 3, &ctx->output, &ctx->wire)) {
    if (ctx->walk.scope.failure == 4) { recursivesubtypes_graph_retire(); ctx->status = 4; }
    return;
  }
  if (!recursivesubtypes_graph_ready()) ctx->status = 5;
}
ZEND_BEGIN_ARG_INFO_EX(lg_args5, 0, 0, 1)
  ZEND_ARG_INFO(0, arg0)
ZEND_END_ARG_INFO()
static ZEND_FUNCTION(lg_call5) {
  const char *lb_probe_public_scope __attribute__((cleanup(lb_probe_end))) = "second";
  fputs("LB_SUBTYPE_ENTRY_V1 begin public second\n", stderr);

  if (ZEND_NUM_ARGS() != 1) { zend_argument_count_error("Expected exactly 1 arguments"); RETURN_THROWS(); }
  zval args[1];
  if (zend_get_parameters_array_ex(1, args) != SUCCESS) RETURN_THROWS();
  if (sizeof(lg_context5) > 16 * 1024 * 1024) { zend_value_error("Zend call context exceeds the conversion limit"); RETURN_THROWS(); }
  lg_context5 *ctx = LB_ZEND_CALLOC(1, sizeof(*ctx));
  if (!ctx) { zend_throw_error(NULL, "Zend call allocation failed"); RETURN_THROWS(); }
  ctx->walk.scope.remaining = 16 * 1024 * 1024 - sizeof(*ctx); ctx->walk.visits = 262144;
  ZVAL_NULL(&ctx->wire); ZVAL_NULL(return_value);
  recursivesubtypes_scalar_nat_t_init(&ctx->output);
  zend_try { lg_execute5(ctx, args); }
  zend_catch { lg_cleanup5(ctx); zend_bailout(); }
  zend_end_try();
  const char *message = ctx->walk.scope.error; int type_error = ctx->walk.scope.type_error;
  uint32_t status = ctx->status;
  if (!message && status == 1) message = recursivesubtypes_graph_error();
  if (!message && !status) { ZVAL_COPY_VALUE(return_value, &ctx->wire); ZVAL_UNDEF(&ctx->wire); }
  lg_cleanup5(ctx);
  if (status) { zend_throw_exception(zend_ce_exception, message ? message : "Compiled Lean graph call failed", status); RETURN_THROWS(); }
  if (message) {
    if (type_error) zend_type_error("%s", message); else zend_value_error("%s", message);
    RETURN_THROWS();
  }
}
ZEND_BEGIN_ARG_INFO_EX(lg_retire_args, 0, 0, 0)
ZEND_END_ARG_INFO()
static ZEND_FUNCTION(lg_retire) {
  if (ZEND_NUM_ARGS()) { zend_argument_count_error("Expected no arguments"); RETURN_THROWS(); }
  recursivesubtypes_graph_retire(); RETURN_NULL();
}
static const zend_function_entry lg_functions[] = {
  ZEND_NS_NAMED_FE("LeanRecursivesubtypes\\Internal\\GraphZend3573c76dee2d2c9c", call0, zif_lg_call0, lg_args0)
  ZEND_NS_NAMED_FE("LeanRecursivesubtypes\\Internal\\GraphZend3573c76dee2d2c9c", call1, zif_lg_call1, lg_args1)
  ZEND_NS_NAMED_FE("LeanRecursivesubtypes\\Internal\\GraphZend3573c76dee2d2c9c", call2, zif_lg_call2, lg_args2)
  ZEND_NS_NAMED_FE("LeanRecursivesubtypes\\Internal\\GraphZend3573c76dee2d2c9c", call3, zif_lg_call3, lg_args3)
  ZEND_NS_NAMED_FE("LeanRecursivesubtypes\\Internal\\GraphZend3573c76dee2d2c9c", call4, zif_lg_call4, lg_args4)
  ZEND_NS_NAMED_FE("LeanRecursivesubtypes\\Internal\\GraphZend3573c76dee2d2c9c", call5, zif_lg_call5, lg_args5)
  ZEND_NS_NAMED_FE("LeanRecursivesubtypes\\Internal\\GraphZend3573c76dee2d2c9c", retire, zif_lg_retire, lg_retire_args)
  PHP_FE_END
};
zend_module_entry lb_recursivesubtypes_graph_3573c76dee2d2c9c_module_entry = {
  STANDARD_MODULE_HEADER, "lb_recursivesubtypes_graph_3573c76dee2d2c9c", lg_functions, NULL, NULL, NULL, NULL, NULL, "1", STANDARD_MODULE_PROPERTIES
};
ZEND_GET_MODULE(lb_recursivesubtypes_graph_3573c76dee2d2c9c)
