/**
 * Exact dependencies and complete entry guards for owned public WIT packages.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { generateOwnedWitPackage } from "../src/backends/wit/owned-package.mjs";
import { guardOwnedWitHostSource, ownedWitHostDependencies } from "../src/backends/wit/owned-host-evidence.mjs";

const identity = { bytes: 10, sha256: "a".repeat(64) };
const evidence = () => ({ receipt: { library: "libcomponent_123.so", nativeLibrary: identity }
	, runtime: { files: { "lib/libleanshared.so": identity, "lib/liblean_bridge_native.so": identity, "include/runtime.h": identity } } });
const wasmtime = { "lib/libwasmtime.so": identity }, gmp = { "lib/libgmp.so.10": identity };

test("owned WIT dependencies embed GMP instead of a separate public C adapter", () => {
	const dependencies = ownedWitHostDependencies(evidence(), wasmtime, gmp);
	assert.deepEqual(dependencies.map(item => item.name), ["libcomponent_123.so", "libgmp.so.10", "liblean_bridge_native.so", "libleanshared.so", "libwasmtime.so"]);
	const mutations = [value => { value.receipt.nativeLibrary = {}; }
		, value => { value.receipt.library = "../libother.so"; }
		, value => { value.receipt.library = "libwasmtime.so"; }
		, value => { value.runtime.files["lib/libextra.so"] = identity; }];
	for(const mutate of mutations)
	{
		const changed = evidence(); mutate(changed);
		assert.throws(() => ownedWitHostDependencies(changed, wasmtime, gmp), /exact/u);
	}
	assert.throws(() => ownedWitHostDependencies(evidence(), {}, gmp), /exact/u);
	assert.throws(() => ownedWitHostDependencies(evidence(), wasmtime, {}), /exact/u);
});

test("every owned WIT export, callback, copy, retain and cleanup entry checks loaded libraries", async () => {
	const record = JSON.parse(await readFile("docs/evidence/owned-host-execution-20260926.json", "utf8"));
	for(const input of Object.values(record.inputs))
	{
		const generated = generateOwnedWitPackage({ ...input, hostCallbacks: true }, new Uint8Array());
		const dependencies = ownedWitHostDependencies(evidence(), wasmtime, gmp);
		const guarded = guardOwnedWitHostSource(generated, dependencies), p = generated.values.prefix;
		const entries = [...guarded.matchAll(new RegExp(`${p}_status (${p}_[a-z0-9_]+)\\([^;{}]*\\) \\{`, "gu"))];
		assert.ok(entries.length > 10);
		for(const entry of entries) assert.ok(guarded.slice(entry.index + entry[0].length).startsWith(`\n  if (getpid() != lb_package_pid) return (${p}_status)LB_OWNED_PROCESS;\n  if (lb_package_failure()) return (${p}_status)LB_OWNED_RUNTIME;`));
		const imports = [...guarded.matchAll(/static wasmtime_error_t \*ow_native_import_\d+\([^;{}]*\) \{/gu)];
		assert.equal(imports.length, generated.model.functions.length);
		for(const entry of imports) assert.ok(guarded.slice(entry.index + entry[0].length).startsWith("\n  const char *package_failure = lb_package_failure();\n  if (package_failure) return wasmtime_error_new(package_failure);"));
		for(const { name, bytes, sha256: digest } of dependencies) assert.ok(guarded.includes(`{"${name}", UINT64_C(${bytes}), "${digest}"}`));
		for(const name of ["session_open", "session_close", "result_release"])
			assert.throws(() => guardOwnedWitHostSource({ ...generated, source: generated.source.replace(`${p}_status ${p}_${name}(`, `${p}_status ${p}_missing(`) }, dependencies), /Unexpected|missing/u);
		assert.throws(() => guardOwnedWitHostSource({ ...generated, source: generated.source.replace("*ow_native_import_0(", "*ow_native_import_other(") }, dependencies), /missing/u);
	}
});
