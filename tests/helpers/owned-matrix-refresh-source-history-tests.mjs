/**
 * Authenticate the refreshed matrix while preserving support and earlier evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createInterface } from "node:readline";
import { Readable } from "node:stream";
import test from "node:test";
import { beforeFinRefinementSource, finRefinementNormalizationPaths } from "./fin-refinement-source-history.mjs";
import {
	beforeOwnedMatrixRefreshSource
	, ownedMatrixRefreshAddedPaths
	, ownedMatrixRefreshChangedPaths
	, ownedMatrixRefreshCommits
	, ownedMatrixRefreshImplementationPaths
	, ownedMatrixRefreshPins
	, ownedMatrixRefreshHistoryPath
	, ownedMatrixRefreshImplementation
	, ownedMatrixRefreshIntegrationPaths
	, ownedMatrixRefreshPredecessor
	, reverseOwnedMatrixRefreshUpdate
} from "./owned-matrix-refresh-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { readPromotionInventory } from "./type-surface-promotion-io.mjs";
import { authenticateSourceHistoryReverse, gitSourceBytes } from "./source-history-stream.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 2 * 1024 ** 2 });
const read = async () => JSON.parse(await readFile(ownedMatrixRefreshHistoryPath));
const predecessor = ownedMatrixRefreshPredecessor;
const implementation = ownedMatrixRefreshImplementation;

test("Owned matrix refresh records its exact implementation and integration", async () => {
	const record = await read();
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "owned-matrix-refresh-source-v1");
	assert.equal(record.predecessorCommit, predecessor);
	assert.equal(record.implementationCommit, implementation);
	assert.equal(record.integrationBaseCommit, implementation);
	assert.deepEqual(record.implementationCommits, ownedMatrixRefreshCommits);
	assert.deepEqual(git(["rev-list", "--reverse", `${predecessor}..${implementation}`]).trim().split("\n")
		, ownedMatrixRefreshCommits);
	for(const [index, revision] of ownedMatrixRefreshCommits.entries())
		assert.equal(git(["show", "-s", "--format=%P", revision]).trim()
			, index === 0 ? predecessor : ownedMatrixRefreshCommits[index - 1]);
	assert.deepEqual(git(["diff", "--name-only", predecessor, implementation]).trim().split("\n")
		, [...ownedMatrixRefreshImplementationPaths].sort());
	assert.deepEqual(record.updates.map(update => update.path), ownedMatrixRefreshChangedPaths);
	assert.deepEqual(record.integrationUpdates.map(update => update.path), ownedMatrixRefreshIntegrationPaths);
	assert.deepEqual(record.additions.map(addition => addition.path), ownedMatrixRefreshAddedPaths);
});

test("Owned matrix refresh reverses all twenty-five source transitions", async () => {
	const record = await read();
	assert.equal(record.updates.length + record.integrationUpdates.length, 25);
	const inventory = record.updates.find(update => update.path === "docs/type-surface.v1.json");
	assert.ok(inventory);
	assert.equal(await authenticateSourceHistoryReverse(gitSourceBytes(implementation, inventory.path), inventory), true);
	const updates = [...record.updates.filter(update => update !== inventory), ...record.integrationUpdates];
	for(const update of updates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path, update.currentSha256);
		const prior = record.integrationUpdates.includes(update) ? implementation : predecessor;
		const original = git(["show", `${prior}:${update.path}`]);
		assert.equal(reverseOwnedMatrixRefreshUpdate(current, update), original);
		assert.equal(beforeOwnedMatrixRefreshSource(update.path, current, update.currentSha256), current);
		assert.equal(beforeFinRefinementSource(update.path, current, update.previousSha256), original);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(addition.path, addition.currentSha256))
			, addition.currentSha256);
});

test("Owned matrix refresh preserves runtime and original evidence", () => {
	for(const path of ["src", "site", ".github", "schema", "demos"
		, "package.json", "package-lock.json", "lean-toolchain"])
		assert.equal(git(["rev-parse", `${predecessor}:${path}`])
			, git(["rev-parse", `${implementation}:${path}`]), path);
	assert.equal(git(["diff", "--name-only", "--diff-filter=MDRCT"
		, predecessor, implementation, "--", "docs/evidence"]), "");
});

test("Owned matrix refresh preserves every support observation", async () => {
	const contracts = {
		irSchema: JSON.parse(await readFile("schema/binding-ir.schema.json"))
		, consumers: JSON.parse(await readFile("docs/consumer-support.v1.json"))
	};
	const previous = await readPromotionInventory(
		Readable.from(gitSourceBytes(predecessor, "docs/type-surface.v1.json"))
		, contracts
	);
	const current = await readPromotionInventory(
		Readable.from(gitSourceBytes(implementation, "docs/type-surface.v1.json"))
		, contracts
	);
	assert.deepEqual(Object.keys(current.document), Object.keys(previous.document));
	for(const key of Object.keys(previous.document).filter(key => key !== "evidence"))
		assert.deepEqual(current.document[key], previous.document[key], key);
	assert.deepEqual(current.document.evidence.map(entry => entry.id)
		, previous.document.evidence.map(entry => entry.id));
});

test("Owned matrix refresh changes 192 pins and retains 55 freshly verified pins", async () => {
	const pins = new Map(ownedMatrixRefreshPins.map(pin => [pin.path, pin]));
	const input = Readable.from(gitSourceBytes(implementation, "docs/type-surface.v1.json"));
	const current = createHash("sha256"), staged = createHash("sha256");
	const counts = new Map(), alreadyCurrent = new Map();
	let bytes = 0, mode, pending, evidence;
	input.on("data", chunk => { current.update(chunk); bytes += chunk.length; });
	for await(const line of createInterface({ input, crlfDelay: Infinity }))
	{
		const id = /^ {6}"id": "([^"]+)",$/u.exec(line);
		if(id) evidence = id[1];
		if(line === '      "files": [') mode = "files";
		if(line === '      "artifacts": [') mode = "artifacts";
		if(line === "      ]," || line === "      ]") mode = undefined;
		let restored = line;
		if(pending)
		{
			assert.equal(mode, "files");
			assert.equal(line, '          "sha256": "' + pending.currentSha256 + '"');
			assert.equal(typeof evidence, "string");
			if(/^owned-checked-record-[a-z-]+-hosted-installed$/u.test(evidence))
				alreadyCurrent.set(pending.path, (alreadyCurrent.get(pending.path) ?? 0) + 1);
			else
			{
				restored = '          "sha256": "' + pending.previousSha256 + '"';
				counts.set(pending.path, (counts.get(pending.path) ?? 0) + 1);
			}
		}
		const match = /^ {10}"path": "([^"]+)",$/u.exec(line);
		pending = mode === "files" && match ? pins.get(match[1]) : undefined;
		staged.update(restored + "\n");
	}
	assert.equal(bytes, 102579190);
	assert.equal(current.digest("hex"), "a74ff33edc7b919f90e0f4c497fe452c879ffcb5a165309862e2057ec5f85aed");
	assert.equal(staged.digest("hex"), "3a0f48f9f1feb80bf5111f9ddaff641d49d8e4b1297d5907c0c5da6f2e854e21");
	assert.equal([...counts.values()].reduce((sum, count) => sum + count, 0), 192);
	assert.equal([...alreadyCurrent.values()].reduce((sum, count) => sum + count, 0), 55);
	for(const pin of pins.values())
	{
		assert.equal(counts.get(pin.path) ?? 0, pin.count);
		assert.equal(alreadyCurrent.get(pin.path) ?? 0, pin.alreadyCurrent);
		assert.equal(sha256(git(["show", `${predecessor}:${pin.path}`])), pin.previousSha256);
		assert.equal(sha256(git(["show", `${implementation}:${pin.path}`])), pin.currentSha256);
	}
});

test("Owned matrix refresh refuses unknown and altered transitions", async () => {
	const update = (await read()).updates.find(item => item.path !== "docs/type-surface.v1.json");
	const current = await sourceAtFinHistoryMilestone(update.path, update.currentSha256);
	for(const forged of [{ ...update, previousSha256: "0".repeat(64) }
		, { ...update, currentSha256: "0".repeat(64) }
		, { ...update, path: "unrelated.mjs" }, { ...update, edits: [] }
		, { ...update, edits: [...update.edits, update.edits[0]] }])
		assert.throws(() => reverseOwnedMatrixRefreshUpdate(current, forged));
	assert.equal(beforeOwnedMatrixRefreshSource(update.path, current + "unknown"), current + "unknown");
	assert.equal(beforeOwnedMatrixRefreshSource("unrelated.mjs", current), current);
});

test("Owned matrix refresh writer refuses an unrelated checkout", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-owned-matrix-refresh-history-guard-"));
	t.after(() => rm(root, { recursive: true }));
	const child = spawnSync(process.execPath, [resolve("scripts/update-owned-matrix-refresh-source-history.mjs")]
		, { cwd: root, encoding: "utf8", timeout: 15_000 });
	assert.notEqual(child.status, 0);
	assert.equal(child.stdout, "");
	assert.deepEqual(await readdir(root), []);
});
