/**
 * Count source, checked-constructor, adapter and pre-validator dispatch for checked-record C exports.
 *
 * @file
 */
import { sha256 } from "../../src/capsule/node.mjs";

/**
 * Name the compiler-emitted Lean adapter that public calls reach through the runtime table.
 *
 * @param name - Lean declaration identity.
 */
export const checkedRecordSymbol = name => `lb_${sha256(`checkedrecords@1.0.0\0${name}`).slice(0, 24)}`;

// Columns: sources width and span; the mkInterval constructor; adapters width and span; pre-validators.
export const checkedRecordDispatchColumns = Object.freeze([
	"l_CheckedRecords_width"
	, "l_CheckedRecords_span"
	, "l_CheckedRecords_mkInterval"
	, checkedRecordSymbol("CheckedRecords.width")
	, checkedRecordSymbol("CheckedRecords.span")
	, `${checkedRecordSymbol("CheckedRecords.width")}_refinement_0`
	, `${checkedRecordSymbol("CheckedRecords.span")}_refinement_0`
	, `${checkedRecordSymbol("CheckedRecords.span")}_refinement_1`]);
const arities = [1, 2, 2, 1, 2, 1, 1, 1];
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
export const checkedRecordDispatchInterposer = () => `#define _GNU_SOURCE
#include <dlfcn.h>
#include <stdlib.h>
static unsigned long counts[${checkedRecordDispatchColumns.length}];
unsigned long checked_record_dispatch_count(unsigned index) { return index < ${checkedRecordDispatchColumns.length} ? counts[index] : 0; }
${checkedRecordDispatchColumns.map(wrapper).join("\n")}
`;

/**
 * Expected rows: step, public status or raw outcome, then the eight counters after the step. A public
 * call runs each pre-validator in order, each running the constructor once; the adapter runs it again
 * for every checked argument before the source. A refusal stops before the adapter and the source.
 */
export const checkedRecordDispatchExpected = Object.freeze([
	["start", 0, [0, 0, 0, 0, 0, 0, 0, 0]]
	, ["public-valid-width", 0, [1, 0, 2, 1, 0, 1, 0, 0]]
	, ["public-invalid-width", 1, [1, 0, 3, 1, 0, 2, 0, 0]]
	, ["public-valid-span", 0, [1, 1, 7, 1, 1, 2, 1, 1]]
	, ["public-invalid-span-second", 1, [1, 1, 9, 1, 1, 2, 2, 2]]
	, ["public-invalid-span-first", 1, [1, 1, 10, 1, 1, 2, 3, 2]]
	// Direct adapter calls skip the pre-validators; the constructor inside the adapter still refuses before the source.
	, ["raw-invalid-width", 1, [1, 1, 11, 2, 1, 2, 3, 2]]
	, ["raw-valid-width", 0, [2, 1, 12, 3, 1, 2, 3, 2]]
	, ["raw-invalid-span-second", 1, [2, 1, 14, 3, 2, 2, 3, 2]]]);

/**
 * Probe public, pre-validator and exported-adapter dispatch. Raw mirrors come from the package's
 * own exported mirror constructor, never from a source record.
 *
 * @param make - Exported symbol that builds an Interval payload mirror from its two Nat fields.
 */
export const checkedRecordDispatchProbe = make => `#define _GNU_SOURCE
#include <checkedrecords.h>
#include <lean/lean.h>
#include <dlfcn.h>
#include <stdio.h>
#include <stdlib.h>
typedef lean_object *(*raw_unary)(lean_object *);
typedef lean_object *(*raw_binary)(lean_object *, lean_object *);
static unsigned long (*count)(unsigned);
static raw_binary mirror;
static void report(const char *step, int status) {
  printf("%s %d", step, status);
  for (unsigned i = 0; i < ${checkedRecordDispatchColumns.length}; ++i) printf(" %lu", count(i));
  printf("\\n");
}
static lean_object *interval(size_t lo, size_t hi) { return mirror(lean_usize_to_nat(lo), lean_usize_to_nat(hi)); }
/* An exported adapter consumes its arguments and returns an owned Option. */
static int none(lean_object *result) {
  int refused = lean_is_scalar(result);
  lean_dec(result);
  return refused;
}
int main(void) {
  *(void **)&count = dlsym(RTLD_DEFAULT, "checked_record_dispatch_count");
  *(void **)&mirror = dlsym(RTLD_DEFAULT, "${make}");
  raw_unary width = (raw_unary)dlsym(RTLD_DEFAULT, "${checkedRecordSymbol("CheckedRecords.width")}");
  raw_binary span = (raw_binary)dlsym(RTLD_DEFAULT, "${checkedRecordSymbol("CheckedRecords.span")}");
  if (!count || !mirror || !width || !span) { fprintf(stderr, "interposer, mirror constructor or adapter is not visible\\n"); return 1; }
  checkedrecords_error error = {0};
  checkedrecords_interval low, high; checkedrecords_interval_init(&low); checkedrecords_interval_init(&high);
  mpz_t result; mpz_init(result);
  report("start", 0);
  mpz_set_ui(low.lo, 3); mpz_set_ui(low.hi, 10); report("public-valid-width", checkedrecords_width(&low, result, &error));
  mpz_set_ui(high.lo, 10); mpz_set_ui(high.hi, 3); report("public-invalid-width", checkedrecords_width(&high, result, &error));
  mpz_set_ui(high.lo, 4); mpz_set_ui(high.hi, 12); report("public-valid-span", checkedrecords_span(&low, &high, result, &error));
  mpz_set_ui(high.lo, 12); mpz_set_ui(high.hi, 4); report("public-invalid-span-second", checkedrecords_span(&low, &high, result, &error));
  report("public-invalid-span-first", checkedrecords_span(&high, &low, result, &error));
  report("raw-invalid-width", none(width(interval(10, 3))));
  report("raw-valid-width", none(width(interval(3, 10))));
  report("raw-invalid-span-second", none(span(interval(1, 5), interval(9, 2))));
  checkedrecords_interval_clear(&low); checkedrecords_interval_clear(&high); mpz_clear(result);
  return 0;
}
`;
