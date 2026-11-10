/**
 * Authenticate deterministic headroom for the complete Node consumer lane.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const vo1220NodeConsumerTimeoutHeadroomHistoryPath
	= "docs/evidence/vo1220-node-consumer-timeout-headroom-source-history-20261110.json";
export const vo1220NodeConsumerTimeoutHeadroomPredecessor
	= "7026e9789503c381318612f1c07bc344bc9d1801";
export const vo1220NodeConsumerTimeoutHeadroomImplementation
	= "6d67e6fc55018a57daf15d5d74730dc2303763f4";
export const vo1220NodeConsumerTimeoutHeadroomCommits = Object.freeze([
	"ef4189c29dbb88ef033f08cb6f858c5dc789103d"
	, vo1220NodeConsumerTimeoutHeadroomImplementation
]);
export const vo1220NodeConsumerTimeoutHeadroomImplementationPaths
	= Object.freeze([
		".github/workflows/consumer-matrix.yml"
		, "docs/type-surface.v1.json"
		, "tests/documentation.test.mjs"
	]);
export const vo1220NodeConsumerTimeoutHeadroomIntegrationPaths
	= Object.freeze([
		"tests/checked-javascript-partition-12.test.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const vo1220NodeConsumerTimeoutHeadroomHistoryAdditions
	= Object.freeze([
		"scripts/update-vo1220-node-consumer-timeout-headroom-source-history.mjs"
		, "tests/helpers/vo1220-node-consumer-timeout-headroom-source-history-tests.mjs"
		, "tests/helpers/vo1220-node-consumer-timeout-headroom-source-history.mjs"
	]);
export const vo1220NodeConsumerTimeoutHeadroomBehavior = Object.freeze({
	changedSupportCells: 0, runtimeSemanticChanges: 0
	, packageSemanticChanges: 0, productionCodeChanges: 0
	, priorTimeoutMinutes: 330, timeoutMinutes: 420
	, configuredHeadroomMinutes: 90
	, observedAttemptMinutes: 330.3, observedHeadroomMinutes: 89.7
	, refreshedPins: 92, removedGates: 0, addedGates: 0
});

const historyUrl = new URL(
	`../../${vo1220NodeConsumerTimeoutHeadroomHistoryPath}`, import.meta.url);
let history;
const record = () => history ??= JSON.parse(readFileSync(historyUrl, "utf8"));
export const vo1220NodeConsumerTimeoutHeadroomNormalizationPaths
	= Object.freeze([...new Set([
		...(existsSync(historyUrl) ? record().updates.map(update => update.path)
			: vo1220NodeConsumerTimeoutHeadroomImplementationPaths)
		, ...(existsSync(historyUrl)
			? record().integrationUpdates.map(update => update.path)
			: vo1220NodeConsumerTimeoutHeadroomIntegrationPaths)
	])].sort());
const allowedPath = path =>
	vo1220NodeConsumerTimeoutHeadroomNormalizationPaths.includes(path);

/**
 * Require the timeout, its live workflow pins and its static contract to agree.
 *
 * @param sources - Exact implementation source by repository path.
 */
export const assertVo1220NodeConsumerTimeoutHeadroom = sources => {
	for(const path of vo1220NodeConsumerTimeoutHeadroomImplementationPaths)
		assert.equal(typeof sources[path], "string", path);
	const workflow = sources[".github/workflows/consumer-matrix.yml"];
	const nodeJob = workflow.match(
		/^ {2}node-consumers:\n[^]*?(?=^ {2}[a-z][a-z0-9-]*:\n)/mu)?.[0];
	assert.ok(nodeJob);
	assert.match(nodeJob, /^ {4}timeout-minutes: 420$/mu);
	assert.match(nodeJob, /Exact run 42760217472 reached 330 minutes/u);
	assert.match(nodeJob
		, /name: Enforce Node support and the browser corpus\n[^]*?run: exit 1/u);
	const inventory = JSON.parse(sources["docs/type-surface.v1.json"]);
	const workflowSha256 = sha256(workflow);
	const pins = inventory.evidence.flatMap(evidence => evidence.files)
		.filter(file => file.path === ".github/workflows/consumer-matrix.yml");
	assert.equal(pins.length, 92);
	assert.ok(pins.every(file => file.sha256 === workflowSha256));
	const documentation = sources["tests/documentation.test.mjs"];
	assert.match(documentation
		, /assert\.match\(liveNodeJob, \/\^ \{4\}timeout-minutes: 420\$\/m\);/u);
	return { ...vo1220NodeConsumerTimeoutHeadroomBehavior };
};

/**
 * Reverse one authenticated timeout-headroom transition.
 *
 * @param source - Exact later source.
 * @param update - Exact transition for the same path.
 */
export const reverseVo1220NodeConsumerTimeoutHeadroomUpdate = (
	source, update
) => {
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
 * Remove only the authenticated timeout-headroom repair and registration.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping digest.
 */
export const beforeVo1220NodeConsumerTimeoutHeadroomSource = (
	path, source, expected
) => {
	if(typeof source !== "string" || !allowedPath(path)) return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reverseVo1220NodeConsumerTimeoutHeadroomUpdate(
				current, update);
	}
	return current;
};
