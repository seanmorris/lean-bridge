/**
 * Authenticate Fin 0 CI integration while preserving earlier execution evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { beforeFinNominalRefusalSource, finNominalRefusalChangedPaths, finNominalRefusalHistoryPath, finNominalRefusalPredecessor, reverseFinNominalRefusalUpdate } from "./fin-nominal-refusal-history.mjs";

test("Fin nominal refusal integration authenticates every transition and refuses unrecorded edits", async () => {
	const history = JSON.parse(await readFile(finNominalRefusalHistoryPath, "utf8"));
	assert.equal(history.schemaVersion, 1);
	assert.equal(history.milestone, "fin-nominal-refusal-v1");
	assert.equal(history.predecessorCommit, finNominalRefusalPredecessor);
	assert.deepEqual(history.updates.map(update => update.path), finNominalRefusalChangedPaths);
	for(const update of history.updates)
	{
		const current = await readFile(update.path, "utf8"), previous = reverseFinNominalRefusalUpdate(current, update);
		assert.equal(beforeFinNominalRefusalSource(update.path, current), previous);
		assert.equal(beforeFinNominalRefusalSource(update.path, current, update.currentSha256), current);
		assert.equal(beforeFinNominalRefusalSource(update.path, previous), previous);
		assert.equal(beforeFinRefinementSource(update.path, current, update.currentSha256), current);
		assert.equal(beforeFinRefinementSource(update.path, current, update.previousSha256), previous);
		assert.equal(beforeFinRefinementSource(update.path, current), beforeFinRefinementSource(update.path, previous));
		const changed = current + "\n// unknown edit\n";
		assert.equal(beforeFinNominalRefusalSource(update.path, changed), changed);
		assert.throws(() => reverseFinNominalRefusalUpdate(changed, update));
		for(const mutation of [
			{ previousSha256: "0".repeat(64) }, { currentSha256: "0".repeat(64) }
			, { path: "unknown.mjs" }, { edits: [] }
			, { edits: [...update.edits, update.edits[0]] }
			, { edits: [{ ...update.edits[0], start: -1 }] }
			, { edits: [{ ...update.edits[0], current: "unrecorded" }] }
		]) assert.throws(() => reverseFinNominalRefusalUpdate(current, { ...update, ...mutation }));
	}
	const buffer = Buffer.from("unregistered bytes");
	assert.equal(beforeFinNominalRefusalSource(finNominalRefusalChangedPaths[0], buffer), buffer);
	assert.equal(beforeFinNominalRefusalSource("unknown.mjs", "unregistered bytes"), "unregistered bytes");
});

test("Fin nominal refusal integration preserves the earlier source ledgers", async () => {
	for(const [path, digest] of [
		["docs/evidence/fin-record-zero-ci-source-history-20261010.json", "3dba67892bd0be4fc52053be7b10f968a56c431a95cd7811a510c35ef423e3a5"]
		, ["docs/evidence/fin-native-hosted-promotion-source-history-20261010.json", "f109bb68ee632f7a061a40ec07cfec2bdab43ca4da411c860dc67fcd434f7fc4"]
		, ["docs/evidence/fin-record-review-omission-source-history-20261010.json", "80e026cf1a13d160821a869f5be0ec96d74e9d70cbda7a248c614911354f2e46"]
		, ["docs/evidence/fin-container-foreign-source-history-20261010.json", "302e830cbfc92e23387476621dd7f440b9b6d431d90ced3d0857fe1fab3b2dc2"]
		, ["docs/evidence/fin-container-edge-ci-source-history-20261010.json", "df5b0fcaef151ea18c128b4d5d9acfbdc6f250caad88d4613b6c526308b1f42c"]
		, ["docs/evidence/fin-container-edge-integration-source-history-20261010.json", "a9fa371246d50339037ad0c1ded08f5d3c83b7802817dd93980e1669cc27a4b1"]
		, ["docs/evidence/native-fin-diagnostic-ci-source-history-20261010.json", "77d1716708d41789f6dced955d6764d3ca2c86c88a1f2eea8b8df356e1dea8c6"]
		, ["docs/evidence/native-fin-diagnostic-source-history-20261010.json", "2bc3b1217601bb0eb0c19b9f1496d00ab5df831e3a1bd1881a4429b28fd210ab"]
	]) assert.equal(sha256(await readFile(path)), digest, path);
});

test("Fin nominal refusal integration history writer refuses an unrelated HEAD before writing", async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-record-omission-history-guard-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
	const git = args => execFileSync("git", args, { cwd: directory, stdio: "pipe", env });
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgsign=false", "commit", "--allow-empty", "--quiet", "-m", "unrelated revision"]);
	const result = spawnSync(process.execPath, [resolve("scripts/update-fin-nominal-refusal-history.mjs")], { cwd: directory, encoding: "utf8", env });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /Fin nominal refusal history is draft-only/u);
	assert.deepEqual(await readdir(directory), [".git"]);
});

test("Fin nominal refusal integration changes current source pins only and adds no installed support claims", async () => {
	const path = "docs/type-surface.v1.json", source = await readFile(path, "utf8");
	const current = JSON.parse(source), previous = JSON.parse(beforeFinNominalRefusalSource(path, source));
	const expected = structuredClone(previous), history = JSON.parse(await readFile(finNominalRefusalHistoryPath, "utf8"));
	let refreshed = 0;
	for(const entry of expected.evidence) for(const file of entry.files)
	{
		const update = history.updates.find(item => item.path === file.path && item.previousSha256 === file.sha256);
		if(update)
		{ file.sha256 = update.currentSha256; refreshed++; }
	}
	assert.ok(refreshed > 0); assert.deepEqual(current, expected);
	assert.deepEqual(current.observations, previous.observations);
	const digests = new Map();
	for(const file of current.evidence.flatMap(entry => entry.files))
	{
		if(!digests.has(file.path)) digests.set(file.path, sha256(await readFile(file.path)));
		assert.equal(file.sha256, digests.get(file.path), file.path);
	}
});
