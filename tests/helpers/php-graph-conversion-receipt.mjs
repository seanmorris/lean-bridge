/**
 * Verify exact generated PHP sources and both independent conversion gates.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { generateCopiedPhpGraphConversions } from "../../src/backends/php/copied-graph-conversions.mjs";
import { nativeRecursiveReviewedIr } from "./native-recursive-reviewed.mjs";
import { phpGraphConversionIr, phpGraphLayoutProbe, phpGraphNativeExtras, phpGraphProbe, phpLeanGraphProbe } from "./php-graph-conversion-fixture.mjs";

const hashes = files => Object.fromEntries(Object.entries(files).map(([path, source]) => [path, sha256(source)]));
const instrumented = files => Object.fromEntries(Object.entries(files).map(([path, source]) => {
	const result = path.endsWith("/GraphNative.php") ? source
		.replace("public static function checkpoint(): void {}", "public static function checkpoint(): void { \\GraphFaults::hit(); }")
		.replace("$this->owners[] = $owner;", "$this->owners[] = $owner; \\GraphFaults::allocated($owner);") : source;
	return [path, result];
}));
const digest = value => assert.match(value, /^[0-9a-f]{64}$/);

/**
 * Require both source paths, weak/strict callers, every fault and retirement mode.
 * This receipt deliberately does not assert installed Composer acceptance.
 *
 * @param record - Source-bound conversion execution evidence.
 */
export const verifyPhpGraphConversionEvidence = async record => {
	assert.equal(record.schemaVersion, 1); assert.equal(record.planNode, 1219);
	assert.equal(record.kind, "recursive-php-native-conversions"); assert.equal(record.installedPackage, false);
	assert.deepEqual(Object.keys(record.reports).sort(), ["isolated", "native"]);
	assert.deepEqual(Object.keys(record.logs).sort(), ["isolated", "native"]);
	for(const [name, report] of Object.entries(record.reports))
	{
		assert.equal(sha256(canonicalJson(report)), record.reportHashes[name]);
		assert.equal(report.schemaVersion, 1); assert.equal(report.installedPackage, false);
		digest(report.phpSha256); assert.match(report.phpVersion, /^PHP 8\./);
		const log = record.logs[name]; assert.equal(sha256(log.text), log.sha256);
		assert.match(log.text, /# tests 1\n/); assert.match(log.text, /# pass 1\n# fail 0\n/); assert.match(log.text, /# skipped 0\n/);
	}
	const isolated = record.reports.isolated, model = generateCopiedPhpGraphConversions(phpGraphConversionIr());
	assert.equal(isolated.compiledLean, false);
	assert.deepEqual(isolated.generatedSourceHashes, hashes(model.files));
	assert.deepEqual(isolated.instrumentedSourceHashes, hashes(instrumented(model.files)));
	assert.equal(isolated.callerSha256, sha256(phpGraphProbe(model)));
	const nativeFixture = await readFile("tests/fixtures/structured-types/recursive-rust-native.c", "utf8");
	assert.equal(isolated.nativeSourceSha256, sha256(`#include "recursive.h"\n${nativeFixture}\n${phpGraphNativeExtras(model)}\n${model.nativeReleaseSource}\n${phpGraphLayoutProbe(model).c}`));
	digest(isolated.nativeBinarySha256);
	const probe = await readFile("tests/fixtures/structured-types/recursive-php-conversions.php", "utf8");
	assert.equal(isolated.probeSha256, sha256(probe));
	assert.deepEqual(isolated.observations.map(item => item.mode), ["weak", "strict"]);
	for(const item of isolated.observations)
	{
		assert.equal(item.programSha256, sha256(probe.replace("strict_types=0", `strict_types=${item.mode === "strict" ? 1 : 0}`)));
		assert.deepEqual(item.observation, {
			actualPhpBits: 64, checkpoints: 180, checks: 7626
			, inputFailures: 32, layoutChecks: 478, live: 0, outputFailures: 148
			, phpVersion: item.observation.phpVersion, rejections: 227 });
	}
	const native = record.reports.native; assert.equal(native.compiledLean, true);
	assert.deepEqual(native.observations.map(item => item.reviewed), [false, true]);
	const ir = nativeRecursiveReviewedIr(); ir.declarations.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
	const compiled = generateCopiedPhpGraphConversions(ir), nativeProbe = await readFile("tests/fixtures/structured-types/recursive-php-lean.php", "utf8");
	for(const item of native.observations)
	{
		assert.equal(item.exports, 18); digest(item.modelSha256); digest(item.binarySha256); digest(item.nativeSourceSha256);
		assert.deepEqual(item.generatedSourceHashes, hashes(compiled.files));
		assert.deepEqual(item.instrumentedSourceHashes, hashes(instrumented(compiled.files)));
		assert.equal(item.callerSha256, sha256(phpLeanGraphProbe(compiled))); assert.equal(item.probeSha256, sha256(nativeProbe));
		assert.deepEqual(item.scenarios.map(scenario => `${scenario.callerMode}:${scenario.mode}`)
			, ["weak", "strict"].flatMap(caller => ["carrier", "raw", "cycle", "during"].map(mode => `${caller}:${mode}`)));
		for(const scenario of item.scenarios) assert.deepEqual(scenario, {
			actualPhpBits: 64, callerMode: scenario.callerMode
			, checks: ["carrier", "during"].includes(scenario.mode) ? 9749 : 9748
			, compiledLean: true, inputFailures: 30, layoutChecks: 455, live: 0
			, managedCheckpoints: 165, mode: scenario.mode, nativeCheckpoints: 28
			, outputFailures: 135, phpVersion: scenario.phpVersion
			, programSha256: sha256(nativeProbe.replace("strict_types=0", `strict_types=${scenario.callerMode === "strict" ? 1 : 0}`)) });
	}
};
