/**
 * Authenticate the owned Subtype live pin completion history layer.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import {
	beforeOwnedSubtypeLivePinCompletionSource
	, ownedSubtypeLivePinCompletionAddedPaths
	, ownedSubtypeLivePinCompletionHistoryPath
	, ownedSubtypeLivePinCompletionImplementation
	, ownedSubtypeLivePinCompletionIntegrationPaths
	, ownedSubtypeLivePinCompletionModifiedPaths
	, ownedSubtypeLivePinCompletionPredecessor
	, reverseOwnedSubtypeLivePinCompletionUpdate
} from "./owned-subtype-live-pin-completion-source-history.mjs";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const inventoryPath = "docs/type-surface.v1.json";
const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const readRecord = async () => JSON.parse(await readFile(
	ownedSubtypeLivePinCompletionHistoryPath, "utf8"));
// This layer always reverses a recognized transition, so milestones resolve
// through the central hub alone, which owns every stop decision.
const atMilestone = (path, digest) => sourceAtFinHistoryMilestone(path, digest);
void inventoryPath;

test("owned Subtype live pin completion history restores every source"
	, async () => {
	const record = await readRecord();
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "owned-subtype-live-pin-completion-source-v1");
	assert.equal(record.predecessorCommit, ownedSubtypeLivePinCompletionPredecessor);
	assert.equal(record.implementationCommit, ownedSubtypeLivePinCompletionImplementation);
	assert.deepEqual(record.updates.map(item => item.path)
		, ownedSubtypeLivePinCompletionModifiedPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, ownedSubtypeLivePinCompletionIntegrationPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, ownedSubtypeLivePinCompletionAddedPaths);
	for(const update of record.updates)
	{
		const current = await atMilestone(update.path, update.currentSha256);
		const previous = git(["show"
			, `${ownedSubtypeLivePinCompletionPredecessor}:${update.path}`]);
		assert.equal(current, git(["show"
			, `${ownedSubtypeLivePinCompletionImplementation}:${update.path}`]), update.path);
		assert.equal(reverseOwnedSubtypeLivePinCompletionUpdate(current, update), previous
			, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path)
			, update.path);
	}
	for(const update of record.integrationUpdates)
	{
		const current = await atMilestone(update.path, update.currentSha256);
		const previous = git(["show"
			, `${ownedSubtypeLivePinCompletionImplementation}:${update.path}`]);
		assert.equal(reverseOwnedSubtypeLivePinCompletionUpdate(current, update), previous
			, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path)
			, update.path);
	}
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256))
			, addition.currentSha256, addition.path);
	}
);

test("owned Subtype live pin completion history is one exact commit", () => {
	const predecessor = ownedSubtypeLivePinCompletionPredecessor;
	const implementation = ownedSubtypeLivePinCompletionImplementation;
	const modified = [...ownedSubtypeLivePinCompletionModifiedPaths].sort();
	assert.equal(git(["rev-parse", `${implementation}^`]).trim()
		, predecessor);
	assert.deepEqual(names(["diff", "--name-only", predecessor
		, implementation]), modified);
	assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
		, predecessor, implementation]), modified);
});

test("owned Subtype live pin completion layer lets the hub reach older milestones"
	, async () => {
	const record = await readRecord();
	const update = [...record.updates, ...record.integrationUpdates].find(item =>
		item.path === "docs/type-surface.v1.json");
	const current = await atMilestone(update.path, update.currentSha256);
	const older = "6dd064096b16a249e168831100a60a48b0853219";
	const target = git(["show", `${older}:${update.path}`]);
	assert.notEqual(sha256(target), update.previousSha256);
	assert.equal(beforeFinRefinementSource(update.path, current, sha256(target))
		, target);
	}
);

test("owned Subtype live pin completion history rejects alteration", async () => {
	const record = await readRecord();
	const update = structuredClone(record.updates[0]);
	const current = await atMilestone(update.path, update.currentSha256);
	const forged = structuredClone(update);
	forged.currentSha256 = "0".repeat(64);
	assert.throws(() => reverseOwnedSubtypeLivePinCompletionUpdate(current, forged));
	const shifted = structuredClone(update);
	shifted.edits[0].start += 1;
	assert.throws(() => reverseOwnedSubtypeLivePinCompletionUpdate(current, shifted));
	const rewritten = structuredClone(update);
	rewritten.edits[0].previous += "x";
	assert.throws(() => reverseOwnedSubtypeLivePinCompletionUpdate(current, rewritten));
	assert.equal(beforeOwnedSubtypeLivePinCompletionSource(update.path, current, update.currentSha256)
		, reverseOwnedSubtypeLivePinCompletionUpdate(current, update)
		, "a recognized transition is reversed regardless of the stop digest");
	assert.equal(beforeOwnedSubtypeLivePinCompletionSource(update.path, `${current}unrelated\n`)
		, `${current}unrelated\n`);
	assert.equal(beforeOwnedSubtypeLivePinCompletionSource("docs/unrelated.md", current), current);
});

test("owned Subtype live pin completion history writer refuses another checkout"
	, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-owned-subtype-live-pin-completion-history-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const environment = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith("GIT_")));
	const localGit = arguments_ => execFileSync("git", arguments_, {
		cwd: root, env: environment, stdio: "pipe"
	});
	localGit(["init", "--quiet"]);
	localGit(["-c", "user.name=Test", "-c"
		, "user.email=test@example.invalid", "-c", "commit.gpgsign=false"
		, "commit", "--allow-empty", "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-owned-subtype-live-pin-completion-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /implementation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
	}
);

const pinRefreshes = Object.freeze({
	"scripts/generate-type-docs.mjs": ["4e7cf136", 110]
	, "tests/test-profiles.test.mjs": ["b409e719", 4]
	, "tests/component-array-contract.test.mjs": ["5704f28e", 3]
});
const pinnedFiles = inventory => inventory.evidence.flatMap(item => item.files)
	.filter(file => !file.path.startsWith("docs/evidence/"));

test("owned Subtype live pin completion replaces exactly the stale pins"
	, () => {
	const implementation = ownedSubtypeLivePinCompletionImplementation;
	const before = JSON.parse(git(["show"
		, `${ownedSubtypeLivePinCompletionPredecessor}:${inventoryPath}`]));
	const after = JSON.parse(git(["show"
		, `${implementation}:${inventoryPath}`]));
	const previous = pinnedFiles(before), current = pinnedFiles(after);
	assert.equal(current.length, previous.length);
	const changed = new Map();
	for(const [index, file] of current.entries())
	{
		assert.equal(file.path, previous[index].path);
		if(file.sha256 === previous[index].sha256) continue;
		const [prefix] = pinRefreshes[file.path];
		assert.ok(previous[index].sha256.startsWith(prefix), file.path);
		assert.equal(file.sha256, sha256(git(["show"
			, `${implementation}:${file.path}`])), file.path);
		changed.set(file.path, (changed.get(file.path) ?? 0) + 1);
	}
	assert.deepEqual(Object.fromEntries(changed), Object.fromEntries(
		Object.entries(pinRefreshes).map(([path, [, count]]) => [path, count])));
	const strip = inventory => JSON.stringify(inventory, (key, value) =>
		key === "sha256" ? undefined : value);
	assert.equal(strip(after), strip(before));
	}
);

test("owned Subtype live pin completion leaves no stale live pin", () => {
	const implementation = ownedSubtypeLivePinCompletionImplementation;
	const inventory = JSON.parse(git(["show"
		, `${implementation}:${inventoryPath}`]));
	const pins = new Map();
	for(const file of pinnedFiles(inventory))
		pins.set(file.path, [...pins.get(file.path) ?? [], file.sha256]);
	const paths = [...pins.keys()];
	const batch = execFileSync("git", ["cat-file", "--batch"], {
		input: paths.map(path => `${implementation}:${path}\n`).join("")
		, maxBuffer: 1024 * 1024 * 1024
	});
	let cursor = 0;
	const stale = [];
	for(const path of paths)
	{
		const end = batch.indexOf(10, cursor);
		const header = batch.subarray(cursor, end).toString("utf8");
		const size = Number(header.split(" ")[2]);
		assert.ok(Number.isSafeInteger(size), `${path}: ${header}`);
		const digest = sha256(batch.subarray(end + 1, end + 1 + size));
		cursor = end + 1 + size + 1;
		for(const pinned of pins.get(path))
			if(pinned !== digest) stale.push(path);
	}
	assert.equal(cursor, batch.length);
	assert.deepEqual(stale, []);
});
