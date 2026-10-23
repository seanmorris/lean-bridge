/**
 * Checked Fin in plain copied PHP-Wasm packages (VO #1220, PHP-Wasm slice 1).
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson } from "../src/capsule/node.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { checkInstalledPhpWasmFixture, phpWasmFinCaller, phpWasmFinConsumer, phpWasmFinFixtures } from "./helpers/php-wasm-fin-fixtures.mjs";
import { createCompiledPhpWasmModel, generateCompiledPhpWasmLeanAdapters } from "../src/build/php-wasm-graph-model.mjs";
import { createMetadataRequest } from "../src/analyze/elaborated-metadata.mjs";
import { createNativeModel, createPhpWasmCopiedModel, generateNativeLeanAdapters } from "../src/build/native-model.mjs";
import { generateNativePrimitiveC } from "../src/backends/c/native-primitives.mjs";
import { compileCopiedPhpModel } from "../src/backends/php/copied-model.mjs";
import { phpWasmFinReadme } from "../src/release/php-wasm-copied-package.mjs";
import { nativeMetadataFixture } from "./helpers/native-metadata.mjs";
import { finRecordCompilerInput, finRecordNat, finRecordSignatures } from "./helpers/fin-record-model.mjs";
import { finProductCompilerInput, finProductSignatures } from "./helpers/fin-product-model.mjs";
import { generateCopiedPhpPackage, renderCopiedPhpPackage } from "../src/backends/php/copied-values.mjs";
import { generateCopiedPhpZendAdapter } from "../src/backends/php/copied-zend.mjs";
import { buildElaboratedComponent } from "../src/build/elaborated-component.mjs";
import "./helpers/php-wasm-fin-source-history-tests.mjs";
import "./helpers/php-wasm-fin-evidence-tests.mjs";
import "./helpers/php-wasm-fin-archive-source-history-tests.mjs";
import "./helpers/php-wasm-reviewed-fin-source-history-tests.mjs";
import "./helpers/reviewed-php-wasm-fin-evidence-tests.mjs";
import "./helpers/reviewed-php-wasm-fin-archive-source-history-tests.mjs";
import "./helpers/php-wasm-fin-promotion-tests.mjs";
import "./helpers/php-wasm-fin-promotion-source-history-tests.mjs";
import "./helpers/php-wasm-fin-direct-tests.mjs";
import "./helpers/php-wasm-fin-direct-report-tests.mjs";
import "./helpers/php-wasm-fin-direct-ci-tests.mjs";
import "./helpers/php-wasm-fin-direct-history-tests.mjs";
import "./helpers/php-wasm-direct-fin-promotion-tests.mjs";
import "./helpers/php-wasm-subtype-tests.mjs";
import "./helpers/php-wasm-subtype-history-tests.mjs";
import "./helpers/php-wasm-subtype-report-tests.mjs";
import "./helpers/php-wasm-subtype-ci-tests.mjs";
import "./helpers/php-wasm-subtype-acceptance-history-tests.mjs";
import "./helpers/php-wasm-subtype-promotion-tests.mjs";
import "./helpers/php-wasm-subtype-promotion-history-tests.mjs";
import "./helpers/php-wasm-refinement-readme-tests.mjs";
import "./helpers/php-wasm-refinement-ci-matrix-tests.mjs";
import "./helpers/php-wasm-refinement-ci-matrix-source-history-tests.mjs";
import "./helpers/php-wasm-refinement-entry-matrix-tests.mjs";
import "./helpers/php-wasm-refinement-entry-matrix-source-history-tests.mjs";
import "./helpers/php-wasm-refinement-entry-hosted-summary-tests.mjs";
import "./helpers/php-wasm-refinement-entry-hosted-source-history-tests.mjs";
import "./helpers/php-wasm-refinement-ci-closure-repair-source-history-tests.mjs";
import "./helpers/php-wasm-refinement-entry-hosted-verifier-closure-source-history-tests.mjs";
import "./helpers/php-wasm-refinement-entry-promotion-ci-tests.mjs";
import "./helpers/php-wasm-refinement-entry-promotion-source-history-tests.mjs";
import "./helpers/php-wasm-refinement-entry-hosted-verifier-root-source-history-tests.mjs";
import "./helpers/php-wasm-refinement-entry-documentation-tests.mjs";
import "./helpers/php-wasm-refinement-entry-documentation-source-history-tests.mjs";
import "./helpers/php-wasm-refinement-entry-documentation-precision-source-history-tests.mjs";
import "./helpers/zero-payload-matrix-closure-source-history-tests.mjs";
import "./helpers/callback-subtype-retained-packages-source-history-tests.mjs";
import "./helpers/owned-checked-record-javascript-retention-source-history-tests.mjs";
import "./helpers/callback-subtype-hosted-archive-foundation-source-history-tests.mjs";
import "./helpers/owned-checked-record-evidence-contract-source-history-tests.mjs";
import "./helpers/owned-subtype-hosted-archive-source-history-tests.mjs";
import "./helpers/owned-subtype-python-dependency-repair-source-history-tests.mjs";
import "./helpers/owned-subtype-documentation-transaction-source-history-tests.mjs";
import "./helpers/callback-subtype-history-traversal-repair-source-history-tests.mjs";
import "./helpers/owned-subtype-perl-identity-repair-source-history-tests.mjs";
import "./helpers/owned-subtype-wit-resource-repair-source-history-tests.mjs";
import "./helpers/owned-subtype-jvm-filename-repair-source-history-tests.mjs";
import "./helpers/owned-subtype-promotion-contract-source-history-tests.mjs";
import "./helpers/owned-subtype-evidence-test-registration-source-history-tests.mjs";
import "./helpers/owned-subtype-hosted-evidence-contract-source-history-tests.mjs";
import "./helpers/recursive-php-wasm-evidence-replay-repair-source-history-tests.mjs";
import "./helpers/callback-checked-record-retained-packages-source-history-tests.mjs";
import "./helpers/owned-checked-record-hosted-archivers-source-history-tests.mjs";
import "./helpers/owned-checked-record-javascript-hosted-lane-source-history-tests.mjs";
import "./helpers/owned-checked-record-php-wasm-retained-handoff-source-history-tests.mjs";
import "./helpers/owned-subtype-php-wasm-package-gap-source-history-tests.mjs";
import "./helpers/callback-subtype-documentation-review-repair-source-history-tests.mjs";
import "./helpers/php-wasm-refinement-entry-generator-closure-source-history-tests.mjs";
import "./helpers/callback-subtype-documentation-readiness-source-history-tests.mjs";
import "./helpers/callback-subtype-test-registration-source-history-tests.mjs";
import "./helpers/callback-subtype-review-repair-source-history-tests.mjs";
import "./helpers/callback-subtype-promotion-contract-source-history-tests.mjs";
import "./helpers/callback-subtype-promotion-source-history-tests.mjs";
import "./helpers/php-wasm-subtype-entry-tests.mjs";
import "./helpers/php-wasm-hosted-refinements-tests.mjs";
import "./helpers/php-wasm-hosted-refinements-history-tests.mjs";
import { beforePhpWasmCorpusPartitionSource, phpWasmCorpusPartitionHistoryPath } from "./helpers/php-wasm-corpus-partition-history.mjs";
import { sourceAtHistoryMilestone } from "./helpers/source-history-test-source.mjs";

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

test("every PHP Fin fixture's export names generate native PHP and PHP-Wasm packages before any long run", async () => {
	// FinProducts once exported never, a PHP keyword; both PHP targets refused it only after a full Lean build.
	// Keywords are now escaped, and the check below proves never becomes never_ before any long run.
	const fixtures = [["products", phpWasmFinFixtures.products, finProductSignatures, finProductCompilerInput]
		, ["records", phpWasmFinFixtures.records, finRecordSignatures, finRecordCompilerInput]];
	for(const [label, fixture, signatures, compilerInput] of fixtures)
	{
		// The compiler-shaped model names exactly the declarations of the Lean fixture.
		const source = await readFile(`${fixture.root}/${fixture.module}.lean`, "utf8");
		assert.deepEqual([...source.matchAll(/^(?:@\[noinline\] )?def (\w+) /gmu)].map(match => match[1]).sort(), Object.keys(signatures).sort(), label);
		const input = compilerInput();
		generateCopiedPhpPackage(createNativeModel(input, { refinements: true }).bindingIr);
		compileCopiedPhpModel(createPhpWasmCopiedModel(input).bindingIr, { integerBits: 32, structuredCallables: true, lists: true, variants: true });
	}
	// The keyword never now gains one trailing underscore in both targets, as class names and graph functions do.
	const renamed = name => {
		const signatures = { ...finProductSignatures, [name]: finProductSignatures.absentOnly };
		delete signatures.absentOnly;
		return finProductCompilerInput(signatures);
	};
	const options = { integerBits: 32, structuredCallables: true, lists: true, variants: true };
	const keyword = renamed("never"), nativeIr = createNativeModel(keyword, { refinements: true }).bindingIr, wasmIr = createPhpWasmCopiedModel(keyword).bindingIr;
	const native = generateCopiedPhpPackage(nativeIr), wasm = compileCopiedPhpModel(wasmIr, options), wasmFiles = renderCopiedPhpPackage(wasm);
	const declaration = wasmIr.declarations.find(item => item.name === "never").id, symbol = `${wasm.namespace}\\never_`;
	for(const files of [native, wasmFiles])
	{
		assert.match(files["src/Api.php"], /function never_\(/u); assert.doesNotMatch(files["src/Api.php"], /function never\(/u);
		const exports = JSON.parse(files["binding-manifest.json"]).exports;
		assert.ok(exports.includes(symbol)); assert.ok(!exports.includes(`${wasm.namespace}\\never`));
	}
	assert.deepEqual(wasm.surface.functions.filter(fn => fn.field === "never").map(fn => fn.publicName), ["never_"]);
	const zend = JSON.parse(generateCopiedPhpZendAdapter(wasmIr, { integerBits: 32 })["copied-zend-manifest.json"]);
	assert.deepEqual(zend.exports.filter(item => item.declaration === declaration).map(item => item.function), [symbol]);
	// A reserved name that is not a keyword is still refused by both targets, so the check above can fail.
	const reserved = renamed("internal");
	assert.throws(() => generateCopiedPhpPackage(createNativeModel(reserved, { refinements: true }).bindingIr), /PHP function name is reserved or duplicated: internal/u);
	assert.throws(() => compileCopiedPhpModel(createPhpWasmCopiedModel(reserved).bindingIr, options), /PHP function name is reserved or duplicated: internal/u);
});

test("the PHP-Wasm side module compares caller limbs with each bound before the only conversion into Lean", () => {
	const wasm = createPhpWasmCopiedModel(finRecordCompilerInput());
	const provider = generateNativePrimitiveC(wasm, { initializer: "initialize_LeanBridgeNative0123456789abcdef" });
	const call = name => { const start = provider.indexOf(`static finrecords_status lb_call_${name}(`); return provider.slice(start, provider.indexOf("\n}\n", start)); };
	const nest = call("nest_sum");
	const inner = nest.indexOf("(&(&arg0->inner)->digit)->data"), tag = nest.indexOf("(&arg0->tag)->data"), dispatch = nest.indexOf("lean_object *checked = ");
	assert.ok(nest.indexOf("_check(arg0, &budget)") < inner && inner < tag && tag < dispatch, nest);
	assert.match(call("shape_size"), /if \(arg0->kind == 0u\) \{\n\s+if \(!lb_fin_below\(\(&arg0->cases\.circle\.radius\)->data, \(&arg0->cases\.circle\.radius\)->length, lb_fin_shape_size_0_0, 1\)\) return lb_invalid\(error, "arg0\.circle\.radius is not below its Fin 10 bound"\);/u);
	// Fin 0 compares against no limbs; a bound is carried in exact 32-bit limbs whatever its width.
	assert.match(call("gate_open"), /lb_fin_below\(\(&arg0->cases\.never\.value\)->data, \(&arg0->cases\.never\.value\)->length, NULL, 0\)/u);
	assert.ok(provider.includes("static const uint32_t lb_fin_tile_sum_0_0[1] = {0x5u};"));
});

test("PHP-Wasm preserves scalar and structural checks while refined callable and owned packages remain refused", async () => {
	const component = { id: "sample@1.0.0", name: "sample", version: "1.0.0" };
	const input = parameter => {
		const value = nativeMetadataFixture(), projection = value.metadata.modules[0].declarations[0].projection;
		projection.parameters[0].type = parameter;
		return { ...value, component };
	};
	const base = nativeMetadataFixture().metadata.modules[0].declarations[0].projection.parameters[0].type;
	const subtype = { kind: "refinement", base, predicate: { kind: "subtype", constructor: "Sample.checkedText" }, abi: base.abi };
	assert.deepEqual(createPhpWasmCopiedModel(input(subtype)).exports[0].refinements, { parameters: [subtype.predicate], result: null });
	const array = createPhpWasmCopiedModel(input({ kind: "array", element: subtype, abi: heap }));
	assert.deepEqual(array.exports[0].refinements, {
		parameters: [{ kind: "array", arguments: [subtype.predicate] }]
		, result: null
	});
	// A refined export beside a callable export is refused for the whole package.
	const signatures = { tileSum: finRecordCompilerInput().metadata.modules[0].declarations.find(item => item.identity === "Sample.tileSum").projection.parameters[0].type };
	const mixed = finRecordCompilerInput({}, { callable: [{ kind: "callback", parameters: [finRecordNat], result: finRecordNat, abi: heap }, finRecordNat], tileSum: [signatures.tileSum, finRecordNat] });
	assert.throws(() => createPhpWasmCopiedModel(mixed), refinedError(/cannot share a PHP-Wasm package with callables/u));
	// Copied graph packages share the recursive carrier's Fin walk. Owned packages still use a
	// separate transport and remain outside this refinement route.
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
	const graphModel = createCompiledPhpWasmModel(reselect(graphed));
	assert.ok(graphModel.copiedGraph);
	assert.deepEqual(graphModel.exports.find(item => item.name === "Sample.bounded").refinements, {
		parameters: [{ kind: "fin", bound: "10" }]
		, result: null
	});
	const graphAdapters = generateCompiledPhpWasmLeanAdapters(graphModel);
	assert.match(graphAdapters.leanSource, /if _bridgeFin\d+ : \(a0\) < 10 then/u);
	// The same recursive export alone also compiles without adding a refinement guard.
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
	assert.match(readme
		, /Generic record instantiations remain unsupported in PHP-Wasm packages\./u);
	assert.match(readme
		, /Synchronous copied-value callbacks apply the same Fin checks at callback replies and returned-closure inputs\./u);
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

const reviewedLean = process.env.LEAN_BRIDGE_PHP_WASM_REVIEWED_FIN_LEAN_TEST === "1";
const leanPrefix = resolve(process.env.LEAN_BRIDGE_LEAN_PREFIX ?? ".toolchains/elan/toolchains/leanprover--lean4---v4.32.2");
/**
 * Elaborate a fixture with a review into the wasm32 model and compile its Lean adapter, stopping before any C or
 * Emscripten step; the model, or the refusal, comes from fresh Lean.
 *
 * @param t - Running test context.
 * @param fixture - Entry of phpWasmFinFixtures.
 * @param review - Reviewed Binding IR document.
 */
const elaborateReviewed = async (t, fixture, review) => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-php-wasm-reviewed-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const projectRoot = join(directory, "project");
	await cp(fixture.root, projectRoot, { recursive: true });
	await writeFile(join(projectRoot, "lean-bridge.exports.json"), canonicalJson({ schemaVersion: 1, modules: [fixture.module], targets: { "php-wasm": fixture.settings } }));
	await writeFile(join(projectRoot, "api.binding-ir.json"), canonicalJson(review));
	let model;
	const stopped = Object.assign(new Error("stopped before C"), { code: "stopped-before-c" });
	const compileComponent = async ({ model: compiled }) => {
		model = compiled;
		throw stopped;
	};
	const options = { projectRoot, outputRoot: join(directory, "out"), leanPrefix, targets: ["php-wasm"], profile: "php-wasm-copied-v1", receiptName: "php-wasm-component.json" };
	await assert.rejects(() => buildElaboratedComponent({ ...options, createModel: createPhpWasmCopiedModel, createAdapters: generateNativeLeanAdapters, compileComponent })
		, error => { if(error !== stopped) throw error; return true; });
	return model;
};

test("independent Fin reviews reconcile with fresh Lean in the wasm32 model, and a changed bound is refused", { skip: !reviewedLean, timeout: 1_800_000 }, async t => {
	// Each mutation tightens one reviewed bound; reconciliation must stop at that decision.
	const mutations = {
		products: ir => { ir.declarations.find(item => item.id === "lean:FinProducts.first").source.extensions["lean-lang.org/refinements"].parameters[0].arguments[0].bound = "9"; }
		, records: ir => { ir.types.find(item => item.id === "lean:FinRecords.Tile").source.extensions["lean-lang.org/nominal-refinements"].fields[0].bound = "4"; } };
	for(const [name, fixture] of Object.entries(phpWasmFinFixtures))
	{
		const model = await elaborateReviewed(t, fixture, fixture.review());
		assert.equal(model.schemaVersion, 3, name);
		assert.equal(model.pointerBits, 32, name);
		assert.deepEqual(Object.fromEntries(model.exports.map(item => [item.name, item.refinements])), fixture.refinements, name);
		const changed = fixture.review();
		mutations[name](changed);
		await assert.rejects(() => elaborateReviewed(t, fixture, changed)
			, error => error.code === "reviewed-ir-source-mismatch"
				&& (name === "products"
					? /^bindingIr\.declarations\[\d+\]\.source\.extensions\.lean-lang\.org\/refinements\.parameters\[0\]\.arguments\[0\]\.bound$/u
					: /^bindingIr\.types\[\d+\]\.source\.extensions\.lean-lang\.org\/nominal-refinements\.fields\[0\]\.bound$/u).test(error.details?.field), name);
	}
});

test("independently reviewed PHP-Wasm packages check Fin before Lean in Node and browser hosts (dispatch not measured)", { skip: process.env.LEAN_BRIDGE_PHP_WASM_REVIEWED_FIN_TEST !== "1", timeout: 3_600_000 }, async t => {
	const reports = [];
	for(const [name, fixture] of Object.entries(phpWasmFinFixtures))
	{
		// The review supplies every export decision; fresh Lean must agree with each bound before packaging.
		const verifyModel = model => assert.deepEqual(Object.fromEntries(model.exports.map(item => [item.name, item.refinements])), fixture.refinements);
		const spec = { ...fixture, label: `reviewed-fin-${name}`, exports: Object.keys(fixture.refinements), verifyModel, minimumChecks: 2000, reviewed: true };
		const { readme, report } = await checkInstalledPhpWasmFixture(t, spec);
		assert.match(readme, /\n## Bounded integers\n\nLean Fin n parameters and results are Brick\\Math\\BigInteger values below n\. The PHP-Wasm side module/u);
		reports.push({ fixture: name, refinements: fixture.refinements, ...report });
	}
	const reportPath = resolve(process.env.LEAN_BRIDGE_PHP_WASM_REVIEWED_FIN_REPORT ?? "build/php-wasm-fin/reviewed.json");
	await saveLakeFile(dirname(reportPath), reportPath.split("/").at(-1), canonicalJson({ schemaVersion: 1, reports }));
});

test("CI runs the reviewed PHP-Wasm Fin reconciliation and installed gates and keeps their report", async () => {
	const path = ".github/workflows/consumer-matrix.yml";
	const workflow = beforePhpWasmCorpusPartitionSource(
		path, sourceAtHistoryMilestone(phpWasmCorpusPartitionHistoryPath, path)
	);
	const command = "          LEAN_BRIDGE_PHP_WASM_REVIEWED_FIN_LEAN_TEST=1 LEAN_BRIDGE_PHP_WASM_REVIEWED_FIN_TEST=1 node --test --test-concurrency=1 --test-name-pattern='independent Fin reviews reconcile|independently reviewed PHP-Wasm packages' tests/php-wasm-fin.test.mjs\n          test -s build/php-wasm-fin/reviewed.json\n";
	const validate = workflow => {
		const job = name => workflow.match(new RegExp(`^ {2}${name}:\\n[^]*?(?=^ {2}[a-z][a-z0-9-]*:\\n)`, "mu"))?.[0];
		const wasm = job("php-wasm-consumers"), native = job("php-consumers");
		assert.ok(wasm); assert.ok(native);
		assert.match(wasm, /timeout-minutes: 330/u); assert.match(native, /timeout-minutes: 240/u);
		assert.equal(wasm.split(command).length, 2);
		assert.ok(wasm.includes("          test -s build/php-wasm-fin/ordinary.json\n" + command));
		assert.ok(wasm.includes("            build/php-wasm-fin/ordinary.json\n            build/php-wasm-fin/reviewed.json\n"));
		assert.ok(wasm.includes(` && ${command.trim().split("\n")[0]} && `));
		assert.doesNotMatch(native, /LEAN_BRIDGE_PHP_WASM_REVIEWED_FIN_/u);
	};
	validate(workflow);
	for(const changed of [
		workflow.replace(command, "")
		, workflow.replace(command, "      - name: misplaced\n        run: |\n" + command)
		, workflow.replace("  php-consumers:\n", "  php-consumers:\n" + command)
		, workflow.replace("            build/php-wasm-fin/reviewed.json\n", "")
		, workflow.replace(" && " + command.trim().split("\n")[0] + " && ", " && ")
	])
		assert.throws(() => validate(changed), assert.AssertionError);
	// The name pattern selects both reviewed tests and nothing else in this file.
	const source = await readFile(new URL(import.meta.url), "utf8"), pattern = /independent Fin reviews reconcile|independently reviewed PHP-Wasm packages/u;
	assert.equal([...source.matchAll(/^test\("([^"]+)"/gmu)].filter(([, name]) => pattern.test(name)).length, 2);
});
