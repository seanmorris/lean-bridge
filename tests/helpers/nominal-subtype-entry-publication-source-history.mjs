/**
 * Authenticate the nominal Subtype entry archive and publication lineage.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const nominalSubtypeEntryPublicationHistoryPath
	= "docs/evidence/nominal-subtype-entry-publication-source-history-20261026.json";
export const nominalSubtypeEntryPublicationPredecessor
	= "0ab9a0fd3d650ea924c50e8d83ae163746a4954f";
export const nominalSubtypeEntryArchiveImplementation
	= "6eadf7e1a23d196a64a74531e2fa5c5e94e76616";
export const nominalSubtypeEntryNativeArchiveCommit
	= "df942ba02a891d83cb6fac60ff30572a33e34e8e";
export const nominalSubtypeEntryBrowserArchiveCommit
	= "9e5c697891996ff721f9f761f50c5da33255e8e0";
export const nominalSubtypeEntryReplayCommit
	= "0c14f487d58f5d247e302203096d8495d7249fa7";
export const nominalSubtypeEntryPromotionImplementation
	= "8594bc6a43fdf28bf3b80da64d31938226d0f0b9";
export const nominalSubtypeEntryPublicationCommit
	= "a553cca8d493f167841d413a2c58576f8281b7bb";
export const nominalSubtypeEntryPublicationCommits = Object.freeze([
	nominalSubtypeEntryArchiveImplementation
	, nominalSubtypeEntryNativeArchiveCommit
	, nominalSubtypeEntryBrowserArchiveCommit
	, nominalSubtypeEntryReplayCommit
	, nominalSubtypeEntryPromotionImplementation
	, nominalSubtypeEntryPublicationCommit
]);

export const nominalSubtypeEntryPublicationTransitions = Object.freeze([
	Object.freeze({ path: "tests/component-array-contract.test.mjs"
		, previous: nominalSubtypeEntryPublicationPredecessor
		, current: nominalSubtypeEntryArchiveImplementation })
	, Object.freeze({ path: "src/adoption/test-profiles.mjs"
		, previous: nominalSubtypeEntryBrowserArchiveCommit
		, current: nominalSubtypeEntryReplayCommit })
	, Object.freeze({ path: "tests/component-array-contract.test.mjs"
		, previous: nominalSubtypeEntryReplayCommit
		, current: nominalSubtypeEntryPromotionImplementation })
	, ...[
		"docs/consume/c.md", "docs/consume/cpp.md"
		, "docs/javascript-typescript.md", "docs/lean/existing-package.md"
		, "docs/type-surface.v1.json"
		, "tests/helpers/nominal-subtype-entry-promotion-tests.mjs"
	].map(path => Object.freeze({ path
		, previous: nominalSubtypeEntryPromotionImplementation
		, current: nominalSubtypeEntryPublicationCommit }))
]);

export const nominalSubtypeEntryPublicationIntroductions = Object.freeze([
	Object.freeze({ commit: nominalSubtypeEntryArchiveImplementation
		, path: "scripts/archive-nominal-subtype-entry-evidence.mjs" })
	, Object.freeze({ commit: nominalSubtypeEntryArchiveImplementation
		, path: "tests/helpers/nominal-subtype-entry-hosted-evidence-tests.mjs" })
	, Object.freeze({ commit: nominalSubtypeEntryArchiveImplementation
		, path: "tests/helpers/nominal-subtype-entry-hosted-evidence.mjs" })
	, Object.freeze({ commit: nominalSubtypeEntryReplayCommit
		, path: "tests/nominal-subtype-entry-hosted-evidence.test.mjs" })
	, Object.freeze({ commit: nominalSubtypeEntryPromotionImplementation
		, path: "scripts/promote-nominal-subtype-entry-evidence.mjs" })
	, Object.freeze({ commit: nominalSubtypeEntryPromotionImplementation
		, path: "tests/helpers/nominal-subtype-entry-promotion-tests.mjs" })
	, Object.freeze({ commit: nominalSubtypeEntryPromotionImplementation
		, path: "tests/helpers/nominal-subtype-entry-promotion.mjs" })
	, Object.freeze({ commit: nominalSubtypeEntryPublicationCommit
		, path: "docs/evidence/nominal-subtype-entry-promotion-20261026.md" })
]);

export const nominalSubtypeEntryPublicationArchiveRoots = Object.freeze({
	native: Object.freeze({
		commit: nominalSubtypeEntryNativeArchiveCommit
		, root: "docs/evidence/nominal-subtype-entry-native-hosted-20261024"
		, indexSha256: "84117788b03fed4ec21fbd7c7fd67e42eb4dbf2abe4ef4da2254aee747e8eafb"
		, manifestFiles: 1636, committedFiles: 1637, committedBytes: 21890840
	})
	, browser: Object.freeze({
		commit: nominalSubtypeEntryBrowserArchiveCommit
		, root: "docs/evidence/nominal-subtype-entry-browser-hosted-20261024"
		, indexSha256: "66ec4ffe09cb7216170f0d5b5c77829c5a88152793d4a533d02681e71aa3c219"
		, manifestFiles: 2408, committedFiles: 2409, committedBytes: 32674943
	})
});

export const nominalSubtypeEntryPublicationIntegrationPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, "tests/component-array-contract.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const nominalSubtypeEntryPublicationNormalizationPaths = Object.freeze([
	...new Set([
		...nominalSubtypeEntryPublicationTransitions.map(item => item.path)
		, ...nominalSubtypeEntryPublicationIntegrationPaths
	])
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	nominalSubtypeEntryPublicationHistoryPath, "utf8"));

/**
 * Restore one exact transition after authenticating both endpoints.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseNominalSubtypeEntryPublicationUpdate = (source, update) => {
	assert.ok(nominalSubtypeEntryPublicationNormalizationPaths
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
 * Reverse every recognized nominal-entry publication layer for one source.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact digest at which normalization stops.
 */
export const beforeNominalSubtypeEntryPublicationSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !nominalSubtypeEntryPublicationNormalizationPaths.includes(path))
		return source;
	const updates = [...record().integrationUpdates, ...record().updates];
	let current = source;
	for(let count = 0; count < updates.length; count++)
	{
		const digest = sha256(current);
		if(digest === expected) return current;
		const update = updates.find(item =>
			item.path === path && item.currentSha256 === digest);
		if(update === undefined) return current;
		current = reverseNominalSubtypeEntryPublicationUpdate(current, update);
	}
	return current;
};
