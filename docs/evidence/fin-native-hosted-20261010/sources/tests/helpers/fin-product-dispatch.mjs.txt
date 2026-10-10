/**
 * Count Lean source and adapter dispatch for product- and Except-refined C exports (VO #1441).
 *
 * @file
 */
import { sha256 } from "../../src/capsule/node.mjs";

/**
 * Name the compiler-emitted Lean adapter that public calls reach through the runtime table.
 *
 * @param name - Lean declaration identity.
 */
export const finProductSymbol = name => `lb_${sha256(`finproducts@1.0.0\0${name}`).slice(0, 24)}`;

// Columns: source first, source both, then their exported adapters. Each takes one Lean object.
export const finProductDispatchColumns = Object.freeze([
	"l_FinProducts_first"
	, "l_FinProducts_both"
	, finProductSymbol("FinProducts.first")
	, finProductSymbol("FinProducts.both")]);
const wrapper = (symbol, index) => `void *${symbol}(void *a0) {
  static void *(*next)(void *);
  if (!next) { *(void **)&next = dlsym(RTLD_NEXT, "${symbol}"); if (!next) abort(); }
  ++counts[${index}];
  return next(a0);
}`;

/** Test-only LD_PRELOAD interposer; each wrapper resolves its target on first use. */
export const finProductDispatchInterposer = () => `#define _GNU_SOURCE
#include <dlfcn.h>
#include <stdlib.h>
static unsigned long counts[${finProductDispatchColumns.length}];
unsigned long fin_product_dispatch_count(unsigned index) { return index < ${finProductDispatchColumns.length} ? counts[index] : 0; }
${finProductDispatchColumns.map(wrapper).join("\n")}
`;

/**
 * Expected rows: step, public status or raw outcome, then the four counters after the step.
 * Public rejections stop at the C entry; raw rejections reach only the adapter, whose typed
 * construction refuses them; valid raw calls reach the adapter and the source.
 */
export const finProductDispatchExpected = Object.freeze([
	["start", 0, [0, 0, 0, 0]]
	, ["public-valid-first", 0, [1, 0, 1, 0]]
	, ["public-invalid-first", 1, [1, 0, 1, 0]]
	, ["public-valid-both-error", 0, [1, 1, 1, 1]]
	, ["public-invalid-both-ok", 1, [1, 1, 1, 1]]
	, ["raw-invalid-first", 1, [1, 1, 2, 1]]
	, ["raw-invalid-both-error", 1, [1, 1, 2, 2]]
	, ["raw-valid-first", 1, [2, 1, 3, 2]]
	, ["raw-valid-both-ok", 1, [2, 2, 3, 3]]]);

/** Probe public and exported-adapter dispatch; raw values use the pinned Lean object API. */
export const finProductDispatchProbe = () => `#define _GNU_SOURCE
#include <finproducts.h>
#include <lean/lean.h>
#include <dlfcn.h>
#include <stdio.h>
typedef lean_object *(*raw_unary)(lean_object *);
static unsigned long (*count)(unsigned);
static void report(const char *step, int status) {
  printf("%s %d", step, status);
  for (unsigned i = 0; i < ${finProductDispatchColumns.length}; ++i) printf(" %lu", count(i));
  printf("\\n");
}
/* Prod.mk is constructor 0 with two fields; Except.error is constructor 0 and Except.ok is 1. */
static lean_object *pair(size_t first, size_t second) {
  lean_object *value = lean_alloc_ctor(0, 2, 0);
  lean_ctor_set(value, 0, lean_box(first)); lean_ctor_set(value, 1, lean_box(second));
  return value;
}
static lean_object *branch(int ok, size_t payload) {
  lean_object *value = lean_alloc_ctor(ok ? 1 : 0, 1, 0);
  lean_ctor_set(value, 0, lean_box(payload));
  return value;
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
  *(void **)&count = dlsym(RTLD_DEFAULT, "fin_product_dispatch_count");
  if (!count) { fprintf(stderr, "interposer is not loaded\\n"); return 1; }
  finproducts_error error = {0};
  finproducts_tuple_nat_nat_value in, out; finproducts_tuple_nat_nat_value_init(&in); finproducts_tuple_nat_nat_value_init(&out);
  mpz_t result; mpz_init(result);
  report("start", 0);
  mpz_set_ui(in.fst, 3); mpz_set_ui(in.snd, 1);
  report("public-valid-first", finproducts_first(&in, &out, &error));
  mpz_set_ui(in.fst, 10); report("public-invalid-first", finproducts_first(&in, &out, &error));
  /* Fresh Except values: the inactive slot is never written. */
  finproducts_result_nat_nat_value valid, invalid; finproducts_result_nat_nat_value_init(&valid); finproducts_result_nat_nat_value_init(&invalid);
  valid.is_ok = 0; mpz_set_ui(valid.error, 2); report("public-valid-both-error", finproducts_both(&valid, result, &error));
  invalid.is_ok = 1; mpz_set_ui(invalid.ok, 7); report("public-invalid-both-ok", finproducts_both(&invalid, result, &error));
  raw_unary first = (raw_unary)dlsym(RTLD_DEFAULT, "${finProductSymbol("FinProducts.first")}");
  raw_unary both = (raw_unary)dlsym(RTLD_DEFAULT, "${finProductSymbol("FinProducts.both")}");
  if (!first || !both) { fprintf(stderr, "exported adapters are not visible\\n"); return 1; }
  /* Direct adapter calls skip the C precheck; Lean's typed construction still rejects them without reaching the source. */
  report("raw-invalid-first", rejected(first, pair(10, 1)));
  report("raw-invalid-both-error", rejected(both, branch(0, 3)));
  report("raw-valid-first", accepted(first, pair(3, 1)));
  report("raw-valid-both-ok", accepted(both, branch(1, 6)));
  finproducts_tuple_nat_nat_value_clear(&in); finproducts_tuple_nat_nat_value_clear(&out);
  finproducts_result_nat_nat_value_clear(&valid); finproducts_result_nat_nat_value_clear(&invalid); mpz_clear(result);
  return 0;
}
`;
