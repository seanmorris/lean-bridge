/**
 * Bind ordinary PHP-Wasm Fin observations to their original packages and complete fixtures.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { phpWasmFinCaller, phpWasmFinFixtures } from "./php-wasm-fin-fixtures.mjs";
import { assertPhpWasmFinObservation as validateReport } from "./php-wasm-fin-observation.mjs";

const directory = "docs/evidence/php-wasm-fin-20261008";
const reportDigest = "67dafe06c7c826269c3fb678117b9bf14da12b261f5c9484e695cfe1a1f87046";
const logDigest = "b91f61f8e39c4507fcfeb3aebd651af0bf64c4bfe01c79e0fc4cbd062fe5e20e";

const counts = { products: 2039, records: 2053 };

test("PHP-Wasm Fin archive authenticates both complete fixtures and every installed route", async () => {
	const receipt = JSON.parse(await readFile(`${directory}/receipt.json`, "utf8"));
	assert.equal(receipt.revision, "c391e58a1fcfa9a3c137f1ca4b4fb8a49fc77dda");
	assert.equal(receipt.execution, "local");
	assert.equal(receipt.scope.sourcePath, "ordinary-source");
	assert.equal(receipt.scope.dispatch, "not measured");
	assert.equal(receipt.scope.reviewedContracts, false);
	assert.equal(receipt.scope.subtype, false);
	assert.deepEqual(receipt.scope.fixtures, [
		{ name: "products", exports: 11, executions: 12, checksPerExecution: 2039 }
		, { name: "records", exports: 13, executions: 12, checksPerExecution: 2053 }
	]);
	assert.equal(receipt.report.sha256, reportDigest); assert.equal(receipt.log.sha256, logDigest);
	assert.equal(receipt.sourceFiles.length, 8);
	for(const source of receipt.sourceFiles)
		assert.equal(sha256(beforeFinRefinementSource(source.path, await readFile(source.path), source.sha256)), source.sha256, source.path);
	const bytes = await readFile(receipt.report.path);
	assert.equal(sha256(bytes), reportDigest);
	const archive = JSON.parse(bytes);
	assert.equal(archive.schemaVersion, 1);
	assert.deepEqual(archive.reports.map(report => report.fixture), ["products", "records"]);
	for(const report of archive.reports)
	{
		const fixture = phpWasmFinFixtures[report.fixture];
		const expectedCaller = receipt.sourceFiles.find(item => item.path === fixture.consumer).sha256;
		const caller = beforeFinRefinementSource(fixture.consumer, await readFile(fixture.consumer, "utf8"), expectedCaller), { request } = await phpWasmFinCaller(fixture);
		assert.equal(sha256(caller), expectedCaller, fixture.consumer);
		assert.deepEqual(report.phpWasm.runtime.pins, receipt.producerEnvironment.pins);
		assert.equal(report.phpWasm.nodeVersion, receipt.producerEnvironment.nodeVersion);
		assert.equal(report.phpWasm.browserVersion, receipt.producerEnvironment.browserVersion);
		validateReport(report, fixture, caller, request, counts[report.fixture]);
		const module = report.phpWasm.component.sourceIdentity.modules.find(item => item.module === fixture.module);
		const expected = receipt.sourceFiles.find(item => item.path === `${fixture.root}/${fixture.module}.lean`);
		assert.equal(module.source.sha256, expected.sha256);
	}
	const log = await readFile(receipt.log.path, "utf8");
	assert.equal(sha256(log), logDigest);
	for(const [key, count] of Object.entries({ tests: 9, pass: 9, fail: 0, skipped: 0 }))
		assert.match(log, new RegExp(`^# ${key} ${count}$`, "mu"));
	assert.match(log, /^exit=0$/mu); assert.doesNotMatch(log, /^not ok /mu);
	const queue = await readFile(receipt.queue.path, "utf8");
	assert.equal(sha256(queue), receipt.queue.sha256);
	assert.match(queue, /php-wasm-fin exit=0 # pass 9 # fail 0 # skipped 0/u);
});

test("PHP-Wasm Fin archive rejects missing cases, altered constraints and unobserved claims", async () => {
	const archive = JSON.parse(await readFile(`${directory}/ordinary.json`, "utf8"));
	const receipt = JSON.parse(await readFile(`${directory}/receipt.json`, "utf8"));
	for(const original of archive.reports)
	{
		const fixture = phpWasmFinFixtures[original.fixture];
		const expectedCaller = receipt.sourceFiles.find(item => item.path === fixture.consumer).sha256;
		const caller = beforeFinRefinementSource(fixture.consumer, await readFile(fixture.consumer, "utf8"), expectedCaller), { request } = await phpWasmFinCaller(fixture);
		assert.equal(sha256(caller), expectedCaller, fixture.consumer);
		validateReport(original, fixture, caller, request, counts[original.fixture]);
		const mutations = [
			report => { report.phpWasm.executions.pop(); }
			, report => { report.phpWasm.executions[0].observation.checks = 0; }
			, report => { report.phpWasm.executions[0].observation.word_bits = 64; }
			, report => { report.phpWasm.executions[0].phases[0].libraries = []; }
			, report => { report.phpWasm.executions[8].requests = []; }
			, report => { report.dispatch = "measured"; }
			, report => { report.path = "reviewed-ir"; }
			, report => { report.reproducible = false; }
			, report => { report.phpWasm.offlineInstall = false; }
			, report => { report.sourceRemovedBeforeInstallation = false; }
			, report => { report.phpWasm.component.wasmLibrary.sha256 = "0".repeat(64); }
			, report => { report.phpWasm.consumerSources.strict = report.phpWasm.consumerSources.weak; }
			, report => { report.phpWasm.component.exports.pop(); }
			, report => { delete report.refinements[Object.keys(report.refinements)[0]]; }
		];
		for(const mutate of mutations)
		{
			const changed = structuredClone(original); mutate(changed);
			assert.throws(() => validateReport(changed, fixture, caller, request, counts[original.fixture]));
		}
	}
});

test("the successful PHP-safe Fin fixture does not rewrite its failed predecessor", async () => {
	const receipt = JSON.parse(await readFile(`${directory}/receipt.json`, "utf8"));
	const previous = JSON.parse(await readFile(receipt.previousFailedAttempt.receipt, "utf8"));
	assert.equal(previous.failedFinAttempt.reportProduced, false);
	assert.equal(previous.failedFinAttempt.log.sha256, receipt.previousFailedAttempt.logSha256);
	const log = await readFile(previous.failedFinAttempt.log.path);
	assert.equal(sha256(log), receipt.previousFailedAttempt.logSha256);
	assert.match(log.toString("utf8"), /PHP function name is reserved or duplicated: never/u);
	const archive = JSON.parse(await readFile(`${directory}/ordinary.json`, "utf8"));
	const products = archive.reports.find(report => report.fixture === "products");
	assert.ok(products.refinements["FinProducts.absentOnly"]);
	assert.equal(products.refinements["FinProducts.never"], undefined);
	assert.match(JSON.stringify(products.refinements["FinProducts.absentOnly"]), /"bound":"0"/u);
});
