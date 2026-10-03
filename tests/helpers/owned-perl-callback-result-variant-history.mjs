/**
 * Close the optional Perl successor stage without rewriting earlier ledgers.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "../../src/capsule/node.mjs";

export const perlVariantHistoryPath = "docs/evidence/owned-perl-callback-result-variant-source-history-20261003.json";
export const perlVariantHistorySha256 = "d17e1c3c522a1accfa7efc839ac3a9f7a0c46de7a7f7d2568ba9e0fb1dee824c";
export const perlVariantBaseline = "461fe547921095b45cf7af3b11b702e48b18c9b7";
export const perlVariantIntegration = "7d07f9b3555ad5f4211ddf36118bb16b0cf3693c";
export const perlVariantSuccessorBaseline = "e5f7ae3dbc9ee8e85a5fd65a4fb68743aeccb0ed";
export const perlVariantPrevious = Object.freeze({
	path: "docs/evidence/wit-callback-runtime-staging-source-history-20261003.json"
	, sha256: "549d27efb22d36d55249cbc01221cc441af367ef301ecdabeb3e71f6dc8b50b7" });
export const perlVariantPredecessor = Object.freeze({
	path: "docs/evidence/owned-perl-callback-results-20261003.json"
	, sha256: "6844d0cfd72bea211625618e74a65a484bbab1a0d61573da45b05b107387eec7" });
export const perlVariantSuccessorPaths = Object.freeze([
	".github/workflows/consumer-matrix.yml", "package.json"
	, "tests/helpers/owned-perl-callback-result-ci-tests.mjs"
	, "tests/helpers/owned-perl-callback-result-ci.mjs"
	, "tests/helpers/owned-perl-callback-result-package-evidence.mjs"
]);
export const perlVariantIntroducedPaths = Object.freeze([
	"tests/helpers/owned-perl-callback-result-variant-archives.mjs"
	, "tests/helpers/owned-perl-callback-result-variant-evidence-tests.mjs"
	, "tests/helpers/owned-perl-callback-result-variant-evidence.mjs"
]);
export const perlVariantExtensionPaths = Object.freeze([
	"docs/consume/perl.md"
	, "docs/type-surface.v1.json"
	, "tests/helpers/copied-fixture-source-history.mjs"
	, "tests/helpers/owned-perl-callback-result-acceptance-tests.mjs"
	, "tests/helpers/owned-perl-callback-result-acceptance.mjs"
	, "tests/helpers/owned-perl-callback-result-ci.mjs"
	, "tests/helpers/owned-perl-callback-result-history-tests.mjs"
	, "tests/helpers/owned-perl-callback-result-variant-evidence-tests.mjs"
	, "tests/helpers/owned-perl-callback-result-variant-evidence.mjs"
	, "tests/helpers/post-perl-callback-staging-history-tests.mjs"
	, "tests/helpers/wit-callback-runtime-staging-history-tests.mjs"
	, "tests/helpers/wit-callback-runtime-staging-history.mjs"
	, "tests/owned-jvm-callback-result-history.test.mjs"
	, "tests/owned-perl-xs.test.mjs"
]);
export const perlVariantChangedPaths = Object.freeze([...new Set([
	...perlVariantSuccessorPaths, ...perlVariantExtensionPaths])].sort());
const keys = (value, names) => assert.deepEqual(Object.keys(value).sort(), names.split(" ").sort());
const digest = value => assert.match(value, /^[a-f0-9]{64}$/u);
const freeze = value => {
	if(value && typeof value === "object")
	{ Object.values(value).forEach(freeze); Object.freeze(value); }
	return value;
};
let history;

/**
 * Validate the closed stage independently from its outer digest.
 *
 * @param record - Candidate staged source ledger.
 */
export const assertPerlVariantHistory = record => {
	keys(record, "schemaVersion kind extensionBaselineRevision successorBaselineRevision successorIntegrationRevision lineage previous predecessor successorUpdates extensionUpdates introducedSources");
	assert.equal(record.schemaVersion, 1); assert.equal(record.kind, "owned-perl-callback-result-variant-source-history");
	assert.equal(record.extensionBaselineRevision, perlVariantBaseline);
	assert.equal(record.successorBaselineRevision, perlVariantSuccessorBaseline);
	assert.equal(record.successorIntegrationRevision, perlVariantIntegration);
	assert.deepEqual(record.lineage, ["bffb781a7a0926b93dcef46c2bc03efecab86cf3", perlVariantIntegration]);
	assert.deepEqual(record.previous, perlVariantPrevious); assert.deepEqual(record.predecessor, perlVariantPredecessor);
	for(const [category, paths] of [["successorUpdates", perlVariantSuccessorPaths], ["extensionUpdates", perlVariantExtensionPaths]])
	{
		assert.deepEqual(record[category].map(update => update.path), paths);
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
	assert.deepEqual(Object.keys(record.introducedSources), perlVariantIntroducedPaths);
	for(const value of Object.values(record.introducedSources))
	{ keys(value, "sha256"); digest(value.sha256); }
	for(const update of record.extensionUpdates)
	{
		const previous = record.successorUpdates.find(value => value.path === update.path)?.currentSha256
			?? record.introducedSources[update.path]?.sha256;
		if(previous) assert.equal(update.previousSha256, previous);
	}
};

/** Authenticate complete stage, WIT predecessor and original frozen Perl bytes. */
export const readPerlVariantHistory = () => {
	if(!history)
	{
		const bytes = readFileSync(perlVariantHistoryPath); assert.equal(sha256(bytes), perlVariantHistorySha256);
		const record = JSON.parse(bytes); assertPerlVariantHistory(record);
		for(const predecessor of [record.previous, record.predecessor]) assert.equal(sha256(readFileSync(predecessor.path)), predecessor.sha256);
		const earlier = JSON.parse(readFileSync(record.previous.path));
		assert.deepEqual(Object.keys(earlier.successorInputs), [...perlVariantSuccessorPaths, ...perlVariantIntroducedPaths]);
		for(const update of record.successorUpdates) assert.equal(update.currentSha256, earlier.successorInputs[update.path].sha256);
		for(const [path, value] of Object.entries(record.introducedSources)) assert.deepEqual(value, earlier.successorInputs[path]);
		history = freeze(record);
	}
	return history;
};

/**
 * Reverse one complete registered transition and reject every unknown edit.
 *
 * @param source - Complete source text or bytes.
 * @param update - Exact authenticated transition.
 * @param category - Successor or later extension transition category.
 */
export const reversePerlVariantUpdate = (source, update, category) => {
	assert.ok(["extensionUpdates", "successorUpdates"].includes(category));
	const registered = readPerlVariantHistory()[category].find(value => value.path === update.path);
	assert.ok(registered); assert.deepEqual(update, registered); assert.equal(sha256(source), update.currentSha256);
	const current = source.toString(), parts = []; let end = 0;
	for(const edit of update.edits)
	{
		assert.equal(current.slice(edit.start, edit.start + edit.current.length), edit.current);
		parts.push(current.slice(end, edit.start), edit.previous); end = edit.start + edit.current.length;
	}
	parts.push(current.slice(end)); const prior = parts.join("");
	assert.equal(sha256(prior), update.previousSha256); return prior;
};

/**
 * Reverse only this stage, latest first, preserving unknown and stopping bytes.
 * WIT and post-Perl readers compose after this function.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current, historical or unknown bytes.
 * @param expected - Optional exact stopping SHA-256.
 */
export const beforePerlCallbackVariants = (path, source, expected) => {
	for(const category of ["extensionUpdates", "successorUpdates"])
	{
		const update = readPerlVariantHistory()[category].find(value => value.path === path), digest = sha256(source);
		if(update && digest !== expected && digest === update.currentSha256) source = reversePerlVariantUpdate(source, update, category);
	}
	return source;
};
