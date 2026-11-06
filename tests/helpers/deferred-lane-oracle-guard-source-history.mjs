/**
 * Preserve the deferred-lane guard on the Core evidence oracle.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const deferredLaneOracleGuardHistoryPath
	= "docs/evidence/deferred-lane-oracle-guard-source-history-20261106.json";
export const deferredLaneOracleGuardPredecessor
	= "1fa9c39e8d994847ff1c4ae70e21bda945ed82e3";
export const deferredLaneOracleGuardImplementation
	= "e5180b705fb2ee0bb2353c84ae4eae9629c82b51";
export const deferredLaneOracleGuardImplementationPaths = Object.freeze([
	"tests/helpers/fin-record-zero-ci-history-tests.mjs"
	, "tests/retained-contract-tests.test.mjs"
]);
export const deferredLaneOracleGuardIntegrationPaths = Object.freeze([
	"tests/checked-javascript-partition-11.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const deferredLaneOracleGuardHistoryAdditions = Object.freeze([
	"scripts/update-deferred-lane-oracle-guard-source-history.mjs"
	, "tests/helpers/deferred-lane-oracle-guard-source-history-tests.mjs"
	, "tests/helpers/deferred-lane-oracle-guard-source-history.mjs"
]);
export const deferredLaneOracleGuardNormalizationPaths
	= Object.freeze([...new Set([
		...deferredLaneOracleGuardImplementationPaths
		, ...deferredLaneOracleGuardIntegrationPaths
	])].sort());
export const deferredLaneOracleGuardBehavior = Object.freeze({
	nativeLoaders: 98, nodeLoaders: 8
	, referenceOnlyHelpers: Object.freeze({ node: 4, native: 1 })
	, eagerCurrentModules: 5, restoredMilestoneRoundTrips: 1
	, changedSupportCells: 0, runtimeSemanticChanges: 0
});

let history;
const record = () => history ??= JSON.parse(readFileSync(
	deferredLaneOracleGuardHistoryPath, "utf8"));
const count = (source, needle) => source.split(needle).length - 1;

/**
 * Require the lane guards to decide retained references with the Core
 * planner oracle, bind every loader by identity, and keep the milestone
 * round trip of the Fin 0 CI integration in its deferred history suite.
 *
 * @param sources - Implementation paths mapped to complete source.
 */
export const assertDeferredLaneOracleGuard = sources => {
	for(const path of deferredLaneOracleGuardImplementationPaths)
		assert.equal(typeof sources[path], "string", path);
	const guard = sources["tests/retained-contract-tests.test.mjs"];
	assert.ok(guard.includes("import { coreContractEvidenceDirectoryReferences,"
		+ " trackedEvidenceDirectories }\n\tfrom \"../scripts/core-contract-evidence.mjs\";\n"));
	assert.equal(guard.includes("retainedReaderShapes"), false);
	for(const marker of [
		"const retainedReferences = (closure, directories) => {"
		, "const assertRetainedReferences = (closure, helpers, directories) => {"
		, "const assertLoadersDeferred = (closure, loaders) => {"
		, "const registeredLoaders = (parent, source) => {"
		, "const moduleLevelReads = (source, path) => {"
		, "const sourceHistoryModule = path => /-source-history(?:-tests)?[.]mjs$/u.test(path);"
		, "assert.deepEqual(modules, [...nativeRetainedLoaders[parent]], parent);"
		, "assert.equal(loaders.length, 98);"
		, "module: \"tests/helpers/native-fin-reply-evidence.mjs\""
		, "assertRetainedReferences(closure, referenceOnlyHelpers.node, directories);"
		, "assertRetainedReferences(closure, referenceOnlyHelpers.native, directories);"
	]) assert.ok(guard.includes(marker), marker);
	const loaderTable = guard.slice(
		guard.indexOf("const nativeRetainedLoaders = Object.freeze({")
		, guard.indexOf("});", guard.indexOf("const nativeRetainedLoaders")));
	assert.equal(count(loaderTable, "\"./helpers/")
		, deferredLaneOracleGuardBehavior.nativeLoaders);
	assert.equal(count(loaderTable, "Object.freeze([") , 4);
	const nodeTable = guard.slice(
		guard.indexOf("const deferredRetainedLoaders = Object.freeze([")
		, guard.indexOf("]);", guard.indexOf("const deferredRetainedLoaders")));
	assert.equal(count(nodeTable, ", module: \"./")
		, deferredLaneOracleGuardBehavior.nodeLoaders);
	const helpers = guard.slice(
		guard.indexOf("const referenceOnlyHelpers = Object.freeze({")
		, guard.indexOf("});", guard.indexOf("const referenceOnlyHelpers")));
	const nodeHelpers = helpers.slice(helpers.indexOf("node:")
		, helpers.indexOf(", native:"));
	assert.equal(count(nodeHelpers, "module: \"tests/helpers/")
		, deferredLaneOracleGuardBehavior.referenceOnlyHelpers.node);
	assert.equal(count(helpers.slice(helpers.indexOf(", native:"))
		, "module: \"tests/helpers/")
	, deferredLaneOracleGuardBehavior.referenceOnlyHelpers.native);
	const current = guard.slice(
		guard.indexOf("const nativeEagerCurrentModules = Object.freeze([")
		, guard.indexOf("]);", guard.indexOf("const nativeEagerCurrentModules")));
	assert.equal(count(current, ", module: \"tests/helpers/")
		, deferredLaneOracleGuardBehavior.eagerCurrentModules);
	const zero = sources["tests/helpers/fin-record-zero-ci-history-tests.mjs"];
	assert.ok(zero.includes("import { assertFinRecordZeroWorkflow,"
		+ " disableFinRecordZeroWorkflow, enableFinRecordZeroWorkflow }"
		+ " from \"./fin-record-zero-ci.mjs\";\n"));
	assert.equal(count(zero, "test(\"Fin zero CI integration is exactly the"
		+ " enable edit of both workflows at its milestone\"")
	, deferredLaneOracleGuardBehavior.restoredMilestoneRoundTrips);
	for(const marker of [
		"const current = await sourceAtHistoryMilestone(finZeroCiHistoryPath, path);"
		, "assert.equal(disableFinRecordZeroWorkflow(current, name), previous, path);"
		, "assert.equal(enableFinRecordZeroWorkflow(previous, name), current, path);"
	]) assert.ok(zero.includes(marker), marker);
	return { ...deferredLaneOracleGuardBehavior };
};

/**
 * Reverse one exact authenticated transition.
 *
 * @param source - Complete later source.
 * @param update - Authenticated reversible transition.
 */
export const reverseDeferredLaneOracleGuardUpdate = (source, update) => {
	assert.ok(deferredLaneOracleGuardNormalizationPaths.includes(update.path)
		, update.path);
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0;
	const parts = [];
	for(const edit of update.edits)
	{
		assert.deepEqual(Object.keys(edit).sort()
			, ["current", "previous", "start"]);
		assert.ok(Number.isSafeInteger(edit.start)
			&& edit.start >= cursor && edit.start <= source.length);
		assert.notEqual(edit.previous, edit.current);
		assert.equal(source.slice(edit.start
			, edit.start + edit.current.length), edit.current, update.path);
		parts.push(source.slice(cursor, edit.start), edit.previous);
		cursor = edit.start + edit.current.length;
	}
	parts.push(source.slice(cursor));
	const previous = parts.join("");
	assert.equal(sha256(previous), update.previousSha256, update.path);
	return previous;
};

/**
 * Remove integration and implementation transitions in order.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping SHA-256.
 */
export const beforeDeferredLaneOracleGuardSource = (path, source, expected) => {
	if(typeof source !== "string"
		|| !deferredLaneOracleGuardNormalizationPaths.includes(path)) return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reverseDeferredLaneOracleGuardUpdate(current, update);
	}
	return current;
};
