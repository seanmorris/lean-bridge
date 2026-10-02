/**
 * Reuse every public lifetime scenario without configuring an installed runtime.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

/**
 * Produce a consumer that uses the wheel's ordinary public import only.
 *
 * @param combined - Include host callbacks and consuming receivers.
 */
export const ownedPythonCallbackInstalledProbe = async combined => {
	const template = await readFile("tests/fixtures/structured-types/owned-python-callback-results.py", "utf8");
	const end = template.indexOf("if not INSTALLED:\n    import ctypes");
	assert.ok(end > 0);
	const source = `HOST_CALLBACKS = ${combined ? "True" : "False"}\nCOMBINED = ${combined ? "True" : "False"}\nINSTALLED = True\n` + template.slice(0, end) + `
for operation in [original_owner, independent_closure, native_passback,
                  recursive_owners, bounded_depth, affinity,
                  *([host_replies] if HOST_CALLBACKS else []),
                  *([combined_transfers] if COMBINED else [])]:
    operation()
    scenarios.append(operation.__name__)
    gc.collect()
print(json.dumps({"checks": checks, "scenarios": scenarios, "ordinaryImport": True}))
`;
	assert.doesNotMatch(source, /import ctypes|from lean_owned_aggregates import _/u);
	return source;
};
