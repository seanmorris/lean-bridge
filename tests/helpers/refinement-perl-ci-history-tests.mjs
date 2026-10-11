/**
 * Authenticate the Perl CI assertion repair without rewriting original installed evidence.
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
import { beforeCheckedRecordPerlCiSource } from "./checked-record-perl-ci-history.mjs";
import { beforeRefinementPerlCiSource, refinementPerlCiChangedPaths, refinementPerlCiHistoryPath, refinementPerlCiPredecessor, reverseRefinementPerlCiUpdate } from "./refinement-perl-ci-history.mjs";

test("Perl CI documentation repair restores exact predecessors and rejects unrecorded edits", async () => {
	const history = JSON.parse(await readFile(refinementPerlCiHistoryPath));
	assert.equal(history.schemaVersion, 1); assert.equal(history.milestone, "refinement-perl-ci-v1");
	assert.equal(history.predecessorCommit, refinementPerlCiPredecessor);
	assert.deepEqual(history.updates.map(update => update.path), refinementPerlCiChangedPaths);
	for(const update of history.updates)
	{
		const current = await readFile(update.path, "utf8");
		const previous = reverseRefinementPerlCiUpdate(current, update);
		assert.equal(beforeRefinementPerlCiSource(update.path, current), previous);
		assert.equal(beforeRefinementPerlCiSource(update.path, current, update.currentSha256), current);
		const unknown = current + "\nunknown\n";
		assert.equal(beforeRefinementPerlCiSource(update.path, unknown), unknown);
		assert.throws(() => reverseRefinementPerlCiUpdate(unknown, update));
		if(update.path === "tests/native-fin-products.test.mjs")
			assert.equal(beforeFinRefinementSource(update.path, current, update.previousSha256), previous);
		for(const mutate of [item => { item.previousSha256 = "0".repeat(64); }
			, item => { item.currentSha256 = "0".repeat(64); }
			, item => { item.path = "unknown"; }, item => { item.edits = []; }
			, item => { item.edits[0].start = -1; }
			, item => { item.edits[0].current += "changed"; }]) {
			const changed = structuredClone(update); mutate(changed);
			assert.throws(() => reverseRefinementPerlCiUpdate(current, changed));
			}
	}
});

test("Perl CI documentation repair leaves support observations and earlier ledger bytes unchanged", async () => {
	const path = "docs/type-surface.v1.json";
	assert.equal(sha256(beforeCheckedRecordPerlCiSource(path, await readFile(path, "utf8"))), "272c84a3d4fb5db30f96c3d120eb11bedea9c8392ad0cc5b7e1f220cf0919811");
	assert.equal(sha256(await readFile("docs/evidence/checked-record-perl-installed-source-history-20261011.json")), "593830197492964f868d745e9e3c9c79fd86ffdcb16b557b6153e0af6a73e0b1");
});

test("Perl CI documentation history writer refuses an unrelated checkout without creating files", async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-perl-ci-history-guard-"));
	t.after(() => rm(directory, { recursive: true }));
	const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
	const git = args => execFileSync("git", args, { cwd: directory, env, stdio: "pipe" });
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgsign=false", "commit", "--allow-empty", "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve("scripts/update-refinement-perl-ci-history.mjs")], { cwd: directory, env, encoding: "utf8" });
	assert.equal(result.status, 1); assert.match(result.stderr, /draft-only/u);
	assert.deepEqual(await readdir(directory), [".git"]);
});

test("native CI repair retains all four original hosted failures and the reproduced assertion", async () => {
	const root = "docs/evidence/refinement-perl-ci-20261011";
	const bytes = await readFile(join(root, "index.json"));
	assert.equal(sha256(bytes), "ddb1721a6659d775af7fb0f190c93ce22c600712bf3a979f1692c10fc13617e3");
	const index = JSON.parse(bytes);
	assert.equal(index.hostedRevision, "c9d11f7ac8fd76d13bcc48f6f679eb22fd86b722");
	assert.equal(index.repairPredecessor, refinementPerlCiPredecessor);
	assert.equal(Object.keys(index.files).length, 13);
	for(const [path, expected] of Object.entries(index.files))
	{
		const artifact = await readFile(join(root, path));
		assert.equal(artifact.length, expected.bytes, path); assert.equal(sha256(artifact), expected.sha256, path);
	}
	for(const id of [114341674832, 114341674955, 114341674825, 114341674872])
	{
		const job = JSON.parse(await readFile(join(root, `${id}.json`)));
		assert.equal(job.id, id); assert.equal(job.head_sha, index.hostedRevision);
		assert.equal(job.conclusion, "failure");
		const log = await readFile(join(root, `${id}.log`), "utf8");
		assert.match(log, /not ok \d+ - documentation paths name product components and the active Except branch/u);
	}
	const before = await readFile(join(root, "reproduced.tap"), "utf8");
	const after = await readFile(join(root, "focused-fixed.tap"), "utf8");
	assert.match(before, /^# fail 1$/mu); assert.match(after, /^# fail 0$/mu);
	assert.match(after, /ok \d+ - documentation paths name product components and the active Except branch/u);
});
