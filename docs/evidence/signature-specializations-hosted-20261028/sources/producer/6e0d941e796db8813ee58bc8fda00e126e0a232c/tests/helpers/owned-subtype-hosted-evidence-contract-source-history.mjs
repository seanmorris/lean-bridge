/**
 * Reverse the owned Subtype hosted-evidence contract transition.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const ownedSubtypeHostedEvidenceContractHistoryPath
	= "docs/evidence/owned-subtype-hosted-evidence-contract-source-history-20261023.json";
export const ownedSubtypeHostedEvidenceContractPredecessor
	= "8a65d441a5bc74948fb72267dddaf0a338f7189f";
export const ownedSubtypeHostedEvidenceContractImplementation
	= "3f038f2f9476afb391cafbbf6bff085f6a742531";
export const ownedSubtypeHostedEvidenceContractHistoryParent
	= "3368bf94776b29ac7dbea180da69accd7b8a133f";
export const ownedSubtypeHostedEvidenceContractCommits = Object.freeze([
	"ae6add6c76e00db894a7282b3ef1ad5578cd4dcd"
	, "de60446dab30d1a53bb54cd5e566135b9acad86a"
	, ownedSubtypeHostedEvidenceContractImplementation
]);
export const ownedSubtypeHostedEvidenceContractHistoricalAdditions
	= Object.freeze([
		"scripts/check-owned-subtype-ci.mjs"
		, "tests/helpers/owned-subtype-hosted-ci.mjs"
		, "tests/helpers/owned-subtype-retained-packages.mjs"
		, "tests/owned-subtype-hosted-ci.test.mjs"
		, "tests/owned-subtype-retained-packages.test.mjs"
	]);
export const ownedSubtypeHostedEvidenceContractModifiedPaths = Object.freeze([
	".github/workflows/owned-subtype-languages.yml"
	, ".github/workflows/owned-subtype-native.yml"
	, ".github/workflows/owned-subtype-perl.yml"
	, ".github/workflows/owned-subtype-remaining.yml"
	, "tests/fixtures/structured-types/owned-perl-subtype.pl"
	, "tests/owned-subtype-language-packaging.test.mjs"
	, "tests/owned-subtype-native-packaging.test.mjs"
	, "tests/owned-subtype-perl-packaging.test.mjs"
	, "tests/owned-subtype-remaining-packaging.test.mjs"
]);
export const ownedSubtypeHostedEvidenceContractImplementationPaths
	= Object.freeze([
		...ownedSubtypeHostedEvidenceContractModifiedPaths
		, ...ownedSubtypeHostedEvidenceContractHistoricalAdditions
	]);
export const ownedSubtypeHostedEvidenceContractIntegrationPaths
	= Object.freeze([
		"tests/helpers/fin-refinement-source-history.mjs"
		, "tests/php-wasm-fin.test.mjs"
	]);
export const ownedSubtypeHostedEvidenceContractChangedPaths
	= Object.freeze([
		...ownedSubtypeHostedEvidenceContractModifiedPaths
		, ...ownedSubtypeHostedEvidenceContractIntegrationPaths
	]);
export const ownedSubtypeHostedEvidenceContractAddedPaths = Object.freeze([
	"scripts/update-owned-subtype-hosted-evidence-contract-source-history.mjs"
	, "tests/helpers/owned-subtype-hosted-evidence-contract-source-history-tests.mjs"
	, "tests/helpers/owned-subtype-hosted-evidence-contract-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	ownedSubtypeHostedEvidenceContractHistoryPath, "utf8"
));

/**
 * Restore one exact transition.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseOwnedSubtypeHostedEvidenceContractUpdate
	= (source, update) => {
		assert.ok(ownedSubtypeHostedEvidenceContractChangedPaths
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
 * Remove only the exact owned Subtype hosted-evidence contract change.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeOwnedSubtypeHostedEvidenceContractSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !ownedSubtypeHostedEvidenceContractChangedPaths.includes(path))
		return source;
	let digest = sha256(source);
	if(digest === expected) return source;
	const data = record();
	const integration = data.integrationUpdates.find(item =>
		item.path === path && item.currentSha256 === digest);
	if(integration)
	{
		source = reverseOwnedSubtypeHostedEvidenceContractUpdate(
			source, integration);
		digest = sha256(source);
		if(digest === expected) return source;
	}
	const historical = data.historicalUpdates.find(item =>
		item.path === path && item.currentSha256 === digest);
	return historical
		? reverseOwnedSubtypeHostedEvidenceContractUpdate(source, historical)
		: source;
};
