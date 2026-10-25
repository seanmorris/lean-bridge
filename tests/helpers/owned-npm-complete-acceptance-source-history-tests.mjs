/**
 * Authenticate the stronger owned npm gate without rewriting earlier evidence.
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
	beforeOwnedNpmCompleteAcceptanceSource
	, ownedNpmCompleteAcceptanceAddedPaths
	, ownedNpmCompleteAcceptanceChangedPaths
	, ownedNpmCompleteAcceptanceHistoryPath
	, ownedNpmCompleteAcceptanceImplementation
	, ownedNpmCompleteAcceptanceIntegrationPaths
	, ownedNpmCompleteAcceptancePredecessor
	, reverseOwnedNpmCompleteAcceptanceUpdate
} from "./owned-npm-complete-acceptance-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { gitSourceBytes } from "./source-history-stream.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 2 * 1024 ** 2 });
const read = async () => JSON.parse(await readFile(ownedNpmCompleteAcceptanceHistoryPath));
const predecessor = ownedNpmCompleteAcceptancePredecessor;
const implementation = ownedNpmCompleteAcceptanceImplementation;

test("owned npm complete acceptance records its exact implementation and integration", async () => {
	const record = await read();
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "owned-npm-complete-acceptance-source-v1");
	assert.equal(record.predecessorCommit, predecessor);
	assert.equal(record.implementationCommit, implementation);
	assert.equal(record.integrationBaseCommit, implementation);
	assert.deepEqual(record.implementationCommits, [implementation]);
	assert.equal(git(["show", "-s", "--format=%P", implementation]).trim(), predecessor);
	assert.deepEqual(git(["diff", "--name-only", predecessor, implementation]).trim().split("\n")
		, [...ownedNpmCompleteAcceptanceChangedPaths].sort());
	assert.deepEqual(record.updates.map(update => update.path), ownedNpmCompleteAcceptanceChangedPaths);
	assert.deepEqual(record.integrationUpdates.map(update => update.path), ownedNpmCompleteAcceptanceIntegrationPaths);
	assert.deepEqual(record.additions.map(addition => addition.path), ownedNpmCompleteAcceptanceAddedPaths);
});

test("owned npm complete acceptance reverses all seven source transitions", async () => {
	const record = await read();
	const updates = [...record.updates, ...record.integrationUpdates];
	assert.equal(updates.length, 7);
	for(const update of updates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path, update.currentSha256);
		const prior = record.integrationUpdates.includes(update) ? implementation : predecessor;
		const original = git(["show", `${prior}:${update.path}`]);
		assert.equal(reverseOwnedNpmCompleteAcceptanceUpdate(current, update), original);
		assert.equal(beforeOwnedNpmCompleteAcceptanceSource(update.path, current, update.currentSha256), current);
		assert.equal(beforeFinRefinementSource(update.path, current, update.previousSha256), original);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(addition.path, addition.currentSha256))
			, addition.currentSha256);
});

test("owned npm complete acceptance preserves runtime, inventory, workflows and archived bytes", () => {
	for(const path of ["src", "docs", "site", ".github", "package.json", "package-lock.json", "lean-toolchain"])
		assert.equal(git(["rev-parse", `${predecessor}:${path}`])
			, git(["rev-parse", `${implementation}:${path}`]), path);
	const checker = git(["show", `${implementation}:scripts/check-owned-checked-record-javascript-ci.mjs`]);
	assert.match(checker, /minimumVersion: 2/u);
	const producer = git(["show", `${implementation}:tests/owned-checked-record-javascript-packaging.test.mjs`]);
	assert.match(producer, /for\(const attempt of \[0, 1\]\)/u);
	assert.match(producer, /Independent author roots must compile the same Wasm/u);
	assert.match(producer, /productionReact: true/u);
});

test("owned npm complete acceptance changes no live source-evidence pin", async () => {
	const input = Readable.from(gitSourceBytes(implementation, "docs/type-surface.v1.json"));
	const digest = createHash("sha256");
	let bytes = 0, matches = 0, mode;
	input.on("data", chunk => { digest.update(chunk); bytes += chunk.length; });
	for await(const line of createInterface({ input, crlfDelay: Infinity }))
	{
		if(line === '      "files": [') mode = "files";
		if(line === '      "artifacts": [') mode = "artifacts";
		if(line === "      ]," || line === "      ]") mode = undefined;
		const match = /^ {10}"path": "([^"]+)",$/u.exec(line);
		if(mode === "files" && match && ownedNpmCompleteAcceptanceChangedPaths.includes(match[1])) matches++;
	}
	assert.equal(matches, 0);
	assert.equal(bytes, 102577221);
	assert.equal(digest.digest("hex"), "68fd0a7a321eeda0637cba71f33284aea66b78f5e2e29686ae0c088559736582");
});

test("owned npm complete acceptance refuses unknown and altered transitions", async () => {
	const update = (await read()).updates[0];
	const current = await sourceAtFinHistoryMilestone(update.path, update.currentSha256);
	for(const forged of [{ ...update, previousSha256: "0".repeat(64) }
		, { ...update, currentSha256: "0".repeat(64) }
		, { ...update, path: "unrelated.mjs" }, { ...update, edits: [] }
		, { ...update, edits: [...update.edits, update.edits[0]] }])
		assert.throws(() => reverseOwnedNpmCompleteAcceptanceUpdate(current, forged));
	assert.equal(beforeOwnedNpmCompleteAcceptanceSource(update.path, current + "unknown"), current + "unknown");
	assert.equal(beforeOwnedNpmCompleteAcceptanceSource("unrelated.mjs", current), current);
});

test("owned npm complete acceptance writer refuses an unrelated checkout", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-owned-npm-complete-history-guard-"));
	t.after(() => rm(root, { recursive: true }));
	const child = spawnSync(process.execPath, [resolve("scripts/update-owned-npm-complete-acceptance-source-history.mjs")]
		, { cwd: root, encoding: "utf8", timeout: 15_000 });
	assert.notEqual(child.status, 0);
	assert.equal(child.stdout, "");
	assert.deepEqual(await readdir(root), []);
});
