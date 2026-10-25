/**
 * Authenticate exact-producer replay without rewriting earlier evidence.
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
	beforePhpClosureProducerReplaySource
	, phpClosureProducerReplayAddedPaths
	, phpClosureProducerReplayChangedPaths
	, phpClosureProducerReplayImplementationPaths
	, phpClosureProducerReplayPins
	, phpClosureProducerReplayHistoryPath
	, phpClosureProducerReplayImplementation
	, phpClosureProducerReplayIntegrationPaths
	, phpClosureProducerReplayPredecessor
	, reversePhpClosureProducerReplayUpdate
} from "./php-closure-producer-replay-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { gitSourceBytes, gitSourceHistoryTransition } from "./source-history-stream.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 2 * 1024 ** 2 });
const read = async () => JSON.parse(await readFile(phpClosureProducerReplayHistoryPath));
const predecessor = phpClosureProducerReplayPredecessor;
const implementation = phpClosureProducerReplayImplementation;

test("PHP and closure producer replay records its exact implementation and integration", async () => {
	const record = await read();
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "php-closure-producer-replay-source-v1");
	assert.equal(record.predecessorCommit, predecessor);
	assert.equal(record.implementationCommit, implementation);
	assert.equal(record.integrationBaseCommit, implementation);
	assert.deepEqual(record.implementationCommits, [implementation]);
	assert.equal(git(["show", "-s", "--format=%P", implementation]).trim(), predecessor);
	assert.deepEqual(git(["diff", "--name-only", predecessor, implementation]).trim().split("\n")
		, [...phpClosureProducerReplayImplementationPaths].sort());
	assert.deepEqual(record.updates.map(update => update.path), phpClosureProducerReplayChangedPaths);
	assert.deepEqual(record.integrationUpdates.map(update => update.path), phpClosureProducerReplayIntegrationPaths);
	assert.deepEqual(record.additions.map(addition => addition.path), phpClosureProducerReplayAddedPaths);
});

test("PHP and closure producer replay reverses all seven source transitions", async () => {
	const record = await read();
	const updates = [...record.updates, ...record.integrationUpdates];
	assert.equal(updates.length, 7);
	for(const update of updates)
	{
		if(update.path === "docs/type-surface.v1.json")
		{
			assert.deepEqual(await gitSourceHistoryTransition(update.path
				, predecessor, implementation), update);
			assert.ok(finRefinementNormalizationPaths.includes(update.path));
			continue;
		}
		const current = await sourceAtFinHistoryMilestone(update.path, update.currentSha256);
		const prior = record.integrationUpdates.includes(update) ? implementation : predecessor;
		const original = git(["show", `${prior}:${update.path}`]);
		assert.equal(reversePhpClosureProducerReplayUpdate(current, update), original);
		assert.equal(beforePhpClosureProducerReplaySource(update.path, current, update.currentSha256), current);
		assert.equal(beforeFinRefinementSource(update.path, current, update.previousSha256), original);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(addition.path, addition.currentSha256))
			, addition.currentSha256);
});

test("PHP and closure producer replay preserves runtime and original evidence", () => {
	for(const path of ["src", "docs/evidence", "docs/reference", "docs/consume"
		, "site", ".github", "package.json", "package-lock.json", "lean-toolchain"])
		assert.equal(git(["rev-parse", `${predecessor}:${path}`])
			, git(["rev-parse", `${implementation}:${path}`]), path);
	const files = ["tests/helpers/php-ci-regression-evidence.mjs"
		, "tests/helpers/closure-thread-evidence.mjs"];
	for(const path of files)
	{
		const source = git(["show", `${implementation}:${path}`]);
		assert.match(source, /sourceAtProducer/u);
		assert.match(source, /typeSurfaceContractsAtProducer/u);
		assert.doesNotMatch(source, /\breadTypeSurface\b/u);
	}
});

test("PHP and closure producer replay changes exactly three source pins", async () => {
	const pins = new Map(phpClosureProducerReplayPins.map(pin => [pin.path, pin]));
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
	assert.equal(bytes, 102577221);
	assert.equal(current.digest("hex"), "779d28b0b7f980f24f0a9cb4b1fdd85a6dd6e3a80447bcf18b2514fcb482e7a5");
	assert.equal(previous.digest("hex"), "68fd0a7a321eeda0637cba71f33284aea66b78f5e2e29686ae0c088559736582");
	assert.equal([...counts.values()].reduce((sum, count) => sum + count, 0), 3);
	for(const pin of pins.values())
	{
		assert.equal(counts.get(pin.path), pin.count);
		assert.equal(sha256(git(["show", `${predecessor}:${pin.path}`])), pin.previousSha256);
		assert.equal(sha256(git(["show", `${implementation}:${pin.path}`])), pin.currentSha256);
	}
});

test("PHP and closure producer replay refuses unknown and altered transitions", async () => {
	const update = (await read()).updates.find(item => item.path !== "docs/type-surface.v1.json");
	const current = await sourceAtFinHistoryMilestone(update.path, update.currentSha256);
	for(const forged of [{ ...update, previousSha256: "0".repeat(64) }
		, { ...update, currentSha256: "0".repeat(64) }
		, { ...update, path: "unrelated.mjs" }, { ...update, edits: [] }
		, { ...update, edits: [...update.edits, update.edits[0]] }])
		assert.throws(() => reversePhpClosureProducerReplayUpdate(current, forged));
	assert.equal(beforePhpClosureProducerReplaySource(update.path, current + "unknown"), current + "unknown");
	assert.equal(beforePhpClosureProducerReplaySource("unrelated.mjs", current), current);
});

test("PHP and closure producer replay writer refuses an unrelated checkout", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-php-closure-producer-history-guard-"));
	t.after(() => rm(root, { recursive: true }));
	const child = spawnSync(process.execPath, [resolve("scripts/update-php-closure-producer-replay-source-history.mjs")]
		, { cwd: root, encoding: "utf8", timeout: 15_000 });
	assert.notEqual(child.status, 0);
	assert.equal(child.stdout, "");
	assert.deepEqual(await readdir(root), []);
});
