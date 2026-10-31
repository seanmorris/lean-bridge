/**
 * Preserve the complete documentation sparse-input closure.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
	assertConsumerHistorySparseCheckoutClosure, consumerHistoryJobs
} from "./consumer-history-sparse-checkout-closure-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";

export const consumerDocumentationSparseInputClosureHistoryPath
	= "docs/evidence/consumer-documentation-sparse-input-closure-source-history-20261031.json";
export const consumerDocumentationSparseInputClosurePredecessor
	= "eaf2bbd0638527bb866a1e8e86490c0989221fe6";
export const consumerDocumentationSparseInputClosureImplementation
	= "a0c04f5dc52364fb34ecfa15164473ce077f2680";
export const consumerDocumentationSparseInputClosurePinRepair
	= "77ea3093cf4e6c0a174837cb94d0a1d710539895";
export const consumerDocumentationSparseInputClosureImplementationPaths
	= Object.freeze([".github/workflows/consumer-matrix.yml"]);
export const consumerDocumentationSparseInputClosurePinPaths
	= Object.freeze(["docs/type-surface.v1.json"]);
export const consumerDocumentationSparseInputClosureIntegrationPaths
	= Object.freeze([
		"tests/checked-javascript-partition-11.test.mjs"
		, "tests/helpers/consumer-type-surface-documentation-contract-repair-source-history-tests.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const consumerDocumentationSparseInputClosureAddedPaths = Object.freeze([
	"scripts/update-consumer-documentation-sparse-input-closure-source-history.mjs"
	, "tests/helpers/consumer-documentation-sparse-input-closure-source-history-tests.mjs"
	, "tests/helpers/consumer-documentation-sparse-input-closure-source-history.mjs"
]);
export const consumerDocumentationSparseInputClosureNormalizationPaths
	= Object.freeze([
		...consumerDocumentationSparseInputClosureImplementationPaths
		, ...consumerDocumentationSparseInputClosurePinPaths
		, ...consumerDocumentationSparseInputClosureIntegrationPaths
	]);
export const consumerDocumentationEvidenceRoots = Object.freeze([
	"checked-records-20261008"
	, "checked-record-perl-installed-20261011"
	, "checked-record-browser-20261011"
	, "checked-record-php-wasm-20261011"
	, "checked-record-python-hosts-20261010"
	, "checked-record-ruby-jvm-20261010"
	, "checked-record-remaining-hosts-20261010"
	, "native-fin-callbacks-20261008"
	, "browser-callback-fin-20261008"
	, "reviewed-callback-fin-20261008"
	, "reviewed-subtype-python-hosts-20261010"
	, "reviewed-subtype-ruby-jvm-hosts-20261010"
	, "reviewed-subtype-remaining-hosts-20261010"
	, "php-wasm-subtype-installed-20261010"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	consumerDocumentationSparseInputClosureHistoryPath, "utf8"));

/**
 * Assert that Documentation receives its exact authenticated type-surface
 * receipt and the retained text archives read directly by author guides.
 *
 * @param workflow - Complete workflow source.
 */
export const assertConsumerDocumentationSparseInputClosure = workflow => {
	assertConsumerHistorySparseCheckoutClosure(workflow);
	const documentation = consumerHistoryJobs(workflow).get("documentation");
	assert.match(documentation, /needs: type-surface-authentication/u);
	assert.equal(documentation.split("actions/download-artifact@v8").length - 1
		, 1);
	assert.match(documentation
		, /name: consumer-type-surface-\$\{\{ github[.]sha \}\}/u);
	assert.match(documentation
		, /LEAN_BRIDGE_TYPE_SURFACE_EVIDENCE_RECEIPT=\$GITHUB_WORKSPACE\/build\/consumer-type-surface\/receipt[.]json/u);
	const restore = documentation.indexOf(
		"Restore the authenticated type-surface receipt");
	const bind = documentation.indexOf(
		"Bind the authenticated type-surface receipt");
	const execute = documentation.indexOf(
		"Check documentation and the versioned support contract");
	assert.ok(restore > documentation.indexOf("actions/checkout@v6"));
	assert.ok(restore < bind && bind < execute);
	for(const root of consumerDocumentationEvidenceRoots)
	{
		const pattern = `/docs/evidence/${root}/`;
		assert.equal(workflow.split(pattern).length - 1, 1, root);
	}
};

/**
 * Reverse one exact documentation sparse-input transition.
 *
 * @param source - Complete later source.
 * @param update - Authenticated transition.
 */
export const reverseConsumerDocumentationSparseInputClosureUpdate
	= (source, update) => {
		assert.ok(consumerDocumentationSparseInputClosureNormalizationPaths
			.includes(update.path), update.path);
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
 * Remove only the documentation sparse-input closure transition.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeConsumerDocumentationSparseInputClosureSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !consumerDocumentationSparseInputClosureNormalizationPaths
			.includes(path)) return source;
	let current = source;
	for(const updates of [
		record().integrationUpdates, record().pinUpdates, record().updates
	]){
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reverseConsumerDocumentationSparseInputClosureUpdate(
				current, update);
	}
	return current;
};
