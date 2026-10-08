/**
 * Authenticate the original independently reviewed PHP-Wasm Fin producer.
 *
 * @file
 */
import assert from "node:assert/strict";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { assertPhpWasmFinObservation } from "./php-wasm-fin-observation.mjs";
import { phpWasmExecutionTuples, phpWasmFinCaller, phpWasmFinFixtures } from "./php-wasm-fin-fixtures.mjs";

export const reviewedPhpWasmFinDirectory = "docs/evidence/reviewed-php-wasm-fin-20261008";
export const reviewedPhpWasmFinRevision = "8d395a3e49e189b174d9b8359c3247f77215b663";
export const reviewedPhpWasmFinFiles = Object.freeze({
	"reviewed.json": { original: "build/vo1220-php-wasm-reviewed-fin-8d395a3.json", sha256: "4620eececc51da0dd6a639598b058d789bb3e860f65813779d5de27e22af947f" }
	, "original.tap": { original: "build/vo1220-php-wasm-reviewed-fin-8d395a3.tap", sha256: "17b73e0afa2e2cc704b2c55327dad4c9c55ab4af4fc3fe361b6e840d860cd301" }
	, "original.queue": { original: "build/vo1220-php-wasm-reviewed-fin-8d395a3.queue", sha256: "281a1ee775bfe93fb81996f94ca6843da591ab4e4b8b73543aceefc56094c643" }
});
export const reviewedPhpWasmFinHarness = Object.freeze({
	path: "tests/php-wasm-fin.test.mjs"
	, archivePath: `${reviewedPhpWasmFinDirectory}/producer-test.mjs.txt`
	, sha256: "7b1f8ce82f4d7c11837138bff30c6d0147d75a2e4a9a33f4768293b983b86cb8"
});
export const reviewedPhpWasmFinSourcePaths = [
	reviewedPhpWasmFinHarness.path
	, "tests/helpers/php-wasm-fin-fixtures.mjs"
	, "tests/helpers/fin-product-install.mjs"
	, "tests/helpers/fin-record-install.mjs"
	, "tests/fixtures/onboarding/native-fin-products/FinProducts.lean"
	, "tests/fixtures/onboarding/native-fin-records/FinRecords.lean"
	, "tests/fixtures/fin-product-consumers/php-native.php"
	, "tests/fixtures/fin-record-consumers/php-native.php"
	, "tests/helpers/reviewed-fin-product-fixture.mjs"
	, "tests/helpers/reviewed-fin-record-fixture.mjs"
	, "tests/helpers/type-corpus-php-wasm-install.mjs"
	, "tests/helpers/type-corpus-php-wasm-evidence.mjs"
	, "tests/helpers/copied-fixture-install.mjs"
	, "src/analyze/NativeExports.lean"
	, "src/analyze/reviewed-source.mjs"
	, "src/analyze/reviewed-refinements.mjs"
	, "src/build/native-model.mjs"
	, "src/build/component-refinements.mjs"
	, "src/build/php-wasm-copied-component.mjs"
	, "src/backends/php/copied-values.mjs"
];
export const reviewedPhpWasmFinChecks = Object.freeze({ products: 2039, records: 2053 });

/**
 * Retain exact package and compiler identities after authenticating the original report bytes.
 *
 * @param report - One original installed fixture report.
 */
export const reviewedPhpWasmFinIdentities = report => ({
	fixture: report.fixture
	, bindingIrSha256: report.bindingIrSha256
	, modelSha256: report.modelSha256
	, receiptSha256: report.receiptSha256
	, reviewedBindingIrSha256: report.reviewedBindingIrSha256
	, componentSourceIdentitySha256: sha256(canonicalJson(report.phpWasm.component.sourceIdentity))
	, archives: report.archives
});

/**
 * Bind each original installed arrangement to the independent contracts, consumers and source.
 *
 * @param archive - Authenticated original two-fixture report.
 * @param receipt - Authenticated archival receipt.
 * @param readSource - Read the exact authenticated producer source for a repository-relative path.
 */
export const assertReviewedPhpWasmFinReport = async (archive, receipt, readSource) => {
	assert.deepEqual(Object.keys(archive).sort(), ["reports", "schemaVersion"]);
	assert.equal(archive.schemaVersion, 1);
	assert.deepEqual(archive.reports.map(report => report.fixture), ["products", "records"]);
	assert.deepEqual(archive.reports.map(reviewedPhpWasmFinIdentities), receipt.identities);
	for(const report of archive.reports)
	{
		const fixture = phpWasmFinFixtures[report.fixture], caller = await readSource(fixture.consumer);
		const { request } = await phpWasmFinCaller(fixture);
		assertPhpWasmFinObservation(report, fixture, caller, request, reviewedPhpWasmFinChecks[report.fixture], true);
		const evidence = report.phpWasm, source = evidence.component.sourceIdentity;
		assert.equal(evidence.nodeVersion, receipt.producerEnvironment.nodeVersion);
		assert.equal(evidence.browserVersion, receipt.producerEnvironment.browserVersion);
		assert.deepEqual(evidence.runtime.pins, receipt.producerEnvironment.pins);
		assert.equal(source.extractorSha256, sha256(await readSource("src/analyze/NativeExports.lean")));
		const module = source.modules.find(item => item.module === fixture.module);
		assert.equal(module.source.sha256, sha256(await readSource(`${fixture.root}/${fixture.module}.lean`)));
		assert.equal(source.leanCommit, receipt.producerEnvironment.pins.leanCommit);
	}
};

/**
 * Validate the two selected tests, two builds per fixture and every reported execution diagnostic.
 * Recorded absolute producer paths are provenance strings; this validator never opens them.
 *
 * @param tap - Original terminal test output.
 * @param queue - Original producer environment and exit record.
 */
export const assertReviewedPhpWasmFinExecution = (tap, queue) => {
	assert.deepEqual([...tap.matchAll(/^ok \d+ - (.+)$/gmu)].map(match => match[1]), [
		"independent Fin reviews reconcile with fresh Lean in the wasm32 model, and a changed bound is refused"
		, "independently reviewed PHP-Wasm packages check Fin before Lean in Node and browser hosts (dispatch not measured)"
	]);
	assert.doesNotMatch(tap, /^not ok /mu);
	for(const [key, count] of Object.entries({ tests: 2, pass: 2, fail: 0, cancelled: 0, skipped: 0, todo: 0 }))
		assert.deepEqual([...tap.matchAll(new RegExp(`^# ${key} (.+)$`, "gmu"))].map(match => match[1]), [String(count)]);
	assert.deepEqual([...tap.matchAll(/^exit=(.+)$/gmu)].map(match => match[1]), ["0"]);
	for(const fixture of ["products", "records"])
	{
		assert.deepEqual([...tap.matchAll(new RegExp(`^# reviewed-fin-${fixture} build (.+): wasm32$`, "gmu"))].map(match => match[1]), ["0", "1"]);
		const executions = [...tap.matchAll(new RegExp(`^# reviewed-fin-${fixture}: PHP-Wasm (Node|Chromium) (.+)$`, "gmu"))]
			.map(match => `${match[1].toLowerCase()}/${match[2]}`).sort();
		assert.deepEqual(executions, phpWasmExecutionTuples);
	}
	assert.match(queue, new RegExp(`^revision=${reviewedPhpWasmFinRevision}$`, "mu"));
	assert.match(queue, /^start=2026-10-08T01:58:30Z free=4885MiB node=v22\.23\.3 cpu=3 concurrency=1$/mu);
	assert.match(queue, /^LEAN_BRIDGE_PHP_WASM_REVIEWED_FIN_LEAN_TEST=1$/mu);
	assert.match(queue, /^LEAN_BRIDGE_PHP_WASM_REVIEWED_FIN_TEST=1$/mu);
	assert.match(queue, /^end=2026-10-08T02:14:07Z exit=0 # pass 2 # fail 0 # skipped 0[ \t]*$/mu);
};
