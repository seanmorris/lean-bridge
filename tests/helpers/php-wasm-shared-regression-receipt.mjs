/**
 * Bind wasm32/graph source transitions to native artifact comparisons and fresh
 * installed acyclic PHP-Wasm executions without rewriting historical hashes.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { generateNativeCopiedGraphAdapters } from "../../src/backends/c/native-graph-adapters.mjs";
import { recursiveCarrierAbi } from "./recursive-carriers.mjs";
import { recursiveReviewedIr } from "./recursive-fixture.mjs";
import { nativeRecursiveReviewedIr } from "./native-recursive-reviewed.mjs";
import { beforeJvmSharedVerification } from "./jvm-shared-verifier-updates.mjs";
import { beforeCStructuredCallables } from "./c-structured-callable-source-history.mjs";
import { phpLinkedGraphIr } from "./php-graph-values-fixture.mjs";
import { assertPhpWasmLegacyPackageComparison, phpWasmPreGraphRecords, phpWasmPreGraphSources, phpWasmSharedRegressionSources } from "./php-wasm-legacy-comparison.mjs";

const evidencePath = "docs/evidence/php-wasm-shared-regressions-20260924.json";
const productionPaths = [
	"src/backends/c/copied-graph-layout.mjs"
	, "src/backends/c/native-graph-adapters.mjs"
	, "src/backends/php/php-wasm-copied-host.mjs"
	, "src/build/php-wasm-copied-artifacts.mjs"
	, "src/build/php-wasm-copied-component.mjs"
	, "src/release/php-wasm-copied-package.mjs"
];
const changes = {
	"tests/helpers/test-registration-history.mjs": [
		['import { assertPhpWasmSharedSourceTransition } from "./php-wasm-shared-regression-receipt.mjs";\n', ""]
		, ['\tif(await assertPhpWasmSharedSourceTransition(path, source, expected)) return;\n', ""]
	]
	, "tests/helpers/native-dotnet-graph-regression.mjs": [
		['import { beforePhpWasmSharedVerification } from "./php-wasm-shared-regression-receipt.mjs";\n', ""]
		, ['\tsource = beforePhpWasmSharedVerification(path, source);\n', ""]
	]
	, "tests/helpers/wasm32-graph-receipt.mjs": [
		['import { assertAdministrativeSourceUpdate } from "./test-registration-history.mjs";\n', ""]
		, ['for(const [path, hash] of Object.entries(record.sources)) await assertAdministrativeSourceUpdate(path, hash);', 'for(const [path, hash] of Object.entries(record.sources)) assert.equal(sha256(await readFile(path)), hash, path);']
	]
	, "tests/php-wasm-ordinary.test.mjs": [
		['import { comparePhpWasmPreGraphArtifacts } from "./helpers/php-wasm-legacy-comparison.mjs";\n', ""]
		, ['\tconst legacyComparison = await comparePhpWasmPreGraphArtifacts({ working, components, runtimeRoot: relocatedRuntime, releases, leanPrefix });\n', ""]
		, ['\tawait saveLakeFile("build/recursive", "php-wasm-shared-regressions.json", canonicalJson(legacyComparison));\n', ""]
	]
};

/**
 * Undo only recorded test-verifier insertions. Production code is untouched.
 *
 * @param path - One of the four upgraded verifier/test files.
 * @param source - Complete current or predecessor source.
 */
export const beforePhpWasmSharedVerification = (path, source) => {
	source = beforeJvmSharedVerification(path, source);
	const edits = changes[path];
	if(!edits || edits.every(([current]) => !source.includes(current))) return source;
	for(const [current, previous] of edits)
	{
		assert.equal(source.split(current).length, 2, "Exactly one PHP-Wasm regression verification edit");
		source = source.replace(current, previous);
	}
	return source;
};

/**
 * Recheck source snapshots, every package difference and complete execution.
 *
 * @param record - New evidence; original package/transport receipts stay frozen.
 */
export const assertPhpWasmSharedRegressionEvidence = async record => {
	assert.equal(record.schemaVersion, 1); assert.equal(record.planNode, 1219);
	assert.equal(record.kind, "php-wasm-shared-regressions");
	assert.equal(record.finalAcceptance, false);
	assert.deepEqual(Object.keys(record.verifierPredecessors).sort(), Object.keys(changes).sort());
	for(const [path, previous] of Object.entries(record.verifierPredecessors))
		assert.equal(sha256(beforePhpWasmSharedVerification(path, await readFile(path, "utf8"))), previous, path);
	assert.deepEqual(Object.keys(record.verifierSources).sort(), [
		...Object.keys(changes)
		, "tests/helpers/php-wasm-shared-regression-receipt.mjs"
		, "tests/php-wasm-shared-regressions.test.mjs"
	].sort());
	for(const [path, hash] of Object.entries(record.verifierSources)) assert.equal(sha256(beforeJvmSharedVerification(path, await readFile(path, "utf8"))), hash, path);
	const { sources, nativeBaseline } = await phpWasmPreGraphSources();
	assert.deepEqual(Object.keys(sources).sort(), productionPaths);
	const report = record.report;
	assert.equal(record.reportSha256, sha256(canonicalJson(report)));
	assert.equal(report.schemaVersion, 1); assert.equal(report.kind, "php-wasm-pre-graph-comparison");
	assert.equal(report.compiledLean, true); assert.deepEqual(report.baselines, phpWasmPreGraphRecords);
	assert.deepEqual(Object.keys(report.sourceHashes).sort(), phpWasmSharedRegressionSources);
	for(const [path, hash] of Object.entries(report.sourceHashes))
		assert.equal(sha256(beforeCStructuredCallables(path, await readFile(path, "utf8"), hash)), hash, path);
	assert.deepEqual(report.native, nativeBaseline);
	const fixtures = { recursiveReviewedIr, nativeRecursiveReviewedIr, phpLinkedGraphIr };
	for(const item of report.native)
	{
		const ir = fixtures[item.fixture](), abi = recursiveCarrierAbi(ir);
		for(const output of item.outputs)
			assert.equal(sha256(canonicalJson(generateNativeCopiedGraphAdapters(ir, abi, output.options))), output.sha256);
	}
	assert.deepEqual(report.packages.map(run => run.name), ["Willow", "Aspen"]);
	const packagePath = "src/release/php-wasm-copied-package.mjs";
	const packagingSource = beforeCStructuredCallables(packagePath, await readFile(packagePath, "utf8"), report.sourceHashes[packagePath]);
	assert.equal(sha256(packagingSource), report.sourceHashes[packagePath]);
	for(const run of report.packages) await assertPhpWasmLegacyPackageComparison(run, sources, { packagingSource });
	assert.equal(sha256(record.executionLog.text), record.executionLog.sha256);
	assert.match(record.executionLog.text, /ok \d+ - ordinary Lean copied APIs execute after relocation in one 32-bit PHP-Wasm host\n/);
	assert.match(record.executionLog.text, /# tests 5\n# suites 0\n# pass 5\n# fail 0\n# cancelled 0\n# skipped 0/);
	for(const loading of ["startup", "lazy"]) for(const mode of ["weak", "strict"])
		assert.match(record.executionLog.text, new RegExp(`Chromium [^\\n]+ ${loading}/${mode}: 88 exports, 20 requests, one runtime and two extensions fetched once`));
	for(const failure of ["disabled", "unregistered", "missing-component", "missing-runtime"])
		assert.ok(record.executionLog.text.includes(`PHP-Wasm ${failure}: explicit errors, no repeated loads, previous error handler restored`));
	return { record, sources };
};

/**
 * Admit only the six measured source transitions or exact verifier insertions.
 * A later production change requires new evidence, not a changed original hash.
 *
 * @param path - A historical receipt's source path.
 * @param source - Complete current implementation.
 * @param expected - The unchanged original digest.
 */
export const assertPhpWasmSharedSourceTransition = async (path, source, expected) => {
	if(Object.hasOwn(changes, path))
	{
		const previous = beforePhpWasmSharedVerification(path, source);
		if(previous !== source && sha256(previous) === expected) return true;
	}
	if(!productionPaths.includes(path)) return false;
	const { sources } = await phpWasmPreGraphSources();
	if(sources[path].sha256 !== expected) return false;
	const record = JSON.parse(await readFile(evidencePath));
	await assertPhpWasmSharedRegressionEvidence(record);
	assert.equal(sha256(beforeCStructuredCallables(path, source, record.report.sourceHashes[path])), record.report.sourceHashes[path], path);
	return true;
};
