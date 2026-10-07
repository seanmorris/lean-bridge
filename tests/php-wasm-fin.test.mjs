/**
 * Checked Fin in plain copied PHP-Wasm packages (VO #1220, PHP-Wasm slice 1).
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { buildCanonicalProject } from "../src/build/canonical-build.mjs";
import { verifyPackageSetReceipt } from "../src/release/package-set-receipt.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { copyPackageSetHandoff } from "./helpers/package-set.mjs";
import { copiedCleanEnvironment, nativeFixtureEnvironment } from "./helpers/copied-fixture-install.mjs";
import { installedPhpWasmCorpus } from "./helpers/type-corpus-php-wasm-install.mjs";
import { phpWasmFinCaller, phpWasmFinConsumer, phpWasmFinFixtures } from "./helpers/php-wasm-fin-fixtures.mjs";
import { createNativeModel, createPhpWasmCopiedModel, generateNativeLeanAdapters } from "../src/build/native-model.mjs";
import { generateNativePrimitiveC } from "../src/backends/c/native-primitives.mjs";
import { compileCopiedPhpModel } from "../src/backends/php/copied-model.mjs";
import { phpWasmFinReadme } from "../src/release/php-wasm-copied-package.mjs";
import { nativeMetadataFixture } from "./helpers/native-metadata.mjs";
import { finRecordCompilerInput, finRecordNat } from "./helpers/fin-record-model.mjs";

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

test("PHP-Wasm keeps checked Subtype, callables and graph packages refused", () => {
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

test("relocated PHP-Wasm packages check Fin before Lean in Node and browser hosts", { skip: process.env.LEAN_BRIDGE_PHP_WASM_FIN_TEST !== "1", timeout: 3_600_000 }, async t => {
	const reports = [];
	for(const [name, fixture] of Object.entries(phpWasmFinFixtures))
	{
		const author = await mkdtemp(join(tmpdir(), "lean-bridge-php-wasm-fin-author-"));
		const consumer = await mkdtemp(join(tmpdir(), "lean-bridge-php-wasm-fin-consumer-"));
		t.after(() => Promise.all([author, consumer].map(root => rm(root, { recursive: true, force: true }))));
		const projectRoot = join(author, "project"), outputRoot = join(author, "release"), handoff = join(consumer, "handoff");
		await cp(fixture.root, projectRoot, { recursive: true });
		const exports = { schemaVersion: 1, modules: [fixture.module], exports: Object.keys(fixture.refinements), targets: { "php-wasm": fixture.settings } };
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson(exports));
		const environment = nativeFixtureEnvironment(["php-wasm"]);
		if(environment.LEAN_BRIDGE_TEST_PHP_COPIED_RUNTIME) environment.LEAN_BRIDGE_PHP_COPIED_RUNTIME = environment.LEAN_BRIDGE_TEST_PHP_COPIED_RUNTIME;
		t.diagnostic(`${name}: compiling for wasm32`);
		const built = await buildCanonicalProject({ projectRoot, outputRoot, targets: ["php-wasm"], environment }).catch(error => { error.message += `: ${JSON.stringify(error.details)}`; throw error; });
		const model = JSON.parse(await readFile(join(outputRoot, "php-wasm/component/model.json"), "utf8"));
		assert.equal(model.pointerBits, 32);
		// Lean elaboration supplies every bound; the wasm32 model carries exactly the native trees.
		assert.deepEqual(Object.fromEntries(model.exports.map(item => [item.name, item.refinements])), fixture.refinements);
		const receipt = await copyPackageSetHandoff(outputRoot, handoff);
		await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
		const receiptSha256 = sha256(await readFile(join(handoff, "package-set-receipt.json")));
		const packageSet = JSON.parse(await readFile(join(outputRoot, "packages/php-wasm/php-wasm-package-set.json")));
		await rm(author, { recursive: true, force: true });
		const caller = await phpWasmFinCaller(fixture);
		const clean = { ...copiedCleanEnvironment, LEAN_BRIDGE_PHP_SOURCE: "/unavailable/php", LEAN_BRIDGE_PHP_EMSDK: "/unavailable/compiler", LEAN_BRIDGE_PHP_COPIED_RUNTIME: "/unavailable/runtime" };
		const installation = { settings: fixture.settings, source: caller.source, request: caller.request, removeHandoff: true };
		const options = { t, library: { id: `fin-${name}` }, consumer, handoff, receipt, packageSet, environment, clean, sourcePath: "ordinary-source", fixture: installation };
		const installed = await installedPhpWasmCorpus(options).catch(error => { error.message += `: ${JSON.stringify(error.details)}`; throw error; });
		const readme = await readFile(join(consumer, "relocated/node_modules", fixture.settings.npm.name, "README.md"), "utf8");
		assert.match(readme, /\n## Bounded integers\n\nLean Fin n parameters and results are Brick\\Math\\BigInteger values below n\. The PHP-Wasm side module/u);
		// Node and browser, embedded and Composer, startup and lazy, weak and strict: one observation each.
		assert.ok(installed.phpWasm.executions.length >= 8);
		for(const execution of installed.phpWasm.executions)
		{
			assert.equal(execution.observation.word_bits, 32);
			assert.ok(execution.observation.checks > 2000, `${name} ${execution.realm}`);
		}
		const identities = { bindingIrSha256: built.bindingIrSha256, modelSha256: sha256(canonicalJson(model)), receiptSha256 };
		reports.push({ fixture: name, profile: "php-wasm", path: "ordinary-source", refinements: fixture.refinements, ...identities, packages: receipt.packages, ...installed, sourceRemovedBeforeInstallation: true });
	}
	const reportPath = resolve(process.env.LEAN_BRIDGE_PHP_WASM_FIN_REPORT ?? "build/php-wasm-fin/ordinary.json");
	await saveLakeFile(dirname(reportPath), reportPath.split("/").at(-1), canonicalJson({ schemaVersion: 1, reports }));
});
