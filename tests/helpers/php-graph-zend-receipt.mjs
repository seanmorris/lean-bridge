/**
 * Reconstruct recursive PHP/Zend sources and check actual wasm32 observations.
 *
 * @file
 */
import assert from "node:assert/strict";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { validateElaboratedMetadata } from "../../src/analyze/elaborated-metadata.mjs";
import { createElaboratedSemanticModel } from "../../src/analyze/semantic-model.mjs";
import { generateCopiedPhpGraphZendAdapter } from "../../src/backends/php/copied-graph-zend.mjs";
import { compileCopiedCGraphLayout } from "../../src/backends/c/copied-graph-layout.mjs";
import { generateNativeCopiedGraphAdapters } from "../../src/backends/c/native-graph-adapters.mjs";
import { phpWasmCopiedPins, phpWasmCopiedProfile } from "../../src/build/php-wasm-copied-artifacts.mjs";
import { phpGraphConversionIr } from "./php-graph-conversion-fixture.mjs";
import { recursiveCarrierAbi } from "./recursive-carriers.mjs";
import { assertAdministrativeSourceUpdate } from "./test-registration-history.mjs";

const sourceHashes = files => Object.fromEntries(Object.entries(files).map(([path, source]) => [path, sha256(source)]));

export const phpGraphZendEvidenceSources = [
	"src/backends/php/copied-graph-wire.mjs"
	, "src/backends/php/copied-graph-zend-runtime.mjs"
	, "src/backends/php/copied-graph-zend.mjs"
	, "src/backends/php/copied-graph-values.mjs"
	, "src/backends/php/copied-graph-walk.mjs"
	, "src/backends/php/copied-graph-scalars.mjs"
	, "src/backends/php/copied-zend-conversions.mjs"
	, "src/backends/php/copied-zend-support.mjs"
	, "src/backends/php/php-wasm-copied-loader.mjs"
	, "src/backends/php/brick-math.mjs"
	, "src/backends/php/brick-math.source.json"
	, "src/backends/c/copied-graph-layout.mjs"
	, "src/backends/c/native-graph-adapters.mjs"
	, "src/backends/native/runtime-broker.mjs"
	, "src/build/php-wasm-copied-component.mjs"
	, "src/build/php-wasm-copied-artifacts.mjs"
	, "src/build/component-recursive-lean.mjs"
	, "src/analyze/NativeExports.lean"
	, "src/analyze/elaborated-metadata.mjs"
	, "src/analyze/semantic-model.mjs"
	, "tests/fixtures/structured-types/recursive-php-values.php"
	, "tests/fixtures/structured-types/recursive-php-zend.php"
	, "tests/fixtures/structured-types/recursive-php-wasm-lean.php"
	, "tests/fixtures/structured-types/wasm32-recursive-probe.c"
	, "tests/fixtures/structured-types/native-recursive-check.c"
	, "tests/fixtures/onboarding/npm-recursive/Recursive.lean"
	, "tests/php-copied-graph-zend.test.mjs"
	, "tests/helpers/php-graph-zend-fixture.mjs"
	, "tests/helpers/php-graph-zend-lean.mjs"
	, "tests/helpers/php-graph-zend-receipt.mjs"
	, "tests/helpers/php-graph-conversion-fixture.mjs"
	, "tests/helpers/wasm32-recursive-transport.mjs"
	, "tests/helpers/native-recursive-transport.mjs"
	, "tests/helpers/native-recursive-reviewed.mjs"
	, "tests/helpers/recursive-fixture.mjs"
	, "tests/helpers/recursive-carriers.mjs"
	, "package.json"
	, "config/cli-package.v1.json"
	, "config/checked-javascript.json"
	, "nix/perl-engine-source-boundary.json"
	, "src/adoption/test-profiles.mjs"
	, ".github/workflows/consumer-matrix.yml"
].sort();

/**
 * Verify the converter stage without promoting package or profile acceptance.
 *
 * @param record - Retained generated sources, execution observations and logs.
 */
export const assertPhpGraphZendEvidence = async record => {
	assert.equal(record.schemaVersion, 1); assert.equal(record.planNode, 1219);
	assert.equal(record.kind, "recursive-php-wasm-zend-conversions");
	assert.equal(record.finalAcceptance, false); assert.equal(record.installedPackage, false);
	for(const [path, hash] of Object.entries(record.sourceHashes)) await assertAdministrativeSourceUpdate(path, hash);
	assert.deepEqual(Object.keys(record.sourceHashes).sort(), phpGraphZendEvidenceSources);
	const { isolated, lean } = record.reports;
	assert.deepEqual(Object.keys(record.reports).sort(), ["isolated", "lean"]);
	for(const [key, report] of Object.entries(record.reports))
	{
		assert.equal(record.reportHashes[key], sha256(canonicalJson(report)));
		assert.equal(report.schemaVersion, 1); assert.equal(report.installedPackage, false);
	}
	assert.equal(isolated.compiledLean, false); assert.equal(lean.compiledLean, true);
	assert.deepEqual(isolated.bindingIr, phpGraphConversionIr());
	assert.deepEqual(isolated.generatedSources, sourceHashes(generateCopiedPhpGraphZendAdapter(isolated.bindingIr)));
	assert.equal(isolated.observations.length, 14);
	assert.deepEqual(isolated.observations.map(run => [run.mode, run.scenario]), ["weak", "strict"].flatMap(mode => [1, 2, 3, 4, 7, 9, 14].map(scenario => [mode, scenario])));
	for(const run of isolated.observations)
	{
		const observed = run.observed;
		assert.equal(observed.actualPhpBits, 32); assert.equal(observed.integerBits, 32); assert.equal(observed.wordBits, 32);
		assert.equal(observed.compiledLean, false); assert.equal(observed.installedPackage, false);
		assert.equal(observed.scenario, run.scenario); assert.equal(observed.stats.retired, 1);
		assert.equal(observed.stats.live, 0); assert.equal(observed.stats.owners, 0);
		assert.ok(observed.checks > 1000); assert.ok(observed.rejections > 100);
		assert.ok(observed.inputFailures > 0); assert.ok(observed.outputFailures > 0);
		assert.equal(observed.phpFaults, observed.inputFailures + observed.outputFailures);
		assert.deepEqual(Object.keys(observed.faults).sort(), ["echo_link", "echo_result_link", "envelope", "spine", "tree", "wide"]);
		for(const count of Object.values(observed.faults)) assert.ok(count > 0);
		assert.match(run.probeSha256, /^[0-9a-f]{64}$/);
	}
	assert.deepEqual(isolated.bailouts.map(run => run.scenario), [5, 6]);
	for(const run of isolated.bailouts)
	{
		const { before, after, recovered } = run.observed;
		assert.equal(recovered, true); assert.equal(before.clears, 1); assert.equal(after.clears, 2);
		for(const observed of [before, after])
		{
			assert.equal(observed.live, 0); assert.equal(observed.owners, 0); assert.equal(observed.retired, 0);
		}
	}
	const transport = lean.transport;
	assert.equal(transport.installedPackage, false); assert.equal(transport.exports, 18); assert.equal(lean.exports, 18);
	validateElaboratedMetadata(transport.metadata, transport.request); assert.deepEqual(transport.metadata.diagnostics, []);
	const ir = createElaboratedSemanticModel({ metadata: transport.metadata
		, request: transport.request
		, component: { id: "recursive@1.0.0", name: "recursive", version: "1.0.0" }
		, elaborationSha256: sha256(canonicalJson(transport.metadata)) }).document;
	assert.deepEqual(transport.bindingIr, ir);
	assert.deepEqual(transport.abi, recursiveCarrierAbi(ir));
	const adapter = generateNativeCopiedGraphAdapters(ir, transport.abi, { wordBits: 32 });
	assert.equal(transport.sourceSha256, sha256(adapter.source));
	assert.equal(transport.files["recursive-graph-types.h"], sha256(adapter.typesHeader));
	assert.equal(transport.files["recursive-graph.h"], sha256(adapter.header));
	assert.deepEqual(transport.runtimeManifest.pins, phpWasmCopiedPins);
	assert.equal(transport.runtimeManifest.pointerBits, 32);
	assert.equal(transport.runtimeManifest.profile, phpWasmCopiedProfile);
	assert.equal(transport.runtimeIdentity, sha256(canonicalJson(transport.runtimeManifest)));
	assert.equal(transport.compiler, transport.runtimeManifest.compiler.version);
	assert.equal(lean.runtimeIdentity, transport.runtimeIdentity);
	assert.deepEqual(lean.generatedSources, sourceHashes(generateCopiedPhpGraphZendAdapter(ir)));
	assert.equal(lean.layoutSha256, sha256(canonicalJson(compileCopiedCGraphLayout(ir, { wordBits: 32 }))));
	assert.equal(transport.layoutSha256, lean.layoutSha256);
	assert.equal(transport.executions.length, 2);
	for(const observed of transport.executions)
	{
		assert.equal(observed.wordBits, 32); assert.equal(observed.phpBits, 32); assert.equal(observed.live, 0);
		assert.equal(observed.checks, 169841); assert.equal(observed.boundaryChecks, 78);
	}
	assert.deepEqual(lean.observations.map(run => run.mode), ["weak", "strict"]);
	for(const run of lean.observations)
	{
		const observed = run.observed;
		assert.equal(observed.compiledLean, true); assert.equal(observed.installedPackage, false); assert.equal(observed.actualPhpBits, 32);
		assert.equal(observed.stats.nativeLive, 0); assert.equal(observed.stats.zendLive, 0);
		assert.equal(observed.stats.runtimeInitializations, 1); assert.equal(observed.stats.componentInitializations, 1);
		assert.ok(observed.checks > 1000); assert.ok(observed.rejections > 100);
		assert.deepEqual(Object.keys(observed.faults).sort(), ["envelope", "spine", "tree", "wide"]);
		for(const counts of Object.values(observed.faults))
		{
			assert.ok(counts.zendAttempts > 0); assert.ok(counts.nativeAttempts > 0);
		}
	}
	for(const [name, log] of Object.entries(record.logs))
	{
		assert.equal(log.sha256, sha256(log.text)); assert.match(log.text, /# fail 0\n/);
		assert.match(log.text, /# skipped 0\n/);
		assert.match(log.text, /ok \d+ - fresh Lean executes through generated recursive PHP-Wasm functions/);
		assert.match(log.text, /ok \d+ - generated Zend graphs execute on 32-bit PHP with strict validation and failure cleanup/);
		assert.match(log.command, /php-copied-graph-zend\.test\.mjs/);
		assert.ok(["isolated", "lean"].includes(name));
	}
	assert.deepEqual(Object.keys(record.logs).sort(), ["isolated", "lean"]);
};
