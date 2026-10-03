/**
 * Authenticate and reverse the installed-WIT callback-result acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "../../src/capsule/node.mjs";

export const witCallbackInstalledHistoryPath
	= "docs/evidence/wit-callback-installed-acceptance-source-history-20261003.json";
export const witCallbackInstalledHistorySha256 = "394ccc991f9371c50d2bb9fb3c3a9ede83459acacaaebcb2d57888f0cc802c7f";
export const witCallbackInstalledBaseline = "b141c972c63db4adcde91d31c280a4317c24b9fc";
export const witCallbackInstalledIntegration = "739482ad9ea34202e4eeebf7a75fa6195724ac54";
export const witCallbackInstalledLineage = Object.freeze([
	"3c06ada4d719597316d28b3f57bb5dbaa8104116"
	, witCallbackInstalledIntegration
]);
export const witCallbackInstalledPrevious = Object.freeze({
	path: "docs/evidence/wit-callback-acceptance-source-history-20261003.json"
	, sha256: "ddd60f2c08b31852bdb55ae1ce66be636397bd935d89048390e02a8385e58136"
});
export const witCallbackInstalledReceipt = Object.freeze({
	path: "docs/evidence/owned-wit-callback-result-packages-20261003.json"
	, sha256: "7680bda297c53ddebc92a97563fd58a1306bc97b997ad4d265e3c159660905bd"
});
export const witCallbackInstalledModifiedPaths = Object.freeze([
	".github/workflows/consumer-matrix.yml"
	, "docs/consume/wit-wasi.md"
	, "docs/lean/existing-package.md"
	, "docs/lean/export-decisions.md"
	, "docs/publish/wit-wasi.md"
	, "package.json"
	, "src/analyze/export-configuration.mjs"
	, "src/backends/wit/copied-model.mjs"
	, "src/build/elaborated-component.mjs"
	, "src/build/multi-profile-project.mjs"
	, "src/build/native-c-projection.mjs"
	, "src/build/native-project.mjs"
	, "tests/helpers/wit-owned-callback-result-probe.mjs"
	, "tests/native-wit.test.mjs"
].sort());
export const witCallbackInstalledIntroducedPaths = Object.freeze([
	"docs/evidence/owned-wit-callback-result-packages-20261003.json"
	, "docs/evidence/owned-wit-callback-result-packages-20261003.md"
	, "scripts/record-owned-wit-callback-result-packages.mjs"
	, "tests/helpers/owned-wit-callback-result-installed-acceptance-tests.mjs"
	, "tests/helpers/owned-wit-callback-result-installed-acceptance.mjs"
	, "tests/wit-owned-callback-result-installed-acceptance.test.mjs"
	, "tests/wit-owned-callback-result-packaging.test.mjs"
].sort());
export const witCallbackInstalledReaderPaths = Object.freeze([
	"tests/helpers/owned-wit-callback-result-acceptance.mjs"
	, "tests/helpers/owned-wit-callback-result-installed-acceptance.mjs"
	, "tests/helpers/wit-callback-acceptance-history-tests.mjs"
	, "tests/helpers/wit-callback-acceptance-history.mjs"
	, "tests/helpers/wit-callback-runtime-staging-history-tests.mjs"
	, "tests/helpers/wit-callback-runtime-staging-history.mjs"
].sort());
const categories = Object.freeze({
	".github/workflows/consumer-matrix.yml": "administrative"
	, "docs/consume/wit-wasi.md": "documentation"
	, "docs/lean/existing-package.md": "documentation"
	, "docs/lean/export-decisions.md": "documentation"
	, "docs/publish/wit-wasi.md": "documentation"
	, "package.json": "administrative"
	, "src/analyze/export-configuration.mjs": "implementation"
	, "src/backends/wit/copied-model.mjs": "implementation"
	, "src/build/elaborated-component.mjs": "implementation"
	, "src/build/multi-profile-project.mjs": "implementation"
	, "src/build/native-c-projection.mjs": "implementation"
	, "src/build/native-project.mjs": "implementation"
	, "tests/helpers/wit-owned-callback-result-probe.mjs": "test"
	, "tests/native-wit.test.mjs": "test"
	, "tests/helpers/owned-wit-callback-result-acceptance.mjs": "reader"
	, "tests/helpers/owned-wit-callback-result-installed-acceptance.mjs": "reader"
	, "tests/helpers/wit-callback-acceptance-history-tests.mjs": "reader"
	, "tests/helpers/wit-callback-acceptance-history.mjs": "reader"
	, "tests/helpers/wit-callback-runtime-staging-history-tests.mjs": "reader"
	, "tests/helpers/wit-callback-runtime-staging-history.mjs": "reader"
});
const scope = Object.freeze({
	stage: "installed-wit-callback-result-acceptance"
	, acceptanceReceipt: true, compiledLean: true, actualWasmtime: true
	, sourceFreeConsumption: true, relocatedPublicReruns: true
	, dependencyTamperChecks: true, ciRequired: true
	, documentationPublished: true, registryPublication: false
	, phpWasmPromotion: false
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
 * Validate the closed installed-acceptance source transition.
 *
 * @param {object} record - Candidate authenticated history record.
 */
export const assertWitCallbackInstalledHistory = record => {
	keys(record, "schemaVersion kind baselineRevision integrationRevision lineage previous completedReceipt scope updates readerUpdates introducedSources");
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.kind, "wit-callback-installed-acceptance-source-history");
	assert.equal(record.baselineRevision, witCallbackInstalledBaseline);
	assert.equal(record.integrationRevision, witCallbackInstalledIntegration);
	assert.deepEqual(record.lineage, witCallbackInstalledLineage);
	assert.deepEqual(record.previous, witCallbackInstalledPrevious);
	assert.deepEqual(record.completedReceipt, witCallbackInstalledReceipt);
	assert.deepEqual(record.scope, scope);
	assert.deepEqual(record.updates.map(update => update.path), witCallbackInstalledModifiedPaths);
	assert.deepEqual(record.readerUpdates.map(update => update.path), witCallbackInstalledReaderPaths);
	for(const update of [...record.updates, ...record.readerUpdates])
	{
		keys(update, "path category currentSha256 previousSha256 strategy edits");
		assert.equal(update.category, categories[update.path]);
		digest(update.currentSha256); digest(update.previousSha256);
		assert.notEqual(update.currentSha256, update.previousSha256);
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
	assert.deepEqual(Object.keys(record.introducedSources), witCallbackInstalledIntroducedPaths);
	for(const [path, identity] of Object.entries(record.introducedSources))
	{
		keys(identity, "integrationSha256 currentSha256");
		digest(identity.integrationSha256); digest(identity.currentSha256);
		const reader = record.readerUpdates.find(update => update.path === path);
		if(reader)
		{
			assert.equal(identity.integrationSha256, reader.previousSha256);
			assert.equal(identity.currentSha256, reader.currentSha256);
		}
		else assert.equal(identity.integrationSha256, identity.currentSha256);
	}
};

/** Authenticate the ledger, prior history and completed installed receipt. */
export const readWitCallbackInstalledHistory = () => {
	if(!history)
	{
		const bytes = readFileSync(witCallbackInstalledHistoryPath);
		assert.equal(sha256(bytes), witCallbackInstalledHistorySha256);
		const record = JSON.parse(bytes); assertWitCallbackInstalledHistory(record);
		for(const predecessor of [record.previous, record.completedReceipt])
			assert.equal(sha256(readFileSync(predecessor.path)), predecessor.sha256);
		history = freeze(record);
	}
	return history;
};

/**
 * Reverse one exact registered installed-acceptance update.
 *
 * @param {string|Buffer} source - Complete current source bytes or text.
 * @param {object} update - Exact authenticated update to reverse.
 * @param {string} category - Integration or successor-reader collection.
 */
export const reverseWitCallbackInstalledUpdate = (source, update, category = "updates") => {
	assert.ok(["readerUpdates", "updates"].includes(category));
	const recorded = readWitCallbackInstalledHistory()[category].find(value => value.path === update.path);
	assert.ok(recorded, update.path); assert.deepEqual(update, recorded);
	assert.equal(sha256(source), update.currentSha256, update.path);
	const current = source.toString(), parts = []; let end = 0;
	for(const edit of update.edits)
	{
		assert.equal(current.slice(edit.start, edit.start + edit.current.length), edit.current, update.path);
		parts.push(current.slice(end, edit.start), edit.previous); end = edit.start + edit.current.length;
	}
	parts.push(current.slice(end)); const previous = parts.join("");
	assert.equal(sha256(previous), update.previousSha256, update.path); return previous;
};

/**
 * Peel the installed acceptance while preserving unknown successor bytes.
 *
 * @param {string} path - Repository-relative source path.
 * @param {string|Buffer} source - Complete current, historical or unknown source.
 * @param {string} [expected] - Optional stopping SHA-256.
 */
export const beforeWitCallbackInstalledAcceptance = (path, source, expected) => {
	for(const category of ["readerUpdates", "updates"])
	{
		const update = readWitCallbackInstalledHistory()[category].find(value => value.path === path);
		const current = sha256(source);
		if(update && current !== expected && current === update.currentSha256)
			source = reverseWitCallbackInstalledUpdate(source, update, category);
	}
	return source;
};
