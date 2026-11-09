/**
 * Retain the exact Nix Fin boundary history and live-pin transition.
 *
 * @file
 */
import assert from "node:assert/strict";
import { assertJsonEqual } from "./bounded-json-equality.mjs";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "./source-history-digest.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { beforeFinDiagnosticCiSource } from "./native-fin-diagnostic-ci-history.mjs";
import {
	beforeFinNixBoundarySource, finNixBoundaryChangedPaths
	, finNixBoundaryHistoryPath, finNixBoundaryPredecessor
	, reverseFinNixBoundaryUpdate
} from "./native-fin-nix-boundary-history.mjs";
import "./native-fin-nix-comparison-history-tests.mjs";
import "./native-history-checkout-tests.mjs";

test("Nix Fin boundary history authenticates both source identities and preserves the earlier ledger", async () => {
	const history = JSON.parse(await readFile(finNixBoundaryHistoryPath, "utf8"));
	assert.equal(history.schemaVersion, 1);
	assert.equal(history.milestone, "native-fin-nix-boundary-v1");
	assert.equal(history.predecessorCommit, finNixBoundaryPredecessor);
	assert.deepEqual(history.updates.map(update => update.path), finNixBoundaryChangedPaths);
	for(const update of history.updates)
	{
		const current = beforeFinDiagnosticCiSource(update.path, await readFile(update.path, "utf8")), previous = reverseFinNixBoundaryUpdate(current, update);
		assert.equal(beforeFinNixBoundarySource(update.path, current), previous);
		assert.equal(beforeFinNixBoundarySource(update.path, previous), previous);
		assert.equal(beforeFinNixBoundarySource(update.path, current, update.currentSha256), current);
		assert.equal(beforeFinRefinementSource(update.path, current, update.currentSha256), current);
		assert.equal(beforeFinRefinementSource(update.path, current, update.previousSha256), previous);
		assert.equal(beforeFinRefinementSource(update.path, current), beforeFinRefinementSource(update.path, previous));
		const changed = current + "\n// unrelated edit\n";
		assert.equal(beforeFinNixBoundarySource(update.path, changed), changed);
		assert.throws(() => reverseFinNixBoundaryUpdate(changed, update));
		assert.throws(() => reverseFinNixBoundaryUpdate(current, { ...update, previousSha256: "0".repeat(64) }));
		assert.throws(() => reverseFinNixBoundaryUpdate(current, { ...update, path: "unknown" }));
		assert.throws(() => reverseFinNixBoundaryUpdate(current, { ...update, edits: [] }));
		assert.throws(() => reverseFinNixBoundaryUpdate(current, { ...update, edits: [...update.edits, update.edits[0]] }));
		assert.throws(() => reverseFinNixBoundaryUpdate(current, { ...update, edits: [{ ...update.edits[0], current: "wrong" }, ...update.edits.slice(1)] }));
	}
	assert.equal(sha256(await readFile("docs/evidence/native-fin-diagnostic-source-history-20261010.json")), "2bc3b1217601bb0eb0c19b9f1496d00ab5df831e3a1bd1881a4429b28fd210ab");
});

test("Nix Fin boundary refreshes exactly eighteen source pins without changing support or observations", async () => {
	const path = "docs/type-surface.v1.json", source = beforeFinDiagnosticCiSource(path, await readFile(path, "utf8"));
	const current = JSON.parse(source), previous = JSON.parse(beforeFinNixBoundarySource(path, source));
	const boundaryPath = "nix/perl-engine-source-boundary.json";
	const boundary = beforeFinDiagnosticCiSource(boundaryPath, await readFile(boundaryPath, "utf8"));
	const previousDigest = sha256(beforeFinNixBoundarySource(boundaryPath, boundary)), currentDigest = sha256(boundary);
	const history = JSON.parse(await readFile(finNixBoundaryHistoryPath, "utf8"));
	const transition = history.updates.find(update => update.path === boundaryPath);
	assert.equal(currentDigest, transition.currentSha256);
	assert.equal(previousDigest, transition.previousSha256);
	const original = path => execFileSync("git", ["show", `${finNixBoundaryPredecessor}:${path}`], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
	assert.equal(beforeFinNixBoundarySource(boundaryPath, boundary), original(boundaryPath));
	assert.deepEqual(previous, JSON.parse(original(path)));
	const expected = structuredClone(previous); let count = 0;
	for(const entry of expected.evidence) for(const file of entry.files) if(file.path === boundaryPath)
	{
		assert.equal(file.sha256, previousDigest); file.sha256 = currentDigest; count++;
	}
	assert.equal(count, 18);
	assertJsonEqual(current, expected);
	assert.deepEqual(current.observations, previous.observations);
});
