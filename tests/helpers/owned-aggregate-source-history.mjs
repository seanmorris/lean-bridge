/**
 * Preserve exact installed predecessors while staging private owned transport.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "../../src/capsule/node.mjs";

export const ownedAggregateBaseline = "262240dd6bc01aefcb6eae587cc7425aa2218b8c";
export const ownedAggregateHistoryPath = "docs/evidence/owned-aggregate-integration-20260926.json";
export const ownedAggregateExecutionPath = "docs/evidence/owned-aggregate-execution-20260926.json";
export const ownedAggregateChangedPaths = [
	".github/workflows/consumer-matrix.yml", ".github/workflows/perl-consumer.yml"
	, "config/checked-javascript.json", "config/cli-package.v1.json"
	, "docs/architecture/binding-ir.md", "docs/type-surface.v1.json"
	, "nix/component-engine-source-boundary.json"
	, "nix/perl-engine-source-boundary.json", "package.json"
	, "schema/lean-export-configuration.schema.json"
	, "schema/native-metadata-type.schema.json", "src/abi/README.md"
	, "src/adoption/test-profiles.mjs", "src/analyze/NativeExports.lean"
	, "src/analyze/README.md", "src/analyze/elaborated-metadata.mjs"
	, "src/analyze/export-configuration.mjs", "src/analyze/lean-project.mjs"
	, "src/analyze/native-metadata.mjs", "src/analyze/native-types.mjs"
	, "src/analyze/semantic-model.mjs", "src/binding-ir/contract.mjs"
	, "src/build/README.md", "tests/documentation.test.mjs"
	, "tests/helpers/wit-recursive-callable-evidence.mjs"
	, "tests/helpers/wit-recursive-callable-source-history.mjs"
	, "tests/wit-recursive-callable-evidence.test.mjs"
].sort();
export const ownedAggregateAddedPaths = [
	ownedAggregateExecutionPath
	, "docs/evidence/owned-aggregate-metadata-20260926.md"
	, "schema/binding-ir-owned.schema.json", "src/abi/owned-aggregate-model.mjs"
	, "src/analyze/owned-aggregate-policy.mjs"
	, "src/analyze/owned-metadata-graph.mjs"
	, "src/backends/native/owned-aggregate-leases.mjs"
	, ...["adapters", "layout", "runtime"].map(name => `src/backends/native/owned-value-${name}.mjs`)
	, "src/build/owned-aggregate-carriers.mjs"
	, ...["owned-aggregates", "owned-scalars"].flatMap(name =>
		["Owned.lean", "lakefile.toml", "lean-bridge.exports.json", "lean-toolchain"].map(file => `tests/fixtures/onboarding/${name}/${file}`))
	, ...["owned-aggregate-carriers", "owned-aggregate-leases", "owned-native-scalars", "owned-native-values"].map(name => `tests/fixtures/structured-types/${name}.c`)
	, ...["fixture", "native", "evidence", "source-history"].map(name => `tests/helpers/owned-aggregate-${name}.mjs`)
	, ...["contract", "model", "metadata", "native", "evidence"].map(name => `tests/owned-aggregate-${name}.test.mjs`)
	, "tests/owned-native-values.test.mjs", "tests/owned-native-scalars.test.mjs"
].sort();
let history;

/**
 * Reconstruct one exact predecessor, rejecting unknown or overlapping text.
 *
 * @param source - Full current file contents.
 * @param update - Recorded whole-file digests and ordered literal edits.
 */
export const reverseOwnedAggregateUpdate = (source, update) => {
	assert.ok(ownedAggregateChangedPaths.includes(update.path), update.path);
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let end = 0; const chunks = [];
	for(const edit of update.edits)
	{
		assert.ok(Number.isSafeInteger(edit.start) && edit.start >= end);
		assert.equal(typeof edit.previous, "string"); assert.equal(typeof edit.current, "string");
		assert.notEqual(edit.previous, edit.current);
		assert.equal(source.slice(edit.start, edit.start + edit.current.length), edit.current);
		chunks.push(source.slice(end, edit.start), edit.previous);
		end = edit.start + edit.current.length;
	}
	chunks.push(source.slice(end));
	const previous = chunks.join("");
	assert.equal(sha256(previous), update.previousSha256, update.path);
	return previous;
};

/**
 * Apply only a fully authenticated transition; leave all unrecorded drift visible.
 *
 * @param path - Repository-relative source path.
 * @param source - Full current or historical file contents.
 * @param expected - Optional exact predecessor at which normalization stops.
 */
export const beforeOwnedAggregates = (path, source, expected) => {
	const digest = sha256(source);
	if(digest === expected || !ownedAggregateChangedPaths.includes(path)) return source;
	const record = history ??= JSON.parse(readFileSync(ownedAggregateHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reverseOwnedAggregateUpdate(source, update) : source;
};
