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
	beforePerlPromotionLivePinRepairSource
	, perlPromotionLivePinRepairAddedPaths
	, perlPromotionLivePinRepairChangedPaths
	, perlPromotionLivePinRepairCommits
	, perlPromotionLivePinRepairHistoryPath
	, perlPromotionLivePinRepairImplementation
	, perlPromotionLivePinRepairIntegrationBase
	, perlPromotionLivePinRepairIntegrationPaths
	, perlPromotionLivePinRepairPins
	, perlPromotionLivePinRepairPredecessor
	, reversePerlPromotionLivePinRepairUpdate
} from "./perl-promotion-live-pin-repair-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 2 * 1024 * 1024 });
const read = async () => JSON.parse(await readFile(
	perlPromotionLivePinRepairHistoryPath, "utf8"));
const inventoryPath = "docs/type-surface.v1.json";

test("Perl promotion live-pin repair authenticates its wiring and lineage", async () => {
	const record = await read();
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "perl-promotion-live-pin-repair-source-v1");
	assert.equal(record.predecessorCommit, perlPromotionLivePinRepairPredecessor);
	assert.equal(record.implementationCommit, perlPromotionLivePinRepairImplementation);
	assert.equal(record.integrationBaseCommit, perlPromotionLivePinRepairIntegrationBase);
	assert.deepEqual(record.implementationCommits, perlPromotionLivePinRepairCommits);
	assert.deepEqual(record.updates.map(item => item.path)
		, perlPromotionLivePinRepairChangedPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, perlPromotionLivePinRepairIntegrationPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, perlPromotionLivePinRepairAddedPaths);
	assert.equal(git(["rev-parse"
		, perlPromotionLivePinRepairImplementation + "^"]).trim()
	, perlPromotionLivePinRepairPredecessor);
	assert.deepEqual(git(["diff", "--name-only"
		, perlPromotionLivePinRepairPredecessor
		, perlPromotionLivePinRepairImplementation]).trim().split("\n")
	, [inventoryPath]);
	for(const update of record.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256, beforePerlPromotionLivePinRepairSource);
		const previous = git(["show"
			, perlPromotionLivePinRepairIntegrationBase + ":" + update.path]);
		assert.equal(reversePerlPromotionLivePinRepairUpdate(
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

test("Perl promotion live-pin repair changes exactly 16 named hashes", async () => {
	const pins = new Map(perlPromotionLivePinRepairPins.map(pin => [pin.path, pin]));
	const counts = new Map();
	const diff = git(["diff", "--no-ext-diff", "--no-textconv", "--unified=1"
		, perlPromotionLivePinRepairPredecessor
		, perlPromotionLivePinRepairImplementation, "--", inventoryPath]);
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
	assert.equal([...counts.values()].reduce((sum, count) => sum + count, 0), 16);
	for(const pin of pins.values())
	{
		assert.equal(counts.get(pin.path), pin.count, pin.path);
		assert.equal(sha256(git(["show"
			, perlPromotionLivePinRepairImplementation + ":" + pin.path]))
		, pin.currentSha256, pin.path);
	}
	const update = (await read()).updates[0];
	assert.equal(update.edits.length, 16);
	for(const edit of update.edits)
		for(const side of ["previous", "current"])
			assert.match(edit[side], /^ {10}"sha256": "[a-f0-9]{64}"\n$/u);
});

test("Perl promotion live-pin repair streams exact inventory endpoints", async () => {
	const update = (await read()).updates[0];
	const pins = new Map(perlPromotionLivePinRepairPins.map(pin => [pin.path, pin]));
	const counts = new Map();
	const currentHash = createHash("sha256");
	const previousHash = createHash("sha256");
	const child = spawn("git", ["show"
		, perlPromotionLivePinRepairImplementation + ":" + inventoryPath]
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

test("Perl promotion live-pin repair rejects unknown or forged transitions", async () => {
	const update = (await read()).integrationUpdates[0];
	const current = await sourceAtFinHistoryMilestone(update.path
		, update.currentSha256, beforePerlPromotionLivePinRepairSource);
	assert.equal(beforePerlPromotionLivePinRepairSource(
		update.path, current, update.currentSha256), current);
	const unknown = current + "\nunknown";
	assert.equal(beforePerlPromotionLivePinRepairSource(
		update.path, unknown), unknown);
	for(const forged of [{ ...update, previousSha256: "0".repeat(64) }
		, { ...update, currentSha256: "0".repeat(64) }
		, { ...update, edits: [...update.edits, update.edits[0]] }
		, { ...update, edits: [] }, { ...update, path: "unrelated.mjs" }])
		assert.throws(() => reversePerlPromotionLivePinRepairUpdate(current, forged));
	assert.equal(beforePerlPromotionLivePinRepairSource(
		"unrelated.mjs", current), current);
});

test("Perl promotion live-pin writer refuses another checkout", async t => {
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
		"scripts/update-perl-promotion-live-pin-repair-source-history.mjs")]
	, { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /exact integration base/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
