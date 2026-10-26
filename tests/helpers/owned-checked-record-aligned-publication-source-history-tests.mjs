/**
 * Check canonical aligned publication and its exact source history.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createInterface } from "node:readline";
import test from "node:test";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import {
	beforeOwnedCheckedAlignedPublicationSource
	, ownedCheckedAlignedPublicationAddedPaths
	, ownedCheckedAlignedPublicationChangedPaths
	, ownedCheckedAlignedPublicationCommits
	, ownedCheckedAlignedPublicationHistoryPath
	, ownedCheckedAlignedPublicationImplementation
	, ownedCheckedAlignedPublicationImplementationPaths
	, ownedCheckedAlignedPublicationIntegrationBase
	, ownedCheckedAlignedPublicationIntegrationPaths
	, ownedCheckedAlignedPublicationPins
	, ownedCheckedAlignedPublicationPredecessor
	, reverseOwnedCheckedAlignedPublicationUpdate
} from "./owned-checked-record-aligned-publication-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";
import {
	authenticateSourceHistoryReverse, gitSourceBytes
} from "./source-history-stream.mjs";

const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 2 * 1024 * 1024 });
const read = async () => JSON.parse(await readFile(
	ownedCheckedAlignedPublicationHistoryPath, "utf8"
));
const inventoryPath = "docs/type-surface.v1.json";

const inventoryPinCounts = async revision => {
	const paths = new Set(ownedCheckedAlignedPublicationPins.map(pin => pin.path));
	const result = new Map([...paths].map(path => [path, new Map()]));
	const child = spawn("git", ["show", `${revision}:${inventoryPath}`]
		, { stdio: ["ignore", "pipe", "pipe"] });
	let stderr = "";
	child.stderr.setEncoding("utf8");
	child.stderr.on("data", chunk => { stderr = (stderr + chunk).slice(0, 65_536); });
	const completed = new Promise((accept, reject) => {
		child.once("error", reject);
		child.once("close", (code, signal) => code === 0 ? accept()
			: reject(new Error(`Inventory read failed: ${code}/${signal} ${stderr}`)));
	});
	let pending;
	for await(const line of createInterface({ input: child.stdout, crlfDelay: Infinity }))
	{
		if(pending !== undefined)
		{
			const digest = line.match(/^ {10}"sha256": "([a-f0-9]{64})"[,}]?$/u)?.[1];
			assert.ok(digest, `Missing source identity after ${pending}`);
			const counts = result.get(pending);
			counts.set(digest, (counts.get(digest) ?? 0) + 1);
			pending = undefined;
		}
		const path = line.match(/^ {10}"path": "([^"]+)",$/u)?.[1];
		if(paths.has(path)) pending = path;
	}
	await completed;
	assert.equal(pending, undefined);
	return result;
};

const sortedCounts = counts => [...counts].sort(([left], [right]) =>
	left.localeCompare(right));

test("Aligned owned checked-record publication authenticates its wiring and lineage", async () => {
	const record = await read();
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "owned-checked-record-aligned-publication-source-v1");
	assert.equal(record.predecessorCommit, ownedCheckedAlignedPublicationPredecessor);
	assert.equal(record.implementationCommit, ownedCheckedAlignedPublicationImplementation);
	assert.equal(record.integrationBaseCommit, ownedCheckedAlignedPublicationIntegrationBase);
	assert.deepEqual(record.implementationCommits, ownedCheckedAlignedPublicationCommits);
	assert.deepEqual(record.updates.map(item => item.path)
		, ownedCheckedAlignedPublicationChangedPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, ownedCheckedAlignedPublicationIntegrationPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, ownedCheckedAlignedPublicationAddedPaths);
	assert.deepEqual(git(["rev-list", "--reverse"
		, `${ownedCheckedAlignedPublicationPredecessor}..${ownedCheckedAlignedPublicationImplementation}`])
		.trim().split("\n"), ownedCheckedAlignedPublicationCommits);
	assert.deepEqual(git(["diff", "--name-only"
		, ownedCheckedAlignedPublicationPredecessor
		, ownedCheckedAlignedPublicationImplementation]).trim().split("\n")
	, [...ownedCheckedAlignedPublicationImplementationPaths].sort());
	const updates = [...record.updates.filter(item => item.path !== inventoryPath)
		, ...record.integrationUpdates];
	for(const update of updates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256, beforeOwnedCheckedAlignedPublicationSource);
		const prior = record.integrationUpdates.includes(update)
			? ownedCheckedAlignedPublicationIntegrationBase
			: ownedCheckedAlignedPublicationPredecessor;
		const previous = git(["show", `${prior}:${update.path}`]);
		assert.equal(reverseOwnedCheckedAlignedPublicationUpdate(current, update), previous);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
	assert.ok(finRefinementNormalizationPaths.includes(inventoryPath));
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256)), addition.currentSha256);
});

test("Aligned owned checked-record publication refreshes exactly 243 named source pins", async () => {
	const before = await inventoryPinCounts(ownedCheckedAlignedPublicationPredecessor);
	const after = await inventoryPinCounts(ownedCheckedAlignedPublicationImplementation);
	let refreshed = 0;
	for(const pin of ownedCheckedAlignedPublicationPins)
	{
		const expected = new Map(before.get(pin.path));
		if(pin.count > 0)
		{
			assert.ok((expected.get(pin.previousSha256) ?? 0) >= pin.count, pin.path);
			expected.set(pin.previousSha256
				, expected.get(pin.previousSha256) - pin.count);
			if(expected.get(pin.previousSha256) === 0) expected.delete(pin.previousSha256);
			expected.set(pin.currentSha256
				, (expected.get(pin.currentSha256) ?? 0) + pin.count);
		}
		assert.deepEqual(sortedCounts(after.get(pin.path)), sortedCounts(expected), pin.path);
		refreshed += pin.count;
		assert.equal(sha256(git(["show"
			, `${ownedCheckedAlignedPublicationImplementation}:${pin.path}`]))
		, pin.currentSha256, pin.path);
	}
	assert.equal(refreshed, 243);
});

test("Aligned owned checked-record publication streams exact inventory endpoints", async () => {
	const update = (await read()).updates.find(item => item.path === inventoryPath);
	assert.equal(await authenticateSourceHistoryReverse(gitSourceBytes(
		ownedCheckedAlignedPublicationImplementation, inventoryPath
	), update), true);
});

test("Aligned owned checked-record publication rejects unknown or forged transitions", async () => {
	const update = (await read()).integrationUpdates[0];
	const current = await sourceAtFinHistoryMilestone(update.path
		, update.currentSha256, beforeOwnedCheckedAlignedPublicationSource);
	assert.equal(beforeOwnedCheckedAlignedPublicationSource(
		update.path, current, update.currentSha256), current);
	const unknown = current + "\nunknown";
	assert.equal(beforeOwnedCheckedAlignedPublicationSource(update.path, unknown), unknown);
	for(const forged of [{ ...update, previousSha256: "0".repeat(64) }
		, { ...update, currentSha256: "0".repeat(64) }
		, { ...update, edits: [...update.edits, update.edits[0]] }
		, { ...update, edits: [] }, { ...update, path: "unrelated.mjs" }])
		assert.throws(() => reverseOwnedCheckedAlignedPublicationUpdate(current, forged));
});

test("Aligned owned checked-record publication writer refuses another checkout", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-owned-aligned-publication-guard-"));
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
		"scripts/update-owned-checked-record-aligned-publication-source-history.mjs")]
	, { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /exact integration base/u);
	assert.deepEqual(await readdir(root), [".git"]);
});

test("Aligned owned checked-record publication binds its acceptance receipt", async () => {
	const path = "docs/evidence/owned-checked-record-aligned-publication-20261026.json";
	const addition = (await read()).additions.find(item => item.path === path);
	const value = JSON.parse(await sourceAtFinHistoryMilestone(path, addition.currentSha256));
	assert.equal(value.schemaVersion, 1);
	assert.equal(value.kind, "owned-checked-record-aligned-publication-acceptance-v1");
	assert.equal(value.predecessor, ownedCheckedAlignedPublicationPredecessor);
	assert.equal(value.sourceCommit, ownedCheckedAlignedPublicationCommits[0]);
	assert.deepEqual(value.coverage, {
		archives: 11, cells: 170, changedObservations: 0
		, committedBytes: 4676061081, committedFiles: 18402
		, profiles: 17, refreshedEvidence: 11, routes: 44
	});
	assert.equal(value.pins.refreshed, 243);
	assert.deepEqual(value.validation.currentPublicationTests, {
		passed: 4, failed: 0, skipped: 0
	});
	assert.equal(value.validation.liveSourcePins.stalePins, 0);
	assert.match(value.boundary, /without adding or widening any support observation/u);
});
