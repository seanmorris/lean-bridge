/* Bind the caller's host-refusal cases to the genuine generated WIT graph encoders.
 * Compiled with the generated conversions and Wasmtime headers; no Lean or component runs. */
#include <stdio.h>
#ifdef RECURSIVE_CHECKED_RECORD_MUTUAL
#include "mutualcheckedrecords-conversions.h"
#define P(name) mutualcheckedrecords_##name
typedef mutualcheckedrecords_envelope_t record;
typedef mutualcheckedrecords_envelope_next_t link_t;
typedef mutualcheckedrecords_step_t step_t;
#define DIGIT mode
#define TAIL next
#define MUTUAL 1
#else
#include "recursivecheckedrecords-conversions.h"
#define P(name) recursivecheckedrecords_##name
typedef recursivecheckedrecords_packet_t record;
typedef recursivecheckedrecords_packet_tail_t link_t;
#define DIGIT digit
#define TAIL tail
#define MUTUAL 0
#endif
typedef P(scalar_nat_t) nat;
typedef P(groups_argument0_t) groups;
typedef P(groups_argument0_element_t) element;

static uint32_t one = 1, padded[2] = {1, 0};
static unsigned checks;
static void *fresh(size_t size) { void *value = calloc(1, size); if (!value) abort(); return value; }
static link_t *option(const record *child) {
  link_t *link = fresh(sizeof(*link));
  if (!child) return link;
  link->has_value = 1;
#if MUTUAL
  step_t *step = fresh(sizeof(*step)); step->kind = MUTUALCHECKEDRECORDS_STEP_T_KIND_MORE; step->cases.more.packet = child; link->value = step;
#else
  link->value = child;
#endif
  return link;
}
static record *node(const record *child) {
  record *out = fresh(sizeof(*out)); out->value = (nat){.data = &one, .length = 1}; out->TAIL = option(child); return out;
}
static record *chain(unsigned count) { const record *tail = NULL; while (count--) tail = node(tail); return (record *)tail; }
static bool encode(const record *value) {
  lb_graph_scope scope = {.memory = {.remaining = LB_GRAPH_BYTES}, .nodes = LB_GRAPH_NODES};
  wasmtime_component_val_t out = {0}; bool ok = ENCODE_RECORD(value, &scope, &out);
  wasmtime_component_val_delete(&out); lb_scope_close(&scope.memory); return ok;
}
static bool encode_groups(const groups *value) {
  lb_graph_scope scope = {.memory = {.remaining = LB_GRAPH_BYTES}, .nodes = LB_GRAPH_NODES};
  wasmtime_component_val_t out = {0}; bool ok = ENCODE_GROUPS(value, &scope, &out);
  wasmtime_component_val_delete(&out); lb_scope_close(&scope.memory); return ok;
}
static void expect(bool condition, const char *label) {
  if (!condition) { fprintf(stderr, "failed: %s\n", label); exit(1); }
  ++checks;
}

int main(void) {
  record *value;
  expect(encode(node(NULL)), "single record");
  expect(encode(chain(40)), "forty linked records used by the caller");
  expect(!encode(chain(100)), "one hundred linked records exceed the depth limit");
  value = node(NULL); value->TAIL = NULL; expect(!encode(value), "missing option pointer");
  value = node(NULL); value->value = (nat){.data = padded, .length = 2}; expect(!encode(value), "noncanonical Nat");
  value = node(NULL); value->value = (nat){.data = NULL, .length = 1}; expect(!encode(value), "missing Nat limbs");
  value = node(node(NULL)); ((link_t *)value->TAIL)->has_value = 2; expect(!encode(value), "option flag");
  value = node(NULL); ((link_t *)value->TAIL)->has_value = 1; expect(!encode(value), "present option without a value");
#if MUTUAL
  value = node(node(NULL)); ((step_t *)value->TAIL->value)->kind = 7; expect(!encode(value), "unknown Step tag");
  value = node(NULL); { step_t *step = fresh(sizeof(*step)); step->kind = MUTUALCHECKEDRECORDS_STEP_T_KIND_STOP;
    link_t *link = (link_t *)value->TAIL; link->has_value = 1; link->value = step; } expect(encode(value), "explicit Stop");
#endif
  value = node(NULL); { link_t *link = (link_t *)value->TAIL; link->has_value = 1;
#if MUTUAL
    step_t *step = fresh(sizeof(*step)); step->kind = MUTUALCHECKEDRECORDS_STEP_T_KIND_MORE; step->cases.more.packet = value; link->value = step;
#else
    link->value = value;
#endif
  } expect(!encode(value), "cycle");
  element flag = {.has_value = 3}; groups flagged = {.data = &flag, .length = 1}; expect(!encode_groups(&flagged), "group option flag");
  groups dangling = {.data = NULL, .length = 1}; expect(!encode_groups(&dangling), "missing group storage");
  const record *shared = node(NULL); element pair[2] = {{.has_value = 1}, {.has_value = 1}};
#if MUTUAL
  pair[0].value = *node(shared); pair[1].value = *node(shared);
#else
  pair[0].value = shared; pair[1].value = shared;
#endif
  groups sharing = {.data = pair, .length = 2}; expect(encode_groups(&sharing), "shared acyclic children");
  printf("{\"encoderChecks\":%u}\n", checks);
  return 0;
}
