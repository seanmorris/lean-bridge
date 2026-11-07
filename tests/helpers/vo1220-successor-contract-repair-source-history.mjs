/**
 * Authenticate the first exact successor-cohort contract repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const vo1220SuccessorContractRepairHistoryPath
	= "docs/evidence/vo1220-successor-contract-repair-source-history-20261107.json";
export const vo1220SuccessorContractRepairPredecessor
	= "462f05adbcec50e33bec9c24f9fe493f79cae7b1";
export const vo1220SuccessorContractRepairImplementation
	= "fa53424418e59add18d92a2bd8a46af9abd64015";
export const vo1220SuccessorContractRepairImplementationPaths = Object.freeze([
	"config/checked-javascript.json"
	, "config/cli-package.v1.json"
	, "nix/component-engine-source-boundary.json"
	, "package.json"
	, "tests/cli-npm-package.test.mjs"
	, "tests/documentation.test.mjs"
	, "tests/helpers/fin-container-edge-ci.mjs"
	, "tests/helpers/fin-container-late-ci-workflow.mjs"
]);
export const vo1220SuccessorContractRepairIntegrationPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, "tests/checked-javascript-partition-12.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const vo1220SuccessorContractRepairHistoryAdditions = Object.freeze([
	"scripts/update-vo1220-successor-contract-repair-source-history.mjs"
	, "tests/helpers/vo1220-successor-contract-repair-source-history-tests.mjs"
	, "tests/helpers/vo1220-successor-contract-repair-source-history.mjs"
]);
export const vo1220SuccessorContractRepairBehavior = Object.freeze({
	changedSupportCells: 0, runtimeSemanticChanges: 0
	, implementationPaths: 8, currentSourcePaths: 6, refreshedPins: 95
});

const historyUrl = new URL("../../" + vo1220SuccessorContractRepairHistoryPath
	, import.meta.url);
let history;
const record = () => history ??= JSON.parse(readFileSync(historyUrl, "utf8"));
export const vo1220SuccessorContractRepairNormalizationPaths
	= Object.freeze([...new Set([
		...(existsSync(historyUrl) ? record().updates.map(update => update.path)
			: vo1220SuccessorContractRepairImplementationPaths)
		, ...(existsSync(historyUrl)
			? record().integrationUpdates.map(update => update.path)
			: vo1220SuccessorContractRepairIntegrationPaths)
	])].sort());

/**
 * Require both independently observed successor repairs.
 *
 * @param sources - Exact implementation source by repository path.
 */
export const assertVo1220SuccessorContractRepair = sources => {
	for(const path of vo1220SuccessorContractRepairImplementationPaths)
		assert.equal(typeof sources[path], "string", path);
	const dependency = "src/build/component-dependent-fin.mjs";
	for(const path of ["package.json", "config/cli-package.v1.json"])
		assert.ok(JSON.parse(sources[path]).files.includes(dependency), path);
	assert.ok(JSON.parse(sources["nix/component-engine-source-boundary.json"])
		.includedFiles.includes(dependency));
	assert.ok(JSON.parse(sources["config/checked-javascript.json"]).deferred
		.some(item => item.path === dependency
			&& item.classification === "strict-migration-backlog"));
	assert.match(sources["tests/cli-npm-package.test.mjs"]
		, /CLI source allowlist contains every relative module dependency/u);
	assert.match(sources["tests/documentation.test.mjs"]
		, /historicalFinContainerTimeouts/u);
	for(const path of ["tests/helpers/fin-container-edge-ci.mjs"
		, "tests/helpers/fin-container-late-ci-workflow.mjs"])
		assert.match(sources[path], /expectedTimeouts/u, path);
	return { ...vo1220SuccessorContractRepairBehavior };
};

/**
 * Reverse one authenticated source transition.
 *
 * @param source - Exact later source.
 * @param update - Recorded transition for the same path.
 */
export const reverseVo1220SuccessorContractRepairUpdate = (
	source, update
) => {
	assert.ok(vo1220SuccessorContractRepairNormalizationPaths
		.includes(update.path));
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
 * Remove only this successor repair and its integration.
 *
 * @param path - Repository-relative path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping digest.
 */
export const beforeVo1220SuccessorContractRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !vo1220SuccessorContractRepairNormalizationPaths.includes(path))
		return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reverseVo1220SuccessorContractRepairUpdate(current, update);
	}
	return current;
};
