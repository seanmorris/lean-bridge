/**
 * Count validator, adapter and source dispatch for checked exports in the installed CPAN package.
 *
 * @file
 */

/** Columns: the exported validator, the adapter and the source of mix, then the source of half. */
export const perlSubtypeDispatchColumns = Object.freeze(["validator:Subtypes.mix", "adapter:Subtypes.mix", "l_Subtypes_mix", "l_Subtypes_half"]);
// Each wrapper repeats the exact exported prototype: validators return uint8_t, adapters and sources return a Lean object.
const wrapper = (symbol, index, arity, result = "void *") => `${result}${result.endsWith("*") ? "" : " "}${symbol}(${Array.from({ length: arity }, (_, i) => `void *a${i}`).join(", ")}) {
  static ${result}${result.endsWith("*") ? "" : " "}(*next)(${Array(arity).fill("void *").join(", ")});
  if (!next) { *(void **)&next = dlsym(RTLD_NEXT, "${symbol}"); if (!next) abort(); }
  ++counts[${index}];
  return next(${Array.from({ length: arity }, (_, i) => `a${i}`).join(", ")});
}`;

const symbolWrapper = (column, index, adapters) => {
	if(column.startsWith("validator:")) return wrapper(`${adapters[column.slice(10)]}_refinement_0`, index, 1, "uint8_t");
	if(column.startsWith("adapter:")) return wrapper(adapters[column.slice(8)], index, 2);
	return wrapper(column, index, column.endsWith("_mix") ? 2 : 1);
};

/**
 * Test-only LD_PRELOAD interposer; counts are written at process exit.
 *
 * @param adapters - Adapter symbol per Lean declaration, from the build's native model.
 */
export const perlSubtypeInterposer = adapters => `#define _GNU_SOURCE
#include <dlfcn.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
static unsigned long counts[4];
${perlSubtypeDispatchColumns.map((column, index) => symbolWrapper(column, index, adapters)).join("\n")}
__attribute__((destructor)) static void report(void) {
  const char *path = getenv("SUBTYPE_COUNTS");
  FILE *file = path ? fopen(path, "w") : NULL;
  if (!file) return;
  fprintf(file, "%lu %lu %lu %lu\\n", counts[0], counts[1], counts[2], counts[3]);
  fclose(file);
}
`;

export const perlSubtypePrelude = "use strict; use warnings; use Math::BigInt; use LeanBridge::Subtypes; sub n { Math::BigInt->new($_[0]) } ";
/** Steps: a valid call reaches validator, adapter and source; a Fin rejection reaches none; a constructor rejection reaches only the validator. */
export const perlSubtypeDispatchSteps = Object.freeze([
	["valid-mix", "LeanBridge::Subtypes::mix(n(4), n(3));", [1, 1, 1, 0]]
	, ["fin-before-constructor", "eval { LeanBridge::Subtypes::mix(n(5), n(10)) }; eval { LeanBridge::Subtypes::mix(n(4), n(10)) };", [0, 0, 0, 0]]
	, ["constructor-rejects", "eval { LeanBridge::Subtypes::mix(n(5), n(3)) }; eval { LeanBridge::Subtypes::half(n(7)) };", [1, 0, 0, 0]]
	, ["invalid-then-valid", "eval { LeanBridge::Subtypes::mix(n(5), n(3)) }; LeanBridge::Subtypes::mix(n(6), n(1)); LeanBridge::Subtypes::half(n(8));", [2, 1, 1, 1]]]);
