/**
 * Authenticate the bounded WIT runtime lineage, not installed or frozen support.
 * Later Perl inputs are recorded as excluded successors and never reversed here.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "../../src/capsule/node.mjs";

export const witCallbackRuntimeHistoryPath = "docs/evidence/wit-callback-runtime-staging-source-history-20261003.json";
export const witCallbackRuntimeHistorySha256 = "549d27efb22d36d55249cbc01221cc441af367ef301ecdabeb3e71f6dc8b50b7";
export const witCallbackRuntimeBaseline = "8345109d5066d0a95e917520eded18bcd574da85";
export const witCallbackRuntimeIntegration = "7d07f9b3555ad5f4211ddf36118bb16b0cf3693c";
export const witCallbackRuntimeLineage = Object.freeze([
	"c960596253f5b4c902820ba5ff2131aeb8bd5727"
	, "f5373170c853c43bda2088994ac6f4ae10e2f7a4"
	, "ef5e750a6e8c8cb009e37d55d767e1e045aa2e6a"
	, "e0d2c1ef096009c5b836c317b6f6a7b9dafea930"
]);
export const witCallbackRuntimePrevious = Object.freeze({
	path: "docs/evidence/post-perl-callback-staging-source-history-20261003.json"
	, sha256: "710955098bb7ee148093d5e7f9c266f27be334d642d6ad06d9020202825850f4"
});
export const witCallbackRuntimeSourcePaths = Object.freeze([
	"src/adoption/test-profiles.mjs", "src/build/multi-profile-project.mjs"
	, "src/build/native-project.mjs", "src/release/owned-wasi.mjs"
	, "tests/wit-owned-callback-results.test.mjs"
]);
export const witCallbackRuntimeIntroducedPaths = Object.freeze([
	"tests/fixtures/structured-types/owned-wit-callback-mixed.c"
	, "tests/helpers/wit-owned-callback-result-probe.mjs"
	, "tests/helpers/wit-owned-callback-result-runtime-evidence.mjs"
	, "tests/wit-owned-callback-result-runtime-evidence.test.mjs"
	, "tests/wit-owned-callback-result-runtime.test.mjs"
]);
export const witCallbackRuntimeReaderPaths = Object.freeze([
	"tests/copied-fixture-source-history.test.mjs"
	, "tests/helpers/copied-fixture-source-history.mjs"
	, "tests/helpers/owned-perl-callback-result-history-tests.mjs"
	, "tests/helpers/post-perl-callback-staging-history-tests.mjs"
	, "tests/helpers/post-perl-callback-staging-history.mjs"
	, "tests/owned-jvm-callback-result-history.test.mjs"
]);
export const witCallbackRuntimeSuccessorPaths = Object.freeze([
	".github/workflows/consumer-matrix.yml", "package.json"
	, "tests/helpers/owned-perl-callback-result-ci-tests.mjs"
	, "tests/helpers/owned-perl-callback-result-ci.mjs"
	, "tests/helpers/owned-perl-callback-result-package-evidence.mjs"
	, "tests/helpers/owned-perl-callback-result-variant-archives.mjs"
	, "tests/helpers/owned-perl-callback-result-variant-evidence-tests.mjs"
	, "tests/helpers/owned-perl-callback-result-variant-evidence.mjs"
]);
const keys = (value, names) => assert.deepEqual(Object.keys(value).sort(), names.split(" ").sort());
const digest = value => assert.match(value, /^[a-f0-9]{64}$/u);
const freeze = value => {
	if(value && typeof value === "object")
	{ Object.values(value).forEach(freeze); Object.freeze(value); }
	return value;
};
let history;

/**
 * Validate the closed stage shape independently from its outer file digest.
 *
 * @param record - Candidate ledger with separately categorized transitions.
 */
export const assertWitCallbackRuntimeHistory = record => {
	keys(record, "schemaVersion kind baselineRevision integrationRevision lineage previous updates readerUpdates introducedSources successorInputs");
	assert.equal(record.schemaVersion, 1); assert.equal(record.kind, "wit-callback-runtime-staging-source-history");
	assert.equal(record.baselineRevision, witCallbackRuntimeBaseline);
	assert.equal(record.integrationRevision, witCallbackRuntimeIntegration);
	assert.deepEqual(record.lineage, witCallbackRuntimeLineage);
	assert.deepEqual(record.previous, witCallbackRuntimePrevious);
	for(const [category, expected] of [["updates", witCallbackRuntimeSourcePaths], ["readerUpdates", witCallbackRuntimeReaderPaths]])
	{
		assert.deepEqual(record[category].map(update => update.path), expected);
		for(const update of record[category])
		{
			keys(update, "path currentSha256 previousSha256 strategy edits");
			digest(update.currentSha256); digest(update.previousSha256); assert.notEqual(update.currentSha256, update.previousSha256);
			assert.equal(update.strategy, "spans"); assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
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
	assert.deepEqual(Object.keys(record.introducedSources), witCallbackRuntimeIntroducedPaths);
	for(const identity of Object.values(record.introducedSources))
	{
		keys(identity, "currentSha256 integratedSha256"); digest(identity.currentSha256);
		assert.equal(identity.currentSha256, identity.integratedSha256);
	}
	assert.deepEqual(Object.keys(record.successorInputs), witCallbackRuntimeSuccessorPaths);
	for(const identity of Object.values(record.successorInputs))
	{ keys(identity, "sha256"); digest(identity.sha256); }
	const paths = [...record.updates, ...record.readerUpdates].map(update => update.path)
		.concat(Object.keys(record.introducedSources), Object.keys(record.successorInputs));
	assert.equal(new Set(paths).size, paths.length);
};

/** Authenticate both complete ledger bytes and the immutable previous stage. */
export const readWitCallbackRuntimeHistory = () => {
	if(!history)
	{
		const bytes = readFileSync(witCallbackRuntimeHistoryPath);
		assert.equal(sha256(bytes), witCallbackRuntimeHistorySha256);
		const record = JSON.parse(bytes); assertWitCallbackRuntimeHistory(record);
		assert.equal(sha256(readFileSync(record.previous.path)), record.previous.sha256);
		history = freeze(record);
	}
	return history;
};
export const witCallbackRuntimeChangedPaths = Object.freeze([
	...witCallbackRuntimeSourcePaths, ...witCallbackRuntimeReaderPaths
].sort());

/**
 * Reverse only a complete, registered transition with exact ordered spans.
 *
 * @param source - Complete source bytes or text.
 * @param update - Authenticated entry from the requested category.
 * @param category - Reader hooks precede the original WIT source updates.
 */
export const reverseWitCallbackRuntimeUpdate = (source, update, category = "updates") => {
	assert.ok(["readerUpdates", "updates"].includes(category));
	const recorded = readWitCallbackRuntimeHistory()[category].find(item => item.path === update.path);
	assert.ok(recorded, update.path); assert.deepEqual(update, recorded);
	assert.equal(sha256(source), update.currentSha256, update.path);
	const current = source.toString(), parts = []; let end = 0;
	for(const edit of update.edits)
	{
		assert.equal(current.slice(edit.start, edit.start + edit.current.length), edit.current, update.path);
		parts.push(current.slice(end, edit.start), edit.previous); end = edit.start + edit.current.length;
	}
	parts.push(current.slice(end)); const prior = parts.join("");
	assert.equal(sha256(prior), update.previousSha256, update.path); return prior;
};

/**
 * Reverse newest reader hooks, then WIT sources, preserving unknown successors.
 *
 * @param path - Registered repository-relative path.
 * @param source - Complete current, historical or unknown bytes.
 * @param expected - Optional exact stopping SHA-256.
 */
export const beforeWitCallbackRuntimeStaging = (path, source, expected) => {
	for(const category of ["readerUpdates", "updates"])
	{
		const update = readWitCallbackRuntimeHistory()[category].find(item => item.path === path);
		const digest = sha256(source);
		if(update && digest !== expected && digest === update.currentSha256)
			source = reverseWitCallbackRuntimeUpdate(source, update, category);
	}
	return source;
};
