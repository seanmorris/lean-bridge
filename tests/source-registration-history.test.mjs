/**
 * Reconcile additive inventories without accepting production-source changes.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { assertSourceRegistrationUpdate, verifyAddedSourceRegistrations } from "./helpers/source-registration-history.mjs";

test("source registration history reverses exact additions and rejects unrelated changes", () => {
	for(const [path, added] of [
		["package.json", '    "src/backends/python/copied-graph-values.mjs",']
		, ["config/cli-package.v1.json", '    "src/backends/python/copied-graph-values.mjs",']
		, ["nix/perl-engine-source-boundary.json", '    "src/backends/python/copied-graph-values.mjs",']
		, ["config/checked-javascript.json", '\t\t{ "path": "src/backends/python/copied-graph-values.mjs", "classification": "strict-migration-backlog" },']
		, [".github/workflows/consumer-matrix.yml", "          LEAN_BRIDGE_PYTHON_GRAPH_TEST=1 node --test tests/python-copied-graph-values.test.mjs"]
	]){
		const before = "unchanged-prefix\nunchanged-suffix\n", after = before.replace("unchanged-suffix", added + "\nunchanged-suffix");
		const updates = [{ path, previousSha256: sha256(before), currentSha256: sha256(after), addedLines: [added] }];
		verifyAddedSourceRegistrations(path, after, sha256(before), updates);
		verifyAddedSourceRegistrations(path, before, sha256(before), []);
		for(const source of [after + "\n", after.replace("suffix", "changed"), after + added + "\n"])
			assert.throws(() => verifyAddedSourceRegistrations(path, source, sha256(before), updates));
		assert.throws(() => verifyAddedSourceRegistrations(path, after, sha256(before), [...updates, ...updates]));
		assert.throws(() => verifyAddedSourceRegistrations(path, after, sha256(before), [{ ...updates[0], addedLines: [added, added] }]));
		assert.throws(() => verifyAddedSourceRegistrations(path, after, "0".repeat(64), updates));
		assert.throws(() => verifyAddedSourceRegistrations("src/build/native-project.mjs", after, sha256(before), updates));
	}
});

test("source registrations cannot disguise scripts, checked-module removal or shell commands", () => {
	for(const [path, added] of [
		["package.json", '    "scripts/skip-checks.sh",']
		, ["package.json", '    "src/../unsafe.mjs",']
		, ["config/checked-javascript.json", '\t\t{ "path": "src/backends/python/copied-graph-values.mjs", "classification": "checked" },']
		, [".github/workflows/consumer-matrix.yml", "          LEAN_BRIDGE_PYTHON_GRAPH_TEST=1 node --test tests/python-copied-graph-values.test.mjs || true"]
		, [".github/workflows/consumer-matrix.yml", "          rm -rf build/recursive"]
	]){
		const before = "before\n", after = before + added + "\n";
		assert.throws(() => verifyAddedSourceRegistrations(path, after, sha256(before), [{ path, previousSha256: sha256(before), currentSha256: sha256(after), addedLines: [added] }]));
	}
});

test("the registration verifier's own upgrade reconstructs its immutable previous source", async () => {
	const path = "tests/helpers/test-registration-history.mjs", source = await readFile(path, "utf8");
	const record = JSON.parse(await readFile("docs/evidence/rust-recursive-packages-20260923.json"));
	const expected = record.sourceHashes[path]; assert.ok(expected);
	assert.equal(await assertSourceRegistrationUpdate(path, source, expected), true);
	await assert.rejects(() => assertSourceRegistrationUpdate(path, source + "\n", expected));
	await assert.rejects(() => assertSourceRegistrationUpdate(path, source.replace("Registration must occur once", "Changed"), expected));
	assert.equal(await assertSourceRegistrationUpdate("src/build/native-project.mjs", source, expected), false);
});
