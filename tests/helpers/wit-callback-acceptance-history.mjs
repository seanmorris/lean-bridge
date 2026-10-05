/**
 * Authenticate and reverse the direct-WIT callback acceptance transition.
 * Older receipts can then reconstruct the exact sources they authenticated.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeWitCallbackInstalledAcceptance } from "./wit-callback-installed-acceptance-history.mjs";

export const witCallbackAcceptanceHistoryPath
	= "docs/evidence/wit-callback-acceptance-source-history-20261003.json";
export const witCallbackAcceptanceHistorySha256 = "ddd60f2c08b31852bdb55ae1ce66be636397bd935d89048390e02a8385e58136";
export const witCallbackAcceptanceBaseline = "aa47eb152d9a283bfa5e3ea9e7eb1e8bd92bd67e";
export const witCallbackAcceptanceIntegration = "70e096168dac009e85cb376fbb0bf4e1287f8b25";
export const witCallbackAcceptanceLineage = Object.freeze([witCallbackAcceptanceIntegration]);
export const witCallbackAcceptancePrevious = Object.freeze({
	path: "docs/evidence/wit-callback-runtime-staging-source-history-20261003.json"
	, sha256: "549d27efb22d36d55249cbc01221cc441af367ef301ecdabeb3e71f6dc8b50b7"
});
export const witCallbackAcceptanceReceipt = Object.freeze({
	path: "docs/evidence/owned-wit-callback-results-20261003.json"
	, sha256: "b4d64c091761b8c929e855b0bb9df75c3a66bba6d150f95249aa757c67a05375"
});
export const witCallbackAcceptanceIntegrationModifiedPaths = Object.freeze([
	".github/workflows/consumer-matrix.yml", "docs/consume/wit-wasi.md"
	, "package.json"
]);
export const witCallbackAcceptanceReaderPaths = Object.freeze([
	"package.json"
	, "tests/helpers/owned-perl-callback-result-variant-acceptance.mjs"
	, "tests/helpers/owned-wit-callback-result-acceptance.mjs"
	, "tests/helpers/php-callback-acceptance-history.mjs"
	, "tests/helpers/php-callback-acceptance-history-tests.mjs"
].sort());
export const witCallbackAcceptanceIntroducedPaths = Object.freeze([
	"docs/evidence/owned-wit-callback-results-20261003.json"
	, "docs/evidence/owned-wit-callback-results-20261003.md"
	, "scripts/record-owned-wit-callback-results.mjs"
	, "tests/helpers/owned-wit-callback-result-acceptance-tests.mjs"
	, "tests/helpers/owned-wit-callback-result-acceptance.mjs"
	, "tests/wit-owned-callback-result-acceptance.test.mjs"
].sort());
const scope = Object.freeze({
	stage: "direct-wit-callback-acceptance", acceptanceReceipt: true
	, compiledLean: true, wasmtimeExecution: true, ciRequired: true
	, documentationPublished: true, producerRerun: false
	, installedPackage: false, registryPublication: false, supportPromotions: 0
});
const categories = Object.freeze({
	".github/workflows/consumer-matrix.yml": "administrative"
	, "docs/consume/wit-wasi.md": "documentation", "package.json": "administrative"
	, "tests/helpers/owned-wit-callback-result-acceptance.mjs": "reader"
	, "tests/helpers/owned-perl-callback-result-variant-acceptance.mjs": "reader"
	, "tests/helpers/php-callback-acceptance-history.mjs": "reader"
	, "tests/helpers/php-callback-acceptance-history-tests.mjs": "reader"
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
 * Validate the closed acceptance history independently from its outer hash.
 *
 * @param record - Candidate direct-WIT acceptance source history.
 */
export const assertWitCallbackAcceptanceHistory = record => {
	keys(record, "schemaVersion kind baselineRevision integrationRevision lineage previous completedReceipt scope updates readerUpdates introducedSources");
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.kind, "wit-callback-acceptance-source-history");
	assert.equal(record.baselineRevision, witCallbackAcceptanceBaseline);
	assert.equal(record.integrationRevision, witCallbackAcceptanceIntegration);
	assert.deepEqual(record.lineage, witCallbackAcceptanceLineage);
	assert.deepEqual(record.previous, witCallbackAcceptancePrevious);
	assert.deepEqual(record.completedReceipt, witCallbackAcceptanceReceipt);
	assert.deepEqual(record.scope, scope);
	assert.deepEqual(record.updates.map(update => update.path), witCallbackAcceptanceIntegrationModifiedPaths);
	assert.deepEqual(record.readerUpdates.map(update => update.path), witCallbackAcceptanceReaderPaths);
	for(const update of [...record.updates, ...record.readerUpdates])
	{
		keys(update, "path category currentSha256 previousSha256 strategy edits");
		assert.equal(update.category, categories[update.path]);
		digest(update.currentSha256); digest(update.previousSha256);
		assert.notEqual(update.currentSha256, update.previousSha256);
		assert.equal(update.strategy, "spans"); assert.equal(update.edits.length, 1);
		for(const edit of update.edits)
		{
			keys(edit, "start current previous");
			assert.ok(Number.isSafeInteger(edit.start) && edit.start >= 0);
			assert.equal(typeof edit.current, "string"); assert.equal(typeof edit.previous, "string");
			assert.notEqual(edit.current, edit.previous);
		}
	}
	assert.deepEqual(Object.keys(record.introducedSources), witCallbackAcceptanceIntroducedPaths);
	for(const [path, identity] of Object.entries(record.introducedSources))
	{
		keys(identity, "integrationSha256 currentSha256");
		digest(identity.integrationSha256); digest(identity.currentSha256);
		const update = record.readerUpdates.find(value => value.path === path);
		if(update)
		{
			assert.equal(identity.integrationSha256, update.previousSha256);
			assert.equal(identity.currentSha256, update.currentSha256);
		} else assert.equal(identity.integrationSha256, identity.currentSha256);
	}
};

/** Authenticate the ledger, previous staging record and completed receipt. */
export const readWitCallbackAcceptanceHistory = () => {
	if(!history)
	{
		const bytes = readFileSync(witCallbackAcceptanceHistoryPath);
		assert.equal(sha256(bytes), witCallbackAcceptanceHistorySha256);
		const record = JSON.parse(bytes); assertWitCallbackAcceptanceHistory(record);
		for(const predecessor of [record.previous, record.completedReceipt])
			assert.equal(sha256(readFileSync(predecessor.path)), predecessor.sha256);
		history = freeze(record);
	}
	return history;
};

/**
 * Reverse one exact registered acceptance update.
 *
 * @param source - Complete current source bytes or text.
 * @param update - Exact authenticated update to reverse.
 * @param category - Integration or successor-reader update collection.
 */
export const reverseWitCallbackAcceptanceUpdate = (source, update, category = "updates") => {
	assert.ok(["readerUpdates", "updates"].includes(category));
	const recorded = readWitCallbackAcceptanceHistory()[category].find(value => value.path === update.path);
	assert.ok(recorded, update.path); assert.deepEqual(update, recorded);
	assert.equal(sha256(source), update.currentSha256, update.path);
	const current = source.toString(), edit = update.edits[0];
	assert.equal(current.slice(edit.start, edit.start + edit.current.length), edit.current, update.path);
	const previous = current.slice(0, edit.start) + edit.previous
		+ current.slice(edit.start + edit.current.length);
	assert.equal(sha256(previous), update.previousSha256, update.path); return previous;
};

/**
 * Peel only this acceptance layer, newest reader changes first.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current, historical or unknown source.
 * @param expected - Optional exact stopping SHA-256.
 */
export const beforeWitCallbackAcceptance = (path, source, expected) => {
	source = beforeWitCallbackInstalledAcceptance(path, source, expected);
	for(const category of ["readerUpdates", "updates"])
	{
		const update = readWitCallbackAcceptanceHistory()[category].find(value => value.path === path);
		const current = sha256(source);
		if(update && current !== expected && current === update.currentSha256)
			source = reverseWitCallbackAcceptanceUpdate(source, update, category);
	}
	return source;
};
