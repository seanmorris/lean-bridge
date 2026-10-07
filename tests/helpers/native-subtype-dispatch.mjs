/**
 * Count validator, adapter and Lean source dispatch for Subtype-refined C exports.
 *
 * @file
 */
import { sha256 } from "../../src/capsule/node.mjs";

/**
 * Name the compiler-emitted Lean adapter that public calls reach through the runtime table.
 *
 * @param name - Lean declaration identity.
 */
export const nativeSubtypeSymbol = name => `lb_${sha256(`subtypes@1.0.0\0${name}`).slice(0, 24)}`;

// Columns: source shout, source mix; adapters shout, mix; validators shout.0, mix.0. Each takes one or two Lean objects.
export const nativeSubtypeDispatchColumns = Object.freeze([
	"l_Subtypes_shout"
	, "l_Subtypes_mix"
	, nativeSubtypeSymbol("Subtypes.shout")
	, nativeSubtypeSymbol("Subtypes.mix")
	, `${nativeSubtypeSymbol("Subtypes.shout")}_refinement_0`
	, `${nativeSubtypeSymbol("Subtypes.mix")}_refinement_0`]);
const arities = [1, 2, 1, 2, 1, 1];
const wrapper = (symbol, index) => {
	const parameters = Array.from({ length: arities[index] }, (_, i) => `void *a${i}`).join(", "), values = Array.from({ length: arities[index] }, (_, i) => `a${i}`).join(", ");
	return `void *${symbol}(${parameters}) {
  static void *(*next)(${Array(arities[index]).fill("void *").join(", ")});
  if (!next) { *(void **)&next = dlsym(RTLD_NEXT, "${symbol}"); if (!next) abort(); }
  ++counts[${index}];
  return next(${values});
}`;
};

/** Test-only LD_PRELOAD interposer; each wrapper resolves its target on first use. */
export const nativeSubtypeDispatchInterposer = () => `#define _GNU_SOURCE
#include <dlfcn.h>
#include <stdlib.h>
static unsigned long counts[${nativeSubtypeDispatchColumns.length}];
unsigned long native_subtype_dispatch_count(unsigned index) { return index < ${nativeSubtypeDispatchColumns.length} ? counts[index] : 0; }
${nativeSubtypeDispatchColumns.map(wrapper).join("\n")}
`;

/** Expected rows: step, public status or raw outcome, then the six counters after the step. */
export const nativeSubtypeDispatchExpected = Object.freeze([
	["start", 0, [0, 0, 0, 0, 0, 0]]
	, ["public-valid-shout", 0, [1, 0, 1, 0, 1, 0]]
	, ["public-invalid-shout", 1, [1, 0, 1, 0, 2, 0]]
	, ["public-valid-mix", 0, [1, 1, 1, 1, 2, 1]]
	, ["public-invalid-mix-fin", 1, [1, 1, 1, 1, 2, 1]]
	, ["public-invalid-mix-subtype", 1, [1, 1, 1, 1, 2, 2]]
	, ["raw-invalid-shout", 1, [1, 1, 2, 1, 2, 2]]
	, ["raw-valid-shout", 1, [2, 1, 3, 1, 2, 2]]]);

/** Probe public, validator and exported-adapter dispatch; raw values use the pinned Lean object API. */
export const nativeSubtypeDispatchProbe = () => `#define _GNU_SOURCE
#include <subtypes.h>
#include <lean/lean.h>
#include <dlfcn.h>
#include <stdbool.h>
#include <stddef.h>
#include <stdio.h>
#include <stdlib.h>
typedef lean_object *(*raw_unary)(lean_object *);
static unsigned long (*count)(unsigned);
static void report(const char *step, int status) {
  printf("%s %d", step, status);
  for (unsigned i = 0; i < ${nativeSubtypeDispatchColumns.length}; ++i) printf(" %lu", count(i));
  printf("\\n");
}
void mi_collect(bool force);
/* Resident pages of the process, from /proc/self/statm, after the allocator releases freed pages. */
static size_t committed(void) {
  mi_collect(true);
  FILE *statm = fopen("/proc/self/statm", "r");
  unsigned long size = 0, resident = 0;
  if (!statm || fscanf(statm, "%lu %lu", &size, &resident) != 2) { fprintf(stderr, "cannot read statm\\n"); exit(1); }
  fclose(statm);
  return (size_t)resident * 4096u;
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
  *(void **)&count = dlsym(RTLD_DEFAULT, "native_subtype_dispatch_count");
  if (!count) { fprintf(stderr, "interposer is not loaded\\n"); return 1; }
  subtypes_error error = {0};
  subtypes_string out = {0};
  const subtypes_string word = {"hi", 2, NULL, NULL}, empty = {"", 0, NULL, NULL};
  mpz_t even, odd, digit, result; mpz_init_set_ui(even, 4); mpz_init_set_ui(odd, 3); mpz_init_set_ui(digit, 3); mpz_init(result);
  report("start", 0);
  report("public-valid-shout", subtypes_shout(&word, &out, &error)); subtypes_string_clear(&out);
  report("public-invalid-shout", subtypes_shout(&empty, &out, &error));
  report("public-valid-mix", subtypes_mix(even, digit, result, &error));
  mpz_set_ui(digit, 10); report("public-invalid-mix-fin", subtypes_mix(even, digit, result, &error));
  mpz_set_ui(digit, 3); report("public-invalid-mix-subtype", subtypes_mix(odd, digit, result, &error));
  raw_unary shout = (raw_unary)dlsym(RTLD_DEFAULT, "${nativeSubtypeSymbol("Subtypes.shout")}");
  if (!shout) { fprintf(stderr, "exported adapter is not visible\\n"); return 1; }
  /* Direct adapter calls skip the validator; the checked constructor inside the adapter still rejects without reaching the source. */
  report("raw-invalid-shout", rejected(shout, lean_mk_string("")));
  report("raw-valid-shout", accepted(shout, lean_mk_string("hi")));
  /* Heap-backed constructor inputs and results, accepted, rejected and late-rejected, leave the process resident size flat across repeated batches; a deliberate leak of adapter results is the positive control. */
  const uint8_t payload[] = {0, 255}; const subtypes_bytes bytes = {payload, 2, NULL, NULL}; const subtypes_bytes none = {NULL, 0, NULL, NULL};
  uint8_t head = 0; mpz_t factor, big; mpz_init_set_si(factor, -3); mpz_init(big); mpz_setbit(big, 100);
  size_t commit[4] = {0};
  for (int batch = 0; batch < 3; ++batch) {
    for (int i = 0; i < 20000; ++i) {
      subtypes_shout(&word, &out, &error); subtypes_string_clear(&out);
      subtypes_shout(&empty, &out, &error);
      subtypes_join(&word, &empty, &out, &error);
      subtypes_head(&bytes, &head, &error); subtypes_head(&none, &head, &error);
      subtypes_scale(factor, big, result, &error);
      subtypes_half(big, result, &error);
      mpz_set_ui(digit, 3); subtypes_mix(odd, digit, result, &error); subtypes_mix(even, digit, result, &error);
    }
    commit[batch] = committed();
  }
  for (int i = 0; i < 200000; ++i) (void)shout(lean_mk_string("hi")); /* Deliberately leaked results. */
  commit[3] = committed();
  printf("heap-rss %zu %zu %zu %zu\\n", commit[0], commit[1], commit[2], commit[3]);
  mpz_clear(even); mpz_clear(odd); mpz_clear(digit); mpz_clear(result); mpz_clear(factor); mpz_clear(big);
  return 0;
}
`;
