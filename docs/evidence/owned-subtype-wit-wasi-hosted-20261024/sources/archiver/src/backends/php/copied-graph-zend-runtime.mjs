/**
 * Iterative Zend graph walkers with call-owned scratch and bailout-safe zvals.
 *
 * @file
 */
import { copiedZendSupport } from "./copied-zend-support.mjs";

/** The scalar helpers retain their strict decimal, UTF-8 and machine-width rules. */
export const graphZendSupport = String.raw`
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
` + copiedZendSupport.slice(copiedZendSupport.indexOf("static int lb_utf8"));

/** Finite descriptors use compiler-checked offsets rather than hardcoded widths. */
export const graphZendDescriptors = String.raw`
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
`;

/**
 * The lg_nodes table is emitted immediately before this walker.
 *
 * @param nativeOutputPreflight - Validate output spans before conversion limits.
 */
const graphZendWalkSource = nativeOutputPreflight => String.raw`
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
${nativeOutputPreflight ? `    if (!lb_readable(s, frame->data, frame->count, child->size, child->alignment)
        || !lg_children(walk, frame->count) || !lb_charge(s, frame->count, child->size)) return 0;`
	: `    if (!lg_children(walk, frame->count) || !lb_charge(s, frame->count, child->size)
        || !lb_readable(s, frame->data, frame->count, child->size, child->alignment)) return 0;`}
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
`;

/** Preserve the recorded copied-only transport's generated bytes. */
export const graphZendWalk = graphZendWalkSource(false);

/** Invalid callback output spans must retire even if their counts exceed limits. */
export const graphZendCheckedWalk = graphZendWalkSource(true);
