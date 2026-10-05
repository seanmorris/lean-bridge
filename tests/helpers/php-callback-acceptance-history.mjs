/**
 * Authenticate and reverse the native-PHP callback acceptance transition.
 * This layer preserves the completed receipt while older readers reconstruct
 * the exact source identities they originally authenticated.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeWitCallbackAcceptance } from "./wit-callback-acceptance-history.mjs";

export const phpCallbackAcceptanceHistoryPath
	= "docs/evidence/php-callback-acceptance-source-history-20261003.json";
export const phpCallbackAcceptanceHistorySha256 = "fe21d122d4da27b2a9cd967a241e814a4cfa69c50e983e9c113780a4dd00ba70";
export const phpCallbackAcceptanceBaseline = "ad185d927673df87d1e40112ed9ccb41e299dfe3";
export const phpCallbackAcceptanceIntegration = "d463c2f89dbe154c17b59cc6063af597fe2e50a3";
export const phpCallbackAcceptanceLineage = Object.freeze([
	"53e3f8ef1d4ff4873c41aab4f7cf9f0302c5d42f"
	, phpCallbackAcceptanceIntegration
]);
export const phpCallbackAcceptancePrevious = Object.freeze({
	path: "docs/evidence/php-callback-installed-staging-source-history-20261003.json"
	, sha256: "8712e0d0b0e5f4fe0d16db89eb4e6beeecc92550c4b7ba833b69d6290826c3b3"
});
export const phpCallbackAcceptanceReceipt = Object.freeze({
	path: "docs/evidence/owned-php-callback-results-20261003.json"
	, sha256: "9812d99ae9b6d7d7b594fc33c9cbe32344600688fdc8d3d12eacc0e6c8449205"
});
export const phpCallbackAcceptanceIntegrationModifiedPaths = Object.freeze([
	".github/workflows/consumer-matrix.yml"
	, "docs/php.md"
	, "docs/type-surface.v1.json"
	, "package.json"
	, "src/adoption/test-profiles.mjs"
	, "tests/copied-fixture-source-history.test.mjs"
	, "tests/helpers/owned-php-callback-result-package-evidence.mjs"
].sort());
export const phpCallbackAcceptanceModifiedPaths = Object.freeze([
	...phpCallbackAcceptanceIntegrationModifiedPaths
	, "tests/helpers/owned-php-callback-result-acceptance.mjs"
	, "tests/helpers/owned-perl-callback-result-variant-acceptance.mjs"
	, "tests/helpers/php-callback-installed-staging-history.mjs"
	, "tests/helpers/php-callback-installed-staging-history-tests.mjs"
].sort());
export const phpCallbackAcceptanceReaderPaths = Object.freeze([
	".github/workflows/consumer-matrix.yml"
	, "docs/type-surface.v1.json"
	, "package.json"
	, "tests/helpers/owned-perl-callback-result-variant-acceptance.mjs"
	, "tests/helpers/owned-php-callback-result-acceptance.mjs"
	, "tests/helpers/php-callback-installed-staging-history.mjs"
	, "tests/helpers/php-callback-installed-staging-history-tests.mjs"
].sort());
export const phpCallbackAcceptanceIntroducedPaths = Object.freeze([
	"docs/evidence/owned-php-callback-results-20261003.json"
	, "docs/evidence/owned-php-callback-results-20261003.md"
	, "scripts/record-owned-php-callback-results.mjs"
	, "scripts/update-owned-php-callback-acceptance.mjs"
	, "tests/helpers/owned-php-callback-result-acceptance-tests.mjs"
	, "tests/helpers/owned-php-callback-result-acceptance.mjs"
	, "tests/owned-php-callback-result-acceptance.test.mjs"
].sort());
const scope = Object.freeze({
	stage: "native-php-callback-acceptance"
	, acceptanceReceipt: true
	, ciRequired: true
	, documentationPublished: true
	, producerRerun: true
	, registryPublication: false
	, supportPromotions: 0
});
const categories = Object.freeze({
	".github/workflows/consumer-matrix.yml": "administrative"
	, "docs/php.md": "documentation"
	, "docs/type-surface.v1.json": "administrative"
	, "package.json": "administrative"
	, "src/adoption/test-profiles.mjs": "administrative"
	, "tests/copied-fixture-source-history.test.mjs": "reader"
	, "tests/helpers/owned-perl-callback-result-variant-acceptance.mjs": "reader"
	, "tests/helpers/owned-php-callback-result-acceptance.mjs": "reader"
	, "tests/helpers/owned-php-callback-result-package-evidence.mjs": "reader"
	, "tests/helpers/php-callback-installed-staging-history.mjs": "reader"
	, "tests/helpers/php-callback-installed-staging-history-tests.mjs": "reader"
});
const keys = (value, names) => assert.deepEqual(Object.keys(value).sort(), names.split(" ").sort());
const digest = value => assert.match(value, /^[a-f0-9]{64}$/u);
const freeze = value => {
	if(value && typeof value === "object")
	{ Object.values(value).forEach(freeze); Object.freeze(value); }
	return value;
};
let history;

/**
 * Validate the closed acceptance history independently from its outer digest.
 *
 * @param record - Candidate native-PHP acceptance source history.
 */
export const assertPhpCallbackAcceptanceHistory = record => {
	keys(record, "schemaVersion kind baselineRevision integrationRevision lineage previous completedReceipt scope updates readerUpdates introducedSources");
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.kind, "php-callback-acceptance-source-history");
	assert.equal(record.baselineRevision, phpCallbackAcceptanceBaseline);
	assert.equal(record.integrationRevision, phpCallbackAcceptanceIntegration);
	assert.deepEqual(record.lineage, phpCallbackAcceptanceLineage);
	assert.deepEqual(record.previous, phpCallbackAcceptancePrevious);
	assert.deepEqual(record.completedReceipt, phpCallbackAcceptanceReceipt);
	assert.deepEqual(record.scope, scope);
	assert.deepEqual(record.updates.map(update => update.path), phpCallbackAcceptanceIntegrationModifiedPaths);
	assert.deepEqual(record.readerUpdates.map(update => update.path), phpCallbackAcceptanceReaderPaths);
	for(const update of [...record.updates, ...record.readerUpdates])
	{
		const expected = update.path === "docs/type-surface.v1.json" ? "source-hashes" : "spans";
		keys(update, "path category currentSha256 previousSha256 strategy edits");
		assert.equal(update.category, categories[update.path]);
		digest(update.currentSha256); digest(update.previousSha256);
		assert.notEqual(update.currentSha256, update.previousSha256);
		assert.equal(update.strategy, expected); assert.ok(update.edits.length > 0);
		if(update.strategy === "source-hashes")
		{
			assert.equal(new Set(update.edits.map(edit => edit.path)).size, update.edits.length);
			for(const edit of update.edits)
			{
				keys(edit, "path current previous count");
				assert.equal(typeof edit.path, "string"); digest(edit.current); digest(edit.previous);
				assert.notEqual(edit.current, edit.previous);
				assert.ok(Number.isSafeInteger(edit.count) && edit.count > 0);
			}
		} else
		{
			let end = 0;
			for(const edit of update.edits)
			{
				keys(edit, "start current previous");
				assert.ok(Number.isSafeInteger(edit.start) && edit.start >= end);
				assert.equal(typeof edit.current, "string"); assert.equal(typeof edit.previous, "string");
				assert.notEqual(edit.current, edit.previous); end = edit.start + edit.current.length;
			}
		}
	}
	assert.deepEqual(Object.keys(record.introducedSources), phpCallbackAcceptanceIntroducedPaths);
	for(const [path, identity] of Object.entries(record.introducedSources))
	{
		keys(identity, "integrationSha256 currentSha256");
		digest(identity.integrationSha256); digest(identity.currentSha256);
		const update = [...record.readerUpdates, ...record.updates].find(value => value.path === path);
		if(update)
		{
			assert.equal(identity.integrationSha256, update.previousSha256);
			assert.equal(identity.currentSha256, update.currentSha256);
		} else assert.equal(identity.integrationSha256, identity.currentSha256);
	}
};

/** Authenticate the ledger, its previous history, and the completed receipt. */
export const readPhpCallbackAcceptanceHistory = () => {
	if(!history)
	{
		const bytes = readFileSync(phpCallbackAcceptanceHistoryPath);
		assert.equal(sha256(bytes), phpCallbackAcceptanceHistorySha256);
		const record = JSON.parse(bytes); assertPhpCallbackAcceptanceHistory(record);
		for(const predecessor of [record.previous, record.completedReceipt])
			assert.equal(sha256(readFileSync(predecessor.path)), predecessor.sha256);
		history = freeze(record);
	}
	return history;
};

/**
 * Reverse one complete authenticated acceptance update.
 *
 * @param source - Complete current source bytes or text.
 * @param update - Exact authenticated update to reverse.
 * @param category - Integration or successor-reader update collection.
 */
export const reversePhpCallbackAcceptanceUpdate = (source, update, category = "updates") => {
	assert.ok(["readerUpdates", "updates"].includes(category));
	const recorded = readPhpCallbackAcceptanceHistory()[category].find(value => value.path === update.path);
	assert.ok(recorded, update.path); assert.deepEqual(update, recorded);
	assert.equal(sha256(source), update.currentSha256, update.path);
	let previous = source.toString();
	if(update.strategy === "source-hashes")
	{
		for(const edit of update.edits)
		{
			assert.equal(previous.split(edit.current).length - 1, edit.count);
			previous = previous.replaceAll(edit.current, edit.previous);
		}
	} else
	{
		const parts = []; let end = 0;
		for(const edit of update.edits)
		{
			assert.equal(previous.slice(edit.start, edit.start + edit.current.length), edit.current);
			parts.push(previous.slice(end, edit.start), edit.previous); end = edit.start + edit.current.length;
		}
		parts.push(previous.slice(end)); previous = parts.join("");
	}
	assert.equal(sha256(previous), update.previousSha256, update.path); return previous;
};

/**
 * Peel only this acceptance layer and preserve unknown or historical bytes.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current, historical or unknown source.
 * @param expected - Optional exact stopping SHA-256.
 */
export const beforePhpCallbackAcceptance = (path, source, expected) => {
	source = beforeWitCallbackAcceptance(path, source, expected);
	for(const category of ["readerUpdates", "updates"])
	{
		const update = readPhpCallbackAcceptanceHistory()[category].find(value => value.path === path);
		const current = sha256(source);
		if(update && current !== expected && current === update.currentSha256)
			source = reversePhpCallbackAcceptanceUpdate(source, update, category);
	}
	return source;
};
