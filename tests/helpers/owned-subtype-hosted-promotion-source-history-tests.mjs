/**
 * Authenticate hosted Subtype promotion and unchanged original evidence.
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
import {
	collectCoreContractTestPaths, coreContractShardLabels, coreContractShardManifest
	, verifyCoreContractShardManifests
} from "../../scripts/core-contract-shards.mjs";
import { beforeFinRefinementSource, finRefinementNormalizationPaths } from "./fin-refinement-source-history.mjs";
import {
	beforeOwnedSubtypeHostedPromotionSource
	, ownedSubtypeHostedPromotionAddedPaths
	, ownedSubtypeHostedPromotionCommits
	, ownedSubtypeHostedPromotionChangedPaths
	, ownedSubtypeHostedPromotionImplementationPaths
	, ownedSubtypeHostedPromotionPins
	, ownedSubtypeHostedPromotionHistoryPath
	, ownedSubtypeHostedPromotionImplementation
	, ownedSubtypeHostedPromotionIntegrationPaths
	, ownedSubtypeHostedPromotionPredecessor
	, reverseOwnedSubtypeHostedPromotionUpdate
} from "./owned-subtype-hosted-promotion-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { authenticateSourceHistoryReverse, gitSourceBytes } from "./source-history-stream.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 2 * 1024 ** 2 });
const read = async () => JSON.parse(await readFile(ownedSubtypeHostedPromotionHistoryPath));
const predecessor = ownedSubtypeHostedPromotionPredecessor;
const implementation = ownedSubtypeHostedPromotionImplementation;

test("Owned Subtype hosted promotion records its exact implementation and integration", async () => {
	const record = await read();
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "owned-subtype-hosted-promotion-source-v1");
	assert.equal(record.predecessorCommit, predecessor);
	assert.equal(record.implementationCommit, implementation);
	assert.equal(record.integrationBaseCommit, implementation);
	assert.deepEqual(record.implementationCommits, ownedSubtypeHostedPromotionCommits);
	assert.deepEqual(git(["rev-list", "--reverse", `${predecessor}..${implementation}`]).trim().split("\n"), ownedSubtypeHostedPromotionCommits);
	for(const [index, revision] of ownedSubtypeHostedPromotionCommits.entries())
		assert.equal(git(["show", "-s", "--format=%P", revision]).trim()
			, index === 0 ? predecessor : ownedSubtypeHostedPromotionCommits[index - 1]);
	assert.deepEqual(git(["diff", "--name-only", predecessor, implementation]).trim().split("\n")
		, [...ownedSubtypeHostedPromotionImplementationPaths].sort());
	assert.deepEqual(record.updates.map(update => update.path), ownedSubtypeHostedPromotionChangedPaths);
	assert.deepEqual(record.integrationUpdates.map(update => update.path), ownedSubtypeHostedPromotionIntegrationPaths);
	assert.deepEqual(record.additions.map(addition => addition.path), ownedSubtypeHostedPromotionAddedPaths);
});

test("Owned Subtype hosted promotion reverses all eight source transitions", async () => {
	const record = await read();
	assert.equal(record.updates.length + record.integrationUpdates.length, 8);
	const inventory = record.updates.find(update => update.path === "docs/type-surface.v1.json");
	assert.ok(inventory);
	assert.equal(await authenticateSourceHistoryReverse(gitSourceBytes(implementation, inventory.path), inventory), true);
	const updates = [...record.updates.filter(update => update !== inventory), ...record.integrationUpdates];
	for(const update of updates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path, update.currentSha256);
		const prior = record.integrationUpdates.includes(update) ? implementation : predecessor;
		const original = git(["show", `${prior}:${update.path}`]);
		assert.equal(reverseOwnedSubtypeHostedPromotionUpdate(current, update), original);
		assert.equal(beforeOwnedSubtypeHostedPromotionSource(update.path, current, update.currentSha256), current);
		assert.equal(beforeFinRefinementSource(update.path, current, update.previousSha256), original);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(addition.path, addition.currentSha256))
			, addition.currentSha256);
});

test("Owned Subtype hosted promotion preserves runtime and original evidence", () => {
	for(const path of ["src/backends", "src/build", "src/analyze"
		, "docs/reference", "docs/consume", "docs/lean"
		, "site", "package.json", "package-lock.json", "lean-toolchain"])
		assert.equal(git(["rev-parse", `${predecessor}:${path}`])
			, git(["rev-parse", `${implementation}:${path}`]), path);
	assert.equal(git(["diff", "--name-only", "--diff-filter=MDRCT"
		, predecessor, implementation, "--", "docs/evidence"]), "");
});

test("Owned Subtype hosted promotion changes exactly 230 live source pins", async () => {
	const pins = new Map(ownedSubtypeHostedPromotionPins.map(pin => [pin.path, pin]));
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
	assert.equal(current.digest("hex"), "a1c0e7d484f135d38f18aab9a8ea9b7c2e6c1b4313440379c90713c76fc1c7f8");
	assert.equal(previous.digest("hex"), "b54c2ce0028c1a5ec94d03e792b0c6cab352732c9a67e6612580f6766338bf57");
	assert.equal([...counts.values()].reduce((sum, count) => sum + count, 0), 230);
	for(const pin of pins.values())
	{
		assert.equal(counts.get(pin.path) ?? 0, pin.count);
		assert.equal(sha256(git(["show", `${predecessor}:${pin.path}`])), pin.previousSha256);
		assert.equal(sha256(git(["show", `${implementation}:${pin.path}`])), pin.currentSha256);
	}
});

test("Owned Subtype hosted promotion refuses unknown and altered transitions", async () => {
	const update = (await read()).updates.find(item => item.path !== "docs/type-surface.v1.json");
	const current = await sourceAtFinHistoryMilestone(update.path, update.currentSha256);
	for(const forged of [{ ...update, previousSha256: "0".repeat(64) }
		, { ...update, currentSha256: "0".repeat(64) }
		, { ...update, path: "unrelated.mjs" }, { ...update, edits: [] }
		, { ...update, edits: [...update.edits, update.edits[0]] }])
		assert.throws(() => reverseOwnedSubtypeHostedPromotionUpdate(current, forged));
	assert.equal(beforeOwnedSubtypeHostedPromotionSource(update.path, current + "unknown"), current + "unknown");
	assert.equal(beforeOwnedSubtypeHostedPromotionSource("unrelated.mjs", current), current);
});

test("Owned Subtype hosted promotion writer refuses an unrelated checkout", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-owned-subtype-hosted-promotion-history-guard-"));
	t.after(() => rm(root, { recursive: true }));
	const child = spawnSync(process.execPath, [resolve("scripts/update-owned-subtype-hosted-promotion-source-history.mjs")]
		, { cwd: root, encoding: "utf8", timeout: 15_000 });
	assert.notEqual(child.status, 0);
	assert.equal(child.stdout, "");
	assert.deepEqual(await readdir(root), []);
});

test("Owned Subtype hosted promotion binds source qualification without claiming execution", async () => {
	const path = "docs/evidence/owned-subtype-hosted-promotion-20261025.json";
	const evidence = JSON.parse(await readFile(path));
	assert.equal(evidence.implementationCommit, implementation);
	assert.equal(evidence.kind, "owned-subtype-hosted-promotion-source-v1");
	assert.equal(evidence.sourceBaseCommit, predecessor);
	assert.equal(evidence.sources.length, 9);
	for(const item of evidence.sources)
	{
		const digest = createHash("sha256");
		let bytes = 0;
		for await(const chunk of gitSourceBytes(implementation, item.path))
		{ digest.update(chunk); bytes += chunk.length; }
		assert.equal(bytes, item.bytes, item.path);
		assert.equal(digest.digest("hex"), item.sha256, item.path);
	}
	assert.equal(evidence.contract.hostedLanes, 8);
	assert.equal(evidence.contract.consumerProfiles, 16);
	assert.equal(evidence.contract.promotionCells, 32);
	assert.equal(evidence.contract.serialReplay, true);
	assert.equal(evidence.contract.missingEvidenceFails, true);
	assert.equal(evidence.validation.focused.passed, 12);
	assert.equal(evidence.validation.installedRuntimeExecutions, 0);
	assert.equal(evidence.validation.inventory.stalePins, 0);
	assert.equal(evidence.validation.inventory.refreshedPins, 230);
	assert.equal(evidence.validation.originalArchiveReplay.result.files, 1683);
	assert.equal(evidence.validation.originalArchiveReplay.result.producerCommit
		, "390ae18d3a2607bc73463767a33fea0cfb9350b0");
	assert.equal(evidence.pending.length, 3);
	const registration = evidence.registration.source;
	const transition = (await read()).updates.find(update => update.path === registration.path);
	assert.ok(transition);
	assert.equal(registration.sha256, transition.currentSha256);
	assert.equal(evidence.registration.partition.contractFiles, 1009);
});

test("Owned Subtype hosted promotion preserves every existing runtime probe and Lean fixture", () => {
	for(const path of ["tests/fixtures/onboarding/owned-subtypes"
		, "tests/owned-checked-record-javascript-packaging.test.mjs"
		, "tests/helpers/owned-javascript-npm-browser.mjs"])
		assert.equal(git(["rev-parse", `${predecessor}:${path}`])
			, git(["rev-parse", `${implementation}:${path}`]), path);
	const path = "tests/owned-subtype-javascript-packaging.test.mjs";
	const probe = source => source.slice(source.indexOf("const probe = ")
		, source.indexOf("\nfor(const reviewed of"));
	assert.equal(probe(git(["show", `${predecessor}:${path}`]))
		, probe(git(["show", `${implementation}:${path}`])));
});

test("Owned Subtype hosted promotion registers hosted promotion controls in Core", async () => {
	const paths = await collectCoreContractTestPaths();
	const manifests = coreContractShardLabels.map(label => coreContractShardManifest(paths, label));
	const verified = verifyCoreContractShardManifests(paths, manifests);
	assert.equal(verified.contractFiles, paths.length);
	const suites = ["tests/owned-subtype-javascript-evidence.test.mjs"
		, "tests/owned-subtype-javascript-hosted.test.mjs"
		, "tests/owned-subtype-hosted-promotion.test.mjs"];
	for(const path of suites)
	{
		assert.ok(paths.includes(path));
		assert.equal(manifests.filter(manifest => manifest.selection.files.includes(path)).length, 1);
	}
});

test("Owned Subtype hosted promotion writer cannot overwrite retained evidence", async () => {
	const before = await readFile(ownedSubtypeHostedPromotionHistoryPath);
	const result = spawnSync(process.execPath, ["--max-old-space-size=512"
		, "scripts/update-owned-subtype-hosted-promotion-source-history.mjs"]
	, { encoding: "utf8", timeout: 15_000 });
	assert.notEqual(result.status, 0);
	assert.deepEqual(await readFile(ownedSubtypeHostedPromotionHistoryPath), before);
});
