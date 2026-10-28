/**
 * Reverse the exact owned lifetime producer replay history.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const ownedLifetimeReplayHistoryPath
	= "docs/evidence/owned-lifetime-producer-replay-source-history-20261024.json";
export const ownedLifetimeReplayPredecessor
	= "42a3a352114d048139c16786bcf0da586ad7afee";
export const ownedLifetimeReplayImplementation
	= "dcd89cee91bdb595681cd6d482ef5df4e9e7bf21";
export const ownedLifetimeReplayImplementationAddedPaths
	= Object.freeze([
		"tests/helpers/owned-lifetime-producer-tests.mjs"
		, "tests/helpers/owned-lifetime-producers.mjs"
		, "tests/helpers/owned-lifetime-replay-control-tests.mjs"
	]);
export const ownedLifetimeReplayModifiedPaths = Object.freeze([
	"tests/helpers/owned-cpp-borrow-evidence.mjs"
	, "tests/helpers/owned-jvm-receiver-gc-evidence.mjs"
	, "tests/helpers/owned-rust-receiver-evidence.mjs"
	, "tests/helpers/wit-owned-receiver-evidence.mjs"
	, "tests/owned-wasm32-transport.test.mjs"
]);
export const ownedLifetimeReplayImplementationPaths
	= Object.freeze([
		...ownedLifetimeReplayModifiedPaths
		, ...ownedLifetimeReplayImplementationAddedPaths
	]);
export const ownedLifetimeReplayIntegrationPaths
	= Object.freeze([
		"tests/helpers/fin-refinement-source-history.mjs"
		, "tests/checked-javascript.test.mjs"
	]);
export const ownedLifetimeReplayNormalizationPaths
	= Object.freeze([
		...ownedLifetimeReplayModifiedPaths
		, ...ownedLifetimeReplayIntegrationPaths
	]);
export const ownedLifetimeReplayAddedPaths = Object.freeze([
	...ownedLifetimeReplayImplementationAddedPaths
	, "scripts/update-owned-lifetime-producer-replay-source-history.mjs"
	, "tests/helpers/owned-lifetime-producer-replay-source-history-tests.mjs"
	, "tests/helpers/owned-lifetime-producer-replay-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	ownedLifetimeReplayHistoryPath, "utf8"
));

/**
 * Restore one exact source transition after authenticating both endpoints.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseOwnedLifetimeReplayUpdate = (
	source, update
) => {
	assert.ok(ownedLifetimeReplayNormalizationPaths
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
 * Remove only the exact owned lifetime producer replay history.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeOwnedLifetimeReplaySource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !ownedLifetimeReplayNormalizationPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const value = record();
	const update = [...value.integrationUpdates, ...value.updates]
		.find(item => item.path === path && item.currentSha256 === digest);
	return update
		? reverseOwnedLifetimeReplayUpdate(source, update)
		: source;
};
