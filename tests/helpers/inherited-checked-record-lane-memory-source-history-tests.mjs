/**
 * Authenticate the inherited checked-record lane memory bound: exact
 * transitions, additions, refusal controls, the pin-only refresh of the ten
 * checkers, and retention controls proving no lane archive is held in memory.
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
	beforeInheritedCheckedRecordLaneMemorySource
	, inheritedCheckedRecordLaneMemoryAddedPaths
	, inheritedCheckedRecordLaneMemoryChangedPaths
	, inheritedCheckedRecordLaneMemoryCommits
	, inheritedCheckedRecordLaneMemoryHistoryPath
	, inheritedCheckedRecordLaneMemoryImplementation
	, inheritedCheckedRecordLaneMemoryImplementationAddedPaths
	, inheritedCheckedRecordLaneMemoryPredecessor
	, reverseInheritedCheckedRecordLaneMemoryUpdate
} from "./inherited-checked-record-lane-memory-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { inheritedCheckedRecordLaneFiles } from "./inherited-checked-record-lane-files.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const laneCheckers = [
	"tests/helpers/inherited-checked-record-browser-evidence.mjs"
	, "tests/helpers/inherited-checked-record-dotnet-evidence.mjs"
	, "tests/helpers/inherited-checked-record-jvm-evidence.mjs"
	, "tests/helpers/inherited-checked-record-perl-evidence.mjs"
	, "tests/helpers/inherited-checked-record-php-evidence.mjs"
	, "tests/helpers/inherited-checked-record-php-wasm-evidence.mjs"
	, "tests/helpers/inherited-checked-record-python-evidence.mjs"
	, "tests/helpers/inherited-checked-record-ruby-evidence.mjs"
	, "tests/helpers/inherited-checked-record-rust-evidence.mjs"
	, "tests/helpers/inherited-checked-record-wit-evidence.mjs"
];
const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const readRecord = async () => JSON.parse(await readFile(
	inheritedCheckedRecordLaneMemoryHistoryPath, "utf8"
));

test("inherited checked-record lane memory bound records exactly its implementation transitions", async () => {
	const record = await readRecord();
	assert.deepEqual(Object.keys(record).sort(), ["additions"
		, "implementationCommit", "implementationCommits", "milestone"
		, "predecessorCommit"
		, "schemaVersion", "scope", "updates"]);
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "inherited-checked-record-lane-memory-source-v1");
	assert.equal(record.predecessorCommit, inheritedCheckedRecordLaneMemoryPredecessor);
	assert.equal(record.implementationCommit
		, inheritedCheckedRecordLaneMemoryImplementation);
	assert.deepEqual(record.implementationCommits, inheritedCheckedRecordLaneMemoryCommits);
	assert.deepEqual(git(["rev-list", "--reverse"
		, `${inheritedCheckedRecordLaneMemoryPredecessor}..${inheritedCheckedRecordLaneMemoryImplementation}`])
		.trim().split("\n"), inheritedCheckedRecordLaneMemoryCommits);
	assert.deepEqual(git(["diff", "--name-only"
		, inheritedCheckedRecordLaneMemoryPredecessor
		, inheritedCheckedRecordLaneMemoryImplementation])
		.trim().split("\n").filter(Boolean).sort()
	, [...inheritedCheckedRecordLaneMemoryChangedPaths
		, ...inheritedCheckedRecordLaneMemoryImplementationAddedPaths].sort());
	assert.deepEqual(record.updates.map(item => item.path)
		, inheritedCheckedRecordLaneMemoryChangedPaths);
	for(const update of record.updates)
	{
		const previous = git(["show"
			, `${inheritedCheckedRecordLaneMemoryPredecessor}:${update.path}`]);
		const current = git(["show"
			, `${inheritedCheckedRecordLaneMemoryImplementation}:${update.path}`]);
		assert.equal(sha256(previous), update.previousSha256, update.path);
		assert.equal(sha256(current), update.currentSha256, update.path);
		assert.equal(reverseInheritedCheckedRecordLaneMemoryUpdate(current, update)
			, previous, update.path);
		assert.equal(beforeInheritedCheckedRecordLaneMemorySource(update.path, current)
			, previous, update.path);
		assert.equal(beforeInheritedCheckedRecordLaneMemorySource(
			update.path, current, update.currentSha256), current, update.path);
	}
});

test("inherited checked-record lane memory bound additions restore exactly", async () => {
	const record = await readRecord();
	assert.deepEqual(record.additions.map(item => item.path)
		, inheritedCheckedRecordLaneMemoryAddedPaths);
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256)), addition.currentSha256, addition.path);
});

test("inherited checked-record lane memory bound rejects altered transitions and unknown content", async () => {
	const record = await readRecord();
	for(const update of record.updates)
	{
		const current = git(["show"
			, `${inheritedCheckedRecordLaneMemoryImplementation}:${update.path}`]);
		for(const changed of [{ ...update, currentSha256: "0".repeat(64) }
			, { ...update, previousSha256: "0".repeat(64) }
			, { ...update, path: "unknown.mjs" }
			, { ...update, edits: [] }
			, { ...update, edits: [...update.edits, update.edits[0]] }])
			assert.throws(() => reverseInheritedCheckedRecordLaneMemoryUpdate(current, changed));
		const shifted = structuredClone(update);
		shifted.edits[0].start += 1;
		assert.throws(() => reverseInheritedCheckedRecordLaneMemoryUpdate(current, shifted));
		const unknown = `${current}unrelated\n`;
		assert.equal(beforeInheritedCheckedRecordLaneMemorySource(update.path, unknown), unknown);
		assert.throws(() => reverseInheritedCheckedRecordLaneMemoryUpdate(unknown, update));
		assert.equal(beforeInheritedCheckedRecordLaneMemorySource("docs/unrelated.md", current)
			, current);
	}
});

/**
 * Require one edit to replace a whole source-pin line with the exact
 * implementation blob digest of the path cited on the line before it.
 *
 * @param current - Complete refreshed inventory text.
 * @param edit - Recorded inventory edit.
 * @param helpers - Edited helper paths and their implementation digests.
 */
const helperPinEdit = (current, edit, helpers) => {
	const pin = /^ *"sha256": "([0-9a-f]{64})"\n$/u;
	const [, newer] = edit.current.match(pin);
	const [, older] = edit.previous.match(pin);
	assert.notEqual(older, newer);
	assert.equal(edit.previous.replace(older, newer), edit.current);
	assert.equal(current.slice(edit.start, edit.start + edit.current.length)
		, edit.current);
	const before = current.lastIndexOf("\n", edit.start - 2) + 1;
	const [, path] = current.slice(before, edit.start)
		.match(/^ *"path": "([^"\n]+)",\n$/u);
	assert.equal(helpers.get(path), newer, path);
	return path;
};

test("inherited checked-record lane memory bound refreshes only the edited helper pins to their exact blobs", async () => {
	const update = (await readRecord()).updates.find(item =>
		item.path === "docs/type-surface.v1.json");
	const current = git(["show"
		, `${inheritedCheckedRecordLaneMemoryImplementation}:docs/type-surface.v1.json`]);
	const helperPaths = laneCheckers;
	const blob = path => git(["show"
		, `${inheritedCheckedRecordLaneMemoryImplementation}:${path}`]);
	const helpers = new Map(helperPaths.map(path => [path, sha256(blob(path))]));
	const counts = new Map();
	assert.equal(update.edits.length, 440);
	for(const edit of update.edits)
	{
		const path = helperPinEdit(current, edit, helpers);
		counts.set(path, (counts.get(path) ?? 0) + 1);
	}
	assert.deepEqual([...counts.entries()].sort()
		, [...helpers.keys()].sort().map(path => [path, 44]));
	const [first] = update.edits;
	for(const forged of [{ ...first, previous: first.current }
		, { ...first, current: first.current.replace(/[0-9a-f]{64}/u, "0".repeat(64)) }
		, { ...first, previous: first.previous.replace("sha256", "sha512") }
		, { ...first, start: first.start - 1 }])
		assert.throws(() => helperPinEdit(current, forged, helpers));
});

test("the inherited lane reader authenticates hash-first and keeps no archived bytes", async () => {
	const bytes = new Map([["a/one.json", Buffer.from("one")]
		, ["a/two.bin", Buffer.alloc(4096, 7)]]);
	const reads = [];
	const read = async path => {
		reads.push(path);
		const value = bytes.get(path.slice("lane/".length));
		assert.ok(value, path);
		return Buffer.from(value);
	};
	const files = inheritedCheckedRecordLaneFiles(read, "lane");
	for(const [path, value] of bytes)
		await files.authenticate({ path, bytes: value.length, sha256: sha256(value) });
	assert.deepEqual(reads, ["lane/a/one.json", "lane/a/two.bin"]);
	assert.deepEqual([...files.keys()], ["a/one.json", "a/two.bin"]);
	assert.deepEqual(files.paths("a/t"), ["a/two.bin"]);
	assert.deepEqual(await files.get("a/one.json"), Buffer.from("one"));
	await files.get("a/one.json");
	// Every use re-reads the archive: nothing is served from retained memory.
	assert.equal(reads.length, 4);
	bytes.set("a/one.json", Buffer.from("two"));
	await assert.rejects(files.get("a/one.json"));
	await assert.rejects(files.get("a/missing.json"));
	await assert.rejects(files.authenticate({ path: "a/two.bin", bytes: 1
		, sha256: sha256(bytes.get("a/two.bin")) }));
	await assert.rejects(files.authenticate({ path: "a/two.bin", bytes: 4096
		, sha256: "0".repeat(64) }));
});

test("every inherited lane checker drops its retained whole-lane file Map", () => {
	for(const path of laneCheckers)
	{
		const source = git(["show"
			, `${inheritedCheckedRecordLaneMemoryImplementation}:${path}`]);
		assert.equal(source.split("inheritedCheckedRecordLaneFiles(").length, 2, path);
		assert.equal(source.split("await files.authenticate(entry);").length, 2, path);
		assert.match(source, /const get = files\.get;/u, path);
		assert.doesNotMatch(source, /files\.set\(|files = new Map\(\)|of files\)/u, path);
		const previous = git(["show"
			, `${inheritedCheckedRecordLaneMemoryPredecessor}:${path}`]);
		assert.match(previous, /files\.set\(entry\.path, value\)/u, path);
	}
});

test("inherited checked-record lane memory bound writer refuses another checkout", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-inherited-checked-record-lane-memory-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const environment = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith("GIT_")));
	const localGit = arguments_ => execFileSync("git", arguments_, {
		cwd: root, env: environment, stdio: "pipe"
	});
	localGit(["init", "--quiet"]);
	localGit(["-c", "user.name=Test", "-c", "user.email=test@example.invalid"
		, "-c", "commit.gpgsign=false", "commit", "--allow-empty", "--quiet"
		, "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-inherited-checked-record-lane-memory-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /exact implementation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
