/**
 * Check labeled archive replay and exact source history without parsing the large inventory.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createInterface } from "node:readline";
import test from "node:test";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import {
	beforeOwnedCheckedArchiveRootsSource
	, ownedCheckedArchiveRootsAddedPaths
	, ownedCheckedArchiveRootsChangedPaths
	, ownedCheckedArchiveRootsCommits
	, ownedCheckedArchiveRootsImplementationPaths
	, ownedCheckedArchiveRootsHistoryPath
	, ownedCheckedArchiveRootsImplementation
	, ownedCheckedArchiveRootsIntegrationBase
	, ownedCheckedArchiveRootsIntegrationPaths
	, ownedCheckedArchiveRootsPins
	, ownedCheckedArchiveRootsPredecessor
	, reverseOwnedCheckedArchiveRootsUpdate
} from "./owned-checked-record-archive-roots-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 2 * 1024 * 1024 });
const read = async () => JSON.parse(await readFile(
	ownedCheckedArchiveRootsHistoryPath, "utf8"));
const inventoryPath = "docs/type-surface.v1.json";

test("Owned checked-record archive roots authenticates its wiring and lineage", async () => {
	const record = await read();
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "owned-checked-record-archive-roots-source-v1");
	assert.equal(record.predecessorCommit, ownedCheckedArchiveRootsPredecessor);
	assert.equal(record.implementationCommit, ownedCheckedArchiveRootsImplementation);
	assert.equal(record.integrationBaseCommit, ownedCheckedArchiveRootsIntegrationBase);
	assert.deepEqual(record.implementationCommits, ownedCheckedArchiveRootsCommits);
	assert.deepEqual(record.updates.map(item => item.path)
		, ownedCheckedArchiveRootsChangedPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, ownedCheckedArchiveRootsIntegrationPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, ownedCheckedArchiveRootsAddedPaths);
	assert.deepEqual(git(["rev-list", "--reverse"
		, ownedCheckedArchiveRootsPredecessor + ".." + ownedCheckedArchiveRootsImplementation]).trim().split("\n")
	, ownedCheckedArchiveRootsCommits);
	for(const [index, revision] of ownedCheckedArchiveRootsCommits.entries())
		assert.equal(git(["show", "-s", "--format=%P", revision]).trim()
			, index === 0 ? ownedCheckedArchiveRootsPredecessor : ownedCheckedArchiveRootsCommits[index - 1]);
	assert.deepEqual(git(["diff", "--name-only"
		, ownedCheckedArchiveRootsPredecessor
		, ownedCheckedArchiveRootsImplementation]).trim().split("\n")
	, [...ownedCheckedArchiveRootsImplementationPaths].sort());
	const updates = [...record.updates.filter(item => item.path !== inventoryPath)
		, ...record.integrationUpdates];
	for(const update of updates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256, beforeOwnedCheckedArchiveRootsSource);
		const prior = record.integrationUpdates.includes(update)
			? ownedCheckedArchiveRootsIntegrationBase : ownedCheckedArchiveRootsPredecessor;
		const previous = git(["show", prior + ":" + update.path]);
		assert.equal(reverseOwnedCheckedArchiveRootsUpdate(
			current, update), previous);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
	assert.ok(finRefinementNormalizationPaths.includes(inventoryPath));
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256)), addition.currentSha256);
});

test("Owned checked-record archive roots changes exactly 22 named hashes", async () => {
	const pins = new Map(ownedCheckedArchiveRootsPins.map(pin => [pin.path, pin]));
	const counts = new Map();
	const diff = git(["diff", "--no-ext-diff", "--no-textconv", "--unified=1"
		, ownedCheckedArchiveRootsPredecessor
		, ownedCheckedArchiveRootsImplementation, "--", inventoryPath]);
	let path;
	let removed = false;
	for(const line of diff.split("\n"))
	{
		const name = line.match(/^ {11}"path": "([^"]+)",$/u);
		if(name) path = name[1];
		if(line.startsWith("---") || line.startsWith("+++")) continue;
		if(!line.startsWith("-") && !line.startsWith("+")) continue;
		const pin = pins.get(path);
		assert.ok(pin, "Only named source pins may change");
		const side = line[0] === "-" ? "previousSha256" : "currentSha256";
		assert.equal(line, line[0] + '          "sha256": "' + pin[side] + '"');
		if(line[0] === "-")
		{
			assert.equal(removed, false);
			removed = true;
		}
		else
		{
			assert.equal(removed, true);
			removed = false;
			counts.set(path, (counts.get(path) ?? 0) + 1);
		}
	}
	assert.equal(removed, false);
	assert.equal(counts.size, pins.size);
	assert.equal([...counts.values()].reduce((sum, count) => sum + count, 0), 22);
	for(const pin of pins.values())
	{
		assert.equal(counts.get(pin.path), pin.count, pin.path);
		assert.equal(sha256(git(["show"
			, ownedCheckedArchiveRootsImplementation + ":" + pin.path]))
		, pin.currentSha256, pin.path);
	}
	const update = (await read()).updates[0];
	assert.equal(update.edits.length, 22);
	for(const edit of update.edits)
		for(const side of ["previous", "current"])
			assert.match(edit[side], /^ {10}"sha256": "[a-f0-9]{64}"\n$/u);
});

test("Owned checked-record archive roots streams exact inventory endpoints", async () => {
	const update = (await read()).updates[0];
	const pins = new Map(ownedCheckedArchiveRootsPins.map(pin => [pin.path, pin]));
	const counts = new Map();
	const currentHash = createHash("sha256");
	const previousHash = createHash("sha256");
	const child = spawn("git", ["show"
		, ownedCheckedArchiveRootsImplementation + ":" + inventoryPath]
	, { stdio: ["ignore", "pipe", "pipe"] });
	let stderr = "";
	child.stderr.setEncoding("utf8");
	child.stderr.on("data", chunk => { stderr += chunk; });
	const completed = new Promise((accept, reject) => {
		child.once("error", reject);
		child.once("close", (code, signal) => {
			if(code === 0) accept();
			else reject(new Error("Inventory read failed: " + code + "/" + signal + " " + stderr));
		});
	});
	child.stdout.on("data", chunk => currentHash.update(chunk));
	let pending;
	const lines = createInterface({ input: child.stdout, crlfDelay: Infinity });
	for await(const line of lines)
	{
		let restored = line;
		if(pending)
		{
			assert.equal(line, '          "sha256": "' + pending.currentSha256 + '"');
			restored = '          "sha256": "' + pending.previousSha256 + '"';
			counts.set(pending.path, (counts.get(pending.path) ?? 0) + 1);
		}
		const match = line.match(/^ {10}"path": "([^"]+)",$/u);
		pending = match ? pins.get(match[1]) : undefined;
		previousHash.update(restored + "\n");
	}
	await completed;
	assert.equal(currentHash.digest("hex"), update.currentSha256);
	assert.equal(previousHash.digest("hex"), update.previousSha256);
	for(const pin of pins.values()) assert.equal(counts.get(pin.path), pin.count);
});

test("Owned checked-record archive roots rejects unknown or forged transitions", async () => {
	const update = (await read()).integrationUpdates[0];
	const current = await sourceAtFinHistoryMilestone(update.path
		, update.currentSha256, beforeOwnedCheckedArchiveRootsSource);
	assert.equal(beforeOwnedCheckedArchiveRootsSource(
		update.path, current, update.currentSha256), current);
	const unknown = current + "\nunknown";
	assert.equal(beforeOwnedCheckedArchiveRootsSource(
		update.path, unknown), unknown);
	for(const forged of [{ ...update, previousSha256: "0".repeat(64) }
		, { ...update, currentSha256: "0".repeat(64) }
		, { ...update, edits: [...update.edits, update.edits[0]] }
		, { ...update, edits: [] }, { ...update, path: "unrelated.mjs" }])
		assert.throws(() => reverseOwnedCheckedArchiveRootsUpdate(current, forged));
	assert.equal(beforeOwnedCheckedArchiveRootsSource(
		"unrelated.mjs", current), current);
});

test("Owned checked-record archive roots writer refuses another checkout", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-owned-archive-roots-guard-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const environment = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith("GIT_")));
	const run = arguments_ => execFileSync("git", arguments_
		, { cwd: root, env: environment, stdio: "pipe" });
	run(["init", "--quiet"]);
	run(["-c", "user.name=Test", "-c", "user.email=test@example.invalid"
		, "-c", "commit.gpgsign=false", "commit", "--allow-empty"
		, "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-owned-checked-record-archive-roots-source-history.mjs")]
	, { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /exact integration base/u);
	assert.deepEqual(await readdir(root), [".git"]);
});

test("Owned checked-record archive roots binds qualification to original captures", async () => {
	const path = "docs/evidence/owned-checked-record-archive-roots-20261025.json";
	const value = JSON.parse(await sourceAtFinHistoryMilestone(path
		, (await read()).additions.find(item => item.path === path).currentSha256));
	assert.equal(value.schemaVersion, 1);
	assert.equal(value.kind, "owned-checked-record-archive-roots-qualification");
	assert.equal(value.predecessorCommit, ownedCheckedArchiveRootsPredecessor);
	assert.equal(value.implementationCommit, ownedCheckedArchiveRootsImplementation);
	assert.equal(value.sourcePins.refreshedPins, 22);
	assert.equal(value.fullMatrixVerified, false);
	assert.equal(value.newInstalledRuntimeExecutions, 0);
	assert.deepEqual(value.validation.directTests, { passed: 13, failed: 0, skipped: 0 });
	assert.equal(value.validation.registeredTests.passed, 13);
	assert.equal(value.validation.registeredTests.failed, 0);
	assert.equal(value.validation.registeredTests.skipped, 0);
	assert.equal(value.validation.checkedJavaScriptTypecheck, true);
	assert.equal(value.validation.scopedEslint, true);
	assert.equal(value.validation.liveSourcePins.stale, 0);
	const replay = value.originalReplay;
	assert.equal(replay.committedRevision, ownedCheckedArchiveRootsPredecessor);
	assert.equal(replay.fullMatrixVerified, false);
	assert.equal(replay.newInstalledRuntimeExecutions, 0);
	assert.deepEqual(replay.captures.map(capture => capture.lane)
		, ["perl", "javascript", "php-wasm"]);
	assert.equal(replay.captures.reduce((sum, capture) => sum + capture.committed.files, 0), 4963);
	assert.equal(replay.captures.reduce((sum, capture) => sum + capture.committed.bytes, 0), 564856679);
	for(const source of replay.sources)
		assert.equal(sha256(git(["show"
			, ownedCheckedArchiveRootsImplementation + ":" + source.path])), source.sha256);
	for(const capture of replay.captures)
	{
		const text = git(["show", replay.committedRevision + ":" + capture.root + "/index.json"]);
		assert.equal(sha256(text), capture.indexSha256);
		const index = JSON.parse(text);
		assert.equal(index.producerCommit, capture.producerCommit);
		assert.equal(index.hostedRun.runId, capture.runId);
		assert.equal(index.hostedRun.job.id, capture.jobId);
		assert.equal(index.hostedRun.artifact.id, capture.artifactId);
		assert.equal(index.files.length + 1, capture.committed.files);
		assert.equal(index.files.reduce((sum, file) => sum + file.bytes, Buffer.byteLength(text))
			, capture.committed.bytes);
		assert.equal(index.accepted.routes.length, 4);
		assert.equal(capture.routes, 4);
	}
});
