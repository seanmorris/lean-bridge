/**
 * Count Lean source and adapter dispatch for container-refined exports in the installed CPAN package.
 *
 * @file
 */

/** Source symbols first, then the compiler-emitted adapters the XSUBs call; each takes one Lean object. */
export const perlContainerDispatchColumns = Object.freeze(["l_FinContainers_mirrorAll", "l_FinContainers_countNone", "adapter:FinContainers.mirrorAll", "adapter:FinContainers.countNone"]);
const wrapper = (symbol, index) => `void *${symbol}(void *a0) {
  static void *(*next)(void *);
  if (!next) { *(void **)&next = dlsym(RTLD_NEXT, "${symbol}"); if (!next) abort(); }
  ++counts[${index}];
  return next(a0);
}`;

/**
 * Test-only LD_PRELOAD interposer; counts are written at process exit.
 *
 * @param adapters - Adapter symbol per Lean declaration, from the build's native model.
 */
export const perlContainerInterposer = adapters => `#define _GNU_SOURCE
#include <dlfcn.h>
#include <stdio.h>
#include <stdlib.h>
static unsigned long counts[4];
${perlContainerDispatchColumns.map((column, index) => wrapper(column.startsWith("adapter:") ? adapters[column.slice(8)] : column, index)).join("\n")}
__attribute__((destructor)) static void report(void) {
  const char *path = getenv("FIN_CONTAINER_COUNTS");
  FILE *file = path ? fopen(path, "w") : NULL;
  if (!file) return;
  fprintf(file, "%lu %lu %lu %lu\\n", counts[0], counts[1], counts[2], counts[3]);
  fclose(file);
}
`;

export const perlContainerPrelude = "use strict; use warnings; use Math::BigInt; use LeanBridge::FinContainers; sub n { Math::BigInt->new($_[0]) } ";
/** Steps: public valid calls reach adapter and source; public rejections reach neither. */
export const perlContainerDispatchSteps = Object.freeze([
	["valid-mirror", "LeanBridge::FinContainers::mirror_all([n(3), n(4)]);", [1, 0, 1, 0]]
	, ["valid-empty", "LeanBridge::FinContainers::count_none([]);", [0, 1, 0, 1]]
	, ["invalid-only", "eval { LeanBridge::FinContainers::mirror_all([n(1), n(10)]) }; eval { LeanBridge::FinContainers::count_none([n(0)]) }; eval { LeanBridge::FinContainers::mirror_all([n(-1)]) }; eval { LeanBridge::FinContainers::mirror_all(3) };", [0, 0, 0, 0]]
	, ["invalid-then-valid", "eval { LeanBridge::FinContainers::mirror_all([n(10)]) }; LeanBridge::FinContainers::mirror_all([n(9)]);", [1, 0, 1, 0]]]);
