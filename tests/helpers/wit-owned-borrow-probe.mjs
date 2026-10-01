/**
 * Independent public assertions and observed Component Model call counters.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

/**
 * Add consuming callbacks without weakening the shared public C borrow probe.
 *
 * @param generated - Generated package supplying only public names.
 * @param installed - Omit private allocation hooks for installed consumers.
 * @param borrowOnly - Compile a package without consuming declarations.
 */
export const ownedWitBorrowProbe = async (generated, installed = false, borrowOnly = false) => {
	const extra = await readFile("tests/fixtures/structured-types/owned-wit-borrow-moves.c", "utf8");
	const base = borrowOnly ? await readFile("tests/fixtures/structured-types/owned-wit-borrow-only.c", "utf8")
		: (await readFile("tests/fixtures/structured-types/owned-public-borrows.c", "utf8"))
		.replace("int main(void) {", extra + "\nint main(void) {")
		.replace("callbacks_and_closures(); mixed_transfers();", "callbacks_and_closures(); mixed_transfers(); wit_borrowed_moves();");
	const original = base
		.replaceAll("owned_aggregates", generated.values.prefix)
		.replaceAll("OWNED_AGGREGATES", generated.values.prefix.toUpperCase());
	if(installed) return "#define LEAN_BRIDGE_BORROW_INSTALLED 1\n" + original;
	return original.replace("int main(void)", "static int consumer_main(void)") + `
extern size_t owned_test_component_calls(void);
extern size_t owned_test_native_imports(void);
extern size_t owned_test_lean_calls(void);
extern size_t owned_test_exports(void);
int main(void) {
  int status = consumer_main();
  printf("{\\"componentCalls\\":%zu,\\"nativeImports\\":%zu,\\"leanCalls\\":%zu,\\"exports\\":%zu}\\n",
    owned_test_component_calls(), owned_test_native_imports(), owned_test_lean_calls(), owned_test_exports());
  return status;
}
`;
};

/**
 * Count actual Component Model, native import and Lean calls without changing ownership.
 *
 * @param generated - Unmodified compiler-generated WIT package.
 */
export const ownedWitBorrowNativeSource = generated => {
	let observed = generated.source;
	const invoke = "wasmtime_error_t *error = wasmtime_component_func_call(";
	assert.equal(observed.split(invoke).length, 2);
	observed = observed.replace(invoke, "++test_component_calls; " + invoke);
	const entry = "wasmtime_component_val_t *results, size_t result_count) {\n  (void)type;";
	assert.equal(observed.split(entry).length, generated.model.functions.length + 1);
	observed = observed.replaceAll(entry, entry + " ++test_native_imports;");
	for(const [index, fn] of [...generated.layout.functions, ...generated.layout.callbacks].entries())
	{
		const call = `status = ${fn.symbol}(host->native, `;
		assert.equal(observed.split(call).length, 2);
		observed = observed.replace(call, "++test_lean_calls; " + (index < generated.layout.functions.length ? `test_exports |= UINT64_C(1) << ${index}; ` : "") + call);
		assert.ok(!observed.includes(`status = ${fn.symbol}(&active->native, `), "Public call bypassed WIT");
	}
	const implementation = `#include <stddef.h>
#include <stdint.h>
extern void *owned_test_allocate(size_t);
extern void owned_test_free(void *);
#define LB_OWNED_ALLOC owned_test_allocate
#define LB_OWNED_FREE owned_test_free
static size_t test_component_calls, test_native_imports, test_lean_calls;
static uint64_t test_exports;
${observed}
size_t owned_test_identities(void) {
  lean_bridge_native_snapshot snapshot; lean_bridge_native_snapshot_read(&snapshot);
  return snapshot.live_identities;
}
size_t owned_test_component_calls(void) { return test_component_calls; }
size_t owned_test_native_imports(void) { return test_native_imports; }
size_t owned_test_lean_calls(void) { return test_lean_calls; }
size_t owned_test_exports(void) {
  size_t count = 0;
  for (uint64_t bits = test_exports; bits; bits >>= 1) count += bits & 1;
  return count;
}
`;
	return implementation;
};
