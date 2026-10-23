/**
 * Bind the public owned WIT host to its exact loaded native dependencies.
 *
 * @file
 */
import { witHostDependencyPrelude } from "./host-evidence.mjs";

/**
 * Owned hosts embed their adapter and depend on GMP instead of a separate C DSO.
 *
 * @param evidence - Verified native component and shared runtime receipts.
 * @param wasmtimeFiles - Verified pinned Wasmtime C API inventory.
 * @param gmpFiles - Pinned GMP build inventory relative to the adapter root.
 */
export const ownedWitHostDependencies = (evidence, wasmtimeFiles, gmpFiles) => {
	const { receipt, runtime } = evidence;
	const libraries = [
		[receipt.library, receipt.nativeLibrary]
		, ...Object.entries(runtime.files).filter(([path]) => path.startsWith("lib/")).map(([path, identity]) => [path.slice(4), identity])
		, ["libgmp.so.10", gmpFiles["lib/libgmp.so.10"]]
		, ["libwasmtime.so", wasmtimeFiles["lib/libwasmtime.so"]]
	].map(([name, identity]) => ({ name, bytes: identity?.bytes, sha256: identity?.sha256 }));
	if(libraries.length !== 5 || new Set(libraries.map(item => item.name)).size !== libraries.length
		|| libraries.some(item => !/^lib[A-Za-z0-9_]+\.so(?:\.10)?$/u.test(item.name)
			|| !Number.isSafeInteger(item.bytes) || item.bytes < 1 || !/^[a-f0-9]{64}$/u.test(item.sha256)))
		throw new Error("Owned WIT hosts require exact component, runtime, GMP and Wasmtime identities");
	return libraries.sort((a, b) => a.name.localeCompare(b.name, "en"));
};

/**
 * Guard every public entry and native import before touching a Wasmtime store.
 * Cleanup stays available after Lean runtime retirement, but never after fork.
 *
 * @param generated - Public owned WIT package generated from authenticated facts.
 * @param dependencies - Verified dependency identities from ownedWitHostDependencies.
 */
export const guardOwnedWitHostSource = (generated, dependencies) => {
	const { values, model, source } = generated, p = values.prefix;
	if(!/^[a-z][a-z0-9_]*_wasmtime$/u.test(p)) throw new TypeError("Invalid owned WIT host namespace");
	const expected = new Set([`${p}_session_open`, `${p}_session_close`
		, `${p}_result_release`
		, ...values.anchoredResults ? [`${p}_result_validate`, ...values.nodes.filter(node => node.identity).map(node => `${node.cName}_equal`)] : []
		, ...[...values.functions, ...values.callbacks, ...values.retains
			, ...values.copies ?? []].map(item => item.cName)]);
	const seen = new Set();
	let guarded = source.replace(new RegExp(`(${p}_status (${p}_[a-z0-9_]+)\\([^;{}]*\\) \\{)`, "gu"), (match, signature, name) => {
		if(!expected.has(name) || seen.has(name)) throw new Error(`Unexpected owned WIT public entry: ${name}`);
		seen.add(name);
		return `${signature}\n  if (getpid() != lb_package_pid) return (${p}_status)LB_OWNED_PROCESS;\n  if (lb_package_failure()) return (${p}_status)LB_OWNED_RUNTIME;`;
	});
	if(seen.size !== expected.size) throw new Error("Owned WIT public entry is missing its dependency guard");
	const imports = new Set();
	guarded = guarded.replace(/(static wasmtime_error_t \*ow_native_import_(\d+)\([^;{}]*\) \{)/gu, (match, signature, index) => {
		if(!model.functions[Number(index)] || imports.has(index)) throw new Error(`Unexpected owned WIT import: ${index}`);
		imports.add(index);
		return `${signature}\n  const char *package_failure = lb_package_failure();\n  if (package_failure) return wasmtime_error_new(package_failure);`;
	});
	if(imports.size !== model.functions.length) throw new Error("Owned WIT native import is missing its dependency guard");
	return witHostDependencyPrelude(dependencies) + guarded;
};
