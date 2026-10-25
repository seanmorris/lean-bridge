/**
 * Authenticate complete Subtype npm acceptance and unchanged original evidence.
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
	beforeOwnedSubtypeNpmCompleteAcceptanceSource
	, ownedSubtypeNpmCompleteAcceptanceAddedPaths
	, ownedSubtypeNpmCompleteAcceptanceChangedPaths
	, ownedSubtypeNpmCompleteAcceptanceImplementationPaths
	, ownedSubtypeNpmCompleteAcceptancePins
	, ownedSubtypeNpmCompleteAcceptanceHistoryPath
	, ownedSubtypeNpmCompleteAcceptanceImplementation
	, ownedSubtypeNpmCompleteAcceptanceIntegrationPaths
	, ownedSubtypeNpmCompleteAcceptancePredecessor
	, reverseOwnedSubtypeNpmCompleteAcceptanceUpdate
} from "./owned-subtype-npm-complete-acceptance-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { authenticateSourceHistoryReverse, gitSourceBytes } from "./source-history-stream.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 2 * 1024 ** 2 });
const read = async () => JSON.parse(await readFile(ownedSubtypeNpmCompleteAcceptanceHistoryPath));
const predecessor = ownedSubtypeNpmCompleteAcceptancePredecessor;
const implementation = ownedSubtypeNpmCompleteAcceptanceImplementation;

test("Owned Subtype npm complete acceptance records its exact implementation and integration", async () => {
	const record = await read();
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "owned-subtype-npm-complete-acceptance-source-v1");
	assert.equal(record.predecessorCommit, predecessor);
	assert.equal(record.implementationCommit, implementation);
	assert.equal(record.integrationBaseCommit, implementation);
	assert.deepEqual(record.implementationCommits, [implementation]);
	assert.equal(git(["show", "-s", "--format=%P", implementation]).trim(), predecessor);
	assert.deepEqual(git(["diff", "--name-only", predecessor, implementation]).trim().split("\n")
		, [...ownedSubtypeNpmCompleteAcceptanceImplementationPaths].sort());
	assert.deepEqual(record.updates.map(update => update.path), ownedSubtypeNpmCompleteAcceptanceChangedPaths);
	assert.deepEqual(record.integrationUpdates.map(update => update.path), ownedSubtypeNpmCompleteAcceptanceIntegrationPaths);
	assert.deepEqual(record.additions.map(addition => addition.path), ownedSubtypeNpmCompleteAcceptanceAddedPaths);
});

test("Owned Subtype npm complete acceptance reverses all thirteen source transitions", async () => {
	const record = await read();
	assert.equal(record.updates.length + record.integrationUpdates.length, 13);
	const inventory = record.updates.find(update => update.path === "docs/type-surface.v1.json");
	assert.ok(inventory);
	assert.equal(await authenticateSourceHistoryReverse(gitSourceBytes(implementation, inventory.path), inventory), true);
	const updates = [...record.updates.filter(update => update !== inventory), ...record.integrationUpdates];
	for(const update of updates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path, update.currentSha256);
		const prior = record.integrationUpdates.includes(update) ? implementation : predecessor;
		const original = git(["show", `${prior}:${update.path}`]);
		assert.equal(reverseOwnedSubtypeNpmCompleteAcceptanceUpdate(current, update), original);
		assert.equal(beforeOwnedSubtypeNpmCompleteAcceptanceSource(update.path, current, update.currentSha256), current);
		assert.equal(beforeFinRefinementSource(update.path, current, update.previousSha256), original);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(addition.path, addition.currentSha256))
			, addition.currentSha256);
});

test("Owned Subtype npm complete acceptance preserves runtime and original evidence", () => {
	for(const path of ["src", "docs/reference", "docs/consume", "docs/lean"
		, "site", "package.json", "package-lock.json", "lean-toolchain"])
		assert.equal(git(["rev-parse", `${predecessor}:${path}`])
			, git(["rev-parse", `${implementation}:${path}`]), path);
	assert.equal(git(["diff", "--name-only", "--diff-filter=MDRCT"
		, predecessor, implementation, "--", "docs/evidence"]), "");
});

test("Owned Subtype npm complete acceptance changes exactly 103 live source pins", async () => {
	const pins = new Map(ownedSubtypeNpmCompleteAcceptancePins.map(pin => [pin.path, pin]));
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
	assert.equal(current.digest("hex"), "150a717310e9fbdd2435117582c909e655467ac6a551aa7dae8fb52d001322c4");
	assert.equal(previous.digest("hex"), "6840fa1c4c02d8352bb872c1b0ea5ba0db3f7f49dc2561311b087749391151b6");
	assert.equal([...counts.values()].reduce((sum, count) => sum + count, 0), 103);
	for(const pin of pins.values())
	{
		assert.equal(counts.get(pin.path) ?? 0, pin.count);
		assert.equal(sha256(git(["show", `${predecessor}:${pin.path}`])), pin.previousSha256);
		assert.equal(sha256(git(["show", `${implementation}:${pin.path}`])), pin.currentSha256);
	}
});

test("Owned Subtype npm complete acceptance refuses unknown and altered transitions", async () => {
	const update = (await read()).updates.find(item => item.path !== "docs/type-surface.v1.json");
	const current = await sourceAtFinHistoryMilestone(update.path, update.currentSha256);
	for(const forged of [{ ...update, previousSha256: "0".repeat(64) }
		, { ...update, currentSha256: "0".repeat(64) }
		, { ...update, path: "unrelated.mjs" }, { ...update, edits: [] }
		, { ...update, edits: [...update.edits, update.edits[0]] }])
		assert.throws(() => reverseOwnedSubtypeNpmCompleteAcceptanceUpdate(current, forged));
	assert.equal(beforeOwnedSubtypeNpmCompleteAcceptanceSource(update.path, current + "unknown"), current + "unknown");
	assert.equal(beforeOwnedSubtypeNpmCompleteAcceptanceSource("unrelated.mjs", current), current);
});

test("Owned Subtype npm complete acceptance writer refuses an unrelated checkout", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-owned-subtype-npm-complete-acceptance-history-guard-"));
	t.after(() => rm(root, { recursive: true }));
	const child = spawnSync(process.execPath, [resolve("scripts/update-owned-subtype-npm-complete-acceptance-source-history.mjs")]
		, { cwd: root, encoding: "utf8", timeout: 15_000 });
	assert.notEqual(child.status, 0);
	assert.equal(child.stdout, "");
	assert.deepEqual(await readdir(root), []);
});

test("Owned Subtype npm complete acceptance binds source qualification without claiming execution", async () => {
	const path = "docs/evidence/owned-subtype-npm-complete-acceptance-20261025.json";
	const evidence = JSON.parse(git(["show", `${implementation}:${path}`]));
	assert.equal(evidence.kind, "owned-subtype-npm-complete-acceptance-source-v1");
	assert.equal(evidence.sourceBaseCommit, predecessor);
	assert.equal(evidence.sources.length, 15);
	for(const item of evidence.sources)
	{
		const digest = createHash("sha256");
		let bytes = 0;
		for await(const chunk of gitSourceBytes(implementation, item.path))
		{ digest.update(chunk); bytes += chunk.length; }
		assert.equal(bytes, item.bytes, item.path);
		assert.equal(digest.digest("hex"), item.sha256, item.path);
	}
	assert.equal(evidence.contract.independentBuildsPerRoute, 2);
	assert.equal(evidence.contract.browserCellsPerRoute, 12);
	assert.equal(evidence.contract.legacyBrowserCellsPerRoute, 9);
	assert.equal(evidence.validation.focused.passed, 23);
	assert.equal(evidence.validation.installedRuntimeExecutions, 0);
	assert.equal(evidence.validation.inventory.stalePins, 0);
	assert.equal(evidence.validation.inventory.refreshedPins, 103);
	assert.equal(evidence.pending.length, 3);
});

test("Owned Subtype npm complete acceptance preserves every existing runtime probe and Lean fixture", () => {
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

test("Owned Subtype npm complete acceptance writer cannot overwrite retained evidence", async () => {
	const before = await readFile(ownedSubtypeNpmCompleteAcceptanceHistoryPath);
	const result = spawnSync(process.execPath, ["--max-old-space-size=512"
		, "scripts/update-owned-subtype-npm-complete-acceptance-source-history.mjs"]
	, { encoding: "utf8", timeout: 15_000 });
	assert.notEqual(result.status, 0);
	assert.deepEqual(await readFile(ownedSubtypeNpmCompleteAcceptanceHistoryPath), before);
});
