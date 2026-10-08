/**
 * Count Lean source and adapter dispatch inside hosts that load libraries with dlopen.
 *
 * @file
 */
import { nativeFinSymbol } from "./native-fin-consumers.mjs";

// Columns: source mirror, source impossible, source label, then their exported adapters.
const counted = [
	["l_NativeFin_mirror", 1]
	, ["l_NativeFin_impossible", 1]
	, ["l_NativeFin_label", 3]
	, [nativeFinSymbol("NativeFin.mirror"), 1]
	, [nativeFinSymbol("NativeFin.impossible"), 1]
	, [nativeFinSymbol("NativeFin.label"), 3]
];
const wrapper = ([symbol, arity], index) => {
	const parameters = Array.from({ length: arity }, (_, i) => `void *a${i}`).join(", ");
	const values = Array.from({ length: arity }, (_, i) => `a${i}`).join(", ");
	return `void *${symbol}(${parameters}) {
  static void *(*next)(${Array(arity).fill("void *").join(", ")});
  if (!next) { *(void **)&next = dlsym(RTLD_NEXT, "${symbol}"); if (!next) abort(); }
  ++counts[${index}];
  return next(${values});
}`;
};

/**
 * Test-only LD_PRELOAD interposer. Each wrapper resolves its target on first use,
 * after the host has loaded the bundled libraries globally; the runtime installer
 * is not wrapped because it runs while those libraries are still being loaded.
 */
export const nativeFinCountInterposer = () => `#define _GNU_SOURCE
#include <dlfcn.h>
#include <stdlib.h>
static unsigned long counts[${counted.length}];
unsigned long native_fin_dispatch_count(unsigned index) { return index < ${counted.length} ? counts[index] : 0; }
${counted.map(wrapper).join("\n")}
`;
