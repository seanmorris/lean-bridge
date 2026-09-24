/**
 * Reconstruct the checked wasm32 transport and keep its evidence separate from
 * generated PHP-to-Zend conversion and installed-package acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { validateElaboratedMetadata } from "../../src/analyze/elaborated-metadata.mjs";
import { createElaboratedSemanticModel } from "../../src/analyze/semantic-model.mjs";
import { generateNativeCopiedGraphAdapters } from "../../src/backends/c/native-graph-adapters.mjs";
import { phpWasmCopiedPins, phpWasmCopiedProfile } from "../../src/build/php-wasm-copied-artifacts.mjs";
import { recursiveCarrierAbi } from "./recursive-carriers.mjs";
import { nativeRecursiveSource } from "./native-recursive-transport.mjs";
import { recursiveReviewedIr } from "./recursive-fixture.mjs";
import { nativeRecursiveReviewedIr } from "./native-recursive-reviewed.mjs";
import { phpLinkedGraphIr } from "./php-graph-values-fixture.mjs";
import { assertAdministrativeSourceUpdate } from "./test-registration-history.mjs";

export const wasm32GraphEvidenceSources = [
	"src/backends/c/copied-graph-layout.mjs"
	, "src/backends/c/native-graph-adapters.mjs"
	, "src/backends/c/generate.mjs"
	, "src/abi/component-recursive.mjs"
	, "src/abi/component-recursive-abi.mjs"
	, "src/abi/component-records.mjs"
	, "src/abi/component-copied.mjs"
	, "src/abi/component-scalars.mjs"
	, "src/binding-ir/contract.mjs"
	, "src/binding-ir/canonical.mjs"
	, "src/capsule/node.mjs"
	, "src/analyze/NativeExports.lean"
	, "src/analyze/elaborated-metadata.mjs"
	, "src/analyze/semantic-model.mjs"
	, "src/build/component-recursive-lean.mjs"
	, "src/build/component-recursive-types.mjs"
	, "src/build/php-wasm-copied-artifacts.mjs"
	, "src/build/php-wasm-copied-component.mjs"
	, "src/build/process-runner.mjs"
	, "src/backends/native/runtime-broker.mjs"
	, "src/backends/php/php-wasm-libuv.mjs"
	, "tests/helpers/wasm32-recursive-transport.mjs"
	, "tests/helpers/wasm32-graph-receipt.mjs"
	, "tests/helpers/native-recursive-transport.mjs"
	, "tests/helpers/native-recursive-reviewed.mjs"
	, "tests/helpers/recursive-carriers.mjs"
	, "tests/helpers/recursive-fixture.mjs"
	, "tests/helpers/php-graph-values-fixture.mjs"
	, "tests/fixtures/onboarding/npm-recursive/Recursive.lean"
	, "tests/fixtures/structured-types/native-recursive-check.c"
	, "tests/fixtures/structured-types/wasm32-recursive-probe.c"
	, "tests/wasm32-recursive-transport.test.mjs"
	, "tests/native-recursive-transport.test.mjs"
	, "tests/native-copied-graph-layout.test.mjs"
].sort();

/**
 * Verify compiler metadata, exact generated transport and both actual widths.
 *
 * @param record - Retained execution record with original pre-change sources.
 */
export const assertWasm32GraphEvidence = async record => {
	assert.equal(record.schemaVersion, 1); assert.equal(record.planNode, 1219);
	assert.equal(record.kind, "recursive-wasm32-transport");
	assert.equal(record.installedPackage, false); assert.equal(record.finalAcceptance, false);
	assert.deepEqual(record.remaining, ["PHP-to-Zend graph conversion", "prepared PHP-Wasm packages", "shared-source verification", "complete cross-language acceptance"]);
	assert.deepEqual(Object.keys(record.sources).sort(), wasm32GraphEvidenceSources);
	for(const [path, hash] of Object.entries(record.sources)) await assertAdministrativeSourceUpdate(path, hash);
	const expectedPrevious = {
		"src/backends/c/copied-graph-layout.mjs": "d3682b19adfb22fc39560d60c03daeb4b1f14593b2f190a3c4327956148d9f3d"
		, "src/backends/c/native-graph-adapters.mjs": "6fc401617a64e628f188ca87d7ef5aba179402a8653a3cb0077331bb5eb2820d"
	};
	assert.deepEqual(record.preChangeSources.map(item => item.path).sort(), Object.keys(expectedPrevious).sort());
	for(const item of record.preChangeSources)
	{ assert.equal(item.sha256, expectedPrevious[item.path]); assert.equal(sha256(item.text), item.sha256); }
	const fixtures = { recursiveReviewedIr, nativeRecursiveReviewedIr, phpLinkedGraphIr };
	assert.deepEqual(record.nativeBaseline.map(item => item.fixture), Object.keys(fixtures));
	for(const item of record.nativeBaseline)
	{
		const ir = fixtures[item.fixture](), abi = recursiveCarrierAbi(ir);
		assert.deepEqual(item.outputs.map(output => output.options), [{}, { initializer: "initialize_LeanBridgeNative0123456789abcdef" }]);
		for(const output of item.outputs) assert.equal(sha256(canonicalJson(generateNativeCopiedGraphAdapters(ir, abi, output.options))), output.sha256);
	}
	const report = record.report;
	assert.equal(record.reportSha256, sha256(canonicalJson(report)));
	assert.equal(report.schemaVersion, 1); assert.equal(report.profile, "wasm32-copied-graph-transport");
	assert.equal(report.installedPackage, false); assert.equal(report.exports, 18);
	validateElaboratedMetadata(report.metadata, report.request);
	assert.deepEqual(report.metadata.diagnostics, []);
	const ir = createElaboratedSemanticModel({ metadata: report.metadata
		, request: report.request
		, component: { id: "recursive@1.0.0", name: "recursive", version: "1.0.0" }
		, elaborationSha256: sha256(canonicalJson(report.metadata)) }).document;
	assert.deepEqual(report.bindingIr, ir); assert.deepEqual(report.abi, recursiveCarrierAbi(ir));
	const adapter = generateNativeCopiedGraphAdapters(ir, report.abi, { wordBits: 32 });
	assert.equal(report.sourceSha256, sha256(adapter.source));
	assert.equal(report.layoutSha256, sha256(canonicalJson(adapter.layout)));
	assert.equal(report.files["recursive-graph-types.h"], sha256(adapter.typesHeader));
	assert.equal(report.files["recursive-graph.h"], sha256(adapter.header));
	assert.equal(report.fixtureSha256, sha256(await readFile("tests/fixtures/structured-types/native-recursive-check.c")));
	assert.equal(report.files["probe.c"], sha256(await readFile("tests/fixtures/structured-types/wasm32-recursive-probe.c")));
	const source = (await nativeRecursiveSource()).replace("value == 18446744073709551615", "value == 4294967295").replace("value == -9223372036854775808", "value == -2147483648");
	assert.equal(report.files["Recursive.lean"], sha256(source));
	assert.equal(report.request.metadata.modules[0].sourceSha256, sha256(source));
	assert.equal(report.request.metadata.toolchain, "leanprover/lean4:v4.32.2");
	assert.deepEqual(report.runtimeManifest.pins, phpWasmCopiedPins);
	assert.equal(report.runtimeManifest.pointerBits, 32); assert.equal(report.runtimeManifest.profile, phpWasmCopiedProfile);
	assert.equal(report.compiler, report.runtimeManifest.compiler.version);
	assert.equal(report.runtimeIdentity, sha256(canonicalJson(report.runtimeManifest)));
	assert.match(report.wasmSha256, /^[0-9a-f]{64}$/);
	assert.deepEqual(report.executions, Array.from({ length: 2 }, () => ({
		checks: 169841, boundaryChecks: 78, wordBits: 32, phpBits: 32
		, phpVersion: "8.4.1", live: 0, runtimeInitializations: 1
		, componentInitializations: 1
	})));
	assert.deepEqual(Object.keys(record.logs).sort(), ["native", "wasm32"]);
	for(const [name, count] of [["native", 26], ["wasm32", 3]])
	{
		const log = record.logs[name]; assert.equal(sha256(log.text), log.sha256);
		assert.ok(log.text.includes(`# tests ${count}\n`)); assert.ok(log.text.includes(`# pass ${count}\n# fail 0\n`));
		assert.match(log.text, /# skipped 0\n/);
	}
};
