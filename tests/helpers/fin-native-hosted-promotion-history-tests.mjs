/**
 * Authenticate hosted Fin coverage promotion while preserving earlier execution evidence.
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
import { beforeFinHostedPromotionSource, finHostedPromotionChangedPaths, finHostedPromotionHistoryPath, finHostedPromotionPredecessor, reverseFinHostedPromotionUpdate } from "./fin-native-hosted-promotion-history.mjs";

test("hosted Fin promotion authenticates every transition and refuses unrecorded edits", async () => {
	const history = JSON.parse(await readFile(finHostedPromotionHistoryPath, "utf8"));
	assert.equal(history.schemaVersion, 1);
	assert.equal(history.milestone, "fin-native-hosted-promotion-v1");
	assert.equal(history.predecessorCommit, finHostedPromotionPredecessor);
	assert.deepEqual(history.updates.map(update => update.path), finHostedPromotionChangedPaths);
	for(const update of history.updates)
	{
		const current = await readFile(update.path, "utf8"), previous = reverseFinHostedPromotionUpdate(current, update);
		assert.equal(beforeFinHostedPromotionSource(update.path, current), previous);
		assert.equal(beforeFinHostedPromotionSource(update.path, current, update.currentSha256), current);
		assert.equal(beforeFinHostedPromotionSource(update.path, previous), previous);
		assert.equal(beforeFinRefinementSource(update.path, current, update.currentSha256), current);
		assert.equal(beforeFinRefinementSource(update.path, current, update.previousSha256), previous);
		assert.equal(beforeFinRefinementSource(update.path, current), beforeFinRefinementSource(update.path, previous));
		const changed = current + "\n// unknown edit\n";
		assert.equal(beforeFinHostedPromotionSource(update.path, changed), changed);
		assert.throws(() => reverseFinHostedPromotionUpdate(changed, update));
		for(const mutation of [
			{ previousSha256: "0".repeat(64) }, { currentSha256: "0".repeat(64) }
			, { path: "unknown.mjs" }, { edits: [] }
			, { edits: [...update.edits, update.edits[0]] }
			, { edits: [{ ...update.edits[0], start: -1 }] }
			, { edits: [{ ...update.edits[0], current: "unrecorded" }] }
		]) assert.throws(() => reverseFinHostedPromotionUpdate(current, { ...update, ...mutation }));
	}
	const buffer = Buffer.from("unregistered bytes");
	assert.equal(beforeFinHostedPromotionSource(finHostedPromotionChangedPaths[0], buffer), buffer);
	assert.equal(beforeFinHostedPromotionSource("unknown.mjs", "unregistered bytes"), "unregistered bytes");
});

test("hosted Fin promotion preserves the earlier source ledgers", async () => {
	for(const [path, digest] of [
		["docs/evidence/fin-container-foreign-source-history-20261010.json", "302e830cbfc92e23387476621dd7f440b9b6d431d90ced3d0857fe1fab3b2dc2"]
		, ["docs/evidence/fin-container-edge-ci-source-history-20261010.json", "df5b0fcaef151ea18c128b4d5d9acfbdc6f250caad88d4613b6c526308b1f42c"]
		, ["docs/evidence/fin-container-edge-integration-source-history-20261010.json", "a9fa371246d50339037ad0c1ded08f5d3c83b7802817dd93980e1669cc27a4b1"]
		, ["docs/evidence/native-fin-diagnostic-ci-source-history-20261010.json", "77d1716708d41789f6dced955d6764d3ca2c86c88a1f2eea8b8df356e1dea8c6"]
		, ["docs/evidence/native-fin-diagnostic-source-history-20261010.json", "2bc3b1217601bb0eb0c19b9f1496d00ab5df831e3a1bd1881a4429b28fd210ab"]
	]) assert.equal(sha256(await readFile(path)), digest, path);
});

test("hosted Fin promotion history writer refuses an unrelated HEAD before writing", async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-record-omission-history-guard-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
	const git = args => execFileSync("git", args, { cwd: directory, stdio: "pipe", env });
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgsign=false", "commit", "--allow-empty", "--quiet", "-m", "unrelated revision"]);
	const result = spawnSync(process.execPath, [resolve("scripts/promote-fin-native-hosted-evidence.mjs")], { cwd: directory, encoding: "utf8", env });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /Hosted Fin promotion history is draft-only/u);
	assert.deepEqual(await readdir(directory), [".git"]);
});
