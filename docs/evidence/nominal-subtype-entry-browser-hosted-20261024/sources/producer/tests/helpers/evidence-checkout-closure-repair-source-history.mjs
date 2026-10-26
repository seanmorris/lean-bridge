/**
 * Preserve the exact evidence-checkout and npm entry-probe repairs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const evidenceCheckoutClosureRepairHistoryPath
	= "docs/evidence/evidence-checkout-closure-repair-source-history-20261023.json";
export const evidenceCheckoutClosureRepairPredecessor
	= "bea28eba41d4caf7a27d65a2b50d1fd3ede5115e";
export const evidenceCheckoutClosureRepairImplementation
	= "f31a1afb2e502ae684387c43faf9bf10fb776bab";
export const evidenceCheckoutClosureRepairCommits = Object.freeze([
	"05e9200cadb55763be4b3094151cd121b0faf409"
	, evidenceCheckoutClosureRepairImplementation
]);
export const evidenceCheckoutClosureRepairModifiedPaths = Object.freeze([
	".gitignore"
	, "tests/helpers/nominal-subtype-entry-npm.mjs"
]);
export const evidenceCheckoutClosureRepairImplementationAdditions = Object.freeze([
	"docs/evidence/callback-checked-record-browser-20261023/hosted/output/callback-checked-record-browser-engine.log"
	, "docs/evidence/callback-checked-record-browser-20261023/hosted/output/callback-checked-record-browser-runtime.log"
	, "docs/evidence/callback-checked-record-dotnet-20261023/hosted/output/callback-checked-record-remaining-dotnet-toolchain.log"
	, "docs/evidence/callback-checked-record-jvm-20261023/hosted/output/callback-checked-record-remaining-jvm-toolchain.log"
	, "docs/evidence/callback-checked-record-languages-20261023/hosted/output/callback-checked-record-languages-toolchain.log"
	, "docs/evidence/callback-checked-record-native-20261023/hosted/output/callback-checked-record-native-toolchain.log"
	, "docs/evidence/callback-checked-record-php-native-20261023/hosted/output/callback-checked-record-remaining-php-native-toolchain.log"
	, "docs/evidence/callback-checked-record-wit-wasi-20261023/hosted/output/callback-checked-record-remaining-wit-wasi-toolchain.log"
	, "docs/evidence/callback-subtype-dotnet-20261022/hosted/output/callback-subtype-remaining-dotnet-toolchain.log"
	, "docs/evidence/callback-subtype-jvm-20261022/hosted/output/callback-subtype-remaining-jvm-toolchain.log"
	, "docs/evidence/callback-subtype-languages-20261022/hosted/output/callback-subtype-languages-toolchain.log"
	, "docs/evidence/callback-subtype-native-20261022/hosted/output/callback-subtype-native-toolchain.log"
	, "docs/evidence/callback-subtype-php-native-20261022/hosted/output/callback-subtype-remaining-php-native-toolchain.log"
	, "docs/evidence/callback-subtype-wit-wasi-20261022/hosted/output/callback-subtype-remaining-wit-wasi-toolchain.log"
	, "docs/evidence/generic-subtype-foundation-hosted-20261023/hosted/output/dependent-generic-subtype-toolchain.log"
	, "docs/evidence/generic-subtype-native-hosted-20261023/hosted/output/generic-subtype-native-toolchain.log"
	, "docs/evidence/generic-subtype-npm-ordinary-hosted-20261023/hosted/output/generic-subtype-engine-ordinary.log"
	, "docs/evidence/generic-subtype-npm-ordinary-hosted-20261023/hosted/output/generic-subtype-runtime-ordinary.log"
	, "docs/evidence/generic-subtype-npm-reviewed-hosted-20261023/hosted/output/generic-subtype-engine-reviewed.log"
	, "docs/evidence/generic-subtype-npm-reviewed-hosted-20261023/hosted/output/generic-subtype-runtime-reviewed.log"
	, "docs/evidence/generic-subtype-perl-hosted-20261023/hosted/output/generic-subtype-perl-toolchain.log"
	, "docs/evidence/generic-subtype-python-hosted-20261023/hosted/output/generic-subtype-python-toolchain.log"
	, "docs/evidence/generic-subtype-ruby-hosted-20261023/hosted/output/generic-subtype-ruby-toolchain.log"
	, "docs/evidence/generic-subtype-rust-hosted-20261023/hosted/output/generic-subtype-rust-toolchain.log"
	, "docs/evidence/owned-subtype-languages-hosted-20261023/hosted/output/owned-subtype-languages-ci/acceptance.log"
	, "docs/evidence/owned-subtype-languages-hosted-20261023/hosted/output/owned-subtype-languages-ci/toolchain.log"
	, "docs/evidence/owned-subtype-native-hosted-20261023/hosted/output/owned-subtype-native-ci/acceptance.log"
	, "docs/evidence/owned-subtype-native-hosted-20261023/hosted/output/owned-subtype-native-ci/toolchain.log"
	, "docs/evidence/owned-subtype-perl-hosted-20261023/hosted/output/owned-subtype-perl-ci/acceptance.log"
	, "docs/evidence/owned-subtype-perl-hosted-20261023/hosted/output/owned-subtype-perl-ci/toolchain.log"
	, "tests/type-surface-evidence-tracked.test.mjs"
]);
export const evidenceCheckoutClosureRepairImplementationPaths = Object.freeze([
	...evidenceCheckoutClosureRepairModifiedPaths
	, ...evidenceCheckoutClosureRepairImplementationAdditions
]);
export const evidenceCheckoutClosureRepairIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/type-surface-evidence-tracked.test.mjs"
]);
export const evidenceCheckoutClosureRepairNormalizationPaths = Object.freeze([
	...new Set([
		...evidenceCheckoutClosureRepairModifiedPaths
		, ...evidenceCheckoutClosureRepairIntegrationPaths
	])
]);
export const evidenceCheckoutClosureRepairAddedPaths = Object.freeze([
	"scripts/update-evidence-checkout-closure-repair-source-history.mjs"
	, "tests/helpers/evidence-checkout-closure-repair-source-history-tests.mjs"
	, "tests/helpers/evidence-checkout-closure-repair-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	evidenceCheckoutClosureRepairHistoryPath, "utf8"));

/**
 * Reverse one exact authenticated text transition.
 *
 * @param source - Complete current source text.
 * @param update - Recorded transition.
 */
export const reverseEvidenceCheckoutClosureRepairUpdate = (source, update) => {
	assert.ok(evidenceCheckoutClosureRepairNormalizationPaths.includes(update.path));
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
		assert.equal(source.slice(edit.start, edit.start + edit.current.length), edit.current);
		parts.push(source.slice(cursor, edit.start), edit.previous);
		cursor = edit.start + edit.current.length;
	}
	parts.push(source.slice(cursor));
	const previous = parts.join("");
	assert.equal(sha256(previous), update.previousSha256, update.path);
	return previous;
};

/**
 * Remove one authenticated repair transition.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source text.
 * @param expected - Optional stop digest owned by the central reader.
 */
export const beforeEvidenceCheckoutClosureRepairSource = (path, source, expected) => {
	void expected;
	if(typeof source !== "string"
		|| !evidenceCheckoutClosureRepairNormalizationPaths.includes(path)) return source;
	const digest = sha256(source);
	const update = [...record().integrationUpdates, ...record().updates]
		.find(item => item.path === path && item.currentSha256 === digest);
	return update === undefined ? source
		: reverseEvidenceCheckoutClosureRepairUpdate(source, update);
};
