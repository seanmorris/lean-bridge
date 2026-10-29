/**
 * Preserve every source state of the native PHP and PHP-Wasm HostNull rollout.
 * The partition-11 transitions are authenticated by the dedicated gap layer.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const hostNullPhpHistoryPath
	= "docs/evidence/host-null-php-source-history-20261029.json";
export const hostNullPhpPredecessor
	= "1d13d30f174d0f4750061cd601a6aebde3f3d69b";
export const hostNullPhpImplementation
	= "e5827ccbdb36fbb940accb9c104090dc025f9e6b";
export const hostNullPhpCommits = Object.freeze([
	"fbcaebecd909439a524a01f4860ae81e14e53492"
	, "d215a3700a02de89a139b7ef4243c2b191367c34"
	, "68c4b2df7ad24c07b4c63e1a77159844f4af6a78"
	, "e73fa98668aa0bbee1e9b3621263186dd50304a6"
	, "acbedcb054c2afc41e821c9af0d7c16a88eebd8b"
	, "bc7032f1731dfbe63f85ad38bb5324328a0ac43b"
	, "c890fa905a7aaf795134621597ce02b3a51bf61e"
	, "806b4c3a3aeac87d8cf85c4cea3f6aac395d071c"
	, "e17f838f52a38c8d31dff55335a26a6b55148671"
	, "98275900c5a0796945611124152911c6fd83f9da"
	, hostNullPhpImplementation
]);
export const hostNullPhpChangedPaths = Object.freeze([
	".github/workflows/consumer-matrix.yml"
	, "docs/lean/existing-package.md"
	, "docs/lean/export-decisions.md"
	, "docs/php.md"
	, "src/adoption/type-surface.mjs"
	, "src/backends/c/generate.mjs"
	, "src/backends/c/native-copied-values.mjs"
	, "src/backends/c/primitive-surface.mjs"
	, "src/backends/php/copied-conversions.mjs"
	, "src/backends/php/copied-model.mjs"
	, "src/backends/php/copied-values.mjs"
	, "src/backends/php/copied-zend-conversions.mjs"
	, "src/backends/php/copied-zend.mjs"
	, "src/build/native-model.mjs"
	, "tests/dependent-checked-record-promotion.test.mjs"
	, "tests/fixtures/host-null-consumers/npm.mjs"
	, "tests/fixtures/onboarding/host-null/HostNullDemo.lean"
	, "tests/helpers/host-null-fixture.mjs"
	, "tests/host-null-npm-installed.test.mjs"
	, "tests/reviewed-host-null.test.mjs"
]);
export const hostNullPhpExternalHistoryPaths = Object.freeze([
	"tests/checked-javascript-partition-11.test.mjs"
]);
export const hostNullPhpImplementationAddedPaths = Object.freeze([
	"scripts/archive-host-null-javascript-browser-evidence.mjs"
	, "scripts/archive-host-null-php-evidence.mjs"
	, "scripts/check-host-null-php-reports.mjs"
	, "scripts/promote-host-null-javascript.mjs"
	, "scripts/promote-host-null-php.mjs"
	, "tests/fixtures/host-null-consumers/php.php"
	, "tests/helpers/host-null-javascript-browser-evidence.mjs"
	, "tests/helpers/host-null-javascript-hosted-evidence-sources.mjs"
	, "tests/helpers/host-null-javascript-hosted-report.mjs"
	, "tests/helpers/host-null-javascript-promotion-tests.mjs"
	, "tests/helpers/host-null-javascript-promotion.mjs"
	, "tests/helpers/host-null-php-evidence.mjs"
	, "tests/helpers/host-null-php-hosted-evidence-sources.mjs"
	, "tests/helpers/host-null-php-hosted-policy.mjs"
	, "tests/helpers/host-null-php-promotion-tests.mjs"
	, "tests/helpers/host-null-php-promotion.mjs"
	, "tests/helpers/host-null-php-report-tests.mjs"
	, "tests/helpers/host-null-php-report.mjs"
	, "tests/helpers/php-host-null-fixture.mjs"
	, "tests/host-null-documentation.test.mjs"
	, "tests/host-null-javascript-hosted-report.test.mjs"
	, "tests/php-host-null-contract.test.mjs"
	, "tests/php-host-null.test.mjs"
	, "tests/php-wasm-host-null.test.mjs"
]);
export const hostNullPhpTransitionPaths = Object.freeze([
	...hostNullPhpChangedPaths
	, "tests/helpers/host-null-javascript-hosted-evidence-sources.mjs"
	, "tests/helpers/host-null-php-evidence.mjs"
	, "tests/helpers/host-null-php-hosted-evidence-sources.mjs"
	, "tests/helpers/host-null-php-promotion.mjs"
	, "tests/php-host-null-contract.test.mjs"
	, "tests/php-host-null.test.mjs"
	, "tests/php-wasm-host-null.test.mjs"
]);
export const hostNullPhpIntegrationPaths = Object.freeze([
	"tests/checked-javascript-partition-11.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const hostNullPhpHistoryAddedPaths = Object.freeze([
	"scripts/update-host-null-php-source-history.mjs"
	, "tests/helpers/host-null-php-source-history-tests.mjs"
	, "tests/helpers/host-null-php-source-history.mjs"
]);
export const hostNullPhpAddedPaths = Object.freeze([
	...hostNullPhpImplementationAddedPaths
	, ...hostNullPhpHistoryAddedPaths
]);
export const hostNullPhpNormalizationPaths = Object.freeze([
	...hostNullPhpTransitionPaths
	, ...hostNullPhpIntegrationPaths
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(hostNullPhpHistoryPath, "utf8"));
const normalizationPaths = new Set(hostNullPhpNormalizationPaths);

/**
 * Restore one exact PHP HostNull transition.
 *
 * @param source - Complete current source.
 * @param update - Authenticated transition record.
 */
export const reverseHostNullPhpUpdate = (source, update) => {
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
		current = reverseHostNullPhpUpdate(current, update);
	}
};

/**
 * Restore only this layer's newest-first registration edits.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping digest.
 */
export const beforeHostNullPhpIntegrationSource = (path, source, expected) =>
	reverseSet(path, source, expected, record().integrationUpdates);

/**
 * Restore all PHP HostNull implementation milestones except partition 11.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping digest.
 */
export const beforeHostNullPhpSource = (path, source, expected) =>
	reverseSet(path, source, expected, record().updates);
