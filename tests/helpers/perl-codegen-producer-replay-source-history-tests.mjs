/**
 * Authenticate the Perl codegen producer replay history: exact transitions, additions,
 * refusal controls and the pin-only refresh of the three edited helpers.
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
	beforePerlCodegenProducerReplaySource
	, perlCodegenProducerReplayAddedPaths
	, perlCodegenProducerReplayChangedPaths
	, perlCodegenProducerReplayCommits
	, perlCodegenProducerReplayHistoryPath
	, perlCodegenProducerReplayImplementation
	, perlCodegenProducerReplayImplementationAddedPaths
	, perlCodegenProducerReplayPredecessor
	, reversePerlCodegenProducerReplayUpdate
} from "./perl-codegen-producer-replay-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const readRecord = async () => JSON.parse(await readFile(
	perlCodegenProducerReplayHistoryPath, "utf8"
));

test("Perl codegen producer replay records exactly its implementation transitions", async () => {
	const record = await readRecord();
	assert.deepEqual(Object.keys(record).sort(), ["additions"
		, "implementationCommit", "implementationCommits", "milestone"
		, "predecessorCommit"
		, "schemaVersion", "scope", "updates"]);
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "perl-codegen-producer-replay-source-v1");
	assert.equal(record.predecessorCommit, perlCodegenProducerReplayPredecessor);
	assert.equal(record.implementationCommit
		, perlCodegenProducerReplayImplementation);
	assert.deepEqual(record.implementationCommits, perlCodegenProducerReplayCommits);
	assert.deepEqual(git(["rev-list", "--reverse"
		, `${perlCodegenProducerReplayPredecessor}..${perlCodegenProducerReplayImplementation}`])
		.trim().split("\n"), perlCodegenProducerReplayCommits);
	assert.deepEqual(git(["diff", "--name-only"
		, perlCodegenProducerReplayPredecessor
		, perlCodegenProducerReplayImplementation])
		.trim().split("\n").filter(Boolean).sort()
	, [...perlCodegenProducerReplayChangedPaths
		, ...perlCodegenProducerReplayImplementationAddedPaths].sort());
	assert.deepEqual(record.updates.map(item => item.path)
		, perlCodegenProducerReplayChangedPaths);
	for(const update of record.updates)
	{
		const previous = git(["show"
			, `${perlCodegenProducerReplayPredecessor}:${update.path}`]);
		const current = git(["show"
			, `${perlCodegenProducerReplayImplementation}:${update.path}`]);
		assert.equal(sha256(previous), update.previousSha256, update.path);
		assert.equal(sha256(current), update.currentSha256, update.path);
		assert.equal(reversePerlCodegenProducerReplayUpdate(current, update)
			, previous, update.path);
		assert.equal(beforePerlCodegenProducerReplaySource(update.path, current)
			, previous, update.path);
		assert.equal(beforePerlCodegenProducerReplaySource(
			update.path, current, update.currentSha256), current, update.path);
	}
});

test("Perl codegen producer replay additions restore exactly", async () => {
	const record = await readRecord();
	assert.deepEqual(record.additions.map(item => item.path)
		, perlCodegenProducerReplayAddedPaths);
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256)), addition.currentSha256, addition.path);
});

test("Perl codegen producer replay rejects altered transitions and unknown content", async () => {
	const record = await readRecord();
	for(const update of record.updates)
	{
		const current = git(["show"
			, `${perlCodegenProducerReplayImplementation}:${update.path}`]);
		for(const changed of [{ ...update, currentSha256: "0".repeat(64) }
			, { ...update, previousSha256: "0".repeat(64) }
			, { ...update, path: "unknown.mjs" }
			, { ...update, edits: [] }
			, { ...update, edits: [...update.edits, update.edits[0]] }])
			assert.throws(() => reversePerlCodegenProducerReplayUpdate(current, changed));
		const shifted = structuredClone(update);
		shifted.edits[0].start += 1;
		assert.throws(() => reversePerlCodegenProducerReplayUpdate(current, shifted));
		const unknown = `${current}unrelated\n`;
		assert.equal(beforePerlCodegenProducerReplaySource(update.path, unknown), unknown);
		assert.throws(() => reversePerlCodegenProducerReplayUpdate(unknown, update));
		assert.equal(beforePerlCodegenProducerReplaySource("docs/unrelated.md", current)
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

test("Perl codegen producer replay refreshes only the edited helper pins to their exact blobs", async () => {
	const update = (await readRecord()).updates.find(item =>
		item.path === "docs/type-surface.v1.json");
	const current = git(["show"
		, `${perlCodegenProducerReplayImplementation}:docs/type-surface.v1.json`]);
	const helperPaths = [
		"tests/helpers/perl-structured-callable-evidence.mjs"
		, "tests/helpers/perl-structured-callable-regression.mjs"
		, "tests/perl-structured-callable-contract.test.mjs"
	];
	const blob = path => git(["show"
		, `${perlCodegenProducerReplayImplementation}:${path}`]);
	const helpers = new Map(helperPaths.map(path => [path, sha256(blob(path))]));
	const counts = new Map();
	assert.equal(update.edits.length, 7);
	for(const edit of update.edits)
	{
		const path = helperPinEdit(current, edit, helpers);
		counts.set(path, (counts.get(path) ?? 0) + 1);
	}
	assert.deepEqual([...counts.entries()].sort()
		, [["tests/helpers/perl-structured-callable-evidence.mjs", 3]
			, ["tests/helpers/perl-structured-callable-regression.mjs", 2]
			, ["tests/perl-structured-callable-contract.test.mjs", 2]]);
	const [first] = update.edits;
	for(const forged of [{ ...first, previous: first.current }
		, { ...first, current: first.current.replace(/[0-9a-f]{64}/u, "0".repeat(64)) }
		, { ...first, previous: first.previous.replace("sha256", "sha512") }
		, { ...first, start: first.start - 1 }])
		assert.throws(() => helperPinEdit(current, forged, helpers));
});

test("Perl codegen producer replay writer refuses another checkout", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-perl-codegen-producer-replay-"));
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
		"scripts/update-perl-codegen-producer-replay-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /exact implementation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
