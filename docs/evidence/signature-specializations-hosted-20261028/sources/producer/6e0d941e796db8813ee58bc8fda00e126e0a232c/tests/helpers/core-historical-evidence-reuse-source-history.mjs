/**
 * Preserve the Core historical-evidence reuse repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const coreHistoricalEvidenceReuseHistoryPath
	= "docs/evidence/core-historical-evidence-reuse-source-history-20261027.json";
export const coreHistoricalEvidenceReusePredecessor
	= "55354cb90895682941dd37fd2988a614b1f6e799";
export const coreHistoricalEvidenceReuseImplementation
	= "667c7b7615e326e5cc016d8ea8e3c08445c28279";
export const coreHistoricalEvidenceReuseImplementationPaths = Object.freeze([
	"tests/callback-subtype-hosted-evidence.test.mjs"
	, "tests/helpers/callback-subtype-hosted-evidence-sources.mjs"
	, "tests/helpers/checked-record-host-ci-history-tests.mjs"
	, "tests/helpers/checked-record-perl-ci-history-tests.mjs"
	, "tests/helpers/checked-record-perl-history-tests.mjs"
	, "tests/helpers/checked-record-perl-installed-history-tests.mjs"
	, "tests/helpers/checked-record-python-history-tests.mjs"
	, "tests/helpers/checked-record-ruby-jvm-history-tests.mjs"
	, "tests/helpers/core-contract-evidence-tests.mjs"
	, "tests/helpers/core-php-structured-endpoint-tests.mjs"
	, "tests/helpers/fin-alias-closure-history-tests.mjs"
	, "tests/helpers/fin-container-edge-ci-history-tests.mjs"
	, "tests/helpers/fin-container-foreign-history-tests.mjs"
	, "tests/helpers/fin-core-repair-history-tests.mjs"
	, "tests/helpers/fin-dotnet-sdk-history-tests.mjs"
	, "tests/helpers/fin-jvm-diagnostics-history-tests.mjs"
	, "tests/helpers/fin-nominal-refusal-history-tests.mjs"
	, "tests/helpers/fin-record-zero-ci-history-tests.mjs"
	, "tests/helpers/maven-prerequisite-history-tests.mjs"
	, "tests/helpers/native-consumer-partition-history-tests.mjs"
	, "tests/helpers/native-fin-diagnostic-ci-tests.mjs"
	, "tests/helpers/native-fin-diagnostic-source-history-tests.mjs"
	, "tests/helpers/php-wasm-direct-fin-promotion-tests.mjs"
	, "tests/helpers/php-wasm-entry-ci-history-tests.mjs"
	, "tests/helpers/php-wasm-entry-harness-history-tests.mjs"
	, "tests/helpers/php-wasm-fin-direct-history-tests.mjs"
	, "tests/helpers/php-wasm-subtype-acceptance-history-tests.mjs"
	, "tests/helpers/php-wasm-subtype-entry-history-tests.mjs"
	, "tests/helpers/php-wasm-subtype-history-tests.mjs"
	, "tests/helpers/php-wasm-subtype-promotion-tests.mjs"
	, "tests/helpers/refinement-followup-history-tests.mjs"
	, "tests/helpers/reviewed-perl-diagnostic-history-tests.mjs"
	, "tests/helpers/reviewed-subtype-browser-ci-history-tests.mjs"
	, "tests/helpers/reviewed-subtype-browser-history-tests.mjs"
	, "tests/helpers/reviewed-subtype-host-ci-history-tests.mjs"
	, "tests/helpers/reviewed-subtype-host-ci-report-history-tests.mjs"
	, "tests/helpers/reviewed-subtype-host-history-tests.mjs"
	, "tests/helpers/reviewed-subtype-package-ci-history-tests.mjs"
	, "tests/helpers/reviewed-subtype-package-record-history-tests.mjs"
	, "tests/helpers/type-surface-historical-evidence.mjs"
]);
export const coreHistoricalEvidenceReuseIntegrationPaths = Object.freeze([
	"tests/helpers/core-historical-evidence-replay-source-history-tests.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const coreHistoricalEvidenceReuseHistoryAdditions = Object.freeze([
	"scripts/update-core-historical-evidence-reuse-source-history.mjs"
	, "tests/helpers/core-historical-evidence-reuse-source-history.mjs"
]);
export const coreHistoricalEvidenceReuseNormalizationPaths = Object.freeze([
	...coreHistoricalEvidenceReuseImplementationPaths
	, ...coreHistoricalEvidenceReuseIntegrationPaths
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	new URL(`../../${coreHistoricalEvidenceReuseHistoryPath}`, import.meta.url)
	, "utf8"
));

/**
 * Restore one exact, authenticated source transition.
 *
 * @param source - Complete current source.
 * @param update - Authenticated transition record.
 */
export const reverseCoreHistoricalEvidenceReuseUpdate = (source, update) => {
	assert.ok(coreHistoricalEvidenceReuseNormalizationPaths.includes(update.path));
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
			, edit.start + edit.current.length), edit.current, update.path);
		parts.push(source.slice(cursor, edit.start), edit.previous);
		cursor = edit.start + edit.current.length;
	}
	parts.push(source.slice(cursor));
	const previous = parts.join("");
	assert.equal(sha256(previous), update.previousSha256, update.path);
	return previous;
};

/**
 * Remove only the authenticated historical-evidence reuse layer.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact digest at which normalization stops.
 */
export const beforeCoreHistoricalEvidenceReuseSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !coreHistoricalEvidenceReuseNormalizationPaths.includes(path))
		return source;
	const updates = [...record().integrationUpdates, ...record().updates];
	let current = source;
	for(let count = 0; count < updates.length; ++count)
	{
		const digest = sha256(current);
		if(digest === expected) return current;
		const update = updates.find(item =>
			item.path === path && item.currentSha256 === digest);
		if(update === undefined) return current;
		current = reverseCoreHistoricalEvidenceReuseUpdate(current, update);
	}
	return current;
};
