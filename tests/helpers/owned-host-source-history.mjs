/**
 * Authenticate call-scoped owned callbacks without rewriting earlier receipts.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";
import { beforeOwnedCi } from "./owned-ci-source-history.mjs";

export const ownedHostBaseline = "b74df10a50bbdc277f6e111718ddeb5af5006c72";
export const ownedHostHistoryPath = "docs/evidence/owned-host-integration-20260926.json";
export const ownedHostExecutionPath = "docs/evidence/owned-host-execution-20260926.json";
export const ownedHostChangedPaths = [
	".github/workflows/consumer-matrix.yml"
	, "config/checked-javascript.json", "config/cli-package.v1.json"
	, "docs/architecture/binding-ir.md", "docs/consume/c.md"
	, "docs/lean/export-decisions.md", "docs/publish/c.md"
	, "docs/type-surface.v1.json", "nix/perl-engine-source-boundary.json"
	, "package.json", "src/adoption/test-profiles.mjs"
	, "src/backends/c/owned-package.mjs", "src/backends/c/owned-values.mjs"
	, "src/backends/native/owned-value-adapters.mjs"
	, "src/build/native-artifacts.mjs", "src/build/native-c-projection.mjs"
	, "src/build/native-component.mjs", "src/build/native-graph-model.mjs"
	, "src/build/native-project.mjs", "src/build/owned-aggregate-carriers.mjs"
	, "src/build/owned-c-projection.mjs", "src/build/owned-native-model.mjs"
	, "src/release/owned-c-package.mjs", "tests/documentation.test.mjs"
	, "tests/helpers/owned-aggregate-evidence.mjs"
	, "tests/helpers/owned-aggregate-native.mjs"
	, "tests/helpers/owned-c-evidence.mjs"
	, "tests/helpers/owned-package-evidence.mjs"
	, "tests/helpers/owned-package-source-history.mjs"
	, "tests/helpers/owned-reviewed-evidence.mjs"
	, "tests/helpers/wit-recursive-callable-evidence.mjs"
	, "tests/owned-c-packaging.test.mjs", "tests/owned-package-evidence.test.mjs"
	, "tests/perl-contract.test.mjs"
].sort();
export const ownedHostAddedPaths = [
	ownedHostExecutionPath, "docs/evidence/owned-host-callbacks-20260926.md"
	, "src/backends/c/owned-callbacks.mjs", "src/build/owned-callback-carriers.mjs"
	, ...["Owned.lean", "lakefile.toml", "lean-toolchain", "lean-bridge.exports.json"]
		.map(name => `tests/fixtures/onboarding/owned-host-callbacks/${name}`)
	, "tests/fixtures/structured-types/owned-host-callbacks.c"
	, "tests/fixtures/structured-types/owned-installed-host-callbacks.c"
	, "tests/helpers/owned-host-callback-fixture.mjs"
	, "tests/helpers/owned-host-source-history.mjs"
	, "tests/helpers/owned-host-evidence.mjs"
	, "tests/owned-host-callbacks.test.mjs", "tests/owned-host-packaging.test.mjs"
	, "tests/owned-host-evidence.test.mjs"
].sort();
let history;

/**
 * Reverse only a whole-file identity with ordered, nonoverlapping literal edits.
 *
 * @param source - Complete current source text.
 * @param update - Recorded previous/current identities and reverse edits.
 */
export const reverseOwnedHostUpdate = (source, update) => {
	source = beforeOwnedCi(update.path, source, update.currentSha256);
	assert.ok(ownedHostChangedPaths.includes(update.path), update.path);
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
 * Normalize only a recorded whole-file digest. Unrecorded changes remain visible.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical text.
 * @param expected - Optional exact digest at which normalization must stop.
 */
export const beforeOwnedHost = (path, source, expected) => {
	source = beforeOwnedCi(path, source, expected);
	if(typeof source === "string" && !ownedHostChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected || !ownedHostChangedPaths.includes(path)) return source;
	const record = history ??= JSON.parse(readFileSync(ownedHostHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reverseOwnedHostUpdate(source, update) : source;
};
