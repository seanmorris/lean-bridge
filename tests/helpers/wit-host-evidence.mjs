/**
 * Check real WIT isolation observations, fresh regressions and exact lineage.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { witHostLibraryHash } from "../../src/backends/wit/host-library-hash.mjs";
import { assertWitPackageReports } from "./wit-package-evidence.mjs";
import { witHostChangedPaths, reverseWitHostUpdate, reverseWitHostInventory } from "./wit-host-source-history.mjs";
import { beforeWitCompositionIntegration } from "./wit-composition-source-history.mjs";

export const witHostExecutionPath = "docs/evidence/wit-host-isolation-20260924.json";
export const witHostAddedPaths = [
	"src/backends/wit/host-evidence.mjs", "src/backends/wit/host-library-hash.mjs"
	, "tests/fixtures/recursive-consumers/wit-package-conflict.c"
	, "tests/helpers/wit-host-evidence.mjs"
	, "tests/helpers/wit-host-source-history.mjs"
	, "tests/wit-host-evidence.test.mjs"
	, "tests/wit-host-isolation-evidence.test.mjs"
	, "tests/wit-host-packages.test.mjs"
].sort();
const digest = value => sha256(canonicalJson(value));
const priorSource = async (path, expected) => beforeWitCompositionIntegration(path, await readFile(path, "utf8"), expected);
const passing = (log, passes, skipped = 0) => {
	assert.equal(sha256(log.text), log.sha256);
	assert.match(log.text, new RegExp(`# pass ${passes}\\n# fail 0\\n# cancelled 0\\n# skipped ${skipped}\\n`));
};

/**
 * Require rejection, compatible reuse and independent results in both scopes.
 *
 * @param report - Source-free compiled consumer observations and package receipts.
 */
export const assertWitHostIsolation = report => {
	assert.equal(report.schemaVersion, 1); assert.equal(report.kind, "installed-wit-host-isolation");
	assert.equal(report.sourceFree, true); assert.equal(report.results.length, 26);
	assert.equal(report.packages.length, 4);
	assert.deepEqual(report.packages.map(item => item.answer), [11, 21, 31, 11]);
	assert.deepEqual(report.packages[0], report.packages[3]);
	assert.equal(report.packages[0].component.library, report.packages[1].component.library);
	assert.notEqual(report.packages[0].component.nativeLibrary.sha256, report.packages[1].component.nativeLibrary.sha256);
	assert.notEqual(report.packages[0].component.library, report.packages[2].component.library);
	const dependencies = Object.keys(report.packages[0].receipt.files).filter(path => /^lib\/[^/]+\.so$/.test(path) && !path.endsWith("_wasmtime.so"));
	assert.equal(dependencies.length, 5);
	for(const visibility of ["local", "global"])
	{
		const runs = report.results.filter(item => item.visibility === visibility);
		assert.equal(runs.length, 13);
		for(const [first, second, rejected] of [[0, 1, true], [1, 0, true], [0, 3, false], [3, 0, false], [0, 2, false], [2, 0, false]])
		{
			const found = runs.filter(item => item.first === first && item.second === second); assert.equal(found.length, 1);
			assert.deepEqual(found[0].observation, { first: report.packages[first].answer
				, firstAfter: report.packages[first].answer
				, second: rejected ? 0xabcdef : report.packages[second].answer
				, secondRejected: rejected, inheritedHostRejected: true });
		}
		for(const [first, preloaded] of [[0, 1], [1, 0]])
		{
			const found = runs.filter(item => item.first === first && item.preloaded === preloaded); assert.equal(found.length, 1);
			assert.deepEqual(found[0].observation, { firstRejected: true });
		}
		for(const path of dependencies)
		{
			const found = runs.filter(item => item.tamperedDependency === path); assert.equal(found.length, 1);
			assert.deepEqual(found[0].observation, { firstRejected: true });
		}
	}
	for(const pkg of report.packages)
	{
		assert.equal(pkg.receipt.runtimeIdentity, report.packages[0].receipt.runtimeIdentity);
		assert.deepEqual(pkg.receipt.files[`lib/${pkg.component.library}`], pkg.component.nativeLibrary);
		for(const path of ["src/" + pkg.name + "_wasmtime.c", "lib/lib" + pkg.name + "_wasmtime.so"])
			assert.match(pkg.receipt.files[path].sha256, /^[a-f0-9]{64}$/);
	}
};

/**
 * Keep the reproduced original failure and independently rerun all WIT families.
 *
 * @param record - Captured reports, original logs and measured source identities.
 */
export const assertWitHostExecution = async record => {
	assert.equal(record.schemaVersion, 1); assert.equal(record.planNode, 1219);
	assert.equal(record.kind, "wit-host-isolation-execution"); assert.equal(record.finalAcceptance, false);
	assert.deepEqual(Object.keys(record.reports).sort(), ["callables", "collections", "hash", "isolation", "recursive", "reproduction"]);
	for(const [name, report] of Object.entries(record.reports))
	{
		assert.equal(digest(report), record.reportHashes[name]);
		passing(record.logs[name], name === "hash" || name === "recursive" ? 3 : 1, name === "recursive" ? 1 : 0);
	}
	assertWitHostIsolation(record.reports.isolation);
	assert.equal(record.reports.isolation.consumerSha256, sha256(await readFile("tests/fixtures/recursive-consumers/wit-package-conflict.c")));
	const { originalFailure: before, reports } = record;
	assert.equal(before.report.consumerSha256, sha256(before.consumerSource));
	assert.deepEqual(before.report.results.map(item => item.observation), [
		{ value: 11 }, { value: 21 }
		, { first: 11, secondRejected: false, second: 11, firstAfter: 11 }
		, { first: 21, secondRejected: false, second: 21, firstAfter: 21 }
	]);
	for(const index of [0, 1]) assert.deepEqual(before.report.packages[index].component, reports.isolation.packages[index].component);
	assert.equal(reports.hash.synthetic, true); assert.equal(reports.hash.checks, 71);
	assert.deepEqual(reports.hash.sanitizers, ["address", "undefined", "leak"]);
	assert.equal(reports.hash.hashSourceSha256, sha256(witHostLibraryHash));
	assert.ok(reports.hash.compilerOptions.includes("-fsanitize=address,undefined"));
	const original = JSON.parse(await readFile("docs/evidence/wit-recursive-packages-20260924.json", "utf8"));
	const recursive = { ...original, reports: { ...original.reports, installed: reports.recursive, reproduction: reports.reproduction }
		, logs: { ...original.logs, installed: record.logs.recursive, reproduction: record.logs.reproduction } };
	recursive.reportHashes = Object.fromEntries(Object.entries(recursive.reports).map(([name, value]) => [name, digest(value)]));
	assertWitPackageReports(recursive);
	const baseline = JSON.parse(await readFile("docs/evidence/wit-recursive-package-regressions-20260924.json", "utf8"));
	for(const family of ["collections", "callables"])
	{
		assert.deepEqual(reports[family].reports.map(item => item.path), ["ordinary-source", "reviewed-ir"]);
		for(const [index, run] of reports[family].reports.entries())
		{
			const prior = baseline.wit[family].report.reports[index];
			assert.deepEqual(run.signatures, prior.signatures);
			assert.equal(run.sourceRemovedBeforeInstallation, true);
			if(family === "callables")
			{
				assert.equal(run.compilerFreePath, true); assert.equal(run.offlineInstall, true);
				assert.equal(run.checks, prior.checks); assert.equal(run.consumerSha256, prior.consumerSha256);
			}
			else
			{
				const values = value => { const copy = { ...value }; delete copy.loadedLibraries; return copy; };
				assert.deepEqual(values(run.observation), values(prior.observation));
				for(const flag of ["compilerFreeExecution", "installedSourcesRemoved", "publicHeadersOnly", "offline", "localLibraries"]) assert.equal(run.wit[flag], true);
				assert.equal(run.handoffRemovedBeforeExecution, true); assert.equal(run.wit.repeatExecutions, 2);
				for(const path of ["include/collections_wasmtime.h", "wit/collections.wit", "component/collections.wat", "component/collections.wasm"])
					assert.deepEqual(run.wit.packageReceipt.files[path], prior.wit.packageReceipt.files[path]);
				for(const path of ["src/collections_wasmtime.c", "lib/libcollections_wasmtime.so"])
					assert.notEqual(run.wit.packageReceipt.files[path].sha256, prior.wit.packageReceipt.files[path].sha256);
			}
		}
	}
};

/**
 * Bind current source, fresh installed evidence and complete predecessor files.
 *
 * @param record - Exact additive integration record.
 */
export const assertWitHostIntegration = async record => {
	assert.equal(record.schemaVersion, 1); assert.equal(record.planNode, 1219);
	assert.equal(record.kind, "wit-host-isolation-integration"); assert.equal(record.finalAcceptance, false);
	assert.equal(record.baselineRevision, "6f8a3690dccb2cf954618e2be4f37df315fa5da7");
	assert.equal(record.execution.path, witHostExecutionPath);
	const bytes = await readFile(record.execution.path); assert.equal(sha256(bytes), record.execution.sha256);
	const execution = JSON.parse(bytes); await assertWitHostExecution(execution);
	assert.equal(record.previous.path, "docs/evidence/wit-recursive-package-integration-20260924.json");
	const previousBytes = await readFile(record.previous.path); assert.equal(sha256(previousBytes), record.previous.sha256);
	const previous = JSON.parse(previousBytes);
	assert.deepEqual(Object.keys(record.sourceHashes).sort(), [...new Set([...Object.keys(previous.sourceHashes), ...witHostChangedPaths, ...witHostAddedPaths])].sort());
	assert.deepEqual(execution.sourceHashes, record.sourceHashes);
	assert.deepEqual(record.updates.map(item => item.path).sort(), witHostChangedPaths.filter(path => path !== record.inventory.path));
	assert.deepEqual(Object.keys(record.additions).sort(), witHostAddedPaths);
	for(const [path, expected] of Object.entries(record.sourceHashes)) assert.equal(sha256(await priorSource(path, expected)), expected, path);
	for(const [path, expected] of Object.entries(record.additions)) assert.equal(expected, record.sourceHashes[path]);
	for(const update of record.updates)
	{
		assert.equal(update.previousSha256, previous.sourceHashes[update.path], update.path);
		reverseWitHostUpdate(await priorSource(update.path, update.currentSha256), update);
	}
	assert.equal(record.inventory.previousSha256, previous.inventory.currentSha256);
	const inventory = await priorSource(record.inventory.path, record.inventory.currentSha256); reverseWitHostInventory(inventory, record.inventory);
	for(const entry of record.inventory.entries)
	{
		const update = record.updates.find(update => update.path === entry.path); assert.ok(update);
		assert.equal(entry.previousSha256, update.previousSha256); assert.equal(entry.currentSha256, update.currentSha256);
	}
	for(const [path, expected] of Object.entries(execution.sourceHashes)) assert.equal(sha256(await priorSource(path, expected)), expected, path);
};
