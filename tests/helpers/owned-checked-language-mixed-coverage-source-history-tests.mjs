/**
 * Authenticate complete language mixed-coverage sources without changing support claims.
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
	beforeOwnedCheckedLanguageMixedCoverageSource
	, ownedCheckedLanguageMixedCoverageAddedPaths
	, ownedCheckedLanguageMixedCoverageChangedPaths
	, ownedCheckedLanguageMixedCoverageImplementationPaths
	, ownedCheckedLanguageMixedCoveragePins
	, ownedCheckedLanguageMixedCoverageHistoryPath
	, ownedCheckedLanguageMixedCoverageImplementation
	, ownedCheckedLanguageMixedCoverageIntegrationPaths
	, ownedCheckedLanguageMixedCoveragePredecessor
	, reverseOwnedCheckedLanguageMixedCoverageUpdate
} from "./owned-checked-language-mixed-coverage-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { authenticateSourceHistoryReverse, gitSourceBytes } from "./source-history-stream.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 2 * 1024 ** 2 });
const read = async () => JSON.parse(await readFile(ownedCheckedLanguageMixedCoverageHistoryPath));
const predecessor = ownedCheckedLanguageMixedCoveragePredecessor;
const implementation = ownedCheckedLanguageMixedCoverageImplementation;

test("Owned checked language mixed coverage records its exact implementation and integration", async () => {
	const record = await read();
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "owned-checked-language-mixed-coverage-source-v1");
	assert.equal(record.predecessorCommit, predecessor);
	assert.equal(record.implementationCommit, implementation);
	assert.equal(record.integrationBaseCommit, implementation);
	assert.deepEqual(record.implementationCommits, [implementation]);
	assert.equal(git(["show", "-s", "--format=%P", implementation]).trim(), predecessor);
	assert.deepEqual(git(["diff", "--name-only", predecessor, implementation]).trim().split("\n")
		, [...ownedCheckedLanguageMixedCoverageImplementationPaths].sort());
	assert.deepEqual(record.updates.map(update => update.path), ownedCheckedLanguageMixedCoverageChangedPaths);
	assert.deepEqual(record.integrationUpdates.map(update => update.path), ownedCheckedLanguageMixedCoverageIntegrationPaths);
	assert.deepEqual(record.additions.map(addition => addition.path), ownedCheckedLanguageMixedCoverageAddedPaths);
});

test("Owned checked language mixed coverage reverses all eleven source transitions", async () => {
	const record = await read();
	assert.equal(record.updates.length + record.integrationUpdates.length, 11);
	const inventory = record.updates.find(update => update.path === "docs/type-surface.v1.json");
	assert.ok(inventory);
	assert.equal(await authenticateSourceHistoryReverse(gitSourceBytes(implementation, inventory.path), inventory), true);
	const updates = [...record.updates.filter(update => update !== inventory), ...record.integrationUpdates];
	for(const update of updates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path, update.currentSha256);
		const prior = record.integrationUpdates.includes(update) ? implementation : predecessor;
		const original = git(["show", `${prior}:${update.path}`]);
		assert.equal(reverseOwnedCheckedLanguageMixedCoverageUpdate(current, update), original);
		assert.equal(beforeOwnedCheckedLanguageMixedCoverageSource(update.path, current, update.currentSha256), current);
		assert.equal(beforeFinRefinementSource(update.path, current, update.previousSha256), original);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(addition.path, addition.currentSha256))
			, addition.currentSha256);
});

test("Owned checked language mixed coverage preserves runtime and original evidence", () => {
	for(const path of ["src", "docs/reference", "docs/consume", "docs/lean"
		, "site", "package.json", "package-lock.json", "lean-toolchain"])
		assert.equal(git(["rev-parse", `${predecessor}:${path}`])
			, git(["rev-parse", `${implementation}:${path}`]), path);
	assert.equal(git(["diff", "--name-only", "--diff-filter=MDRCT"
		, predecessor, implementation, "--", "docs/evidence"]), "");
});

test("Owned checked language mixed coverage changes exactly eleven live test-source pins", async () => {
	const pins = new Map(ownedCheckedLanguageMixedCoveragePins.map(pin => [pin.path, pin]));
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
	assert.equal(current.digest("hex"), "461aafdb9246c6187cfbd9951987f1200dc8ec68b7b9cb8bd4aad1c5746d6f3b");
	assert.equal(previous.digest("hex"), "929f3bed60d3eb7d2ac429fb62899e3a9bd9780e79bddd6c2a24d798114f210d");
	assert.equal([...counts.values()].reduce((sum, count) => sum + count, 0), 11);
	for(const pin of pins.values())
	{
		assert.equal(counts.get(pin.path) ?? 0, pin.count);
		assert.equal(sha256(git(["show", `${predecessor}:${pin.path}`])), pin.previousSha256);
		assert.equal(sha256(git(["show", `${implementation}:${pin.path}`])), pin.currentSha256);
	}
});

test("Owned checked language mixed coverage refuses unknown and altered transitions", async () => {
	const update = (await read()).updates.find(item => item.path !== "docs/type-surface.v1.json");
	const current = await sourceAtFinHistoryMilestone(update.path, update.currentSha256);
	for(const forged of [{ ...update, previousSha256: "0".repeat(64) }
		, { ...update, currentSha256: "0".repeat(64) }
		, { ...update, path: "unrelated.mjs" }, { ...update, edits: [] }
		, { ...update, edits: [...update.edits, update.edits[0]] }])
		assert.throws(() => reverseOwnedCheckedLanguageMixedCoverageUpdate(current, forged));
	assert.equal(beforeOwnedCheckedLanguageMixedCoverageSource(update.path, current + "unknown"), current + "unknown");
	assert.equal(beforeOwnedCheckedLanguageMixedCoverageSource("unrelated.mjs", current), current);
});

test("Owned checked language mixed coverage writer refuses an unrelated checkout", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-owned-checked-language-mixed-coverage-history-guard-"));
	t.after(() => rm(root, { recursive: true }));
	const child = spawnSync(process.execPath, [resolve("scripts/update-owned-checked-language-mixed-coverage-source-history.mjs")]
		, { cwd: root, encoding: "utf8", timeout: 15_000 });
	assert.notEqual(child.status, 0);
	assert.equal(child.stdout, "");
	assert.deepEqual(await readdir(root), []);
});

test("Owned checked language mixed coverage binds source qualification without claiming installed execution", async () => {
	const path = "docs/evidence/owned-checked-language-mixed-coverage-20261025.json";
	const evidence = JSON.parse(git(["show", `${implementation}:${path}`]));
	assert.equal(evidence.profile, "owned-checked-language-mixed-source-qualification");
	assert.equal(evidence.predecessorCommit, predecessor);
	assert.equal(evidence.sourceIdentity.kind, "pre-implementation-working-tree-bytes");
	assert.equal(evidence.sourceIdentity.files.length, 8);
	for(const item of evidence.sourceIdentity.files)
	{
		const source = git(["show", `${implementation}:${item.path}`]);
		assert.equal(Buffer.byteLength(source), item.bytes, item.path);
		assert.equal(sha256(source), item.sha256, item.path);
	}
	assert.equal(evidence.validation.focusedGenerators.pass, 4);
	assert.equal(evidence.validation.promotionControls.pass, 4);
	assert.equal(evidence.validation.realLeanCarriers.pass, 2);
	assert.equal(evidence.validation.liveInventoryAudit.stalePins, 0);
	assert.equal(evidence.inventory.supportObservationsChanged, false);
	assert.equal(evidence.inventory.originalArchivesChanged, false);
	assert.equal(evidence.pending.length, 4);
	assert.match(evidence.scope, /not installed runtime or lifetime acceptance/u);
});
