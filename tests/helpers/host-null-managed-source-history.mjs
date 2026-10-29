/**
 * Preserve every source state of the .NET, Java and Kotlin HostNull rollout.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const hostNullManagedHistoryPath
	= "docs/evidence/host-null-managed-source-history-20261029.json";
export const hostNullManagedPredecessor
	= "e5827ccbdb36fbb940accb9c104090dc025f9e6b";
export const hostNullManagedDotnet
	= "ac3773f08f54bc9d98635c21a648916bddd4ca07";
export const hostNullManagedJvm
	= "bbcf283d4ad2fde8b03fd110242326a8510570e8";
export const hostNullManagedPinDefinition
	= "0b9150ea62cade9de1b6bc5d26a61e1294a7984b";
export const hostNullManagedPinRefresh
	= "d68fd8deb389ead51fbc6eda279c19fe85579bab";
export const hostNullManagedCommits = Object.freeze([
	hostNullManagedDotnet
	, hostNullManagedJvm
	, hostNullManagedPinDefinition
	, hostNullManagedPinRefresh
]);
export const hostNullManagedChangedPaths = Object.freeze([
	"src/adoption/test-profiles.mjs"
	, "src/backends/dotnet/copied-conversions.mjs"
	, "src/backends/dotnet/copied-model.mjs"
	, "src/backends/dotnet/copied-values.mjs"
	, "src/backends/jvm/callables.mjs"
	, "src/backends/jvm/copied-aliases.mjs"
	, "src/backends/jvm/copied-conversions.mjs"
	, "src/backends/jvm/copied-kotlin.mjs"
	, "src/backends/jvm/copied-model.mjs"
	, "src/backends/jvm/copied-values.mjs"
	, "tests/test-profiles.test.mjs"
]);
export const hostNullManagedExternalHistoryPaths = Object.freeze([
	"docs/type-surface.v1.json"
]);
export const hostNullManagedImplementationAddedPaths = Object.freeze([
	"scripts/refresh-host-null-managed-pins.mjs"
	, "tests/dotnet-host-null-contract.test.mjs"
	, "tests/jvm-host-null-contract.test.mjs"
]);
export const hostNullManagedIntegrationPaths = Object.freeze([
	"tests/checked-javascript-partition-11.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const hostNullManagedHistoryAddedPaths = Object.freeze([
	"scripts/update-host-null-managed-source-history.mjs"
	, "tests/helpers/host-null-managed-source-history-tests.mjs"
	, "tests/helpers/host-null-managed-source-history.mjs"
]);
export const hostNullManagedAddedPaths = Object.freeze([
	...hostNullManagedImplementationAddedPaths
	, ...hostNullManagedHistoryAddedPaths
]);
export const hostNullManagedNormalizationPaths = Object.freeze([
	...hostNullManagedChangedPaths
	, ...hostNullManagedIntegrationPaths
]);
let history;
const record = () => history ??= JSON.parse(readFileSync(
	hostNullManagedHistoryPath, "utf8"
));
const normalizationPaths = new Set(hostNullManagedNormalizationPaths);

/**
 * Restore one exact managed HostNull transition.
 *
 * @param source - Complete current source.
 * @param update - Authenticated transition record.
 */
export const reverseHostNullManagedUpdate = (source, update) => {
	assert.ok(normalizationPaths.has(update.path), update.path);
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

const reverseSet = (path, source, expected, updates) => {
	if(typeof source !== "string" || !normalizationPaths.has(path)) return source;
	let current = source;
	while(true)
	{
		const digest = sha256(current);
		if(digest === expected) return current;
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update === undefined) return current;
		current = reverseHostNullManagedUpdate(current, update);
	}
};

/**
 * Restore only this layer's newest-first registration edits.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping digest.
 */
export const beforeHostNullManagedIntegrationSource = (path, source, expected) =>
	reverseSet(path, source, expected, record().integrationUpdates);

/**
 * Restore the four managed HostNull implementation milestones.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping digest.
 */
export const beforeHostNullManagedSource = (path, source, expected) =>
	reverseSet(path, source, expected, record().updates);
