/**
 * Reuse independent public C lifetime assertions at the Component Model boundary.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { ownedWitBorrowNativeSource } from "./wit-owned-borrow-probe.mjs";

/**
 * Observe exact export and closure entry sets, separately from aggregate call counts.
 *
 * @param generated - Unmodified compiler-generated WIT package.
 */
export const ownedWitCallbackNativeSource = generated => {
	let source = ownedWitBorrowNativeSource(generated);
	assert.ok(generated.layout.callbacks.length <= 64);
	for(const [index, callback] of generated.layout.callbacks.entries())
	{
		const call = `++test_lean_calls; status = ${callback.symbol}(host->native, `;
		assert.equal(source.split(call).length, 2);
		source = source.replace(call, `++test_closure_calls; test_closures |= UINT64_C(1) << ${index}; ${call}`);
	}
	return `#include <stddef.h>\n#include <stdint.h>\nstatic size_t test_closure_calls;\nstatic uint64_t test_closures;\n${source}
size_t owned_test_closure_calls(void) { return test_closure_calls; }
uint64_t owned_test_export_mask(void) { return test_exports; }
uint64_t owned_test_closure_mask(void) { return test_closures; }
`;
};

/**
 * Compose public lifetime, higher-order and consuming callback assertions.
 *
 * @param generated - Generated WIT package with public C names.
 * @param combined - Include consuming receivers and export anchors.
 * @param hostCallbacks - Explicit case contract for host descriptor signatures.
 */
export const ownedWitCallbackResultProbe = async (generated, combined, hostCallbacks) => {
	assert.equal(typeof hostCallbacks, "boolean");
	assert.equal(generated.publicHeader.includes("_host {"), hostCallbacks);
	const base = await readFile("tests/fixtures/structured-types/owned-callback-results.c", "utf8");
	const mixed = await readFile("tests/fixtures/structured-types/owned-wit-callback-mixed.c", "utf8");
	const combinations = combined ? await readFile("tests/fixtures/structured-types/owned-installed-callback-combinations.c", "utf8") : "";
	const fn = generated.values.functions.find(item => item.name === "callbackRecord");
	const node = generated.values.nodes.find(item => item.id === fn.parameters[1]);
	assert.ok(node.cName.endsWith("_apply_twice_argument1_t"));
	const marker = "  clear(&closure_owner); clear(&supplied_owner); clear(&first_owner); clear(&second_owner);";
	assert.equal(base.split(marker).length, 2);
	const source = base.replace("int main(void) {", `${mixed}\n${combinations}\nstatic int consumer_main(void) {`)
		.replace(marker, `  mixed_callbacks(session);${combined ? " callback_combinations(session);" : ""}\n${marker}`)
		.replaceAll("owned_aggregates_callback_record_argument1_t", "owned_aggregates_apply_twice_argument1_t")
		.replaceAll("owned_aggregates", generated.values.prefix)
		.replaceAll("OWNED_AGGREGATES", generated.values.prefix.toUpperCase());
	return `#define HOST_CALLBACKS ${hostCallbacks ? 1 : 0}\n#define COMBINED ${combined ? 1 : 0}\n${source}
extern size_t owned_test_component_calls(void);
extern size_t owned_test_native_imports(void);
extern size_t owned_test_lean_calls(void);
extern size_t owned_test_exports(void);
extern size_t owned_test_closure_calls(void);
extern uint64_t owned_test_export_mask(void);
extern uint64_t owned_test_closure_mask(void);
int main(void) {
  int status = consumer_main();
  printf("{\\"componentCalls\\":%zu,\\"nativeImports\\":%zu,\\"leanCalls\\":%zu,\\"exports\\":%zu,\\"closureCalls\\":%zu,\\"exportMask\\":%llu,\\"closureMask\\":%llu}\\n",
    owned_test_component_calls(), owned_test_native_imports(), owned_test_lean_calls(), owned_test_exports(),
    owned_test_closure_calls(), (unsigned long long)owned_test_export_mask(), (unsigned long long)owned_test_closure_mask());
  return status;
}
`;
};
