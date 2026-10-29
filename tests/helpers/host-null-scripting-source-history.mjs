/**
 * Preserve every source state of the Perl, Python and Ruby HostNull rollout.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const hostNullScriptingHistoryPath
	= "docs/evidence/host-null-scripting-source-history-20261029.json";
export const hostNullScriptingPredecessor
	= "1de60dcd3dd0858b96d13f4476a405cf60fefcfd";
export const hostNullScriptingProjection
	= "e38cacb01679d30bd0770daaabb66e4c565b2096";
export const hostNullScriptingAcceptance
	= "eb0834607b2cb90abce537b9880f3e447a4185c9";
export const hostNullScriptingHosted
	= "9126e948b065a055285f01b4acb88b8159a40419";
export const hostNullScriptingPinDefinition
	= "93b58511f787ff41aef626c4a046907519022e36";
export const hostNullScriptingPinRefresh
	= "7075578b6fc2f3ff497a42d308872ef351004512";
export const hostNullScriptingCommits = Object.freeze([
	hostNullScriptingProjection
	, hostNullScriptingAcceptance
	, hostNullScriptingHosted
	, hostNullScriptingPinDefinition
	, hostNullScriptingPinRefresh
]);
export const hostNullScriptingChangedPaths = Object.freeze([
	".github/workflows/perl-consumer.yml"
	, "src/adoption/test-profiles.mjs"
	, "src/backends/perl/copied-aliases.mjs"
	, "src/backends/perl/generate.mjs"
	, "src/backends/python/compounds.mjs"
	, "src/backends/python/copied-conversions.mjs"
	, "src/backends/python/copied-model.mjs"
	, "src/backends/python/copied-values.mjs"
	, "src/backends/ruby/copied-conversions.mjs"
	, "src/backends/ruby/copied-model.mjs"
	, "src/backends/ruby/copied-values.mjs"
	, "tests/test-profiles.test.mjs"
]);
export const hostNullScriptingExternalHistoryPaths = Object.freeze([
	"docs/type-surface.v1.json"
]);
export const hostNullScriptingImplementationAddedPaths = Object.freeze([
	"scripts/check-host-null-scripting-ci.mjs"
	, "scripts/refresh-host-null-scripting-pins.mjs"
	, "scripts/run-host-null-scripting-ci.sh"
	, "tests/fixtures/host-null-consumers/perl.pl"
	, "tests/fixtures/host-null-consumers/python.py"
	, "tests/fixtures/host-null-consumers/ruby.rb"
	, "tests/helpers/host-null-scripting-installed.mjs"
	, "tests/scripting-host-null-ci.test.mjs"
	, "tests/scripting-host-null-contract.test.mjs"
	, "tests/scripting-host-null.test.mjs"
]);
export const hostNullScriptingIntegrationPaths = Object.freeze([
	"tests/checked-javascript-partition-11.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const hostNullScriptingHistoryAddedPaths = Object.freeze([
	"scripts/update-host-null-scripting-source-history.mjs"
	, "tests/helpers/host-null-scripting-source-history-tests.mjs"
	, "tests/helpers/host-null-scripting-source-history.mjs"
]);
export const hostNullScriptingAddedPaths = Object.freeze([
	...hostNullScriptingImplementationAddedPaths
	, ...hostNullScriptingHistoryAddedPaths
]);
export const hostNullScriptingNormalizationPaths = Object.freeze([
	...hostNullScriptingChangedPaths
	, ...hostNullScriptingIntegrationPaths
]);
export const hostNullScriptingPinCounts = Object.freeze({
	".github/workflows/perl-consumer.yml": 13
	, "src/adoption/test-profiles.mjs": 98
	, "tests/test-profiles.test.mjs": 4
});
export const hostNullScriptingPinCount = Object.values(
	hostNullScriptingPinCounts).reduce((sum, count) => sum + count, 0);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	hostNullScriptingHistoryPath, "utf8"
));
const normalizationPaths = new Set(hostNullScriptingNormalizationPaths);

/**
 * Restore one exact scripting HostNull transition.
 *
 * @param source - Complete current source.
 * @param update - Authenticated transition record.
 */
export const reverseHostNullScriptingUpdate = (source, update) => {
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
		current = reverseHostNullScriptingUpdate(current, update);
	}
};

/**
 * Restore only this layer's newest-first registration edits.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping digest.
 */
export const beforeHostNullScriptingIntegrationSource = (path, source, expected) =>
	reverseSet(path, source, expected, record().integrationUpdates);

/**
 * Restore the five Perl, Python and Ruby HostNull implementation milestones.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping digest.
 */
export const beforeHostNullScriptingSource = (path, source, expected) =>
	reverseSet(path, source, expected, record().updates);
