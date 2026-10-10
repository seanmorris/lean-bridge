/**
 * Count Lean source and adapter dispatch for container-refined C exports.
 *
 * @file
 */
import { sha256 } from "../../src/capsule/node.mjs";

/**
 * Name the compiler-emitted Lean adapter that public calls reach through the runtime table.
 *
 * @param name - Lean declaration identity.
 */
export const finContainerSymbol = name => `lb_${sha256(`fincontainers@1.0.0\0${name}`).slice(0, 24)}`;

// Columns: source mirrorAll, source orDefault, then their exported adapters. Each takes one Lean object.
export const finContainerDispatchColumns = Object.freeze([
	"l_FinContainers_mirrorAll"
	, "l_FinContainers_orDefault"
	, finContainerSymbol("FinContainers.mirrorAll")
	, finContainerSymbol("FinContainers.orDefault")]);
const wrapper = (symbol, index) => `void *${symbol}(void *a0) {
  static void *(*next)(void *);
  if (!next) { *(void **)&next = dlsym(RTLD_NEXT, "${symbol}"); if (!next) abort(); }
  ++counts[${index}];
  return next(a0);
}`;

/** Test-only LD_PRELOAD interposer; each wrapper resolves its target on first use. */
export const finContainerDispatchInterposer = () => `#define _GNU_SOURCE
#include <dlfcn.h>
#include <stdlib.h>
static unsigned long counts[${finContainerDispatchColumns.length}];
unsigned long fin_container_dispatch_count(unsigned index) { return index < ${finContainerDispatchColumns.length} ? counts[index] : 0; }
${finContainerDispatchColumns.map(wrapper).join("\n")}
`;

/** Expected rows: step, public status or raw outcome, then the four counters after the step. */
export const finContainerDispatchExpected = Object.freeze([
	["start", 0, [0, 0, 0, 0]]
	, ["public-valid-mirror", 0, [1, 0, 1, 0]]
	, ["public-invalid-mirror", 1, [1, 0, 1, 0]]
	, ["public-valid-absent", 0, [1, 1, 1, 1]]
	, ["public-invalid-present", 1, [1, 1, 1, 1]]
	, ["raw-invalid-mirror", 1, [1, 1, 2, 1]]
	, ["raw-invalid-present", 1, [1, 1, 2, 2]]
	, ["raw-valid-mirror", 1, [2, 1, 3, 2]]
	, ["raw-valid-absent", 1, [2, 2, 3, 3]]]);

/** Probe public and exported-adapter dispatch; raw values use the pinned Lean object API. */
export const finContainerDispatchProbe = () => `#define _GNU_SOURCE
#include <fincontainers.h>
#include <lean/lean.h>
#include <dlfcn.h>
#include <stdio.h>
typedef lean_object *(*raw_unary)(lean_object *);
static unsigned long (*count)(unsigned);
static void report(const char *step, int status) {
  printf("%s %d", step, status);
  for (unsigned i = 0; i < ${finContainerDispatchColumns.length}; ++i) printf(" %lu", count(i));
  printf("\\n");
}
static lean_object *singleton(size_t value) {
  lean_object *array = lean_alloc_array(1, 1);
  lean_array_set_core(array, 0, lean_box(value));
  return array;
}
static lean_object *present(size_t value) {
  lean_object *option = lean_alloc_ctor(1, 1, 0);
  lean_ctor_set(option, 0, lean_box(value));
  return option;
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
  *(void **)&count = dlsym(RTLD_DEFAULT, "fin_container_dispatch_count");
  if (!count) { fprintf(stderr, "interposer is not loaded\\n"); return 1; }
  fincontainers_error error = {0};
  fincontainers_array_nat_span out = {0};
  mpz_t value, result; mpz_init_set_ui(value, 3); mpz_init(result);
  fincontainers_array_nat_span values = {&value, 1, NULL, NULL};
  fincontainers_option_nat_value option; fincontainers_option_nat_value_init(&option);
  report("start", 0);
  report("public-valid-mirror", fincontainers_mirror_all(&values, &out, &error)); fincontainers_array_nat_span_clear(&out);
  mpz_set_ui(value, 10); report("public-invalid-mirror", fincontainers_mirror_all(&values, &out, &error));
  report("public-valid-absent", fincontainers_or_default(&option, result, &error));
  option.has_value = 1; mpz_set_ui(option.value, 1); report("public-invalid-present", fincontainers_or_default(&option, result, &error));
  raw_unary mirror = (raw_unary)dlsym(RTLD_DEFAULT, "${finContainerSymbol("FinContainers.mirrorAll")}");
  raw_unary or_default = (raw_unary)dlsym(RTLD_DEFAULT, "${finContainerSymbol("FinContainers.orDefault")}");
  if (!mirror || !or_default) { fprintf(stderr, "exported adapters are not visible\\n"); return 1; }
  /* Direct adapter calls skip the C precheck; Lean's typed construction still rejects them without reaching the source. */
  report("raw-invalid-mirror", rejected(mirror, singleton(10)));
  report("raw-invalid-present", rejected(or_default, present(1)));
  report("raw-valid-mirror", accepted(mirror, singleton(3)));
  report("raw-valid-absent", accepted(or_default, lean_box(0)));
  mpz_clear(value); mpz_clear(result); fincontainers_option_nat_value_clear(&option);
  return 0;
}
`;
