/**
 * Fixed-width recursive compiler admission and actual installed PHP-Wasm APIs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { createPhpWasmCopiedModel, generateNativeLeanAdapters } from "../src/build/native-model.mjs";
import { createCompiledPhpWasmModel, generateCompiledPhpWasmLeanAdapters, phpWasmGraphCarrierAbi } from "../src/build/php-wasm-graph-model.mjs";
import { generateCompiledPhpWasmGraph } from "../src/build/php-wasm-graph-component.mjs";
import { createPhpWasmCopiedDescriptor } from "../src/backends/php/php-wasm-copied-host.mjs";
import { nativeMetadataFixture } from "./helpers/native-metadata.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { checkPhpWasmGraphPackages } from "./helpers/php-wasm-graph-packages.mjs";
import { assertPhpWasmGraphPackageEvidence } from "./helpers/php-wasm-graph-receipt.mjs";

test("recursive PHP-Wasm models bind finite constructors to 32-bit total Lean carriers", () => {
	// Synthetic metadata tests model validation, not compiled execution.
	const input = nativeMetadataFixture(), projection = input.metadata.modules[0].declarations[0].projection;
	const abi = { cType: "lean_object*", box: "lean_box", unbox: "lean_unbox", heap: true };
	const reference = { kind: "reference", name: "Sample.Tree", lean: "Sample.Tree", abi };
	const tree = { kind: "variant", name: "Sample.Tree", lean: "Sample.Tree", abi
		, cases: [{ name: "leaf", constructor: "Sample.Tree.leaf", fields: [{ name: "value", type: projection.result }] }
			, { name: "next", constructor: "Sample.Tree.next", fields: [{ name: "child", type: reference }] }] };
	const graph = { kind: "graph", root: reference, types: [tree], abi };
	projection.parameters[0].type = graph; projection.result = graph;
	const options = { ...input, component: { id: "sample@1.0.0", name: "sample", version: "1.0.0" } };
	const before = canonicalJson(options), model = createCompiledPhpWasmModel(options);
	assert.equal(canonicalJson(options), before);
	assert.equal(model.schemaVersion, 4); assert.equal(model.profile, "php-wasm-copied-v1"); assert.equal(model.pointerBits, 32);
	assert.equal(model.copiedGraph.types.length, 1);
	assert.deepEqual(phpWasmGraphCarrierAbi(model).exports[0].parameters, [{ kind: "named", id: "lean:Sample.Tree" }]);
	for(const mutate of [
		value => { value.pointerBits = 64; }
		, value => { value.profile = "native-library-v1"; }
		, value => { value.copiedGraph.exports[0].symbol = `lean_bridge_${"f".repeat(24)}`; }
		, value => { value.copiedGraph.types[0].cases.reverse(); }
		, value => { value.copiedGraph.schemaVersion = 2; }
	]) {
		const changed = structuredClone(model); mutate(changed);
		assert.throws(() => phpWasmGraphCarrierAbi(changed), /differ/);
	}
	const adapters = generateCompiledPhpWasmLeanAdapters(model), output = generateCompiledPhpWasmGraph(model, adapters);
	assert.match(adapters.header, /sizeof\(size_t\) \* 8 == 32/);
	assert.doesNotMatch(adapters.leanSource, /\b(?:unsafe|unsafeCast|partial|sorry|axiom|defaultValue)\b/);
	assert.match(output.files["graph/transport.c"], /__builtin_wasm_memory_size/);
	assert.match(output.files["graph/runtime.c"], /LEAN_BRIDGE_NATIVE_RUNTIME_RETIREMENT_VERSION != 1/);
	assert.equal(output.receipt.layoutSha256, output.manifest.layoutSha256);
	assert.deepEqual(output.sources, ["graph/transport.c", "graph/runtime.c", `extension/${output.manifest.extension}.c`]);
	assert.equal(output.manifest.integerBits, 32); assert.equal(output.manifest.wordBits, 32);
});

test("recursive PHP-Wasm admission preserves the existing acyclic compiler model and wrappers", () => {
	const options = { ...nativeMetadataFixture(), component: { id: "example@1.0.0", name: "example", version: "1.0.0" } };
	const old = createPhpWasmCopiedModel(options), current = createCompiledPhpWasmModel(options);
	assert.deepEqual(current, old); assert.deepEqual(generateCompiledPhpWasmLeanAdapters(current), generateNativeLeanAdapters(old));
	assert.throws(() => createCompiledPhpWasmModel({ ...options, moduleName: "LeanBridge::Example" }), /Perl namespace/);
	for(const changed of [{ ...current, profile: "native-library-v1" }, { ...current, pointerBits: 64 }, { ...current, byteOrder: "big" }])
		assert.throws(() => phpWasmGraphCarrierAbi(changed), /compiled profile/);
});

test("PHP-Wasm graph descriptors mount the closed internal PHP source set in both modes", () => {
	const url = name => new URL(`file:///installed/${name}`);
	const runtime = { identity: "1".repeat(64), loaderIdentity: "2".repeat(64), library: `liblean_bridge_php_wasm_copied_${"3".repeat(20)}.so`, url: url("runtime.so") };
	const component = { id: "recursive@1.0.0", identity: "4".repeat(64), runtimeIdentity: runtime.identity, namespace: "LeanRecursive", library: `php8.4-lb_recursive_graph_${"5".repeat(16)}.so`, composer: "test/recursive" };
	const php = { "bootstrap.php": url("bootstrap.php"), ...Object.fromEntries(["Values", "GraphTypes", "Wire"].map(name => [`src/Internal/${name}.php`, url(name + ".php")])) };
	const assets = { api: url("Api.php"), native: url("Native.php"), library: url("component.so"), registration: url("lazy.txt"), php };
	for(const mode of ["startup", "lazy"])
	{
		const descriptor = createPhpWasmCopiedDescriptor(runtime, component, assets), entry = mode === "lazy" ? descriptor.lazy : descriptor;
		const host = { phpVersion: "8.4", phpArgs: {} }, files = entry.getFiles(host);
		for(const path of Object.keys(php)) assert.equal(files.filter(file => file.path === `/vendor/test/recursive/${path}`).length, 1);
		assert.deepEqual(entry.getFiles(host), []); assert.equal(entry.getLibs(host).length, 2);
	}
	for(const path of ["src/Internal/Other.php", "src/Internal/../Wire.php", "/src/Internal/Wire.php", "src/Api.php", "src/Internal/Native.php"])
		assert.throws(() => createPhpWasmCopiedDescriptor(runtime, component, { ...assets, php: { ...php, [path]: url("other.php") } }), /Invalid bundled PHP dependencies/);
});

test("ordinary and reviewed recursive PHP-Wasm packages execute after offline installation", {
	skip: process.env.LEAN_BRIDGE_PHP_WASM_GRAPH_PACKAGE_TEST !== "1"
	, timeout: 900000
}, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-php-wasm-graph-packages-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const report = await checkPhpWasmGraphPackages(root, message => { t.diagnostic(message); process.stderr.write(message + "\n"); });
	await saveLakeFile("build/recursive", "php-wasm-graph-packages.json", canonicalJson(report));
});

test("PHP-Wasm CI requires and retains the recursive installed-package report", async () => {
	const workflow = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	assert.ok(workflow.includes("          LEAN_BRIDGE_PHP_WASM_GRAPH_PACKAGE_TEST=1 node --test tests/php-wasm-graph-package.test.mjs\n"));
	assert.ok(workflow.includes("          test -s build/recursive/php-wasm-graph-packages.json\n"));
	assert.ok(workflow.includes("            build/recursive/php-wasm-graph-packages.json\n"));
});

test("recursive PHP-Wasm package evidence binds actual installed APIs and browser assets", async () => {
	const record = JSON.parse(await readFile("docs/evidence/php-wasm-recursive-packages-20260924.json", "utf8"));
	await assertPhpWasmGraphPackageEvidence(record);
	for(const mutate of [
		value => { value.finalAcceptance = true; }
		, value => { value.report.observations.pop(); }
		, value => { value.report.observations[0].executions.pop(); }
		, value => { value.report.observations[0].browser.executions.pop(); }
		, value => { value.report.observations[0].browser.executions[0].requests = []; }
		, value => { value.report.observations[0].receipt.copiedGraph.layoutSha256 = "0".repeat(64); }
		, value => { value.report.observations[0].authorRemoved = false; }
		, value => { value.report.allocationGuard.pop(); }
		, value => { value.preAdmissionSources["src/build/php-wasm-copied-component.mjs"].source += "\n"; }
	]) {
		const changed = structuredClone(record); mutate(changed);
		changed.reportSha256 = sha256(canonicalJson(changed.report));
		await assert.rejects(() => assertPhpWasmGraphPackageEvidence(changed));
	}
});
