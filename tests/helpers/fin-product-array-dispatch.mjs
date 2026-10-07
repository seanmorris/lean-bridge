/**
 * Count Lean source and adapter dispatch for the array-of-product C export (VO #1441).
 * Only rows is measured: Lean inlines reversed (Array.reverse) into its adapter, so no
 * separate source symbol exists to count for it.
 *
 * @file
 */
import { sha256 } from "../../src/capsule/node.mjs";

/**
 * Name the compiler-emitted Lean adapter that public calls reach through the runtime table.
 *
 * @param name - Lean declaration identity.
 */
export const finProductArraySymbol = name => `lb_${sha256(`finproductarrays@1.0.0\0${name}`).slice(0, 24)}`;

// Columns: source rows, then its exported adapter. Each takes one Lean object.
export const finProductArrayDispatchColumns = Object.freeze(["l_FinProductArrays_rows", finProductArraySymbol("FinProductArrays.rows")]);
const wrapper = (symbol, index) => `void *${symbol}(void *a0) {
  static void *(*next)(void *);
  if (!next) { *(void **)&next = dlsym(RTLD_NEXT, "${symbol}"); if (!next) abort(); }
  ++counts[${index}];
  return next(a0);
}`;

/** Test-only LD_PRELOAD interposer; each wrapper resolves its target on first use. */
export const finProductArrayDispatchInterposer = () => `#define _GNU_SOURCE
#include <dlfcn.h>
#include <stdlib.h>
static unsigned long counts[${finProductArrayDispatchColumns.length}];
unsigned long fin_product_array_dispatch_count(unsigned index) { return index < ${finProductArrayDispatchColumns.length} ? counts[index] : 0; }
${finProductArrayDispatchColumns.map(wrapper).join("\n")}
`;

/**
 * Expected rows: step, public status or raw outcome, then the two counters after the step.
 * Public rejections stop at the C entry; raw rejections reach only the adapter, whose typed
 * construction refuses them; a valid raw call reaches the adapter and the source.
 */
export const finProductArrayDispatchExpected = Object.freeze([
	["start", 0, [0, 0]]
	, ["public-valid", 0, [1, 1]]
	, ["public-invalid-component", 1, [1, 1]]
	, ["public-invalid-error", 1, [1, 1]]
	, ["raw-invalid-component", 1, [1, 2]]
	, ["raw-invalid-error", 1, [1, 3]]
	, ["raw-valid", 1, [2, 4]]]);

/** Probe public and exported-adapter dispatch; raw values use the pinned Lean object API. */
export const finProductArrayDispatchProbe = () => `#define _GNU_SOURCE
#include <finproductarrays.h>
#include <lean/lean.h>
#include <dlfcn.h>
#include <stdio.h>
typedef lean_object *(*raw_unary)(lean_object *);
typedef finproductarrays_tuple_nat_result_nat_nat_value row;
static unsigned long (*count)(unsigned);
static void report(const char *step, int status) {
  printf("%s %d", step, status);
  for (unsigned i = 0; i < ${finProductArrayDispatchColumns.length}; ++i) printf(" %lu", count(i));
  printf("\\n");
}
/* Prod.mk is constructor 0 with two fields; Except.error is constructor 0 and Except.ok is 1. */
static lean_object *element(size_t component, int ok, size_t payload) {
  lean_object *branch = lean_alloc_ctor(ok ? 1 : 0, 1, 0);
  lean_ctor_set(branch, 0, lean_box(payload));
  lean_object *value = lean_alloc_ctor(0, 2, 0);
  lean_ctor_set(value, 0, lean_box(component)); lean_ctor_set(value, 1, branch);
  return value;
}
static lean_object *rows_of(size_t component, int ok, size_t payload) {
  lean_object *values = lean_mk_empty_array();
  values = lean_array_push(values, element(0, 1, 7));
  return lean_array_push(values, element(component, ok, payload));
}
/* An exported adapter consumes its argument and returns an owned Option. */
static int rejected(raw_unary adapter, lean_object *argument) {
  lean_object *result = adapter(argument);
  int none = lean_is_scalar(result);
  lean_dec(result);
  return none;
}
static int accepted(raw_unary adapter, lean_object *argument) {
  lean_object *result = adapter(argument);
  int some = !lean_is_scalar(result);
  lean_dec(result);
  return some;
}
int main(void) {
  *(void **)&count = dlsym(RTLD_DEFAULT, "fin_product_array_dispatch_count");
  if (!count) { fprintf(stderr, "interposer is not loaded\\n"); return 1; }
  finproductarrays_error error = {0};
  row items[2];
  for (int i = 0; i < 2; ++i) finproductarrays_tuple_nat_result_nat_nat_value_init(&items[i]);
  items[0].snd.is_ok = 1; mpz_set_ui(items[0].snd.ok, 7);
  mpz_set_ui(items[1].fst, 3); items[1].snd.is_ok = 0; mpz_set_ui(items[1].snd.error, 5);
  finproductarrays_array_tuple_nat_result_nat_nat_span span = {items, 2, NULL, NULL};
  mpz_t result; mpz_init(result);
  report("start", 0);
  report("public-valid", finproductarrays_rows(&span, result, &error));
  mpz_set_ui(items[1].fst, 4); report("public-invalid-component", finproductarrays_rows(&span, result, &error));
  mpz_set_ui(items[1].fst, 3); mpz_set_ui(items[1].snd.error, 6); report("public-invalid-error", finproductarrays_rows(&span, result, &error));
  raw_unary rows = (raw_unary)dlsym(RTLD_DEFAULT, "${finProductArraySymbol("FinProductArrays.rows")}");
  if (!rows) { fprintf(stderr, "exported adapter is not visible\\n"); return 1; }
  /* Direct adapter calls skip the C precheck; Lean's typed construction still rejects them without reaching the source. */
  report("raw-invalid-component", rejected(rows, rows_of(4, 0, 5)));
  report("raw-invalid-error", rejected(rows, rows_of(3, 0, 6)));
  report("raw-valid", accepted(rows, rows_of(3, 0, 5)));
  for (int i = 0; i < 2; ++i) finproductarrays_tuple_nat_result_nat_nat_value_clear(&items[i]);
  mpz_clear(result);
  return 0;
}
`;
