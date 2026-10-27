/**
 * Preserve installed observations while checking refinement Core CI repairs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { sourceAtHistoryMilestone } from "./source-history-test-source.mjs";
import { assertHistoricalTypeSurfaceEvidence } from "./type-surface-historical-evidence.mjs";
import { beforeRefinementCoreCiSource, refinementCoreCiChangedPaths, refinementCoreCiHistoryPath, refinementCoreCiPredecessor, reverseRefinementCoreCiUpdate } from "./refinement-core-ci-history.mjs";

test("Refinement Core CI repairs history authenticates exact transitions and refuses unknown edits", async () => {
	const history = JSON.parse(await readFile(refinementCoreCiHistoryPath));
	assert.equal(history.schemaVersion, 1);
	assert.equal(history.milestone, "refinement-core-ci-v1");
	assert.equal(history.predecessorCommit, refinementCoreCiPredecessor);
	assert.deepEqual(history.updates.map(update => update.path), refinementCoreCiChangedPaths);
	for(const update of history.updates)
	{
		const current = await sourceAtHistoryMilestone(
			refinementCoreCiHistoryPath, update.path
		);
		const previous = reverseRefinementCoreCiUpdate(current, update);
		assert.equal(beforeRefinementCoreCiSource(update.path, current), previous);
		const bytes = Buffer.from(current);
		assert.equal(beforeFinRefinementSource(update.path, bytes, update.currentSha256), bytes);
		assert.equal(beforeFinRefinementSource(update.path, Buffer.from(current), update.previousSha256), previous);
		const unknown = current + "\nunknown\n";
		assert.equal(beforeRefinementCoreCiSource(update.path, unknown), unknown);
		assert.throws(() => reverseRefinementCoreCiUpdate(unknown, update));
		for(const mutate of [item => { item.previousSha256 = "0".repeat(64); }
			, item => { item.currentSha256 = "0".repeat(64); }
			, item => { item.path = "unknown"; }, item => { item.edits = []; }
			, item => { item.edits[0].start = -1; }
			, item => { item.edits[0].current += "changed"; }]) {
			const changed = structuredClone(update); mutate(changed);
			assert.throws(() => reverseRefinementCoreCiUpdate(current, changed));
			}
	}
});

test("Refinement Core CI repairs changes only source pins and preserves all installed observations", async () => {
	const history = JSON.parse(await readFile(refinementCoreCiHistoryPath));
	const path = "docs/type-surface.v1.json";
	const source = await sourceAtHistoryMilestone(refinementCoreCiHistoryPath, path);
	const restored = beforeRefinementCoreCiSource(path, source);
	assert.equal(sha256(restored), "986d6c39e6cf292c706b106f721748651e5f59f00d08f42ca05f4fed917a7756");
	const current = JSON.parse(source), previous = JSON.parse(restored);
	const expected = structuredClone(previous); let pins = 0;
	for(const entry of expected.evidence) for(const file of entry.files)
	{
		const update = history.updates.find(item => item.path === file.path && item.previousSha256 === file.sha256);
		if(update)
		{ file.sha256 = update.currentSha256; pins++; }
	}
	assert.equal(pins, 5); assert.deepEqual(current, expected);
	assert.equal(current.evidence.length, 436); assert.equal(current.observations.length, 551);
	assert.deepEqual(current.observations, previous.observations);
	await assertHistoricalTypeSurfaceEvidence(current
		, (file, bytes, digest) => beforeFinRefinementSource(
			file, bytes, digest));
	assert.equal(sha256(await readFile("docs/evidence/checked-record-host-ci-source-history-20261011.json")), "9fa30cc51ec6911a0ec43305c252f7be0dba7d3958088ab7e7206bba6d5e9ad2");
});

test("Refinement Core CI repairs history writer refuses an unrelated checkout before changing files", async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-refinement-core-ci-history-guard-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
	const git = args => execFileSync("git", args, { cwd: directory, env, stdio: "pipe" });
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgsign=false", "commit", "--allow-empty", "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve("scripts/update-refinement-core-ci-history.mjs")], { cwd: directory, env, encoding: "utf8" });
	assert.equal(result.status, 1); assert.match(result.stderr, /draft-only/u);
	assert.deepEqual(await readdir(directory), [".git"]);
});

test("Refinement Core CI archive retains hosted failure and local outcomes without claiming hosted repair acceptance", async t => {
	const root = "docs/evidence/refinement-core-ci-20261011";
	const bytes = await readFile(join(root, "index.json"));
	assert.equal(sha256(bytes), "978f96736a75311ff69cab082d830d99d5471c9a5e0dcdcd4e9dbdeabcc1117e");
	const index = JSON.parse(bytes);
	assert.deepEqual(index.hosted, {
		runId: 38095922167, jobId: 114341673721
		, commit: "c9d11f7ac8fd76d13bcc48f6f679eb22fd86b722"
		, conclusion: "failure"
	});
	assert.equal(index.localPredecessor, refinementCoreCiPredecessor);
	assert.equal(index.records.length, 7);
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-core-ci-archive-test-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const records = new Map();
	for(const record of index.records)
	{
		assert.match(record.path, /^[a-z-]+\.(?:log|json|stderr|tap)$/u);
		const original = await readFile(join(root, record.path));
		assert.equal(sha256(original), record.sha256, record.path);
		assert.equal(original.length, record.byteLength, record.path);
		records.set(record.path, original);
		// The archive reader uses only relative archive paths. Build paths are provenance.
		assert.ok(record.source.startsWith("build/"));
		await mkdir(dirname(join(directory, record.source)), { recursive: true });
		await writeFile(join(directory, record.source), original);
	}
	assert.match(records.get("local-reproduced.tap").toString(), /# pass 0\n# fail 4\n/u);
	assert.match(records.get("local-fixed.tap").toString(), /# pass 5\n# fail 0\n/u);
	assert.equal(JSON.parse(records.get("local-analysis.json")).status, "needs-input");
	for(const [name, id] of [["run", index.hosted.runId], ["job", index.hosted.jobId]])
	{
		const metadata = JSON.parse(records.get(`hosted-${name}.json`));
		assert.equal(metadata.id, id); assert.equal(metadata.head_sha, index.hosted.commit);
		assert.equal(metadata.status, "completed"); assert.equal(metadata.conclusion, "failure");
	}
	const invoke = () => spawnSync(process.execPath, [resolve("scripts/archive-refinement-core-ci-evidence.mjs")], { cwd: directory, encoding: "utf8" });
	for(let attempt = 0; attempt < 2; attempt++) assert.equal(invoke().status, 0);
	assert.deepEqual(await readFile(join(directory, root, "index.json")), bytes);
	const changed = join(directory, root, "local-fixed.tap");
	await writeFile(changed, "do not replace this file\n");
	const refusal = invoke(); assert.equal(refusal.status, 1);
	assert.match(refusal.stderr, /Refuse to replace local-fixed.tap/u);
	assert.equal(await readFile(changed, "utf8"), "do not replace this file\n");
	await rm(join(directory, index.records[0].source));
	assert.equal(invoke().status, 1, "Missing original evidence must not be replaced by the archived copy");
});
