/**
 * Check the exact producer pin refresh without parsing the large inventory.
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
	beforeCoreHistoryEndpointIntegrationSource
	, coreHistoryEndpointIntegrationAddedPaths
	, coreHistoryEndpointIntegrationChangedPaths
	, coreHistoryEndpointIntegrationCommits
	, coreHistoryEndpointIntegrationParents
	, coreHistoryEndpointIntegrationRetainedCommits
	, coreHistoryEndpointIntegrationImplementationPaths
	, coreHistoryEndpointIntegrationHistoryPath
	, coreHistoryEndpointIntegrationImplementation
	, coreHistoryEndpointIntegrationIntegrationBase
	, coreHistoryEndpointIntegrationIntegrationPaths
	, coreHistoryEndpointIntegrationPins
	, coreHistoryEndpointIntegrationPredecessor
	, reverseCoreHistoryEndpointIntegrationUpdate
} from "./core-history-endpoint-integration-source-history.mjs";
import { phpWasmCallbackEndpointStopHistoryPath } from "./php-wasm-callback-endpoint-stop-source-history.mjs";
import { zeroPayloadDotnetArchiveGapHistoryPath } from "./zero-payload-dotnet-archive-gap-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";
import { inheritedCheckedRecordPromotionHistoryPath } from "./inherited-checked-record-promotion-source-history.mjs";
import { primitiveAuditIntegrationHistoryPath } from "./primitive-audit-integration-source-history.mjs";
import { primitiveAuditCoreRepairHistoryPath } from "./primitive-audit-core-repair-source-history.mjs";
import {
	ownedTransferCopyReplayRepairHistoryPath
	, ownedTransferCopyNativeFollowupCommit
	, ownedTransferCopyNativeFollowupPaths
} from "./owned-transfer-copy-replay-repair-source-history.mjs";

const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 2 * 1024 * 1024 });
const read = async () => JSON.parse(await readFile(
	coreHistoryEndpointIntegrationHistoryPath, "utf8"));
const inventoryPath = "docs/type-surface.v1.json";

test("Core history endpoint integration authenticates its wiring and lineage", async () => {
	const record = await read();
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "core-history-endpoint-integration-source-v1");
	assert.equal(record.predecessorCommit, coreHistoryEndpointIntegrationPredecessor);
	assert.equal(record.implementationCommit, coreHistoryEndpointIntegrationImplementation);
	assert.equal(record.integrationBaseCommit, coreHistoryEndpointIntegrationIntegrationBase);
	assert.deepEqual(record.implementationCommits, coreHistoryEndpointIntegrationCommits);
	assert.deepEqual(record.implementationParents, coreHistoryEndpointIntegrationParents);
	assert.deepEqual(record.retainedCommits, coreHistoryEndpointIntegrationRetainedCommits);
	assert.deepEqual(record.updates.map(item => item.path)
		, coreHistoryEndpointIntegrationChangedPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, coreHistoryEndpointIntegrationIntegrationPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, coreHistoryEndpointIntegrationAddedPaths);
	assert.deepEqual(git(["rev-list", "--first-parent", "--reverse"
		, coreHistoryEndpointIntegrationPredecessor + ".." + coreHistoryEndpointIntegrationImplementation])
		.trim().split("\n"), coreHistoryEndpointIntegrationCommits);
	for(const [index, revision] of coreHistoryEndpointIntegrationCommits.entries())
		assert.deepEqual(git(["show", "-s", "--format=%P", revision])
			.trim().split(" "), coreHistoryEndpointIntegrationParents[index]);
	for(const retained of coreHistoryEndpointIntegrationRetainedCommits)
	{
		assert.equal(git(["show", "-s", "--format=%P", retained.commit]).trim(), retained.parent);
		git(["merge-base", "--is-ancestor", retained.commit, coreHistoryEndpointIntegrationImplementation]);
	}
	assert.deepEqual(git(["diff", "--name-only"
		, coreHistoryEndpointIntegrationPredecessor
		, coreHistoryEndpointIntegrationImplementation]).trim().split("\n").sort()
	, [...coreHistoryEndpointIntegrationImplementationPaths].sort());
	for(const update of [...record.updates.filter(item => item.path !== inventoryPath)
		, ...record.integrationUpdates]) {
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256, beforeCoreHistoryEndpointIntegrationSource);
		const prior = record.integrationUpdates.includes(update)
			? coreHistoryEndpointIntegrationIntegrationBase : coreHistoryEndpointIntegrationPredecessor;
		const previous = git(["show", prior + ":" + update.path]);
		assert.equal(reverseCoreHistoryEndpointIntegrationUpdate(
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

test("Core history endpoint integration changes exactly 44 named hashes", async () => {
	const pins = new Map(coreHistoryEndpointIntegrationPins.map(pin => [pin.path, pin]));
	const counts = new Map();
	const diff = git(["diff", "--no-ext-diff", "--no-textconv", "--unified=1"
		, coreHistoryEndpointIntegrationPredecessor
		, coreHistoryEndpointIntegrationImplementation, "--", inventoryPath]);
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
	assert.equal([...counts.values()].reduce((sum, count) => sum + count, 0), 44);
	for(const pin of pins.values())
	{
		assert.equal(counts.get(pin.path), pin.count, pin.path);
		assert.equal(sha256(git(["show"
			, coreHistoryEndpointIntegrationImplementation + ":" + pin.path]))
		, pin.currentSha256, pin.path);
	}
	const update = (await read()).updates[0];
	assert.equal(update.edits.length, 44);
	for(const edit of update.edits)
		for(const side of ["previous", "current"])
			assert.match(edit[side], /^ {10}"sha256": "[a-f0-9]{64}"\n$/u);
});

test("Core history endpoint integration streams exact inventory endpoints", async () => {
	const update = (await read()).updates[0];
	const pins = new Map(coreHistoryEndpointIntegrationPins.map(pin => [pin.path, pin]));
	const counts = new Map();
	const currentHash = createHash("sha256");
	const previousHash = createHash("sha256");
	const child = spawn("git", ["show"
		, coreHistoryEndpointIntegrationImplementation + ":" + inventoryPath]
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

test("Core history endpoint integration rejects unknown or forged transitions", async () => {
	const update = (await read()).integrationUpdates[0];
	const current = await sourceAtFinHistoryMilestone(update.path
		, update.currentSha256, beforeCoreHistoryEndpointIntegrationSource);
	assert.equal(beforeCoreHistoryEndpointIntegrationSource(
		update.path, current, update.currentSha256), current);
	const unknown = current + "\nunknown";
	assert.equal(beforeCoreHistoryEndpointIntegrationSource(
		update.path, unknown), unknown);
	for(const forged of [{ ...update, previousSha256: "0".repeat(64) }
		, { ...update, currentSha256: "0".repeat(64) }
		, { ...update, edits: [...update.edits, update.edits[0]] }
		, { ...update, edits: [] }, { ...update, path: "unrelated.mjs" }])
		assert.throws(() => reverseCoreHistoryEndpointIntegrationUpdate(current, forged));
	assert.equal(beforeCoreHistoryEndpointIntegrationSource(
		"unrelated.mjs", current), current);
});

test("Core history endpoint integration writer refuses another checkout", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-core-producer-pin-guard-"));
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
		"scripts/update-core-history-endpoint-integration-source-history.mjs")]
	, { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /exact integration base/u);
	assert.deepEqual(await readdir(root), [".git"]);
});

test("Core history endpoint integration reaches both repaired history boundaries", async () => {
	for(const path of [phpWasmCallbackEndpointStopHistoryPath
		, zeroPayloadDotnetArchiveGapHistoryPath]) {
		const record = JSON.parse(await readFile(path, "utf8"));
		for(const update of record.updates ?? record.historicalTransitions)
		{
			const current = await readFile(update.path, "utf8");
			assert.equal(sha256(beforeFinRefinementSource(update.path, current
				, update.previousSha256)), update.previousSha256, update.path);
			assert.equal(sha256(beforeFinRefinementSource(update.path, current
				, update.currentSha256)), update.currentSha256, update.path);
			const unknown = current + "\n// unrelated bytes\n";
			assert.equal(beforeFinRefinementSource(update.path, unknown
				, update.previousSha256), unknown, update.path);
		}
		}
});

test("Core history endpoint integration authenticates all three historical additions sets", async () => {
	for(const path of [inheritedCheckedRecordPromotionHistoryPath
		, primitiveAuditIntegrationHistoryPath
		, primitiveAuditCoreRepairHistoryPath]) {
		const record = JSON.parse(await readFile(path, "utf8"));
		assert.ok(record.additions.length > 0);
		for(const addition of record.additions)
			assert.equal(sha256(await sourceAtFinHistoryMilestone(
				addition.path, addition.currentSha256)), addition.currentSha256, addition.path);
		}
});

test("Core history endpoint integration follows both transfer-copy stages with exact stops", async () => {
	const record = JSON.parse(await readFile(ownedTransferCopyReplayRepairHistoryPath, "utf8"));
	for(const path of ownedTransferCopyNativeFollowupPaths)
	{
		const stages = record.historicalTransitions.filter(update => update.path === path);
		assert.equal(stages.length, 2, path);
		const latest = stages.find(update => update.currentCommit === ownedTransferCopyNativeFollowupCommit);
		assert.ok(latest, path);
		const prior = stages.find(update => update.currentSha256 === latest.previousSha256);
		assert.ok(prior, path);
		const current = await readFile(path, "utf8");
		for(const stop of [latest.currentSha256, latest.previousSha256, prior.previousSha256])
			assert.equal(sha256(beforeFinRefinementSource(path, current, stop)), stop, path);
		const unknown = current + "\n// unrecorded bytes\n";
		assert.equal(beforeFinRefinementSource(path, unknown, prior.previousSha256), unknown);
	}
});
