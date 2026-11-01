/**
 * Preserve the sparse consumer-suite and JVM HostNull contract repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const consumerSuiteContractRepairHistoryPath
	= "docs/evidence/consumer-suite-contract-repair-source-history-20261101.json";
export const consumerSuiteContractRepairPredecessor
	= "5e3b5d5f57d3205b76a1f1452bffc9e9b4c11f6d";
export const consumerSuiteContractRepairImplementation
	= "07ee24a73db228ba99abbf9f64436fb37c50d306";
export const consumerSuiteContractRepairModifiedPaths = Object.freeze([
	"tests/fixtures/compound-consumers/java.java"
	, "tests/fixtures/compound-consumers/kotlin.kt"
	, "tests/helpers/jvm-compound-fixture.mjs"
	, "tests/helpers/reviewed-subtype-package-ci-workflow-tests.mjs"
	, "tests/helpers/reviewed-subtype-package-ci-workflow.mjs"
	, "tests/helpers/scalar-fin-source-entry-run-tests.mjs"
	, "tests/scalar-fin-rejection.test.mjs"
]);
export const consumerSuiteContractRepairImplementationAdditions
	= Object.freeze([
		"tests/helpers/scalar-fin-source-entry-registration-tests.mjs"
		, "tests/scalar-fin-source-entry.test.mjs"
	]);
export const consumerSuiteContractRepairImplementationPaths = Object.freeze([
	...consumerSuiteContractRepairModifiedPaths
	, ...consumerSuiteContractRepairImplementationAdditions
]);
export const consumerSuiteContractRepairIntegrationPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, "tests/checked-javascript-partition-11.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/jvm-source-history.mjs"
	, "tests/jvm-compound-contract.test.mjs"
]);
export const consumerSuiteContractRepairHistoryAdditions = Object.freeze([
	"scripts/update-consumer-suite-contract-repair-source-history.mjs"
	, "tests/helpers/consumer-suite-contract-repair-source-history-tests.mjs"
	, "tests/helpers/consumer-suite-contract-repair-source-history.mjs"
]);

const historyUrl = new URL(
	"../../" + consumerSuiteContractRepairHistoryPath, import.meta.url);
let history;
const record = () => history ??= JSON.parse(readFileSync(historyUrl, "utf8"));
export const consumerSuiteContractRepairNormalizationPaths
	= Object.freeze([...new Set([
		...(existsSync(historyUrl)
			? record().updates.map(update => update.path)
			: consumerSuiteContractRepairModifiedPaths)
		, ...(existsSync(historyUrl)
			? record().integrationUpdates.map(update => update.path) : [])
	])].sort());
const allowedPath = path => [
	...consumerSuiteContractRepairModifiedPaths
	, ...consumerSuiteContractRepairIntegrationPaths
].includes(path);

/**
 * Assert the two independent repairs without treating either as product support.
 *
 * @param sources - Implementation paths mapped to complete source text.
 */
export const assertConsumerSuiteContractRepair = sources => {
	for(const path of consumerSuiteContractRepairImplementationPaths)
		assert.equal(typeof sources[path], "string", path);
	const runtime = sources["tests/scalar-fin-rejection.test.mjs"];
	const retained = sources["tests/scalar-fin-source-entry.test.mjs"];
	for(const name of [
		"scalar-fin-source-entry-evidence-tests"
		, "scalar-fin-source-entry-integration-source-history-tests"
		, "scalar-fin-source-entry-run-tests"
		, "scalar-fin-source-entry-ci-source-history-tests"
	]) {
		assert.doesNotMatch(runtime, new RegExp(name, "u"));
		assert.match(retained, new RegExp(name, "u"));
	}
	assert.match(runtime, /scalar-fin-source-entry-tests[.]mjs/u);
	assert.match(sources[
		"tests/helpers/scalar-fin-source-entry-registration-tests.mjs"
	], /sparse Scalar Fin runtime acceptance and retained history/u);
	for(const [path, language] of [
		["tests/fixtures/compound-consumers/java.java", "java"]
		, ["tests/fixtures/compound-consumers/kotlin.kt", "kotlin"]
	]) {
		const source = sources[path];
		assert.match(source, /Option[.]some[^\n]*null[^\n]*(?:isSome|value)/u
			, language);
		assert.match(source, /Api[.]optionString\(Option[.]some\(null\)\)/u
			, language);
		assert.match(source, /Api[.]resultString\(Result[.]ok\(null\)\)/u
			, language);
		assert.match(source, /Api[.]tupleString\(.*null/u, language);
	}
	assert.match(sources["tests/helpers/jvm-compound-fixture.mjs"]
		, /Optional authenticated fixture source/u);
	assert.match(sources[
		"tests/helpers/reviewed-subtype-package-ci-workflow.mjs"
	], /const enforcedSubtype = enforced/u);
	assert.match(sources[
		"tests/helpers/scalar-fin-source-entry-run-tests.mjs"
	], /sourceAtFinHistoryRecord/u);
};

/**
 * Reverse one authenticated consumer-suite repair transition.
 *
 * @param source - Complete later source.
 * @param update - Authenticated reversible transition.
 */
export const reverseConsumerSuiteContractRepairUpdate = (source, update) => {
	assert.ok(allowedPath(update.path), update.path);
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
 * Remove only authenticated consumer-suite repair transitions.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping SHA-256.
 */
export const beforeConsumerSuiteContractRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !consumerSuiteContractRepairNormalizationPaths.includes(path))
		return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reverseConsumerSuiteContractRepairUpdate(current, update);
	}
	return current;
};
