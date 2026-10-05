#include <assert.h>
#include "recursive.h"

static recursive_spine_t owned;

void mixed_native_check(void) {
  assert(owned.kind == RECURSIVE_SPINE_T_KIND_NEXT);
  assert(owned.cases.next.value->kind == RECURSIVE_SPINE_T_KIND_LEAF);
  assert(owned.cases.next.value->cases.leaf.value == 83);
}
void mixed_native_create(void) {
  recursive_spine_t input;
  recursive_spine_t_init(&input); recursive_spine_t_init(&owned);
  assert(recursive_spine_t_select(&input, RECURSIVE_SPINE_T_KIND_LEAF) == RECURSIVE_STATUS_OK);
  input.cases.leaf.value = 83;
  assert(recursive_grow(&input, &owned, NULL) == RECURSIVE_STATUS_OK);
  input.cases.leaf.value = 12; mixed_native_check();
  recursive_spine_t_clear(&input);
}
void mixed_native_rejected(void) {
  recursive_spine_t input, out;
  recursive_spine_t_init(&input); recursive_spine_t_init(&out);
  assert(recursive_spine_t_select(&input, RECURSIVE_SPINE_T_KIND_LEAF) == RECURSIVE_STATUS_OK);
  assert(recursive_spine_t_select(&out, RECURSIVE_SPINE_T_KIND_LEAF) == RECURSIVE_STATUS_OK);
  input.cases.leaf.value = 42; out.cases.leaf.value = 97;
  assert(recursive_grow(&input, &out, NULL) != RECURSIVE_STATUS_OK);
  assert(out.kind == RECURSIVE_SPINE_T_KIND_LEAF && out.cases.leaf.value == 97);
  recursive_spine_t_clear(&input); recursive_spine_t_clear(&out);
}
void mixed_native_clear(void) {
  mixed_native_check(); recursive_spine_t_clear(&owned); recursive_spine_t_clear(&owned);
}
