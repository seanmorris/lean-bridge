/**
 * Authenticate the installed native-PHP callback package staging transition.
 * This ledger records evidence and bookkeeping only; it does not freeze support.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "../../src/capsule/node.mjs";

export const phpCallbackInstalledHistoryPath = "docs/evidence/php-callback-installed-staging-source-history-20261003.json";
export const phpCallbackInstalledHistorySha256 = "8712e0d0b0e5f4fe0d16db89eb4e6beeecc92550c4b7ba833b69d6290826c3b3";
export const phpCallbackInstalledBaseline = "fa51434d712136f38b6b0f88d9361494a32eda3a";
export const phpCallbackInstalledIntegration = "07959423074d1b5d82ebab6f6d810b3358304baa";
export const phpCallbackInstalledLineage = Object.freeze([
	"1e635cf05a418c6169fd8002f0976ee2608afaa4"
	, "07959423074d1b5d82ebab6f6d810b3358304baa"
]);
export const phpCallbackInstalledPrevious = Object.freeze({
	path: "docs/evidence/owned-perl-callback-result-variant-source-history-20261003.json"
	, sha256: "d17e1c3c522a1accfa7efc839ac3a9f7a0c46de7a7f7d2568ba9e0fb1dee824c"
});
export const phpCallbackInstalledCompletedPredecessor = Object.freeze({
	path: "docs/evidence/owned-perl-callback-result-variants-20261003.json"
	, sha256: "b40a1c36311c0327a2e407329f282aeab7a55718f326b5edaceea934f9bf3aaf"
});
export const phpCallbackInstalledIntroducedPaths = Object.freeze([
	"tests/fixtures/structured-types/owned-installed-php-callback-assets.php"
	, "tests/fixtures/structured-types/owned-installed-php-callback-observer.php"
	, "tests/helpers/owned-php-callback-result-composer.mjs"
	, "tests/helpers/owned-php-callback-result-execution.mjs"
	, "tests/helpers/owned-php-callback-result-installed.mjs"
	, "tests/helpers/owned-php-callback-result-package-evidence.mjs"
	, "tests/helpers/owned-php-callback-result-package-sources.mjs"
	, "tests/helpers/owned-php-callback-result-package-zip.mjs"
	, "tests/helpers/owned-php-callback-result-producer.mjs"
	, "tests/owned-php-callback-result-package-evidence.test.mjs"
	, "tests/owned-php-callback-result-packaging.test.mjs"
].sort());
export const phpCallbackInstalledAdministrativePaths = Object.freeze([
	"docs/type-surface.v1.json", "src/adoption/test-profiles.mjs"
]);
export const phpCallbackInstalledReaderPaths = Object.freeze([
	"tests/helpers/owned-perl-callback-result-history-tests.mjs"
	, "tests/helpers/owned-perl-callback-result-variant-acceptance.mjs"
	, "tests/helpers/owned-perl-callback-result-variant-history-tests.mjs"
	, "tests/helpers/owned-php-callback-result-package-evidence.mjs"
	, "tests/helpers/post-perl-callback-staging-history-tests.mjs"
	, "tests/helpers/post-perl-callback-staging-history.mjs"
	, "tests/helpers/wit-callback-runtime-staging-history-tests.mjs"
	, "tests/helpers/wit-package-source-history.mjs"
	, "tests/owned-jvm-callback-result-history.test.mjs"
	, "tests/owned-php-callback-result-package-evidence.test.mjs"
]);
const scope = Object.freeze({
	stage: "installed-package-evidence"
	, acceptanceReceipt: false
	, ciRequired: false
	, documentationPublished: false
	, producerRerun: false
	, registryPublication: false
	, supportPromotions: 0
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
 * Validate the closed staging record independently from its outer digest.
 *
 * @param record - Candidate closed staging record.
 */
export const assertPhpCallbackInstalledHistory = record => {
	keys(record, "schemaVersion kind baselineRevision integrationRevision lineage previous completedPredecessor scope updates introducedSources");
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.kind, "php-callback-installed-staging-source-history");
	assert.equal(record.baselineRevision, phpCallbackInstalledBaseline);
	assert.equal(record.integrationRevision, phpCallbackInstalledIntegration);
	assert.deepEqual(record.lineage, phpCallbackInstalledLineage);
	assert.deepEqual(record.previous, phpCallbackInstalledPrevious);
	assert.deepEqual(record.completedPredecessor, phpCallbackInstalledCompletedPredecessor);
	assert.deepEqual(record.scope, scope);
	assert.deepEqual(record.updates.map(update => update.path), [
		...phpCallbackInstalledAdministrativePaths, ...phpCallbackInstalledReaderPaths
	].sort());
	for(const update of record.updates)
	{
		const category = phpCallbackInstalledAdministrativePaths.includes(update.path) ? "administrative" : "reader";
		assert.equal(update.category, category); digest(update.currentSha256); digest(update.previousSha256);
		assert.notEqual(update.currentSha256, update.previousSha256);
		if(update.strategy === "registrations")
		{
			keys(update, "path category currentSha256 previousSha256 strategy addedTests");
			assert.equal(update.path, "src/adoption/test-profiles.mjs");
			assert.deepEqual(update.addedTests, [
				"owned-php-callback-result-package-evidence"
				, "owned-php-callback-result-packaging"
			]);
		} else if(update.strategy === "replace-all")
		{
			keys(update, "path category currentSha256 previousSha256 strategy edits");
			assert.equal(update.path, "docs/type-surface.v1.json"); assert.ok(update.edits.length > 0);
			assert.equal(new Set(update.edits.map(edit => edit.path)).size, update.edits.length);
			assert.equal(new Set(update.edits.map(edit => edit.current)).size, update.edits.length);
			for(const edit of update.edits)
			{
				keys(edit, "path current previous count"); assert.equal(typeof edit.path, "string");
				digest(edit.current); digest(edit.previous);
				assert.ok(Number.isSafeInteger(edit.count) && edit.count > 0);
			}
		} else
		{
			keys(update, "path category currentSha256 previousSha256 strategy edits");
			assert.equal(update.strategy, "spans"); assert.ok(update.edits.length > 0);
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
	assert.deepEqual(Object.keys(record.introducedSources), phpCallbackInstalledIntroducedPaths);
	for(const [path, identity] of Object.entries(record.introducedSources))
	{
		keys(identity, "integrationSha256 stagedSha256");
		digest(identity.integrationSha256); digest(identity.stagedSha256);
		const update = record.updates.find(value => value.path === path);
		if(update)
		{
			assert.equal(identity.integrationSha256, update.previousSha256);
			assert.equal(identity.stagedSha256, update.currentSha256);
		} else assert.equal(identity.integrationSha256, identity.stagedSha256);
	}
};

/** Authenticate the ledger and both immutable Perl predecessors. */
export const readPhpCallbackInstalledHistory = () => {
	if(!history)
	{
		const bytes = readFileSync(phpCallbackInstalledHistoryPath);
		assert.equal(sha256(bytes), phpCallbackInstalledHistorySha256);
		const record = JSON.parse(bytes); assertPhpCallbackInstalledHistory(record);
		for(const predecessor of [record.previous, record.completedPredecessor])
			assert.equal(sha256(readFileSync(predecessor.path)), predecessor.sha256);
		history = freeze(record);
	}
	return history;
};
export const phpCallbackInstalledChangedPaths = Object.freeze([
	...phpCallbackInstalledAdministrativePaths, ...phpCallbackInstalledReaderPaths
].sort());

/**
 * Reverse one exact registered staging update.
 *
 * @param source - Complete current source bytes or text.
 * @param update - Exact authenticated update to reverse.
 */
export const reversePhpCallbackInstalledUpdate = (source, update) => {
	const recorded = readPhpCallbackInstalledHistory().updates.find(value => value.path === update.path);
	assert.ok(recorded, update.path); assert.deepEqual(update, recorded);
	assert.equal(sha256(source), update.currentSha256, update.path);
	let previous = source.toString();
	if(update.strategy === "registrations")
	{
		for(const name of update.addedTests)
		{
			const line = `\t\t, "${name}"\n`; assert.equal(previous.split(line).length, 2);
			previous = previous.replace(line, "");
		}
	} else if(update.strategy === "replace-all")
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
 * Undo only this newest PHP staging layer and preserve unknown bytes verbatim.
 * Older history readers compose after this function.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current, historical or unknown source.
 * @param expected - Optional exact stopping identity.
 */
export const beforePhpCallbackInstalledStaging = (path, source, expected) => {
	const update = readPhpCallbackInstalledHistory().updates.find(value => value.path === path);
	const current = sha256(source);
	return update && current !== expected && current === update.currentSha256
		? reversePhpCallbackInstalledUpdate(source, update) : source;
};
