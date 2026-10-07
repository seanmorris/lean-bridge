/**
 * Checked Fin in plain copied PHP-Wasm packages (VO #1220, PHP-Wasm slice 1).
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { canonicalJson } from "../src/capsule/node.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { checkInstalledPhpWasmFixture, phpWasmFinCaller, phpWasmFinConsumer, phpWasmFinFixtures } from "./helpers/php-wasm-fin-fixtures.mjs";
import { createCompiledPhpWasmModel } from "../src/build/php-wasm-graph-model.mjs";
import { createMetadataRequest } from "../src/analyze/elaborated-metadata.mjs";
import { createNativeModel, createPhpWasmCopiedModel, generateNativeLeanAdapters } from "../src/build/native-model.mjs";
import { generateNativePrimitiveC } from "../src/backends/c/native-primitives.mjs";
import { compileCopiedPhpModel } from "../src/backends/php/copied-model.mjs";
import { phpWasmFinReadme } from "../src/release/php-wasm-copied-package.mjs";
import { nativeMetadataFixture } from "./helpers/native-metadata.mjs";
import { finRecordCompilerInput, finRecordNat } from "./helpers/fin-record-model.mjs";
import "./helpers/php-wasm-fin-source-history-tests.mjs";

const heap = { cType: "lean_object*", box: "lean_box", unbox: "lean_unbox", heap: true };
const refinedError = pattern => error => error.code === "native-refinements-unsupported" && pattern.test(error.message);

test("plain copied PHP-Wasm models carry the native Fin trees and the same Lean guards", () => {
	const input = finRecordCompilerInput(), native = createNativeModel(input, { refinements: true }), wasm = createPhpWasmCopiedModel(input);
	assert.equal(wasm.profile, "php-wasm-copied-v1");
	assert.equal(wasm.pointerBits, 32);
	assert.deepEqual(wasm.bindingIr, native.bindingIr);
	assert.deepEqual(wasm.exports.map(item => item.refinements), native.exports.map(item => item.refinements));
	// One adapter text: the erased mirrors and decidable Fin construction are shared with native packages.
	// Only the List conversion fuel follows the 32-bit pointer width.
	const lean = model => generateNativeLeanAdapters(model).leanSource;
	const fuel = text => text.replace(/loop \d+ value #\[\]/gu, "loop FUEL value #[]");
	assert.equal(fuel(lean(wasm)), fuel(lean(native)));
	assert.match(lean(wasm), /def LbErased\.FinRecords\.Tile\.check/u);
});

test("the PHP-Wasm side module compares caller limbs with each bound before the only conversion into Lean", () => {
	const wasm = createPhpWasmCopiedModel(finRecordCompilerInput());
	const provider = generateNativePrimitiveC(wasm, { initializer: "initialize_LeanBridgeNative0123456789abcdef" });
	const call = name => { const start = provider.indexOf(`static finrecords_status lb_call_${name}(`); return provider.slice(start, provider.indexOf("\n}\n", start)); };
	const nest = call("nest_sum");
	const inner = nest.indexOf("(&(&arg0->inner)->digit)->data"), tag = nest.indexOf("(&arg0->tag)->data"), dispatch = nest.indexOf("lean_object *checked = ");
	assert.ok(nest.indexOf("_check(arg0, &budget)") < inner && inner < tag && tag < dispatch, nest);
	assert.match(call("shape_size"), /if \(arg0->kind == 0u\) \{\n\s+if \(!lb_fin_below\(\(&arg0->cases\.circle\.radius\)->data, \(&arg0->cases\.circle\.radius\)->length, lb_fin_shape_size_0_0, 1\)\) return lb_invalid\(error, "arg0 is not below its Fin 10 bound"\);/u);
	// Fin 0 compares against no limbs; a bound is carried in exact 32-bit limbs whatever its width.
	assert.match(call("gate_open"), /lb_fin_below\(\(&arg0->cases\.never\.value\)->data, \(&arg0->cases\.never\.value\)->length, NULL, 0\)/u);
	assert.ok(provider.includes("static const uint32_t lb_fin_tile_sum_0_0[1] = {0x5u};"));
});

test("PHP-Wasm keeps checked Subtype, callables, graph and owned packages refused", async () => {
	const component = { id: "sample@1.0.0", name: "sample", version: "1.0.0" };
	const input = parameter => {
		const value = nativeMetadataFixture(), projection = value.metadata.modules[0].declarations[0].projection;
		projection.parameters[0].type = parameter;
		return { ...value, component };
	};
	const base = nativeMetadataFixture().metadata.modules[0].declarations[0].projection.parameters[0].type;
	assert.throws(() => createPhpWasmCopiedModel(input({ kind: "refinement", base, predicate: { kind: "subtype", constructor: "Sample.checkedText" }, abi: base.abi })), refinedError(/checked Subtype refinements are not yet supported by PHP-Wasm packages/u));
	// A refined export beside a callable export is refused for the whole package.
	const signatures = { tileSum: finRecordCompilerInput().metadata.modules[0].declarations.find(item => item.identity === "Sample.tileSum").projection.parameters[0].type };
	const mixed = finRecordCompilerInput({}, { callable: [{ kind: "callback", parameters: [finRecordNat], result: finRecordNat, abi: heap }, finRecordNat], tileSum: [signatures.tileSum, finRecordNat] });
	assert.throws(() => createPhpWasmCopiedModel(mixed), refinedError(/cannot share a PHP-Wasm package with callables/u));
	// Graph and owned packages have no Fin walk: a bound beside a recursive export, or in an owned
	// package, is refused at the PHP-Wasm entry, naming the refined declaration.
	const reselect = (value, extra = {}) => {
		const { metadata, ...selection } = value.sourceIdentity.request;
		void metadata;
		Object.assign(selection, extra, { exports: value.metadata.modules[0].declarations.map(item => item.identity) });
		const modules = [{ name: "Sample", sourcePath: "Sample.lean", sourceSha256: "e".repeat(64), interfaceSha256: "1".repeat(64) }];
		const identity = { toolchain: "leanprover/lean4:v4.32.2", modules, leanCompilerSha256: value.sourceIdentity.leanCompilerSha256, extractorSha256: value.sourceIdentity.extractorSha256 };
		value.sourceIdentity.request = { ...selection, metadata: createMetadataRequest(selection, identity).metadata };
		value.metadata.producer.invocationIdentitySha256 = value.sourceIdentity.request.metadata.invocationIdentitySha256;
		return { ...value, component };
	};
	const fin = { kind: "refinement", base: finRecordNat, predicate: { kind: "fin", bound: "10" }, abi: finRecordNat.abi };
	const graphed = nativeMetadataFixture(), declaration = graphed.metadata.modules[0].declarations[0];
	const bounded = JSON.parse(JSON.stringify(declaration).replaceAll("Sample.increment", "Sample.bounded"));
	bounded.projection.parameters[0].type = fin; bounded.projection.result = finRecordNat;
	const reference = { kind: "reference", name: "Sample.Tree", lean: "Sample.Tree", abi: heap };
	const leaf = { name: "leaf", constructor: "Sample.Tree.leaf", fields: [{ name: "value", type: declaration.projection.result }] };
	const tree = { kind: "variant", name: "Sample.Tree", lean: "Sample.Tree", abi: heap, cases: [leaf, { name: "next", constructor: "Sample.Tree.next", fields: [{ name: "child", type: reference }] }] };
	const graph = { kind: "graph", root: reference, types: [tree], abi: heap };
	declaration.projection.parameters[0].type = graph; declaration.projection.result = graph;
	graphed.metadata.modules[0].declarations.unshift(bounded);
	assert.throws(() => createCompiledPhpWasmModel(reselect(graphed)), refinedError(/^Sample\.bounded: checked Fin refinements cannot share a PHP-Wasm package with copied graph exports$/u));
	// The same recursive export alone still compiles: the refusal is about the bound, not the graph.
	const plainGraph = nativeMetadataFixture(), alone = plainGraph.metadata.modules[0].declarations[0].projection;
	alone.parameters[0].type = graph; alone.result = graph;
	assert.ok(createCompiledPhpWasmModel(reselect(plainGraph)).copiedGraph);
	const owned = nativeMetadataFixture(), site = owned.metadata.modules[0].declarations[0].projection;
	site.parameters[0].type = fin; site.result = finRecordNat;
	const ownedAggregates = JSON.parse(await readFile("docs/evidence/owned-php-transfers-20260930.json", "utf8")).runtime[0].input.sourceIdentity.request.ownedAggregates;
	assert.throws(() => createCompiledPhpWasmModel(reselect(owned, { ownedAggregates })), refinedError(/implemented only for ordinary native packages with bound-checking adapters/u));
});

test("PHP-Wasm packages document each checked path, and packages without bounds document nothing new", () => {
	const settings = { integerBits: 32, structuredCallables: true, lists: true, variants: true };
	const readme = phpWasmFinReadme(compileCopiedPhpModel(createPhpWasmCopiedModel(finRecordCompilerInput()).bindingIr, settings));
	assert.match(readme, /^\n## Bounded integers\n\nLean Fin n parameters and results are Brick\\Math\\BigInteger values below n\. The PHP-Wasm side module compares each argument/u);
	assert.match(readme, /Fin inside callbacks or generic record instantiations is not supported in PHP-Wasm packages\./u);
	for(const line of ["nest_sum: $arg0.inner.digit < 5; $arg0.tag < 3", "maybe_shape: $arg0?.circle.radius < 10", "tile_except: $arg0.ok.digit < 5; $arg0.error.circle.radius < 10"])
		assert.ok(readme.includes(`\\${line}\n`), line);
	const plain = { ...nativeMetadataFixture(), component: { id: "sample@1.0.0", name: "sample", version: "1.0.0" } };
	assert.equal(phpWasmFinReadme(compileCopiedPhpModel(createPhpWasmCopiedModel(plain).bindingIr, settings)), "");
});

test("PHP-Wasm callers are the native PHP Fin consumers with only loading and reporting changed", async () => {
	for(const fixture of Object.values(phpWasmFinFixtures))
	{
		const native = await readFile(fixture.consumer, "utf8"), { source, request } = await phpWasmFinCaller(fixture);
		for(const mode of ["weak", "strict"])
		{
			const wasm = source(mode);
			assert.ok(wasm.startsWith(`<?php\ndeclare(strict_types=${mode === "strict" ? 1 : 0});\nuse Brick\\Math\\BigInteger;`), fixture.root);
			assert.doesNotMatch(wasm, /require 'vendor\/autoload\.php'/u);
			// Every case line of the native caller survives unchanged.
			assert.equal(wasm.split("\n").length, native.split("\n").length - 1);
		}
		assert.deepEqual(JSON.parse(request("composer")), { module: fixture.namespace, operations: { probe: fixture.operation }, autoload: "vendor/autoload.php" });
	}
	assert.throws(() => phpWasmFinConsumer("<?php\necho 1;\n", "weak"), /Unexpected native PHP consumer layout/u);
});

test("relocated PHP-Wasm packages check Fin before Lean in Node and browser hosts (dispatch not measured)", { skip: process.env.LEAN_BRIDGE_PHP_WASM_FIN_TEST !== "1", timeout: 3_600_000 }, async t => {
	const reports = [];
	for(const [name, fixture] of Object.entries(phpWasmFinFixtures))
	{
		// Lean elaboration supplies every bound; the wasm32 model carries exactly the native trees.
		const verifyModel = model => assert.deepEqual(Object.fromEntries(model.exports.map(item => [item.name, item.refinements])), fixture.refinements);
		const spec = { ...fixture, label: `fin-${name}`, exports: Object.keys(fixture.refinements), verifyModel, minimumChecks: 2000 };
		const { readme, report } = await checkInstalledPhpWasmFixture(t, spec);
		assert.match(readme, /\n## Bounded integers\n\nLean Fin n parameters and results are Brick\\Math\\BigInteger values below n\. The PHP-Wasm side module/u);
		reports.push({ fixture: name, refinements: fixture.refinements, ...report });
	}
	const reportPath = resolve(process.env.LEAN_BRIDGE_PHP_WASM_FIN_REPORT ?? "build/php-wasm-fin/ordinary.json");
	await saveLakeFile(dirname(reportPath), reportPath.split("/").at(-1), canonicalJson({ schemaVersion: 1, reports }));
});
