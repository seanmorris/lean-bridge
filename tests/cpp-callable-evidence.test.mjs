/**
 * Bind C++ callable promotion to independent, source-hidden installed runs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { cppCallableSignatures } from "./helpers/cpp-callable-fixture.mjs";

test("C++ callable evidence retains both source paths, compile failures and source-free execution", async () => {
	const record = JSON.parse(await readFile("docs/evidence/cpp-callables-20260919.json", "utf8"));
	for(const file of record.sources) assert.equal(file.sha256, sha256(await readFile(file.path)));
	assert.equal(record.consumerSha256, sha256(await readFile("tests/fixtures/callable-consumers/cpp.cpp")));
	const sort = values => [...values].sort((a, b) => a.name.localeCompare(b.name));
	assert.deepEqual(sort(record.signatures), sort(cppCallableSignatures));
	assert.deepEqual(record.executions.map(run => run.path), ["ordinary-source", "reviewed-ir"]);
	for(const run of record.executions)
	{
		assert.equal(run.profile, "cpp"); assert.ok(run.checks > 23_000);
		assert.equal(run.consumerSha256, record.consumerSha256);
		assert.equal(run.offlineInstall, true); assert.equal(run.compilerFreePath, true);
		assert.equal(run.sourceRemovedBeforeInstallation, true);
		assert.equal(run.safety.sourceFreeChecks, run.checks);
		assert.equal(run.glibcMinimumVersion, record.packageGlibcFloor);
		assert.equal(run.safety.boost.version, "1.90.0"); assert.equal(run.safety.boostFiles, 199);
		assert.deepEqual(run.safety.rejected.map(entry => entry.name), ["argument", "result", "callback-argument", "borrowed-result", "closure-argument", "copy", "unit-result"]);
		assert.ok(run.safety.rejected.every(entry => entry.diagnostics > 0 && /^[a-f0-9]{64}$/.test(entry.sourceSha256)));
		for(const field of ["bindingIrSha256", "sourceTreeSha256", "modelSha256", "receiptSha256"]) assert.match(run[field], /^[a-f0-9]{64}$/);
		assert.equal(run.packages.length, 1);
		assert.equal(run.packages[0].target, "cpp");
		for(const archive of run.packages[0].artifacts) assert.match(archive.sha256, /^[a-f0-9]{64}$/);
	}
	assert.equal(record.packageGlibcFloor, "2.38");
	assert.deepEqual(record.corpora.map(report => report.runs.map(run => run.path)), [["ordinary-source", "ordinary-source"], ["reviewed-ir", "reviewed-ir"]]);
	for(const report of record.corpora)
	{
		assert.match(report.sha256, /^[a-f0-9]{64}$/);
		assert.equal(report.summary.executedCases, 96);
		assert.equal(report.summary.compileRejectedCases, 28);
		for(const run of report.runs)
		{
			assert.deepEqual(run.counts, { matched: 46, "rejected-as-expected": 2, "rejected-at-compile-time": 14 });
			assert.equal(run.offline, true); assert.equal(run.installedSourcesRemoved, true);
			assert.deepEqual(run.integrationExecutions, { "pkg-config": 2, cmake: 2 });
			assert.match(run.archive.sha256, /^[a-f0-9]{64}$/);
		}
	}
	assert.deepEqual(record.regressions.map(suite => suite.passed), [4, 3]);
});
