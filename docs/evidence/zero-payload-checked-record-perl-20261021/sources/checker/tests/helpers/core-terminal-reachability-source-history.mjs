/**
 * Authenticate the bounded Core follow-up repair and bridge only the exact
 * historical source triples that older receipts still request.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const coreTerminalReachabilityHistoryPath
	= "docs/evidence/core-terminal-reachability-source-history-20261018.json";
export const coreTerminalReachabilityPredecessor
	= "a6cd0f01f03d1bf79d53597840008fe0457b675f";
export const coreTerminalReachabilityChangedPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, "tests/component-array-contract.test.mjs"
	, "tests/generic-record-array-rollout-history.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/owned-dotnet-process-history.mjs"
	, "tests/helpers/owned-perl-callback-result-history-tests.mjs"
	, "tests/helpers/owned-perl-callback-result-variant-history-tests.mjs"
	, "tests/helpers/php-callback-installed-staging-history.mjs"
	, "tests/helpers/post-perl-callback-staging-history-tests.mjs"
	, "tests/owned-jvm-callback-result-history.test.mjs"
]);
export const coreTerminalReachabilityAddedPaths = Object.freeze([
	"docs/evidence/owned-dotnet-span-runtime-history-20261018.json"
	, "scripts/update-core-terminal-reachability-source-history.mjs"
	, "tests/helpers/core-terminal-reachability-source-history-tests.mjs"
	, "tests/helpers/core-terminal-reachability-source-history.mjs"
	, "tests/helpers/owned-dotnet-span-runtime-history-tests.mjs"
	, "tests/helpers/owned-dotnet-span-runtime-history.mjs"
]);
export const coreTerminalReachabilityTerminalSpecs = Object.freeze([
	{
		path: "tests/helpers/inherited-checked-record-php-evidence.mjs"
		, expectedCommit: "4268943dc4bdd1f7a8dca256075b75c64594f437"
		, currentCommit: "16a722de655f2d6b691b9c0e26d1ad945337445a"
	}
	, {
		path: "tests/helpers/inherited-checked-record-php-provenance.mjs"
		, expectedCommit: "de9d1316c340a39de8d608475689526b176d9df5"
		, currentCommit: "16a722de655f2d6b691b9c0e26d1ad945337445a"
	}
	, {
		path: "tests/helpers/inherited-checked-record-python-evidence.mjs"
		, expectedCommit: "de17a9463fe0d51b4c5464b295d262aae670e4a3"
		, currentCommit: "9aee3a3b71727134d4b26afd871eee44d9070746"
	}
	, {
		path: "tests/helpers/inherited-checked-record-python-provenance.mjs"
		, expectedCommit: "de17a9463fe0d51b4c5464b295d262aae670e4a3"
		, currentCommit: "9aee3a3b71727134d4b26afd871eee44d9070746"
	}
	, {
		path: "tests/helpers/inherited-checked-record-ruby-evidence.mjs"
		, expectedCommit: "3f7f275e55d9c84e707e1d1e1553fdd40d2e0e5"
		, currentCommit: "fd6cec142b01c9b6ac9537bfd728a46045a4e8c9"
	}
	, {
		path: "tests/helpers/inherited-checked-record-ruby-provenance.mjs"
		, expectedCommit: "3f7f275e55d9c84e707e1d1e1553fdd40d2e0e5"
		, currentCommit: "fd6cec142b01c9b6ac9537bfd728a46045a4e8c9"
	}
	, {
		path: "tests/helpers/owned-borrow-history.mjs"
		, expectedCommit: "2e422bde5449fd6578af0d4c27256e7110ec3c48"
		, currentCommit: "dec8d558423d1b1c2ec4b95999ea8779adb60091"
	}
	, {
		path: "tests/helpers/owned-perl-callback-result-ci.mjs"
		, expectedCommit: "bffb781a7a0926b93dcef46c2bc03efecab86cf3"
		, currentCommit: "fa51434d712136f38b6b0f88d9361494a32eda3a"
	}
	, {
		path: "tests/helpers/owned-perl-callback-result-variant-evidence-tests.mjs"
		, expectedCommit: "7d07f9b3555ad5f4211ddf36118bb16b0cf3693c"
		, currentCommit: "fa51434d712136f38b6b0f88d9361494a32eda3a"
	}
	, {
		path: "tests/helpers/owned-perl-callback-result-variant-evidence.mjs"
		, expectedCommit: "7d07f9b3555ad5f4211ddf36118bb16b0cf3693c"
		, currentCommit: "fa51434d712136f38b6b0f88d9361494a32eda3a"
	}
	, {
		path: "tests/helpers/owned-ruby-transfer-evidence.mjs"
		, expectedCommit: "2e422bde5449fd6578af0d4c27256e7110ec3c48"
		, currentCommit: "764032d07d36cb442ebb90b24078bb2b50e9184d"
	}
	, {
		path: "tests/owned-borrow-evidence.test.mjs"
		, expectedCommit: "2e422bde5449fd6578af0d4c27256e7110ec3c48"
		, currentCommit: "dec8d558423d1b1c2ec4b95999ea8779adb60091"
	}
]);
export const coreTerminalReachabilityTerminalPaths = Object.freeze(
	coreTerminalReachabilityTerminalSpecs.map(item => item.path)
);
let history;

const record = () => history ??= JSON.parse(readFileSync(
	coreTerminalReachabilityHistoryPath, "utf8"
));

const reverseEdits = (source, update) => {
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
		assert.equal(typeof edit.previous, "string");
		assert.equal(typeof edit.current, "string");
		assert.notEqual(edit.previous, edit.current);
		assert.equal(source.slice(edit.start
			, edit.start + edit.current.length), edit.current);
		parts.push(source.slice(cursor, edit.start), edit.previous);
		cursor = edit.start + edit.current.length;
	}
	parts.push(source.slice(cursor));
	const previous = parts.join("");
	assert.equal(sha256(previous), update.previousSha256, update.path);
	return previous;
};

/**
 * Reverse one exact worktree repair transition.
 *
 * @param source - Complete current source text.
 * @param update - Authenticated transition for the same path.
 */
export const reverseCoreTerminalReachabilityUpdate = (source, update) => {
	assert.ok(coreTerminalReachabilityChangedPaths.includes(update.path));
	return reverseEdits(source, update);
};

/**
 * Remove only the exact follow-up repair layer from current source.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeCoreTerminalReachabilityRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !coreTerminalReachabilityChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseCoreTerminalReachabilityUpdate(source, update)
		: source;
};

/**
 * Reverse one exact stop-specific historical bridge.
 *
 * @param source - Complete source at the known terminal digest.
 * @param entry - Exact path, digest pair, commits and reversal edits.
 */
export const reverseCoreTerminalReachabilityEntry = (source, entry) => {
	assert.deepEqual(Object.keys(entry).sort(), [
		"currentCommit", "currentSha256", "edits", "expectedCommit"
		, "expectedSha256", "path"
	]);
	assert.ok(coreTerminalReachabilityTerminalPaths.includes(entry.path));
	return reverseEdits(source, {
		path: entry.path, currentSha256: entry.currentSha256
		, previousSha256: entry.expectedSha256, edits: entry.edits
	});
};

/**
 * Bridge only a declared path/current/expected triple. Calls without an exact
 * stop and all unknown triples remain byte-identical.
 *
 * @param path - Repository-relative source path.
 * @param source - Source left after the ordinary history readers.
 * @param expected - Requested exact historical digest.
 */
export const beforeCoreTerminalReachabilitySource = (
	path, source, expected
) => {
	if(typeof source !== "string" || typeof expected !== "string"
		|| sha256(source) === expected) return source;
	const digest = sha256(source);
	const entry = record().terminalEntries.find(item => item.path === path
		&& item.currentSha256 === digest
		&& item.expectedSha256 === expected);
	return entry === undefined ? source
		: reverseCoreTerminalReachabilityEntry(source, entry);
};
