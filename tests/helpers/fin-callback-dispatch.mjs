/**
 * Count dispatch through a leased closure with a checked Fin argument (VO #1445).
 * Columns: the public lease-call entry, the checked closure-call adapter, then the source body.
 * The entry counts every public call, rejected ones included; only dispatch after validation stays zero.
 *
 * @file
 */
import { sha256 } from "../../src/capsule/node.mjs";
import { nativeTypeKey } from "../../src/build/native-model.mjs";

/**
 * Name the three counted symbols from the compiled model and the generated closure name.
 *
 * @param model - Compiled native model of the FinCallbacks fixture.
 * @param closure - Generated public owned-closure name for scaler's result.
 */
export const finCallbackDispatchSymbols = (model, closure) => {
	const scaler = model.exports.find(item => item.name === "FinCallbacks.scaler");
	return { entry: `${closure.replace(/^fincallbacks_/u, "fincallbacks_gmp_")}_call`
		, adapter: `lb_t${nativeTypeKey(scaler.result)}_call`
		, source: "l_FinCallbacks_scaled"
		, factory: `lb_${sha256(`${model.component.id}\0FinCallbacks.scaler`).slice(0, 24)}` };
};

/**
 * Test-only LD_PRELOAD interposer for the three columns.
 *
 * @param symbols - Counted symbol names.
 */
export const finCallbackDispatchInterposer = symbols => `#define _GNU_SOURCE
#include <dlfcn.h>
#include <stdlib.h>
static unsigned long counts[3];
unsigned long fin_callback_dispatch_count(unsigned index) { return index < 3 ? counts[index] : 0; }
int ${symbols.entry}(void *self, void *argument, void *out, void *error) {
  static int (*next)(void *, void *, void *, void *);
  if (!next) { *(void **)&next = dlsym(RTLD_NEXT, "${symbols.entry}"); if (!next) abort(); }
  ++counts[0];
  return next(self, argument, out, error);
}
void *${symbols.adapter}(void *closure, void *value) {
  static void *(*next)(void *, void *);
  if (!next) { *(void **)&next = dlsym(RTLD_NEXT, "${symbols.adapter}"); if (!next) abort(); }
  ++counts[1];
  return next(closure, value);
}
void *${symbols.source}(void *factor, void *digit) {
  static void *(*next)(void *, void *);
  if (!next) { *(void **)&next = dlsym(RTLD_NEXT, "${symbols.source}"); if (!next) abort(); }
  ++counts[2];
  return next(factor, digit);
}
`;

/**
 * Expected rows: step, status or raw outcome (1 when Lean answered none), then entry, adapter and source counts.
 * A public rejection is counted at the entry only; a raw adapter call with an invalid argument reaches the adapter,
 * whose decidable construction answers none without reaching the source; valid calls reach all three.
 */
export const finCallbackDispatchExpected = Object.freeze([
	["start", 0, [0, 0, 0]]
	, ["public-valid", 0, [1, 1, 1]]
	, ["public-invalid-bound", 1, [2, 1, 1]]
	, ["public-invalid-wide", 1, [3, 1, 1]]
	, ["public-recovery", 0, [4, 2, 2]]
	, ["raw-invalid", 1, [4, 3, 2]]
	, ["raw-valid", 0, [4, 4, 3]]
	, ["public-after-raw", 0, [5, 5, 4]]]);

/**
 * Probe public and raw dispatch through one leased closure; the probe refuses to report without the interposer.
 *
 * @param symbols - Counted symbol names.
 * @param closure - Generated public owned-closure name for scaler's result.
 */
export const finCallbackDispatchProbe = (symbols, closure) => `#define _GNU_SOURCE
#include <fincallbacks.h>
#include <lean/lean.h>
#include <dlfcn.h>
#include <stdio.h>
typedef lean_object *(*raw_factory)(lean_object *);
typedef lean_object *(*raw_call)(lean_object *, lean_object *);
static unsigned long (*count)(unsigned);
static void report(const char *step, int status) {
  printf("%s %d", step, status);
  for (unsigned i = 0; i < 3; ++i) printf(" %lu", count(i));
  printf("\\n");
}
int main(void) {
  *(void **)&count = dlsym(RTLD_DEFAULT, "fin_callback_dispatch_count");
  if (!count) { fprintf(stderr, "interposer is not loaded\\n"); return 1; }
  fincallbacks_error error = {0};
  mpz_t factor, digit, out; mpz_init_set_ui(factor, 7); mpz_init(digit); mpz_init(out);
  ${closure} *scaler = NULL;
  if (fincallbacks_scaler(factor, &scaler, &error) != FINCALLBACKS_STATUS_OK) return 1;
  report("start", 0);
  mpz_set_ui(digit, 4); report("public-valid", ${closure}_call(scaler, digit, out, &error) != FINCALLBACKS_STATUS_OK);
  mpz_set_ui(digit, 10); report("public-invalid-bound", ${closure}_call(scaler, digit, out, &error) == FINCALLBACKS_STATUS_INVALID_ARGUMENT);
  mpz_set_ui(digit, 0); mpz_setbit(digit, 70); report("public-invalid-wide", ${closure}_call(scaler, digit, out, &error) == FINCALLBACKS_STATUS_INVALID_ARGUMENT);
  mpz_set_ui(digit, 9); report("public-recovery", ${closure}_call(scaler, digit, out, &error) != FINCALLBACKS_STATUS_OK || mpz_cmp_ui(out, 63) != 0);
  /* Direct adapter calls skip the C precheck; Lean's decidable construction still answers none without the source. */
  raw_factory make = (raw_factory)dlsym(RTLD_DEFAULT, "${symbols.factory}");
  raw_call call = (raw_call)dlsym(RTLD_DEFAULT, "${symbols.adapter}");
  if (!make || !call) { fprintf(stderr, "exported adapters are not visible\\n"); return 1; }
  lean_object *closure = make(lean_box(7));
  lean_inc(closure); lean_object *none = call(closure, lean_box(12));
  report("raw-invalid", lean_is_scalar(none));
  lean_inc(closure); lean_object *some = call(closure, lean_box(5));
  int valid = !lean_is_scalar(some) && lean_unbox(lean_ctor_get(some, 0)) == 35;
  report("raw-valid", !valid);
  lean_dec(some); lean_dec(closure);
  mpz_set_ui(digit, 3); report("public-after-raw", ${closure}_call(scaler, digit, out, &error) != FINCALLBACKS_STATUS_OK || mpz_cmp_ui(out, 21) != 0);
  ${closure}_dispose(&scaler);
  mpz_clear(factor); mpz_clear(digit); mpz_clear(out);
  return 0;
}
`;
