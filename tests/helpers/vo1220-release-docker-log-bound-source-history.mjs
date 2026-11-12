/**
 * Preserve the bounded discard-only Docker log repair and public pins.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const vo1220ReleaseDockerLogBoundHistoryPath
	= "docs/evidence/vo1220-release-docker-log-bound-source-history-20261112.json";
export const vo1220ReleaseDockerLogBoundPredecessor
	= "7dbe2ff990c3f6ad548285ac48a865e5901f19e0";
export const vo1220ReleaseDockerLogBoundImplementation
	= "436cd6fd3d40d17307d6e4cf597030930c0d8a00";
export const vo1220ReleaseDockerLogBoundPinRefresh
	= "7cd9444f8727f7044e185b2826483aaf2dd40547";
export const vo1220ReleaseDockerLogBoundImplementationPaths = Object.freeze([
	"src/build/canonical-build.mjs"
	, "src/build/process-runner.mjs"
	, "tests/canonical-build.test.mjs"
	, "tests/helpers/process-failure-diagnostics-tests.mjs"
]);
export const vo1220ReleaseDockerLogBoundPinPaths = Object.freeze([
	"docs/type-surface.v1.json"
]);
export const vo1220ReleaseDockerLogBoundIntegrationPaths = Object.freeze([
	"tests/checked-javascript-partition-11.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const vo1220ReleaseDockerLogBoundAddedPaths = Object.freeze([
	"scripts/update-vo1220-release-docker-log-bound-source-history.mjs"
	, "tests/helpers/vo1220-release-docker-log-bound-source-history-tests.mjs"
	, "tests/helpers/vo1220-release-docker-log-bound-source-history.mjs"
]);
export const vo1220ReleaseDockerLogBoundNormalizationPaths = Object.freeze([
	...vo1220ReleaseDockerLogBoundImplementationPaths
	, ...vo1220ReleaseDockerLogBoundPinPaths
	, ...vo1220ReleaseDockerLogBoundIntegrationPaths
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	vo1220ReleaseDockerLogBoundHistoryPath, "utf8"));

/**
 * Reverse one authenticated Docker-log repair transition.
 *
 * @param source - Complete later source.
 * @param update - Authenticated transition.
 */
export const reverseVo1220ReleaseDockerLogBoundUpdate = (source, update) => {
	assert.ok(vo1220ReleaseDockerLogBoundNormalizationPaths
		.includes(update.path), update.path);
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0;
	const parts = [];
	for(const edit of update.edits)
	{
		assert.deepEqual(Object.keys(edit).sort(), ["current", "previous", "start"]);
		assert.ok(Number.isSafeInteger(edit.start)
			&& edit.start >= cursor && edit.start <= source.length);
		assert.notEqual(edit.previous, edit.current);
		assert.equal(source.slice(edit.start, edit.start + edit.current.length)
			, edit.current, update.path);
		parts.push(source.slice(cursor, edit.start), edit.previous);
		cursor = edit.start + edit.current.length;
	}
	parts.push(source.slice(cursor));
	const previous = parts.join("");
	assert.equal(sha256(previous), update.previousSha256, update.path);
	return previous;
};

/**
 * Remove only the authenticated Docker-log repair and pin refresh.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping digest.
 */
export const beforeVo1220ReleaseDockerLogBoundSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !vo1220ReleaseDockerLogBoundNormalizationPaths.includes(path))
		return source;
	let current = source;
	const transitions = [
		record().integrationUpdates, record().pinUpdates, record().updates
	];
	for(const updates of transitions)
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reverseVo1220ReleaseDockerLogBoundUpdate(current, update);
	}
	return current;
};
