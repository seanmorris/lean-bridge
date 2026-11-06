/**
 * Preserve the retained-contract scope and JVM observation-model repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const retainedContractScopeRepairHistoryPath
	= "docs/evidence/retained-contract-scope-repair-source-history-20261106.json";
export const retainedContractScopeRepairPredecessor
	= "b88e1ebfee44771d0e075d2aec582658d6c3642b";
export const retainedContractScopeRepairImplementation
	= "6b656face9812ffd4ff7055032e33f808fca2794";
export const retainedContractScopeRepairImplementationPaths = Object.freeze([
	".github/workflows/consumer-matrix.yml"
	, ".github/workflows/perl-consumer.yml"
	, ".github/workflows/quality.yml"
	, "tests/generic-records.test.mjs"
	, "tests/helpers/fin-container-edge-jvm.mjs"
	, "tests/helpers/jvm-pending-exit-evidence-tests.mjs"
	, "tests/native-fin-products.test.mjs"
]);
export const retainedContractScopeRepairImplementationAdditions = Object.freeze([
	"tests/helpers/retained-contract-tests.mjs"
	, "tests/retained-contract-tests.test.mjs"
]);
export const retainedContractScopeRepairIntegrationPaths = Object.freeze([
	"tests/checked-javascript-partition-11.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const retainedContractScopeRepairHistoryAdditions = Object.freeze([
	"scripts/update-retained-contract-scope-repair-source-history.mjs"
	, "tests/helpers/retained-contract-scope-repair-source-history-tests.mjs"
	, "tests/helpers/retained-contract-scope-repair-source-history.mjs"
]);

const historyUrl = new URL(
	`../../${retainedContractScopeRepairHistoryPath}`, import.meta.url);
let history;
const record = () => history ??= JSON.parse(readFileSync(historyUrl, "utf8"));
export const retainedContractScopeRepairNormalizationPaths = Object.freeze([
	...new Set([
		...(existsSync(historyUrl) ? record().updates.map(update => update.path)
			: retainedContractScopeRepairImplementationPaths)
		, ...(existsSync(historyUrl)
			? record().integrationUpdates.map(update => update.path)
			: retainedContractScopeRepairIntegrationPaths)
	])
].sort());
const allowedPath = path => retainedContractScopeRepairImplementationPaths
	.includes(path) || retainedContractScopeRepairIntegrationPaths.includes(path);
const workflowJob = (source, job) => source.split(`\n  ${job}:\n`)[1]
	?.split(/\n {2}[a-z][a-z0-9-]*:\n/u)[0];

/**
 * Require current behavior in sparse lanes and retained contracts in Core.
 *
 * @param sources - Implementation and added paths mapped to complete source.
 */
export const assertRetainedContractScopeRepair = sources => {
	for(const path of [
		...retainedContractScopeRepairImplementationPaths
		, ...retainedContractScopeRepairImplementationAdditions
	]) assert.equal(typeof sources[path], "string", path);
	const consumers = sources[".github/workflows/consumer-matrix.yml"];
	for(const job of [
		"node-consumers", "php-consumers", "native-consumers"
		, "managed-consumers", "wasi-consumer"
	]) assert.equal(workflowJob(consumers, job)
		.match(/LEAN_BRIDGE_RETAINED_CONTRACTS: deferred/gu)?.length, 1, job);
	assert.equal(workflowJob(sources[".github/workflows/perl-consumer.yml"]
		, "perl").match(/LEAN_BRIDGE_RETAINED_CONTRACTS: deferred/gu)?.length
	, 1);
	assert.equal(workflowJob(sources[".github/workflows/quality.yml"]
		, "contract").match(/LEAN_BRIDGE_RETAINED_CONTRACTS: required/gu)
		?.length, 1);
	const helper = sources["tests/helpers/retained-contract-tests.mjs"];
	assert.match(helper, /Object[.]freeze\(\["required", "deferred"\]\)/u);
	assert.match(helper
		, /if\(scope === "deferred"\) return Object[.]freeze\(\{ scope, registered: 0 \}\);/u);
	assert.match(helper, /for\(const loader of loaders\) await loader\(\);/u);
	const generic = sources["tests/generic-records.test.mjs"];
	assert.equal(generic.match(/\(\) => import\("[.]\/helpers\//gu)?.length
		, 18);
	const native = sources["tests/native-fin-products.test.mjs"];
	assert.equal(native.match(/\(\) => import\("[.]\/helpers\//gu)?.length, 5);
	assert.match(native, /lb_copy_2_check\(arg0, &_lb_budget\)/u);
	assert.match(native, /lb_copy_2_in\\\(arg0\\\)/u);
	const jvm = sources["tests/helpers/fin-container-edge-jvm.mjs"];
	assert.match(jvm
		, /finContainerEdgeJvmExpectedBeforeOptionNullEntry = expectedRows\(false\)/u);
	assert.match(jvm, /finContainerEdgeJvmExpected = expectedRows\(true\)/u);
	assert.match(jvm, /if\(publicOptionNull\) add\("optionalDigits", "null"\)/u);
	const archive = sources[
		"tests/helpers/jvm-pending-exit-evidence-tests.mjs"];
	assert.match(archive
		, /readFinContainerEdgeJvm\(stdout, "java", finContainerEdgeJvmExpectedBeforeOptionNullEntry\)/u);
	return { deferredConsumerJobs: 6, retainedEntrypoints: 2
		, currentJvmRows: 12047, historicalJvmRows: 12046
		, changedSupportCells: 0, runtimeSemanticChanges: 0 };
};

/**
 * Reverse one authenticated scope-repair transition.
 *
 * @param source - Complete later source.
 * @param update - Authenticated reversible transition.
 */
export const reverseRetainedContractScopeRepairUpdate = (source, update) => {
	assert.ok(allowedPath(update.path), update.path);
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
 * Remove only authenticated retained-contract scope transitions.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping SHA-256.
 */
export const beforeRetainedContractScopeRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !retainedContractScopeRepairNormalizationPaths.includes(path)
		|| !existsSync(historyUrl)) return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reverseRetainedContractScopeRepairUpdate(current, update);
	}
	return current;
};
