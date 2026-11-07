/**
 * Authenticate the complete exact-cohort repair before its successor run.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const vo1220ExactCohortRepairHistoryPath
	= "docs/evidence/vo1220-exact-cohort-repair-source-history-20261107.json";
export const vo1220ExactCohortRepairPredecessor
	= "c02e32aa44fd91a6ffbb557f1f90a3f35ed745de";
export const vo1220ExactCohortRepairImplementation
	= "2ccebb96cc3701cccbd6b0c09437fd43e89baf00";
export const vo1220ExactCohortRepairImplementationPaths = Object.freeze([
	".github/workflows/callback-checked-record-remaining.yml"
	, ".github/workflows/consumer-matrix.yml"
	, ".github/workflows/reviewed-fin-wasm-entry.yml"
	, "scripts/README.md"
	, "src/adoption/test-profiles.mjs"
	, "src/build/component-callable-adapters.mjs"
	, "src/build/component-copied-adapters.mjs"
	, "src/build/component-record-adapters.mjs"
	, "src/build/component-recursive-adapters.mjs"
	, "src/build/component-refinements.mjs"
	, "src/build/component-scalar-adapters.mjs"
	, "src/build/component-structured-callable-adapters.mjs"
	, "tests/component-array-contract.test.mjs"
	, "tests/component-callable-contract.test.mjs"
	, "tests/component-compound-contract.test.mjs"
	, "tests/component-record-contract.test.mjs"
	, "tests/component-structured-callable-contract.test.mjs"
	, "tests/component-variant-contract.test.mjs"
	, "tests/dependent-fin-javascript.test.mjs"
	, "tests/docker-consumer-ci.test.mjs"
	, "tests/documentation.test.mjs"
	, "tests/fixtures/collection-consumers/jvm-equality.java"
	, "tests/fixtures/dependent-fin-consumers/javascript.mjs"
	, "tests/helpers/checked-record-value-index-wit-ci-workflow-tests.mjs"
	, "tests/helpers/component-nominal-subtype-tests.mjs"
	, "tests/helpers/consumer-nix-disk-budget-source-history-tests.mjs"
	, "tests/helpers/dependent-checked-record-wit-ci-workflow-tests.mjs"
	, "tests/helpers/dependent-fin-javascript-tests.mjs"
	, "tests/helpers/dependent-signature-foundation-tests.mjs"
	, "tests/helpers/fin-container-edge-ci.mjs"
	, "tests/helpers/inherited-checked-record-wit-ci-workflow-tests.mjs"
	, "tests/helpers/managed-ci-isolation-evidence.mjs"
	, "tests/helpers/nested-checked-record-wit-ci-workflow-tests.mjs"
	, "tests/helpers/nominal-primitive-subtype-wit-ci-workflow-tests.mjs"
	, "tests/helpers/nominal-subtype-browser-promotion-tests.mjs"
	, "tests/helpers/nominal-subtype-browser-promotion.mjs"
	, "tests/helpers/nominal-subtype-conversion-tests.mjs"
	, "tests/helpers/nominal-subtype-php-wasm-promotion-tests.mjs"
	, "tests/helpers/nominal-subtype-php-wasm-promotion.mjs"
	, "tests/helpers/nominal-subtype-wit-promotion-tests.mjs"
	, "tests/helpers/nominal-subtype-wit-promotion.mjs"
	, "tests/helpers/recursive-checked-record-wit-ci-workflow-tests.mjs"
	, "tests/helpers/structural-subtype-extractor-tests.mjs"
	, "tests/helpers/subtype-result-source-tests.mjs"
	, "tests/helpers/wasmtime-capi-bootstrap.mjs"
	, "tests/helpers/wasmtime-capi-rollout-tests.mjs"
	, "tests/helpers/wit-owned-transfer-ci.mjs"
	, "tests/helpers/zero-payload-checked-record-wit-ci-workflow-tests.mjs"
	, "tests/java-collection-evidence.test.mjs"
	, "tests/jvm-variant-evidence.test.mjs"
	, "tests/kotlin-collection-evidence.test.mjs"
	, "tests/managed-ci-isolation-evidence.test.mjs"
	, "tests/native-subtype.test.mjs"
	, "tests/nested-checked-records.test.mjs"
	, "tests/owned-perl-xs.test.mjs"
	, "tests/perl-scalar-promotion.test.mjs"
	, "tests/retained-contract-tests.test.mjs"
	, "tests/wit-owned-transfer-evidence.test.mjs"
	, "tests/word-contract.test.mjs"
]);
export const vo1220ExactCohortRepairImplementationAdditions = Object.freeze([
	"scripts/retry-lean-bootstrap-ci.sh"
	, "src/build/component-dependent-fin.mjs"
	, "tests/component-array-history-partition-01.test.mjs"
	, "tests/component-array-history-partition-02.test.mjs"
	, "tests/component-array-history-partition-03.test.mjs"
	, "tests/component-array-history-partition-04.test.mjs"
	, "tests/component-array-history-partition-05.test.mjs"
	, "tests/component-array-history-partition-06.test.mjs"
	, "tests/component-array-history-partition-07.test.mjs"
	, "tests/component-array-history-partition-08.test.mjs"
	, "tests/component-array-history-partition-09.test.mjs"
	, "tests/component-array-history-partition-10.test.mjs"
	, "tests/component-array-history-partition-11.test.mjs"
	, "tests/component-array-history-partition-12.test.mjs"
	, "tests/helpers/component-array-nested-fin-source-history-tests.mjs"
	, "tests/helpers/component-array-subtype-source-history-tests.mjs"
	, "tests/helpers/consumer-matrix-live-topology.mjs"
	, "tests/helpers/test-registration-owners.mjs"
	, "tests/nested-checked-record-history-partition-01.test.mjs"
	, "tests/nested-checked-record-history-partition-02.test.mjs"
	, "tests/nested-checked-record-history-partition-03.test.mjs"
	, "tests/nested-checked-record-history-partition-04.test.mjs"
	, "tests/nested-checked-record-history-partition-05.test.mjs"
	, "tests/nested-checked-record-history-partition-06.test.mjs"
	, "tests/nested-checked-record-history-partition-07.test.mjs"
	, "tests/nested-checked-record-history-partition-08.test.mjs"
	, "tests/nested-checked-record-history-partition-09.test.mjs"
	, "tests/nested-checked-record-history-partition-10.test.mjs"
	, "tests/nested-checked-record-history-partition-11.test.mjs"
	, "tests/nested-checked-record-history-partition-12.test.mjs"
]);
export const vo1220ExactCohortRepairIntegrationPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, "tests/checked-javascript-partition-12.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const vo1220ExactCohortRepairHistoryAdditions = Object.freeze([
	"scripts/update-vo1220-exact-cohort-repair-source-history.mjs"
	, "tests/helpers/vo1220-exact-cohort-repair-source-history-tests.mjs"
	, "tests/helpers/vo1220-exact-cohort-repair-source-history.mjs"
]);
export const vo1220ExactCohortRepairBehavior = Object.freeze({
	changedSupportCells: 0, runtimeSemanticChanges: 1
	, implementationPaths: 59, implementationAdditions: 30
	, currentSourcePaths: 32, refreshedPins: 450
	, preservedCoreRoots: 1096, addedCorePartitionRoots: 24
});

const historyUrl = new URL("../../" + vo1220ExactCohortRepairHistoryPath
	, import.meta.url);
let history;
const record = () => history ??= JSON.parse(readFileSync(historyUrl, "utf8"));
export const vo1220ExactCohortRepairNormalizationPaths
	= Object.freeze([...new Set([
		...(existsSync(historyUrl) ? record().updates.map(update => update.path)
			: vo1220ExactCohortRepairImplementationPaths)
		, ...(existsSync(historyUrl)
			? record().integrationUpdates.map(update => update.path)
			: vo1220ExactCohortRepairIntegrationPaths)
	])].sort());

/**
 * Require the substantive boundaries of the complete exact-cohort repair.
 *
 * @param sources - Exact implementation source by repository path.
 */
export const assertVo1220ExactCohortRepair = sources => {
	for(const path of vo1220ExactCohortRepairImplementationPaths)
		assert.equal(typeof sources[path], "string", path);
	const workflow = sources[".github/workflows/consumer-matrix.yml"];
	assert.equal(workflow.split(
		"bash scripts/retry-lean-bootstrap-ci.sh nix build .#universal-core-artifacts"
	).length - 1, 2);
	assert.match(workflow, /rg '\^# pass 6\$' build\/wit-owned-transfers[.]log/u);
	assert.match(workflow, /^ {2}wasi-qualifications:$/mu);
	const profiles = sources["src/adoption/test-profiles.mjs"];
	for(const family of ["component-array-history", "nested-checked-record-history"])
		for(let index = 1; index <= 12; index++)
			assert.match(profiles, new RegExp(`"${family}-partition-${String(index).padStart(2, "0")}"`, "u"));
	for(const path of [
		"src/build/component-callable-adapters.mjs"
		, "src/build/component-copied-adapters.mjs"
		, "src/build/component-record-adapters.mjs"
		, "src/build/component-recursive-adapters.mjs"
		, "src/build/component-scalar-adapters.mjs"
		, "src/build/component-structured-callable-adapters.mjs"
	]) assert.match(sources[path], /componentDependentFinGuard/u, path);
	assert.doesNotMatch(sources["tests/component-array-contract.test.mjs"]
		, /^import "[.]\/helpers\/[^"\r\n]+-tests[.]mjs";$/mu);
	assert.doesNotMatch(sources["tests/nested-checked-records.test.mjs"]
		, /^import "[.]\/helpers\/[^"\r\n]+-tests[.]mjs";$/mu);
	for(const path of [
		"tests/java-collection-evidence.test.mjs"
		, "tests/jvm-variant-evidence.test.mjs"
		, "tests/kotlin-collection-evidence.test.mjs"
	]) assert.match(sources[path], /moduleAtProducer/u, path);
	return { ...vo1220ExactCohortRepairBehavior };
};

/**
 * Reverse one authenticated exact-cohort transition.
 *
 * @param source - Exact later source.
 * @param update - Recorded transition for the same path.
 */
export const reverseVo1220ExactCohortRepairUpdate = (source, update) => {
	assert.ok(vo1220ExactCohortRepairNormalizationPaths.includes(update.path));
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
 * Remove only the exact-cohort repair and its integration.
 *
 * @param path - Repository-relative path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping digest.
 */
export const beforeVo1220ExactCohortRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !vo1220ExactCohortRepairNormalizationPaths.includes(path))
		return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reverseVo1220ExactCohortRepairUpdate(current, update);
	}
	return current;
};

