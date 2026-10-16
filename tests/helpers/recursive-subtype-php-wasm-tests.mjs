/**
 * Recursive checked-Subtype source contract and installed PHP-Wasm acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";
import { access, cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { join } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { validateBindingIr } from "../../src/binding-ir/contract.mjs";
import { validateExportConfiguration } from "../../src/analyze/export-configuration.mjs";
import { reviewedContractDifference } from "../../src/analyze/reviewed-source.mjs";
import { componentRecordDefinitions } from "../../src/abi/component-records.mjs";
import { componentRecursiveAbi, componentRecursiveDispatch } from "../../src/abi/component-recursive-abi.mjs";
import { nominalRefinementEntries } from "../../src/abi/refinements.mjs";
import { generateNativeCopiedGraphAdapters } from "../../src/backends/c/native-graph-adapters.mjs";
import { generateCopiedPhpGraphZendAdapter } from "../../src/backends/php/copied-graph-zend.mjs";
import { compileCopiedPhpGraphZendModel } from "../../src/backends/php/copied-graph-zend.mjs";
import { buildElaboratedComponent } from "../../src/build/elaborated-component.mjs";
import { createCompiledPhpWasmModel, generateCompiledPhpWasmLeanAdapters } from "../../src/build/php-wasm-graph-model.mjs";
import { phpWasmGraphRefinementReadme } from "../../src/release/php-wasm-copied-package.mjs";
import { checkInstalledPhpWasmFixture } from "./php-wasm-fin-fixtures.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import {
	recursiveSubtypeConfiguration
	, recursiveSubtypeFixtureRoot
	, recursiveSubtypePhpWasmFixture
	, recursiveSubtypeRefinements
	, recursiveSubtypeReview
} from "./recursive-subtype-fixture.mjs";

test("recursive Subtype fixture retains independent per-use checks and finite result projection", () => {
	const review = recursiveSubtypeReview();
	validateBindingIr(review);
	validateExportConfiguration(recursiveSubtypeConfiguration("ordinary"));
	validateExportConfiguration(recursiveSubtypeConfiguration("reviewed"));
	assert.equal(review.declarations.length, 6);
	assert.equal(review.types.length, 2);
	assert.deepEqual(review.types.find(type => type.name === "ChainAlias").target
		, { kind: "named", id: "lean:RecursiveSubtypes.Chain" });
	assert.deepEqual(review.declarations.find(item => item.name === "echoGroups").parameters[0].type, {
		kind: "apply"
		, constructor: "array"
		, arguments: [{
			kind: "apply"
			, constructor: "option"
			, arguments: [{ kind: "named", id: "lean:RecursiveSubtypes.ChainAlias" }]
		}]
	});
	assert.equal(recursiveSubtypeRefinements["RecursiveSubtypes.first"].parameters[0].cases[1].fields[0].refinement.constructor
		, "RecursiveSubtypes.plusOne");
	assert.equal(recursiveSubtypeRefinements["RecursiveSubtypes.second"].parameters[0].cases[1].fields[0].refinement.constructor
		, "RecursiveSubtypes.plusTwo");
	assert.equal(recursiveSubtypeRefinements["RecursiveSubtypes.echo"].result.cases[1].fields[0].refinement.constructor, null);
	assert.equal(recursiveSubtypeRefinements["RecursiveSubtypes.groups"].parameters[0].arguments[0].arguments[0].kind, "variant");
	assert.deepEqual(review.types.find(type => type.name === "Chain").source.extensions["lean-lang.org/nominal-refinements"].cases
		, [[], [null, { kind: "fin", bound: "3" }, null]]);
});

test("recursive PHP-Wasm graph refinements report exact paths without retiring the runtime", () => {
	const ir = recursiveSubtypeReview();
	const abi = {
		version: componentRecursiveAbi, dispatch: componentRecursiveDispatch
		, types: componentRecordDefinitions(ir, true)
		, exports: ir.declarations.map(item => ({
			bindingId: item.id
			, symbol: `lean_bridge_${sha256(`${ir.component.id}\0${item.id}`).slice(0, 24)}`
			, parameters: item.parameters.map(parameter => parameter.type)
			, result: item.result.type, resultMode: item.resultMode })) };
	const refinementExports = ir.declarations.map((item, index) => ({
		bindingId: item.id
		, symbol: abi.exports[index].symbol, wrapper: `export${index}`
		, sourceDeclaration: item.source.declaration
		, parameters: item.parameters.map(() => ({}))
		, refinements: item.source.extensions["lean-lang.org/refinements"] }));
	const native = generateNativeCopiedGraphAdapters(ir, abi, { wordBits: 32
		, initializer: "initialize_LeanBridgeNative0123456789abcdef"
		, refinementExports
		, nominalRefinements: nominalRefinementEntries(ir.types) });
	assert.equal(native.refinementDiagnostics, true);
	assert.match(native.header, /const char \*recursivesubtypes_graph_error\(void\);/u);
	assert.match(native.source, /static _Thread_local char ng_refinement_message/u);
	assert.match(native.source, /\.node\.tail/u);
	assert.match(native.source, /\.node\.value/u);
	assert.match(native.source, /\.node\.digit/u);
	assert.match(native.source, /is not below its Fin 3 bound/u);
	assert.match(native.source, /was rejected by RecursiveSubtypes\.plusOne/u);
	assert.match(native.source, /was rejected by RecursiveSubtypes\.plusTwo/u);
	assert.match(native.source, /return ng_refinement_reject[\s\S]*return NG_OK/u);
	const zend = generateCopiedPhpGraphZendAdapter(ir, { refinementDiagnostics: true });
	const extension = Object.entries(zend).find(([path]) => path.startsWith("extension/"))[1];
	assert.match(extension, /if \(!message && status == 1\) message = recursivesubtypes_graph_error\(\);/u);
	assert.match(extension, /if \(ctx->status == 4 \|\| ctx->status > 5\)/u);
});

test("recursive PHP-Wasm packages document checked graph paths", () => {
	const ir = recursiveSubtypeReview();
	const readme = phpWasmGraphRefinementReadme(ir, compileCopiedPhpGraphZendModel(ir));
	assert.match(readme, /^\n## Checked refinements\n/u);
	assert.match(readme, /Recursive fields and active cases repeat those checks at every reachable occurrence/u);
	assert.match(readme, /a rejection names the actual field or case path/u);
	assert.match(readme, /RecursiveSubtypes\.plusOne/u);
	assert.match(readme, /\$value0\.node\.value checked by RecursiveSubtypes\.plusOne/u);
	assert.match(readme, /\$value0\.node\.digit < 3/u);
	assert.doesNotMatch(readme, /Recursive, generic, owned and callback Subtype positions remain unsupported/u);
});

test("recursive checked PHP-Wasm acceptance is a recurring two-route gate", async () => {
	const workflow = await readFile(".github/workflows/recursive-subtype-php-wasm.yml", "utf8");
	const runner = await readFile("scripts/run-recursive-subtype-php-wasm-ci.sh", "utf8");
	assert.match(workflow, /bash scripts\/run-recursive-subtype-php-wasm-ci\.sh/u);
	assert.match(workflow, /build\/recursive-subtype-php-wasm-ci\//u);
	assert.match(workflow, /if: always\(\)/u);
	assert.match(runner, /for route in ordinary reviewed/u);
	assert.match(runner, /LEAN_BRIDGE_RECURSIVE_SUBTYPE_SOURCE_TEST=1/u);
	assert.match(runner, /LEAN_BRIDGE_RECURSIVE_SUBTYPE_PHP_WASM_HANDOFF/u);
	assert.match(runner, /git diff --quiet HEAD --/u);
});

const sourceFlag = "LEAN_BRIDGE_RECURSIVE_SUBTYPE_SOURCE_TEST";
if(process.env[sourceFlag] !== undefined) assert.ok(["0", "1"].includes(process.env[sourceFlag]), `Invalid ${sourceFlag}`);
for(const route of ["ordinary", "reviewed"]) test(`fresh Lean compiles the ${route} recursive Subtype graph adapters`, {
	skip: process.env[sourceFlag] !== "1", timeout: 600_000
}, async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-recursive-subtype-source-"));
	let complete = false;
	t.after(async () => {
		if(complete) await rm(directory, { recursive: true });
		else t.diagnostic(`Retained recursive Subtype compiler probe: ${directory}`);
	});
	const projectRoot = join(directory, "project"), outputRoot = join(directory, "release");
	await cp(recursiveSubtypeFixtureRoot, projectRoot, { recursive: true });
	await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson(recursiveSubtypeConfiguration(route)));
	if(route === "reviewed") await saveLakeFile(projectRoot, "api.binding-ir.json", canonicalJson(recursiveSubtypeReview()));
	let observed, selectedModel;
	const stopped = new Error("Recursive Subtype adapters compiled; stop before C component compilation");
	const compileComponent = async ({ model, adapters, generatedC }) => {
		observed = { model, adapters, c: await readFile(generatedC, "utf8") };
		throw stopped;
	};
	await assert.rejects(buildElaboratedComponent({
		projectRoot, outputRoot
		, leanPrefix: resolve(process.env.LEAN_BRIDGE_LEAN_PREFIX ?? ".toolchains/elan/toolchains/leanprover--lean4---v4.32.2")
		, targets: ["php-wasm"], profile: "php-wasm-copied-v1"
		, receiptName: "php-wasm-component.json"
		, createModel: createCompiledPhpWasmModel
		, validateModel: model => { selectedModel = model; }
		, createAdapters: generateCompiledPhpWasmLeanAdapters, compileComponent
	}), error => {
		if(error !== stopped)
		{
			const refinements = selectedModel?.bindingIr.types
				.filter(type => type.source.extensions["lean-lang.org/nominal-refinements"] !== undefined)
				.map(type => ({ id: type.id, kind: type.kind
					, fields: type.fields, cases: type.cases
					, refinement: type.source.extensions["lean-lang.org/nominal-refinements"] }));
			error.message += ": " + JSON.stringify({ details: error.details, refinements }); throw error;
		}
		return true;
	});
	await assert.rejects(access(outputRoot), { code: "ENOENT" });
	assert.ok(observed.model.copiedGraph);
	assert.equal(observed.model.schemaVersion, route === "reviewed" ? 5 : 4);
	assert.equal(reviewedContractDifference(recursiveSubtypeReview(), observed.model.bindingIr), null);
	assert.deepEqual(Object.fromEntries(observed.model.exports.map(item => [item.name, item.refinements]))
		, recursiveSubtypeRefinements);
	assert.match(observed.adapters.leanSource, /def LbErased\.RecursiveSubtypes\.Chain\.via_/u);
	assert.match(observed.adapters.leanSource, /def LbErased\.RecursiveSubtypes\.Chain\.validFin/u);
	assert.match(observed.c, /lean_bridge_/u);
	complete = true;
});

const flag = "LEAN_BRIDGE_RECURSIVE_SUBTYPE_PHP_WASM_TEST";
if(process.env[flag] !== undefined) assert.ok(["0", "1"].includes(process.env[flag]), `Invalid ${flag}`);
for(const route of ["ordinary", "reviewed"]) test(`${route} recursive Subtype PHP-Wasm packages reproduce, relocate and recover`, {
	skip: process.env[flag] !== "1", timeout: 3_600_000
}, async t => {
	const fixture = recursiveSubtypePhpWasmFixture(route);
	const verifyModel = model => {
		assert.ok(model.copiedGraph);
		assert.deepEqual(Object.fromEntries(model.exports.map(item => [item.name, item.refinements])), recursiveSubtypeRefinements);
	};
	const { readme, report } = await checkInstalledPhpWasmFixture(t, {
		...fixture, label: "recursive-subtypes"
		, reviewed: route === "reviewed", verifyModel, minimumChecks: 10
		, ...(process.env.LEAN_BRIDGE_RECURSIVE_SUBTYPE_PHP_WASM_HANDOFF === undefined ? {}
			: { retainHandoff: resolve(process.env.LEAN_BRIDGE_RECURSIVE_SUBTYPE_PHP_WASM_HANDOFF, route) })
	});
	assert.match(readme, /Subtype parameters cross as their base value/u);
	for(const execution of report.phpWasm.executions)
	{
		assert.equal(execution.observation.checks, 24);
		assert.equal(execution.observation.word_bits, 32);
	}
	const path = resolve(process.env.LEAN_BRIDGE_RECURSIVE_SUBTYPE_PHP_WASM_OUTPUT ?? "build/recursive-subtypes/php-wasm", `${route}.json`);
	await saveLakeFile(dirname(path), path.split("/").at(-1), canonicalJson({
		schemaVersion: 1, route, refinements: recursiveSubtypeRefinements, ...report
	}));
});
