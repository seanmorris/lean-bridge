/**
 * Validate installed cross-package WIT observations and their source lineage.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { assertWitHostExecution } from "./wit-host-evidence.mjs";
import { reverseWitCompositionUpdate, witCompositionChangedPaths } from "./wit-composition-source-history.mjs";

export const witCompositionExecutionPath = "docs/evidence/wit-recursive-composition-20260924.json";
export const witCompositionAddedPaths = [
	"tests/fixtures/documentation/consumers/wit-wasi/recursive.c"
	, "tests/fixtures/recursive-consumers/wit-composition.c"
	, "tests/fixtures/recursive-consumers/wit-mixed-host.c"
	, "tests/fixtures/recursive-consumers/wit-mixed-native.c"
	, "tests/helpers/wit-composition-evidence.mjs"
	, "tests/helpers/wit-composition-source-history.mjs"
	, "tests/helpers/wit-graph-composition.mjs"
	, "tests/helpers/wit-mixed-packages.mjs"
	, "tests/wit-composition-evidence.test.mjs"
	, "tests/wit-graph-composition.test.mjs"
].sort();
const digest = value => sha256(canonicalJson(value));
const hash = value => assert.match(value, /^[a-f0-9]{64}$/);
const passing = (log, passes, skips = 0) => {
	assert.equal(sha256(log.text), log.sha256);
	assert.match(log.text, new RegExp(`# pass ${passes}\\n# fail 0\\n# cancelled 0\\n# skipped ${skips}\\n`));
};

/**
 * Require both source paths, library scopes, call orders and failure modes.
 *
 * @param report - Installed composition observations.
 * @param rejected - False only for the captured original fork failure.
 */
export const assertWitComposition = (report, rejected = true) => {
	assert.equal(report.schemaVersion, 1);
	assert.deepEqual(report.observations.map(run => run.reviewed), [false, true]);
	for(const run of report.observations)
	{
		assert.equal(run.sourceFree, true); assert.equal(run.relocated, true);
		hash(run.consumerSha256); hash(run.executableSha256); hash(run.faultSourceSha256);
		if(rejected) hash(run.faultLibrarySha256);
		assert.equal(run.documentation.stdout, "next(leaf(71))\n");
		hash(run.documentation.sourceSha256); hash(run.documentation.executableSha256);
		assert.deepEqual(run.packages.map(pkg => pkg.name), ["recursive", "peer"]);
		assert.equal(run.packages[0].pkg.runtimeIdentity, run.packages[1].pkg.runtimeIdentity);
		for(const pkg of run.packages)
		{
			hash(pkg.sourceSha256); hash(pkg.pkg.artifacts[0].sha256);
			assert.equal(pkg.pkg.target, "wit-wasi");
			assert.equal(pkg.receipt.runtimeIdentity, pkg.pkg.runtimeIdentity);
			assert.equal(pkg.receipt.kind, "lean-bridge-ordinary-wit-package");
			assert.deepEqual(pkg.libraries, Object.fromEntries(Object.entries(pkg.receipt.files).filter(([path]) => /^lib\/[^/]+\.so(?:\.\d+)*$/.test(path))));
			assert.equal(Object.keys(pkg.libraries).length, 6);
		}
		assert.equal(run.scenarios.length, 16);
		for(const visibility of ["local", "global"]) for(const order of ["recursive-first", "peer-first"]) for(const mode of ["normal", "limit", "malformed", "unopened-peer-fork"])
		{
			const found = run.scenarios.filter(item => item.visibility === visibility && item.order === order && item.mode === mode);
			assert.equal(found.length, 1);
			assert.deepEqual(found[0].observation, mode === "unopened-peer-fork"
				? { unopenedPeerRejected: rejected, childStatus: rejected ? 0 : 14 }
				: { sharedRuntime: true, independentResult: true, cleanupAfterBothClosed: true, mode });
		}
	}
};

/**
 * Check one component's independently compiled public C and WIT callers.
 *
 * @param report - Original mixed release receipts and relocated executions.
 */
export const assertWitMixedPackages = report => {
	assert.equal(report.schemaVersion, 1);
	assert.deepEqual(report.observations.map(run => run.reviewed), [false, true]);
	for(const run of report.observations)
	{
		assert.equal(run.sourceFree, true); assert.equal(run.relocated, true);
		hash(run.sourceSha256); hash(run.executableSha256);
		assert.deepEqual(Object.keys(run.sources).sort(), ["host", "native"]);
		for(const value of Object.values(run.sources)) hash(value);
		assert.deepEqual(run.packages.map(pkg => pkg.package.target).sort(), ["c", "wit-wasi"]);
		const [first, second] = run.packages;
		assert.equal(first.manifest.bindingIrSha256, second.manifest.bindingIrSha256);
		assert.equal(first.manifest.runtimeIdentity, second.manifest.runtimeIdentity);
		const files = {};
		for(const { package: pkg, manifest } of run.packages)
		{
			hash(pkg.artifacts[0].sha256);
			for(const [path, identity] of Object.entries(manifest.files).filter(([path]) => /^lib\/[^/]+\.so(?:\.\d+)*$/.test(path)))
			{
				if(files[path]) assert.deepEqual(files[path], identity);
				files[path] = identity;
			}
		}
		assert.deepEqual(run.libraries, files);
		assert.deepEqual(run.scenarios, ["native-first", "wit-first"].map(order => ({ order
			, observation: { mixedPublicApis: true, sharedRetirement: true, ownedCleanup: true } })));
	}
};

/**
 * Bind real regression reports, the original failure and executed public docs.
 *
 * @param record - Captured execution evidence, not generated expectations.
 */
export const assertWitCompositionExecution = async record => {
	assert.equal(record.schemaVersion, 1); assert.equal(record.planNode, 1219);
	assert.equal(record.kind, "wit-recursive-composition-execution");
	assert.equal(record.finalAcceptance, false);
	assert.equal(record.structuredCallbacks, false); assert.equal(record.ownedResourceAggregates, false);
	assert.deepEqual(Object.keys(record.reports).sort(), ["callables", "collections", "composition", "hash", "isolation", "mixed", "recursive", "reproduction"]);
	assert.deepEqual(Object.keys(record.reportHashes).sort(), Object.keys(record.reports).sort());
	assert.deepEqual(Object.keys(record.logs).sort(), Object.keys(record.reports).sort());
	assertWitComposition(record.originalFork.report, false);
	assert.equal(sha256(record.originalFork.consumerSource), record.originalFork.report.observations[0].consumerSha256);
	assert.ok(record.originalFork.report.observations.every(run => run.consumerSha256 === record.originalFork.report.observations[0].consumerSha256));
	assert.match(record.originalArityFailure.text, /unused variable.*scope/);
	assert.equal(sha256(record.originalArityFailure.text), record.originalArityFailure.sha256);
	assertWitComposition(record.reports.composition); assertWitMixedPackages(record.reports.mixed);
	for(const [name, report] of Object.entries(record.reports)) assert.equal(digest(report), record.reportHashes[name]);
	passing(record.logs.composition, 2); passing(record.logs.mixed, 2);
	assert.deepEqual(record.logs.mixed, record.logs.composition);
	const prior = JSON.parse(await readFile("docs/evidence/wit-host-isolation-20260924.json", "utf8"));
	const names = Object.keys(prior.reports);
	await assertWitHostExecution({
		...prior
		, reports: Object.fromEntries(names.map(name => [name, record.reports[name]]))
		, logs: Object.fromEntries(names.map(name => [name, record.logs[name]]))
		, reportHashes: Object.fromEntries(names.map(name => [name, record.reportHashes[name]]))
	});
	const source = await readFile("tests/fixtures/recursive-consumers/wit-composition.c");
	const faultSource = await readFile("tests/fixtures/recursive-consumers/wit-result-fault.c");
	const documentation = (await readFile("docs/consume/wit-wasi.md", "utf8")).match(/```c file=wit-wasi\/recursive\.c\n([^]*?)\n```/)[1] + "\n";
	assert.equal(documentation, await readFile("tests/fixtures/documentation/consumers/wit-wasi/recursive.c", "utf8"));
	for(const run of record.reports.composition.observations)
	{
		assert.equal(run.consumerSha256, sha256(source));
		assert.equal(run.faultSourceSha256, sha256(faultSource));
		assert.equal(run.documentation.sourceSha256, sha256(documentation));
	}
	for(const name of ["host", "native"])
	{
		const expected = sha256(await readFile(`tests/fixtures/recursive-consumers/wit-mixed-${name}.c`));
		for(const run of record.reports.mixed.observations) assert.equal(run.sources[name], expected);
	}
};

/**
 * Preserve complete predecessor source hashes across measured changes only.
 *
 * @param record - This milestone's source and evidence integration record.
 */
export const assertWitCompositionIntegration = async record => {
	assert.equal(record.schemaVersion, 1); assert.equal(record.planNode, 1219);
	assert.equal(record.kind, "wit-recursive-composition-integration");
	assert.equal(record.finalAcceptance, false);
	assert.equal(record.baselineRevision, "83be33fb3bcf06236d1247b704421a5c5248b05e");
	assert.equal(record.previous.path, "docs/evidence/wit-host-isolation-integration-20260924.json");
	const bytes = await readFile(record.previous.path); assert.equal(sha256(bytes), record.previous.sha256);
	const previous = JSON.parse(bytes);
	assert.deepEqual(record.updates.map(update => update.path).sort(), witCompositionChangedPaths);
	assert.deepEqual(Object.keys(record.additions).sort(), witCompositionAddedPaths);
	const paths = [...new Set([...Object.keys(previous.sourceHashes), ...witCompositionChangedPaths, ...witCompositionAddedPaths])].sort();
	assert.deepEqual(Object.keys(record.sourceHashes).sort(), paths);
	for(const path of paths) assert.equal(sha256(await readFile(path)), record.sourceHashes[path], path);
	for(const update of record.updates)
	{
		assert.equal(update.previousSha256, previous.sourceHashes[update.path]);
		reverseWitCompositionUpdate(await readFile(update.path, "utf8"), update);
	}
	for(const [path, expected] of Object.entries(record.additions)) assert.equal(expected, record.sourceHashes[path]);
	assert.equal(record.execution.path, witCompositionExecutionPath);
	const executionBytes = await readFile(record.execution.path); assert.equal(sha256(executionBytes), record.execution.sha256);
	const execution = JSON.parse(executionBytes);
	assert.deepEqual(record.sourceHashes, execution.sourceHashes);
	await assertWitCompositionExecution(execution);
};
