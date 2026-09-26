/**
 * Authenticate the owned C packaging transition without rewriting predecessors.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "../../src/capsule/node.mjs";

export const ownedPackageBaseline = "b1f4d2d8eaa626e1e6084d9ae777a98feecf5c0e";
export const ownedPackageHistoryPath = "docs/evidence/owned-package-integration-20260926.json";
export const ownedPackageExecutionPath = "docs/evidence/owned-package-execution-20260926.json";
export const ownedPackageChangedPaths = [
	".github/workflows/consumer-matrix.yml"
	, "config/checked-javascript.json", "config/cli-package.v1.json"
	, "docs/architecture/binding-ir.md", "docs/consume/c.md"
	, "docs/evidence/owned-aggregate-metadata-20260926.md"
	, "docs/lean/export-decisions.md", "docs/publish/c.md"
	, "docs/type-surface.v1.json", "package.json"
	, "src/adoption/test-profiles.mjs", "src/analyze/reviewed-owned-source.mjs"
	, "src/build/elaborated-component.mjs", "src/build/native-artifacts.mjs"
	, "src/build/native-c-projection.mjs", "src/build/native-component.mjs"
	, "src/build/native-graph-model.mjs", "src/build/native-project.mjs"
	, "src/build/owned-aggregate-carriers.mjs"
	, "tests/documentation.test.mjs"
	, "tests/helpers/owned-aggregate-evidence.mjs"
	, "tests/helpers/owned-c-evidence.mjs"
	, "tests/helpers/owned-reviewed-evidence.mjs"
	, "tests/helpers/owned-reviewed-source-history.mjs"
	, "tests/helpers/wit-recursive-callable-evidence.mjs"
	, "tests/owned-reviewed-evidence.test.mjs"
].sort();
export const ownedPackageAddedPaths = [
	ownedPackageExecutionPath, "src/build/owned-c-projection.mjs"
	, "src/build/owned-native-model.mjs", "src/release/owned-c-package.mjs"
	, "tests/fixtures/structured-types/owned-installed-values.c"
	, "tests/helpers/owned-package-source-history.mjs"
	, "tests/helpers/owned-package-evidence.mjs"
	, "tests/owned-c-packaging.test.mjs", "tests/owned-package-evidence.test.mjs"
].sort();
let history;

/**
 * Restore the exact predecessor using ordered, nonoverlapping literal edits.
 *
 * @param source - Complete current source text.
 * @param update - Whole-file identities and recorded reverse edits.
 */
export const reverseOwnedPackageUpdate = (source, update) => {
	assert.ok(ownedPackageChangedPaths.includes(update.path), update.path);
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length);
	const chunks = []; let end = 0;
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
	const previous = chunks.join(""); assert.equal(sha256(previous), update.previousSha256, update.path);
	return previous;
};

/**
 * Normalize only a recorded whole-file identity; unknown drift stays visible.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical text.
 * @param expected - Optional exact digest at which normalization must stop.
 */
export const beforeOwnedPackage = (path, source, expected) => {
	const digest = sha256(source);
	if(digest === expected || !ownedPackageChangedPaths.includes(path)) return source;
	const record = history ??= JSON.parse(readFileSync(ownedPackageHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reverseOwnedPackageUpdate(source, update) : source;
};
