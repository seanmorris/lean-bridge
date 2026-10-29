/**
 * Preserve the exact systems HostNull type-surface pin transition and this
 * layer's newest-first registration.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const hostNullSystemsTypeSurfaceHistoryPath
	= "docs/evidence/host-null-systems-type-surface-lineage-source-history-20261029.json";
export const hostNullSystemsTypeSurfacePredecessor
	= "f974802515052fa8e2c6f09c0b7bd7a2afa2412c";
export const hostNullSystemsTypeSurfacePath = "docs/type-surface.v1.json";
export const hostNullSystemsTypeSurfacePinDefinition
	= "95b3dedcbceee518695c3901534300a9468fc36e";
export const hostNullSystemsTypeSurfacePinRefresh
	= "1dc4c6c47def16c4cb5f98ce0ee23e12ed6a7d82";
export const hostNullSystemsTypeSurfaceAnchorSha256
	= "a2e6eb3bd5c2ad19cf1057e0cfdc84ea91ad927f50fb36f2788a0316ef88d57e";
export const hostNullSystemsTypeSurfaceTargetSha256
	= "50dd46005e488bd90b9d099f7f6b27d6b34f2a43b557d81d803cdaf90038449b";
export const hostNullSystemsTypeSurfacePinCount = 308;
export const hostNullSystemsTypeSurfaceIntegrationPaths = Object.freeze([
	"tests/checked-javascript-partition-11.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const hostNullSystemsTypeSurfaceNormalizationPaths = Object.freeze([
	hostNullSystemsTypeSurfacePath
	, ...hostNullSystemsTypeSurfaceIntegrationPaths
]);
export const hostNullSystemsTypeSurfaceAddedPaths = Object.freeze([
	"scripts/update-host-null-systems-type-surface-lineage-source-history.mjs"
	, "tests/helpers/host-null-systems-type-surface-lineage-source-history-tests.mjs"
	, "tests/helpers/host-null-systems-type-surface-lineage-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	hostNullSystemsTypeSurfaceHistoryPath, "utf8"
));

/**
 * Reverse one exact authenticated systems type-surface transition.
 *
 * @param source - Complete later source.
 * @param update - Path, digests and later-side edits of one change.
 */
export const reverseHostNullSystemsTypeSurfaceUpdate = (source, update) => {
	assert.ok(hostNullSystemsTypeSurfaceNormalizationPaths.includes(update.path));
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0;
	const parts = [];
	for(const edit of update.edits)
	{
		assert.deepEqual(Object.keys(edit).sort(), ["current", "previous", "start"]);
		assert.ok(Number.isSafeInteger(edit.start)
			&& edit.start >= cursor && edit.start <= source.length);
		assert.equal(typeof edit.previous, "string");
		assert.equal(typeof edit.current, "string");
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

const walk = (path, source, expected, updates) => {
	if(typeof source !== "string"
		|| !hostNullSystemsTypeSurfaceNormalizationPaths.includes(path)) return source;
	let current = source;
	while(true)
	{
		const digest = sha256(current);
		if(digest === expected) return current;
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update === undefined) return current;
		current = reverseHostNullSystemsTypeSurfaceUpdate(current, update);
	}
};

/**
 * Remove only this layer's newest-first registration.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping digest.
 */
export const beforeHostNullSystemsTypeSurfaceIntegrationSource
	= (path, source, expected) => walk(
		path, source, expected, record().integrationUpdates);

/**
 * Restore the systems HostNull pin refresh to its authenticated predecessor.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping digest.
 */
export const beforeHostNullSystemsTypeSurfaceSource
	= (path, source, expected) => walk(path, source, expected, record().updates);
