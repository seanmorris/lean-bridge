/**
 * Authenticate the complete post-reader candidate repair before final CI.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const candidateAcceptanceRepairHistoryPath
	= "docs/evidence/candidate-acceptance-repair-source-history-20261107.json";
export const candidateAcceptanceRepairPredecessor
	= "ec456c06a98e32e73b85b96ce06c829e26f51e51";
export const candidateAcceptanceRepairImplementation
	= "c3cf955c16549cc407f8ad7f0ebe2a250730b61e";
export const candidateAcceptanceRepairImplementationPaths = Object.freeze([
	".github/workflows/consumer-matrix.yml"
	, "src/build/component-copied-adapters.mjs"
	, "tests/closed-generic-checked-record-source-history.test.mjs"
	, "tests/documentation.test.mjs"
	, "tests/fin-container-entry-ci.test.mjs"
	, "tests/fixtures/collection-consumers/java.java"
	, "tests/fixtures/variant-consumers/java.java"
	, "tests/fixtures/variant-consumers/kotlin.kt"
	, "tests/helpers/checked-record-value-index-perl-promotion-source-history-tests.mjs"
	, "tests/helpers/checked-record-value-index-php-promotion-source-history-tests.mjs"
	, "tests/helpers/fin-container-entry-ci.mjs"
	, "tests/helpers/managed-ci-isolation.mjs"
	, "tests/helpers/nominal-primitive-subtype-fixture-tests.mjs"
	, "tests/helpers/nominal-subtype-dotnet-ci-workflow-tests.mjs"
	, "tests/helpers/nominal-subtype-dotnet-ci-workflow.mjs"
	, "tests/helpers/nominal-subtype-jvm-ci-workflow-tests.mjs"
	, "tests/helpers/nominal-subtype-jvm-ci-workflow.mjs"
	, "tests/helpers/nominal-subtype-perl-promotion-tests.mjs"
	, "tests/helpers/nominal-subtype-perl-promotion.mjs"
	, "tests/helpers/nominal-subtype-php-promotion-tests.mjs"
	, "tests/helpers/nominal-subtype-php-promotion.mjs"
	, "tests/helpers/nominal-subtype-ruby-ci-workflow-tests.mjs"
	, "tests/helpers/nominal-subtype-ruby-ci-workflow.mjs"
	, "tests/helpers/nominal-subtype-ruby-promotion-tests.mjs"
	, "tests/helpers/nominal-subtype-ruby-promotion.mjs"
	, "tests/helpers/nominal-subtype-wit-ci-workflow-tests.mjs"
	, "tests/helpers/nominal-subtype-wit-ci-workflow.mjs"
	, "tests/helpers/owned-checked-record-published-matrix-tests.mjs"
	, "tests/helpers/owned-perl-callback-result-history-tests.mjs"
	, "tests/helpers/source-at-fin-history-milestone.mjs"
	, "tests/helpers/structural-subtype-php-evidence-tests.mjs"
	, "tests/helpers/structural-subtype-php-wasm-evidence-tests.mjs"
	, "tests/helpers/wit-owned-package-evidence.mjs"
	, "tests/jvm-kotlin-contract.test.mjs"
	, "tests/managed-ci-isolation.test.mjs"
	, "tests/native-fin-callbacks.test.mjs"
	, "tests/owned-jvm-receiver-evidence.test.mjs"
	, "tests/owned-rust-receiver-evidence.test.mjs"
	, "tests/retained-contract-tests.test.mjs"
	, "tests/wit-owned-native-evidence.test.mjs"
	, "tests/wit-owned-package-evidence.test.mjs"
	, "tests/wit-owned-session-evidence.test.mjs"
	, "tests/word-contract.test.mjs"
]);
export const candidateAcceptanceRepairIntegrationPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, "tests/checked-javascript-partition-12.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const candidateAcceptanceRepairHistoryAdditions = Object.freeze([
	"scripts/update-candidate-acceptance-repair-source-history.mjs"
	, "tests/helpers/candidate-acceptance-repair-source-history-tests.mjs"
	, "tests/helpers/candidate-acceptance-repair-source-history.mjs"
]);
export const candidateAcceptanceRepairBehavior = Object.freeze({
	changedSupportCells: 0
	, runtimeSemanticChanges: 1
	, implementationPaths: 43
	, currentSourcePaths: 14
	, refreshedPins: 165
});

const historyUrl = new URL("../../" + candidateAcceptanceRepairHistoryPath
	, import.meta.url);
let history;
const record = () => history ??= JSON.parse(readFileSync(historyUrl, "utf8"));
export const candidateAcceptanceRepairNormalizationPaths
	= Object.freeze([...new Set([
		...(existsSync(historyUrl) ? record().updates.map(update => update.path)
			: candidateAcceptanceRepairImplementationPaths)
		, ...(existsSync(historyUrl) ? record().integrationUpdates.map(update => update.path)
			: candidateAcceptanceRepairIntegrationPaths)
	])].sort());

/**
 * Require the substantive boundaries of the complete candidate repair.
 *
 * @param sources - Exact implementation source by repository path.
 */
export const assertCandidateAcceptanceRepair = sources => {
	for(const path of candidateAcceptanceRepairImplementationPaths)
		assert.equal(typeof sources[path], "string", path);
	const workflow = sources[".github/workflows/consumer-matrix.yml"];
	for(const job of ["wasi-consumer", "wasi-qualifications"
		, "wasi-consumer-finalize"])
		assert.match(workflow, new RegExp(`^ {2}${job}:$`, "mu"), job);
	assert.match(workflow, /^ {2}managed-consumers:\n[\s\S]*?^ {4}timeout-minutes: 360$/mu);
	assert.match(workflow, /run 42344727501\/job 128323854052/u);
	const copied = sources["src/build/component-copied-adapters.mjs"];
	assert.equal(copied.split('refinement.kind !== "fin-parameter"').length - 1, 2);
	for(const path of ["tests/owned-jvm-receiver-evidence.test.mjs"
		, "tests/owned-rust-receiver-evidence.test.mjs"]){
		assert.match(sources[path], /UnownedInventory/u, path);
		assert.match(sources[path]
			, /0de30b1254976b9a588bcff7d677802ee09c4368685de494f1996843ff1c7323/u
			, path);
		}
	for(const path of ["tests/fixtures/collection-consumers/java.java"
		, "tests/fixtures/variant-consumers/java.java"])
		assert.match(sources[path]
			, /catch \(java\.lang\.reflect\.InvocationTargetException error\)/u, path);
	assert.match(sources["tests/fixtures/variant-consumers/kotlin.kt"]
		, /throw error\.targetException/u);
	assert.match(sources["tests/jvm-kotlin-contract.test.mjs"]
		, /surface copied-record constructor null refusals/u);
	return { ...candidateAcceptanceRepairBehavior };
};

/**
 * Reverse one authenticated source transition.
 *
 * @param source - Exact later source.
 * @param update - Recorded transition for the same path.
 */
export const reverseCandidateAcceptanceRepairUpdate = (source, update) => {
	assert.ok(candidateAcceptanceRepairNormalizationPaths.includes(update.path));
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
 * Remove only this complete candidate repair and its integration.
 *
 * @param path - Repository-relative path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping digest.
 */
export const beforeCandidateAcceptanceRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !candidateAcceptanceRepairNormalizationPaths.includes(path))
		return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reverseCandidateAcceptanceRepairUpdate(current, update);
	}
	return current;
};
