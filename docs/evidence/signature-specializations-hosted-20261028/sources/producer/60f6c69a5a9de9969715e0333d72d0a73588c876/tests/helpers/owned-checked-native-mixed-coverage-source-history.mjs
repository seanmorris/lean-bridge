/**
 * Authenticate expanded native mixed-record and ownership-failure coverage.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const ownedCheckedNativeMixedCoverageHistoryPath
	= "docs/evidence/owned-checked-native-mixed-coverage-source-history-20261025.json";
export const ownedCheckedNativeMixedCoveragePredecessor
	= "29ae6d8f74722b6c667ad874ce5646599fc9625b";
export const ownedCheckedNativeMixedCoverageImplementation
	= "bff034c316fd916533f301802ab57594689c3b50";
export const ownedCheckedNativeMixedCoverageIntegrationBase
	= "bff034c316fd916533f301802ab57594689c3b50";
export const ownedCheckedNativeMixedCoverageCommits = Object.freeze([
	"bff034c316fd916533f301802ab57594689c3b50"
]);
export const ownedCheckedNativeMixedCoverageChangedPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, "tests/fixtures/onboarding/owned-checked-records/OwnedCheckedRecords.lean"
	, "tests/fixtures/structured-types/owned-checked-record-installed.c"
	, "tests/fixtures/structured-types/owned-checked-record-installed.cpp"
	, "tests/fixtures/structured-types/owned-checked-record-installed.pl"
	, "tests/helpers/owned-checked-record-native-fixture.mjs"
	, "tests/owned-checked-record-foundation.test.mjs"
	, "tests/owned-checked-record-native-packaging.test.mjs"
	, "tests/owned-checked-record-perl-packaging.test.mjs"
]);
export const ownedCheckedNativeMixedCoverageImplementationAddedPaths = Object.freeze([
	"docs/evidence/owned-checked-native-mixed-coverage-20261025.json"
]);
export const ownedCheckedNativeMixedCoverageImplementationPaths = Object.freeze([
	...ownedCheckedNativeMixedCoverageChangedPaths
	, ...ownedCheckedNativeMixedCoverageImplementationAddedPaths
]);
export const ownedCheckedNativeMixedCoverageIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/checked-javascript.test.mjs"
	, "tests/helpers/owned-checked-record-native-perl-source-history-tests.mjs"
]);
export const ownedCheckedNativeMixedCoverageNormalizationPaths = Object.freeze([
	...ownedCheckedNativeMixedCoverageChangedPaths
	, ...ownedCheckedNativeMixedCoverageIntegrationPaths
]);
export const ownedCheckedNativeMixedCoverageHistoryAddedPaths = Object.freeze([
	"scripts/update-owned-checked-native-mixed-coverage-source-history.mjs"
	, "tests/helpers/owned-checked-native-mixed-coverage-source-history-tests.mjs"
	, "tests/helpers/owned-checked-native-mixed-coverage-source-history.mjs"
]);
export const ownedCheckedNativeMixedCoverageAddedPaths = Object.freeze([
	...ownedCheckedNativeMixedCoverageImplementationAddedPaths
	, ...ownedCheckedNativeMixedCoverageHistoryAddedPaths
]);
export const ownedCheckedNativeMixedCoveragePins = Object.freeze([
	{
		"path": "tests/fixtures/onboarding/owned-checked-records/OwnedCheckedRecords.lean"
		, "count": 4
		, "previousSha256": "b5c2e10c7ccb18859da182d63d7f664e2cc12d2a748f8943ab3e6dc603ddf57f"
		, "currentSha256": "65226b9f8cafb1ff9e5c54dd680efc2939158fd9c4be1da2aaf8c069c1e1eb89"
	}
	, {
		"path": "tests/fixtures/structured-types/owned-checked-record-installed.c"
		, "count": 0
		, "previousSha256": "7a79317cb29509ea28e3a63cea98d85895cdd798e4648180b834fb7d29ea7dcc"
		, "currentSha256": "7faf494caf91115be7ef68b9f56418e1e0096ad1fb7d9d77c24ece84185e3f70"
	}
	, {
		"path": "tests/fixtures/structured-types/owned-checked-record-installed.cpp"
		, "count": 0
		, "previousSha256": "49e3fa1367ce31d9f13139896c083176ea0473d8c63af1e24afda06345384a3c"
		, "currentSha256": "fcf65f4f4effdef04e6ec2efa8ba047f0f6e260cfa77f367ac156aea457a8022"
	}
	, {
		"path": "tests/fixtures/structured-types/owned-checked-record-installed.pl"
		, "count": 0
		, "previousSha256": "189e5fd13efff72dd8eac4beee838e04e0e0d0c01d55bc9836d167b674d5737a"
		, "currentSha256": "0b38fe46c8a7cb1085549715e979e6786e3050f5b99644380276dd2a37dab20e"
	}
	, {
		"path": "tests/helpers/owned-checked-record-native-fixture.mjs"
		, "count": 0
		, "previousSha256": "25bf7ba8abf74d42dfa0be1fcb8a28b1ccc741bb77e549d7b75e222de78bb41c"
		, "currentSha256": "6ee7fb49b1291a942afaf6569cefecdd9981476baf6ab5a9089efaf84938c523"
	}
	, {
		"path": "tests/owned-checked-record-foundation.test.mjs"
		, "count": 4
		, "previousSha256": "c6a2a1fc68d52658a56bbc0eb925f6993c20a323b9feb8c8fcfeab497ab82569"
		, "currentSha256": "433041fb3fb0738ee1de4ce1e96b2d6f70d639f4043a3727ae315809f11d94f3"
	}
	, {
		"path": "tests/owned-checked-record-native-packaging.test.mjs"
		, "count": 0
		, "previousSha256": "64af30d159ca2469464570d7f8423d124696be2bdf9bd0bec0e1f016249b48bc"
		, "currentSha256": "f726a1e29e4884c7ce518892a0b94e4239a6b19fde1f9bafd644454e29e2213c"
	}
	, {
		"path": "tests/owned-checked-record-perl-packaging.test.mjs"
		, "count": 0
		, "previousSha256": "c2b99696e184e1f62091a166c92565d3a5253bf024c8bf51ec4bd33b2b608d23"
		, "currentSha256": "50bd5ce927547e784f2287d0ac58eab723eb3e6c046c137fda0c685fcb971cd4"
	}
]);
let history;
const record = () => history ??= JSON.parse(readFileSync(
	ownedCheckedNativeMixedCoverageHistoryPath, "utf8"
));

/**
 * Restore one exact transition after authenticating both endpoints.
 *
 * @param source - Complete current source.
 * @param update - Exact recorded transition.
 */
export const reverseOwnedCheckedNativeMixedCoverageUpdate = (
	source, update
) => {
	assert.ok(ownedCheckedNativeMixedCoverageNormalizationPaths
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
 * Remove only the exact Owned checked native mixed coverage.
 * Without a requested stop, unwind all authenticated stages of this repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact digest at which normalization stops.
 */
export const beforeOwnedCheckedNativeMixedCoverageSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !ownedCheckedNativeMixedCoverageNormalizationPaths.includes(path))
		return source;
	const value = record();
	const updates = [...value.integrationUpdates, ...value.updates];
	let current = source;
	for(let count = 0; count < updates.length; count++)
	{
		const digest = sha256(current);
		if(digest === expected) return current;
		const update = updates.find(item =>
			item.path === path && item.currentSha256 === digest);
		if(update === undefined) return current;
		current = reverseOwnedCheckedNativeMixedCoverageUpdate(current, update);
	}
	return current;
};
