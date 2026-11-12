/**
 * Preserve the Docker-visible shared Git object-store repair and public pins.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const vo1220ReleaseDockerGitMountHistoryPath
	= "docs/evidence/vo1220-release-docker-git-mount-source-history-20261112.json";
export const vo1220ReleaseDockerGitMountPredecessor
	= "28ac1a34f8da75bb128467f0726cd2af45174ba7";
export const vo1220ReleaseDockerGitMountImplementation
	= "b5dfc84dfa3e0ba08ccf62cc47a94d5069edf3c9";
export const vo1220ReleaseDockerGitMountPinRefresh
	= "0d62c614b67eef91e12fc1688ea060734368fd41";
export const vo1220ReleaseDockerGitMountImplementationPaths = Object.freeze([
	"src/build/canonical-build.mjs"
	, "tests/canonical-build.test.mjs"
]);
export const vo1220ReleaseDockerGitMountPinPaths = Object.freeze([
	"docs/type-surface.v1.json"
]);
export const vo1220ReleaseDockerGitMountIntegrationPaths = Object.freeze([
	"tests/checked-javascript-partition-11.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const vo1220ReleaseDockerGitMountAddedPaths = Object.freeze([
	"scripts/update-vo1220-release-docker-git-mount-source-history.mjs"
	, "tests/helpers/vo1220-release-docker-git-mount-source-history-tests.mjs"
	, "tests/helpers/vo1220-release-docker-git-mount-source-history.mjs"
]);
export const vo1220ReleaseDockerGitMountNormalizationPaths = Object.freeze([
	...vo1220ReleaseDockerGitMountImplementationPaths
	, ...vo1220ReleaseDockerGitMountPinPaths
	, ...vo1220ReleaseDockerGitMountIntegrationPaths
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	vo1220ReleaseDockerGitMountHistoryPath, "utf8"));

/**
 * Reverse one authenticated Docker Git-mount transition.
 *
 * @param source - Complete later source.
 * @param update - Authenticated transition.
 */
export const reverseVo1220ReleaseDockerGitMountUpdate = (source, update) => {
	assert.ok(vo1220ReleaseDockerGitMountNormalizationPaths
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
 * Remove only the authenticated Docker Git-mount repair and pin refresh.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping digest.
 */
export const beforeVo1220ReleaseDockerGitMountSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !vo1220ReleaseDockerGitMountNormalizationPaths.includes(path))
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
			current = reverseVo1220ReleaseDockerGitMountUpdate(current, update);
	}
	return current;
};
