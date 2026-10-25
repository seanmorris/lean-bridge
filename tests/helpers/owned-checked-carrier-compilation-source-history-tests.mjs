/**
 * Authenticate complete owned carrier compilation without changing support claims.
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
	beforeOwnedCheckedCarrierCompilationSource
	, ownedCheckedCarrierCompilationAddedPaths
	, ownedCheckedCarrierCompilationChangedPaths
	, ownedCheckedCarrierCompilationImplementationPaths
	, ownedCheckedCarrierCompilationPins
	, ownedCheckedCarrierCompilationHistoryPath
	, ownedCheckedCarrierCompilationImplementation
	, ownedCheckedCarrierCompilationIntegrationPaths
	, ownedCheckedCarrierCompilationPredecessor
	, reverseOwnedCheckedCarrierCompilationUpdate
} from "./owned-checked-carrier-compilation-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { authenticateSourceHistoryReverse, gitSourceBytes } from "./source-history-stream.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 2 * 1024 ** 2 });
const read = async () => JSON.parse(await readFile(ownedCheckedCarrierCompilationHistoryPath));
const predecessor = ownedCheckedCarrierCompilationPredecessor;
const implementation = ownedCheckedCarrierCompilationImplementation;

test("Owned checked carrier compilation records its exact implementation and integration", async () => {
	const record = await read();
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "owned-checked-carrier-compilation-source-v1");
	assert.equal(record.predecessorCommit, predecessor);
	assert.equal(record.implementationCommit, implementation);
	assert.equal(record.integrationBaseCommit, implementation);
	assert.deepEqual(record.implementationCommits, [implementation]);
	assert.equal(git(["show", "-s", "--format=%P", implementation]).trim(), predecessor);
	assert.deepEqual(git(["diff", "--name-only", predecessor, implementation]).trim().split("\n")
		, [...ownedCheckedCarrierCompilationImplementationPaths].sort());
	assert.deepEqual(record.updates.map(update => update.path), ownedCheckedCarrierCompilationChangedPaths);
	assert.deepEqual(record.integrationUpdates.map(update => update.path), ownedCheckedCarrierCompilationIntegrationPaths);
	assert.deepEqual(record.additions.map(addition => addition.path), ownedCheckedCarrierCompilationAddedPaths);
});

test("Owned checked carrier compilation reverses all six source transitions", async () => {
	const record = await read();
	assert.equal(record.updates.length + record.integrationUpdates.length, 6);
	const inventory = record.updates.find(update => update.path === "docs/type-surface.v1.json");
	assert.ok(inventory);
	assert.equal(await authenticateSourceHistoryReverse(gitSourceBytes(implementation, inventory.path), inventory), true);
	const updates = [...record.updates.filter(update => update !== inventory), ...record.integrationUpdates];
	for(const update of updates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path, update.currentSha256);
		const prior = record.integrationUpdates.includes(update) ? implementation : predecessor;
		const original = git(["show", `${prior}:${update.path}`]);
		assert.equal(reverseOwnedCheckedCarrierCompilationUpdate(current, update), original);
		assert.equal(beforeOwnedCheckedCarrierCompilationSource(update.path, current, update.currentSha256), current);
		assert.equal(beforeFinRefinementSource(update.path, current, update.previousSha256), original);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(addition.path, addition.currentSha256))
			, addition.currentSha256);
});

test("Owned checked carrier compilation preserves runtime and original evidence", () => {
	for(const path of ["src", "docs/reference", "docs/consume", "docs/lean"
		, "site", "package.json", "package-lock.json", "lean-toolchain"])
		assert.equal(git(["rev-parse", `${predecessor}:${path}`])
			, git(["rev-parse", `${implementation}:${path}`]), path);
	assert.equal(git(["diff", "--name-only", "--diff-filter=MDRCT"
		, predecessor, implementation, "--", "docs/evidence"]), "");
});

test("Owned checked carrier compilation changes exactly four live test-source pins", async () => {
	const pins = new Map(ownedCheckedCarrierCompilationPins.map(pin => [pin.path, pin]));
	const input = Readable.from(gitSourceBytes(implementation, "docs/type-surface.v1.json"));
	const current = createHash("sha256"), previous = createHash("sha256");
	const counts = new Map();
	let bytes = 0, mode, pending;
	input.on("data", chunk => { current.update(chunk); bytes += chunk.length; });
	for await(const line of createInterface({ input, crlfDelay: Infinity }))
	{
		if(line === '      "files": [') mode = "files";
		if(line === '      "artifacts": [') mode = "artifacts";
		if(line === "      ]," || line === "      ]") mode = undefined;
		let restored = line;
		if(pending)
		{
			assert.equal(mode, "files");
			assert.equal(line, '          "sha256": "' + pending.currentSha256 + '"');
			restored = '          "sha256": "' + pending.previousSha256 + '"';
			counts.set(pending.path, (counts.get(pending.path) ?? 0) + 1);
		}
		const match = /^ {10}"path": "([^"]+)",$/u.exec(line);
		pending = mode === "files" && match ? pins.get(match[1]) : undefined;
		previous.update(restored + "\n");
	}
	assert.equal(bytes, 102579190);
	assert.equal(current.digest("hex"), "e2c8af3be42bd903a44c809b82898dd50555658602a53818ed15373b43b0720e");
	assert.equal(previous.digest("hex"), "a74ff33edc7b919f90e0f4c497fe452c879ffcb5a165309862e2057ec5f85aed");
	assert.equal([...counts.values()].reduce((sum, count) => sum + count, 0), 4);
	for(const pin of pins.values())
	{
		assert.equal(counts.get(pin.path) ?? 0, pin.count);
		assert.equal(sha256(git(["show", `${predecessor}:${pin.path}`])), pin.previousSha256);
		assert.equal(sha256(git(["show", `${implementation}:${pin.path}`])), pin.currentSha256);
	}
});

test("Owned checked carrier compilation refuses unknown and altered transitions", async () => {
	const update = (await read()).updates.find(item => item.path !== "docs/type-surface.v1.json");
	const current = await sourceAtFinHistoryMilestone(update.path, update.currentSha256);
	for(const forged of [{ ...update, previousSha256: "0".repeat(64) }
		, { ...update, currentSha256: "0".repeat(64) }
		, { ...update, path: "unrelated.mjs" }, { ...update, edits: [] }
		, { ...update, edits: [...update.edits, update.edits[0]] }])
		assert.throws(() => reverseOwnedCheckedCarrierCompilationUpdate(current, forged));
	assert.equal(beforeOwnedCheckedCarrierCompilationSource(update.path, current + "unknown"), current + "unknown");
	assert.equal(beforeOwnedCheckedCarrierCompilationSource("unrelated.mjs", current), current);
});

test("Owned checked carrier compilation writer refuses an unrelated checkout", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-owned-checked-carrier-compilation-history-guard-"));
	t.after(() => rm(root, { recursive: true }));
	const child = spawnSync(process.execPath, [resolve("scripts/update-owned-checked-carrier-compilation-source-history.mjs")]
		, { cwd: root, encoding: "utf8", timeout: 15_000 });
	assert.notEqual(child.status, 0);
	assert.equal(child.stdout, "");
	assert.deepEqual(await readdir(root), []);
});

test("Owned checked carrier compilation binds all nineteen audited sources and retained TAP", async () => {
	const receipt = JSON.parse(await readFile(
		"docs/evidence/owned-checked-carrier-compilation-20261025.json", "utf8"
	));
	assert.equal(receipt.predecessorCommit, predecessor);
	assert.equal(receipt.sources.length, 19);
	assert.equal(new Set(receipt.sources.map(source => source.path)).size, 19);
	for(const source of receipt.sources)
		assert.equal(sha256(git(["show", `${implementation}:${source.path}`]))
			, source.sha256, source.path);
	for(const [name, count] of [["foundation", 12], ["adjacent", 26], ["requiredCiSelection", 2]])
	{
		const result = receipt.validation[name];
		assert.equal(result.passed, count);
		assert.equal(result.failed, 0);
		assert.equal(result.skipped, 0);
		assert.match(result.tap, /^TAP version 13\n/u);
		for(const point of [`tests ${count}`, `pass ${count}`, "fail 0", "skipped 0"])
			assert.ok(result.tap.split("\n").includes(`# ${point}`), name);
	}
	assert.equal(receipt.inventory.refreshedPins, 4);
	assert.equal(receipt.notEstablished.length, 4);
});
